// One approved campaign. No message retries; credentials never enter output.
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {createDecipheriv,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const PACKET=new URL('../.github/approved-patch-20261020.enc.json',import.meta.url);
export function dueWindow(p,now=new Date()) {
  const delta=now.getTime()-Date.parse(p.targetAt);
  return Number.isFinite(delta)&&delta>=-20*60000&&delta<60000;
}
async function request(method,body,{token,fetch=globalThis.fetch}) {
  let response,data;
  try {response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',body,headers:typeof body==='string'?{'Content-Type':'application/json'}:undefined,signal:AbortSignal.timeout(30000)});data=await response.json();}
  catch {throw new Error(`${method}: delivery/connection status unknown; no retry.`);}
  if(!response.ok||!data.ok) {
    const error=new Error(`${method}: Telegram ${data.error_code||'error'}: ${String(data.description||'request rejected').replaceAll(token,'[REDACTED]')}`);
    error.migration=data.parameters?.migrate_to_chat_id;throw error;
  }
  return data.result;
}
export async function sendApprovedPair(p,{token,chatId,approvedNow=false,fetch=globalThis.fetch,now=()=>new Date(),onReceipt=()=>{}}={}) {
  if(!token||!chatId)throw new Error('Missing Telegram credentials; nothing sent.');
  const delta=now().getTime()-Date.parse(p.targetAt);
  if(approvedNow!==true&&(!Number.isFinite(delta)||delta<0||delta>=60000))throw new Error('Outside the approved 0700H minute; nothing sent.');
  const receipt={photoMessageId:null,textMessageId:null};
  const form=new FormData();form.set('chat_id',chatId);form.set('parse_mode','HTML');form.set('caption',p.caption);
  form.set('photo',new Blob([Buffer.from(p.imageBase64,'base64')],{type:'image/png'}),p.imageName);
  const photo=await request('sendPhoto',form,{token,fetch});
  if(!Number.isSafeInteger(photo.message_id))throw new Error('Photo response has no message ID; stop without retry.');
  receipt.photoMessageId=photo.message_id;onReceipt({...receipt});
  const text=await request('sendMessage',JSON.stringify({chat_id:chatId,text:p.text,parse_mode:'HTML',disable_web_page_preview:true,link_preview_options:{is_disabled:true},reply_to_message_id:photo.message_id,reply_parameters:{message_id:photo.message_id,allow_sending_without_reply:false}}),{token,fetch});
  if(!Number.isSafeInteger(text.message_id))throw new Error('Text response has no message ID; stop without retry.');
  receipt.textMessageId=text.message_id;onReceipt({...receipt});return receipt;
}
function loadPacket() {
  const key=Buffer.from(process.env.PATCH_POST_KEY||'','base64');
  if(key.length!==32)throw new Error('Missing campaign decryption secret; nothing sent.');
  const packet=JSON.parse(readFileSync(PACKET,'utf8'));
  const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(packet.iv,'base64'));cipher.setAuthTag(Buffer.from(packet.tag,'base64'));
  const p=JSON.parse(Buffer.concat([cipher.update(Buffer.from(packet.data,'base64')),cipher.final()]).toString('utf8'));
  const image=Buffer.from(p.imageBase64,'base64');
  if(image.length!==629955||createHash('sha256').update(image).digest('hex')!=='0cd2d4ed4e2e54e801dddfcb49dbd398a2e873243546c54fab187b5455047ce9')throw new Error('Approved image mismatch; nothing sent.');
  if(p.targetAt!=='2026-10-19T23:00:00.000Z'||p.caption!=='🎖 <b>BANDWIDTH BROTHERS: RUBBERIZED VELCRO PATCH</b> 🎖'||typeof p.text!=='string'||p.text.length>4096)throw new Error('Approved campaign validation failed; nothing sent.');
  if(createHash('sha256').update(p.text).digest('hex')!=='ce495c9ca41e9cb9b9fc5093617cd302caf84aa4bb9134b9736711851a3b1019')throw new Error('Approved text mismatch; nothing sent.');
  return p;
}
async function verifyDestination(p) {
  const token=process.env.TELEGRAM_BOT_TOKEN,secretChat=process.env.TELEGRAM_CHAT_ID;
  if(!token||!secretChat)throw new Error('Missing Telegram credentials; nothing sent.');
  const api=(method,body)=>request(method,JSON.stringify(body),{token});
  const me=await api('getMe',{});if(String(me.id)!==p.botId)throw new Error('Bot identity mismatch; nothing sent.');
  let chatId=secretChat;
  for(let check=0;check<2;check++)try {
    const chat=await api('getChat',{chat_id:chatId});
    if(!['group','supergroup'].includes(chat.type)||chat.title?.toUpperCase().replace(/[–—]/g,'-').replace(/\s+/g,' ').trim()!==p.chatTitle)throw new Error('Class group identity mismatch; nothing sent.');
    const member=await api('getChatMember',{chat_id:chatId,user_id:me.id});
    if(['left','kicked'].includes(member.status)||member.can_send_messages===false||member.can_send_photos===false)throw new Error('Bot cannot post to the class group; nothing sent.');
    return {token,chatId:String(chat.id)};
  } catch(error) {if(check===0&&error.migration){chatId=String(error.migration);continue;}throw error;}
  throw new Error('Unable to resolve the class group; nothing sent.');
}
async function main() {
  let receipt={photoMessageId:null,textMessageId:null};
  const record=(status,error)=>{
    const result={status,...receipt,...(error?{error}:{}),time:new Date().toISOString()};
    writeFileSync('patch-receipt.json',JSON.stringify(result,null,2));
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\n${JSON.stringify(result)}\n`);
    console.log(JSON.stringify(result));
  };
  try {
    const p=loadPacket();
    const approvedNow=process.env.PATCH_SEND_NOW==='true'&&process.env.GITHUB_EVENT_NAME==='workflow_dispatch';
    if(process.argv.includes('--plan')) {const eligible=(approvedNow||dueWindow(p))&&process.env.GITHUB_RUN_ATTEMPT==='1';if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`due=${eligible}\n`);console.log(eligible?'Approved send window.':'Outside approved date window; nothing sent.');return;}
    if(process.argv.includes('--preflight')) {await verifyDestination(p);console.log('Verified approved bot and class group; no messages sent.');return;}
    if(process.argv.includes('--wait')) {const ms=Date.parse(p.targetAt)-Date.now();if(ms<=-60000||ms>20*60000)throw new Error('Cannot wait outside approved start window.');if(ms>0)await new Promise(r=>setTimeout(r,ms));return;}
    if(!process.argv.includes('--send')||process.env.GITHUB_RUN_ATTEMPT!=='1'||process.env.PATCH_CLAIM_SAVED!=='true')throw new Error('Unarmed or repeated execution; nothing sent.');
    const credentials=await verifyDestination(p);
    receipt=await sendApprovedPair(p,{...credentials,approvedNow,onReceipt:r=>{receipt=r;record('partial');}});record('sent');
  } catch(error) {record('stopped',error.message);process.exitCode=1;}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
