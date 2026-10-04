import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tomorrowInManila, formatSchedule, splitMessage, postTomorrow } from '../telegram-schedule.mjs';
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
test('successful posts use the group, optional topic and private credentials; repeat runs are skipped', async () => {
  const dir=mkdtempSync(join(tmpdir(),'telegram-test-'));const statePath=join(dir,'sent.json');
  try {
    const calls=[]; const options={now:new Date('2026-10-04T13:00:00Z'),token:'123:fake_token',chatId:'-1001234',topicId:'7',statePath,
      fetchFn:async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return {ok:true,status:200,json:async()=>({ok:true})};}};
    const result=await postTomorrow(options);assert.equal(result.skipped,false);
    assert.equal(calls[0].body.chat_id,'-1001234');assert.equal(calls[0].body.message_thread_id,7);
    assert.equal(calls[0].body.link_preview_options.is_disabled,true);
    assert.equal((await postTomorrow(options)).skipped,true);
    assert.equal(calls.length,result.messages);
    assert.doesNotMatch(readFileSync(statePath,'utf8'),/fake_token|-1001234/);
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
