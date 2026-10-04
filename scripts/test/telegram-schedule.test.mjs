import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tomorrowInManila, formatSchedule, formatRichSchedule, splitMessage, postTomorrow } from '../telegram-schedule.mjs';
import { loadSchedule } from '../build.mjs';

test('tomorrow uses Philippine dates across midnight, month and year boundaries', () => {
  assert.equal(tomorrowInManila(new Date('2026-10-04T13:00:00Z')), '2026-10-05');
  assert.equal(tomorrowInManila(new Date('2026-10-04T16:00:00Z')), '2026-10-06');
  assert.equal(tomorrowInManila(new Date('2026-12-31T13:00:00Z')), '2027-01-01');
});
test('every tomorrow block is included, and missing dates are never replaced with another week', () => {
  const data = loadSchedule(); const text = formatSchedule(data,'2026-10-05');
  for (const block of data.days[0].blocks) {
    assert.ok(text.includes(block.activity));assert.ok(text.includes(block.instructor));
    if(block.venue) assert.ok(text.includes(block.venue));
    if(block.uniform) assert.ok(text.includes(block.uniform));
  }
  assert.match(text, /#day-2026-10-05/);
  const missing = formatSchedule(data,'2026-10-12');
  assert.match(missing,/has not been uploaded/);assert.doesNotMatch(missing,/Reveille/);
  assert.ok(splitMessage(text).every(chunk=>chunk.length<=3900));
  assert.ok(splitMessage('x'.repeat(8200)).every(chunk=>chunk.length<=3900));
});
test('rich rendering retains every field for the entire week and handles missing dates explicitly', () => {
  const data=loadSchedule();
  const decode=text=>text.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  for(const day of data.days) {
    const html=formatRichSchedule(data,day.date);const plain=decode(html);
    for(const block of day.blocks) {
      for(const field of ['activity','instructor','venue','uniform','remarks']) {
        if(block[field]) assert.ok(plain.includes(block[field]),`${day.date}: missing ${field}`);
      }
    }
  }
  const missing=formatRichSchedule(data,'2026-10-12');
  assert.match(missing,/has not been uploaded/);assert.doesNotMatch(missing,/Reveille/);
});
test('successful posts use the group, optional topic and private credentials; repeat runs are skipped', async () => {
  const dir=mkdtempSync(join(tmpdir(),'telegram-test-'));const statePath=join(dir,'sent.json');
  try {
    const calls=[]; const options={now:new Date('2026-10-04T13:00:00Z'),token:'123:fake_token',chatId:'-1001234',topicId:'7',statePath,
      fetchFn:async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return {ok:true,status:200,json:async()=>({ok:true})};}};
    const result=await postTomorrow(options);assert.equal(result.skipped,false);
    assert.equal(calls[0].body.chat_id,'-1001234');assert.equal(calls[0].body.message_thread_id,7);
    assert.match(calls[0].url,/\/sendRichMessage$/);
    assert.match(calls[0].body.rich_message.html,/<h2>Tomorrow/);
    assert.match(calls[0].body.rich_message.html,/<b>0430–0530 · Reveille &amp; Physical Conditioning<\/b>/);
    assert.match(calls[0].body.rich_message.html,/<footer><i>Training Directorate/);
    assert.equal(calls.at(-1).body.reply_markup.inline_keyboard[0][0].text,'Full Schedule');
    assert.match(calls.at(-1).body.reply_markup.inline_keyboard[0][0].url,/#day-2026-10-05$/);
    assert.equal(calls.at(-1).body.reply_markup.inline_keyboard[0][1].url,'https://atticus-42.github.io/quiz-hub/');
    assert.equal((await postTomorrow(options)).skipped,true);
    assert.equal(calls.length,result.messages);
    assert.doesNotMatch(readFileSync(statePath,'utf8'),/fake_token|-1001234/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('rich schedule preserves all fields chronologically and escapes source HTML', async () => {
  const dir=mkdtempSync(join(tmpdir(),'telegram-test-'));
  try {
    const calls=[];
    const blocks=[
      {time:'2130',activity:'Late <check>',instructor:'A & B',venue:'Hall <1>',uniform:'AU',remarks:'Bring "notes"'},
      {time:'0430-0530',activity:'Early event',instructor:'First instructor',venue:'Ground',uniform:'SGOU'},
      {time:'2130',activity:'Second late event',instructor:'Second instructor',venue:'',uniform:'AU'},
    ];
    await postTomorrow({now:new Date('2026-10-04T13:00:00Z'),data:{days:[{date:'2026-10-05',day:'Monday',blocks}]},
      token:'123:fake_token',chatId:'-1001234',statePath:join(dir,'sent.json'),
      fetchFn:async(url,init)=>{calls.push(JSON.parse(init.body));return {ok:true,status:200,json:async()=>({ok:true})};}});
    const html=calls[0].rich_message.html;
    assert.ok(html.indexOf('Early event')<html.indexOf('Late &lt;check&gt;'));
    assert.ok(html.indexOf('Late &lt;check&gt;')<html.indexOf('Second late event'));
    assert.match(html,/Instructor: A &amp; B/);assert.match(html,/Venue: Hall &lt;1&gt;/);
    assert.match(html,/Uniform: <b>AU<\/b>/);assert.match(html,/Bring &quot;notes&quot;/);
    assert.doesNotMatch(html,/<details|<tg-spoiler|<check>/);
    assert.equal(blocks[0].activity,'Late <check>');
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('long rich schedules split only between complete entries without losing activities', async () => {
  const dir=mkdtempSync(join(tmpdir(),'telegram-test-'));
  try {
    const calls=[];const blocks=Array.from({length:150},(_,i)=>({time:'0800-0900',activity:`Activity ${i}: ${'x'.repeat(250)}`,instructor:'Instructor',venue:'Hall',uniform:'AU'}));
    await postTomorrow({now:new Date('2026-10-04T13:00:00Z'),data:{days:[{date:'2026-10-05',day:'Monday',blocks}]},
      token:'123:fake_token',chatId:'-1001234',statePath:join(dir,'sent.json'),
      fetchFn:async(url,init)=>{calls.push(JSON.parse(init.body));return {ok:true,status:200,json:async()=>({ok:true})};}});
    assert.ok(calls.length>1);
    for(const call of calls) {
      const html=call.rich_message.html;assert.ok(html.length<=26000);
      assert.equal((html.match(/<p>/g)||[]).length,(html.match(/<\/p>/g)||[]).length);
      assert.equal((html.match(/<b>/g)||[]).length,(html.match(/<\/b>/g)||[]).length);
    }
    const full=calls.map(call=>call.rich_message.html).join('\n');
    for(let i=0;i<150;i++) assert.equal(full.split(`Activity ${i}:`).length-1,1);
    assert.equal(calls[0].reply_markup,undefined);assert.ok(calls.at(-1).reply_markup);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('missing credentials and failed Telegram posts fail without leaking the token or saving success', async () => {
  await assert.rejects(postTomorrow({token:'',chatId:''}),/Configure/);
  const dir=mkdtempSync(join(tmpdir(),'telegram-test-'));
  try {
    await assert.rejects(postTomorrow({token:'123:fake_token',chatId:'-1001234',statePath:join(dir,'sent.json'),
      fetchFn:async()=>{throw Error('https://api.telegram.org/bot123:fake_token/sendMessage');}}),error=>!error.message.includes('fake_token'));
    await assert.rejects(postTomorrow({token:'123:fake_token',chatId:'-1001234',statePath:join(dir,'sent.json'),
      fetchFn:async()=>({ok:false,status:403,json:async()=>({ok:false})})}),/rejected/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
