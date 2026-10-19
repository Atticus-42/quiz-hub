import test from 'node:test';
import assert from 'node:assert/strict';
import { sendApprovedPair, dueWindow } from '../approved-patch.mjs';
const payload={targetAt:'2026-10-19T23:00:00.000Z',caption:'exact <b>caption</b>',text:'exact\n<blockquote>text</blockquote>',imageName:'image.png',imageBase64:Buffer.from('image bytes').toString('base64')};
const at=new Date(payload.targetAt);
const ok=id=>({ok:true,json:async()=>({ok:true,result:{message_id:id}})});
test('exactly one photo then one reply preserve approved bytes and HTML',async()=>{
  const calls=[];const ids=await sendApprovedPair(payload,{token:'test-token',chatId:'-1001',now:()=>at,fetch:async(url,init)=>{calls.push({url,body:init.body});return ok(calls.length===1?101:102);}});
  assert.deepEqual(ids,{photoMessageId:101,textMessageId:102});assert.equal(calls.length,2);
  assert.ok(calls[0].url.endsWith('/sendPhoto'));assert.equal(calls[0].body.get('caption'),payload.caption);assert.equal(calls[0].body.get('parse_mode'),'HTML');
  assert.equal(Buffer.from(await calls[0].body.get('photo').arrayBuffer()).toString(),'image bytes');
  const reply=JSON.parse(calls[1].body);assert.ok(calls[1].url.endsWith('/sendMessage'));assert.equal(reply.text,payload.text);assert.equal(reply.parse_mode,'HTML');assert.equal(reply.disable_web_page_preview,true);assert.equal(reply.reply_to_message_id,101);assert.equal(reply.reply_parameters.message_id,101);assert.equal(reply.reply_parameters.allow_sending_without_reply,false);
});
for(const failAt of [1,2])test(`failure at message ${failAt} never retries or continues`,async()=>{
  let count=0;await assert.rejects(sendApprovedPair(payload,{token:'test-token',chatId:'-1001',now:()=>at,fetch:async()=>{count++;return count===failAt?{ok:false,json:async()=>({ok:false,error_code:400,description:'test-token forbidden'})}:ok(101);}}),e=>!e.message.includes('test-token'));
  assert.equal(count,failAt);
});
test('ambiguous photo timeout stops without retry',async()=>{
  let count=0;await assert.rejects(sendApprovedPair(payload,{token:'test-token',chatId:'-1001',now:()=>at,fetch:async()=>{count++;throw new Error('URL with test-token');}}),e=>!e.message.includes('test-token'));
  assert.equal(count,1);
});
test('no sends before or after the approved minute, or with missing credentials',async()=>{
  for(const time of ['2026-10-19T22:59:59Z','2026-10-19T23:01:00Z'])await assert.rejects(sendApprovedPair(payload,{token:'x',chatId:'y',now:()=>new Date(time),fetch:()=>{assert.fail('must not call Telegram');}}));
  await assert.rejects(sendApprovedPair(payload,{token:'',chatId:'y',now:()=>at,fetch:()=>{assert.fail('missing credentials');}}));
  assert.equal(dueWindow(payload,new Date('2026-10-19T22:45:00Z')),true);
  assert.equal(dueWindow(payload,new Date('2026-10-20T22:45:00Z')),false);
});

test('new explicit send-now approval permits immediate delivery outside original minute',async()=>{
  let count=0;
  const result=await sendApprovedPair(payload,{token:'test-token',chatId:'-1001',approvedNow:true,now:()=>new Date('2026-10-19T22:00:00Z'),fetch:async()=>ok(++count)});
  assert.deepEqual(result,{photoMessageId:1,textMessageId:2});assert.equal(count,2);
});
