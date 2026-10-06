import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tomorrowInManila, formatSchedule, formatRichSchedule, splitMessage, postTomorrow } from '../telegram-schedule.mjs';
import { loadSchedule } from '../build.mjs';

const plainRich = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(plainRich).join('') : value?.text ? plainRich(value.text) : '';
const richText = message => message.blocks.map(block=>plainRich(block.text)).join('\n');

test('automatic posts are forbidden outside the 19:00 Philippine minute without touching delivery state', async () => {
  const dir=mkdtempSync(join(tmpdir(),'telegram-window-test-'));
  try {
    for(const iso of ['2026-10-05T10:59:59Z','2026-10-05T11:01:00Z','2026-10-05T13:00:00Z','2026-10-05T21:08:12Z']) {
      let calls=0;
      const statePath=join(dir,'sent.json');
      const result=await postTomorrow({scheduled:true,now:new Date(iso),sendClock:()=>new Date(iso),token:'123:fake_token',chatId:'-1001234',statePath,
        fetchFn:async()=>{calls++;return {ok:true,status:200,json:async()=>({ok:true})};}});
      assert.equal(result.reason,'outside-window');
      assert.equal(calls,0);
      assert.equal(existsSync(statePath),false);
    }
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('automatic posts at 19:00 succeed once; crossing 19:01 before the network call skips delivery', async () => {
  const dir=mkdtempSync(join(tmpdir(),'telegram-window-test-'));
  try {
    let calls=0;
    const now=new Date('2026-10-06T11:00:59Z');
    const options={scheduled:true,now,sendClock:()=>now,token:'123:fake_token',chatId:'-1001234',statePath:join(dir,'sent.json'),
      fetchFn:async()=>{calls++;return {ok:true,status:200,json:async()=>({ok:true})};}};
    assert.equal((await postTomorrow(options)).skipped,false);
    assert.equal((await postTomorrow(options)).skipped,true);
    assert.equal(calls,1);
    const missed=await postTomorrow({...options,statePath:join(dir,'late.json'),sendClock:()=>new Date('2026-10-06T11:01:00Z')});
    assert.equal(missed.reason,'outside-window');
    assert.equal(calls,1);
    assert.equal(existsSync(join(dir,'late.json')),false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('an explicitly requested manual send after 19:00 still posts tomorrow once', async () => {
  const dir=mkdtempSync(join(tmpdir(),'telegram-manual-window-test-'));
  try {
    const calls=[];
    const options={now:new Date('2026-10-06T12:00:00Z'),token:'123:fake_token',chatId:'-1001234',statePath:join(dir,'sent.json'),
      fetchFn:async(url,init)=>{calls.push(JSON.parse(init.body));return {ok:true,status:200,json:async()=>({ok:true})};}};
    assert.equal((await postTomorrow(options)).date,'2026-10-07');
    assert.match(richText(calls[0].rich_message),/Tomorrow’s Schedule/);
    assert.equal((await postTomorrow(options)).skipped,true);
    assert.equal(calls.length,1);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('menus appear at their mess periods with the source notice', () => {
  const data=loadSchedule();
  assert.equal(data.days.filter(day=>day.blocks.filter(block=>block.menu?.length).length===3).length,7);
  assert.deepEqual(data.days[0].blocks.find(block=>block.activity==='Morning Mess').menu,
    ['Pork Tocino','Tomato & Cucumber Salad','Non-Beef tapa','Coffee','Soup']);
  for(const day of data.days) {
    const text=richText(formatRichSchedule(data,day.date));
    for(const block of day.blocks) for(const item of block.menu || []) assert.ok(text.includes(item));
    assert.ok(text.includes(data.menuNotice));
  }
});

test('an explicit manual date posts today without changing the default tomorrow target', async () => {
  const dir=mkdtempSync(join(tmpdir(),'telegram-date-test-'));
  try {
    const calls=[];
    const options={now:new Date('2026-10-05T04:00:00Z'),date:'2026-10-05',token:'123:fake_token',chatId:'-1001234',statePath:join(dir,'manual.json'),
      fetchFn:async(url,init)=>{calls.push(JSON.parse(init.body));return {ok:true,status:200,json:async()=>({ok:true})};}};
    const result=await postTomorrow(options);
    assert.equal(result.date,'2026-10-05');
    assert.match(richText(calls[0].rich_message),/Today’s Schedule/);
    assert.match(calls[0].reply_markup.inline_keyboard[0][0].url,/#day-2026-10-05$/);
    assert.equal((await postTomorrow(options)).skipped,true);
    assert.equal(tomorrowInManila(options.now),'2026-10-06');
    await assert.rejects(postTomorrow({...options,date:'2026-02-30'}),/valid.*date/i);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('tomorrow uses Philippine dates across midnight, month and year boundaries', () => {
  assert.equal(tomorrowInManila(new Date('2026-10-04T13:00:00Z')), '2026-10-05');
  assert.equal(tomorrowInManila(new Date('2026-10-04T16:00:00Z')), '2026-10-06');
  assert.equal(tomorrowInManila(new Date('2026-12-31T13:00:00Z')), '2027-01-01');
});
test('Telegram-directed group migration retries the same post once at the new group ID', async () => {
  const dir=mkdtempSync(join(tmpdir(),'telegram-migration-test-'));
  try {
    const calls=[];
    const options={now:new Date('2026-10-04T13:00:00Z'),token:'123:fake_token',chatId:'-1001234',statePath:join(dir,'sent.json'),
      fetchFn:async(url,init)=>{calls.push(JSON.parse(init.body));return calls.length===1
        ? {ok:false,status:400,json:async()=>({ok:false,description:'Bad Request: group chat was upgraded to a supergroup chat',parameters:{migrate_to_chat_id:-100999999}})}
        : {ok:true,status:200,json:async()=>({ok:true})};}};
    assert.equal((await postTomorrow(options)).skipped,false);
    assert.equal(calls.length,2);
    assert.equal(calls[1].chat_id,'-100999999');
    assert.deepEqual(calls[1].rich_message,calls[0].rich_message);
    assert.equal((await postTomorrow(options)).skipped,true);
    assert.doesNotMatch(readFileSync(options.statePath,'utf8'),/100999999|fake_token/);
  } finally {rmSync(dir,{recursive:true,force:true});}
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
  for(const day of data.days) {
    const plain=richText(formatRichSchedule(data,day.date));
    for(const block of day.blocks) {
      for(const field of ['activity','instructor','venue','uniform','remarks']) {
        if(block[field]) assert.ok(plain.includes(block[field]),`${day.date}: missing ${field}`);
      }
    }
  }
  const missing=richText(formatRichSchedule(data,'2026-10-12'));
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
    const rich=calls[0].body.rich_message;
    assert.ok(rich.blocks.some(block=>block.type==='heading' && block.text==='Tomorrow’s Schedule'));
    const entries=rich.blocks.find(block=>block.type==='paragraph' && Array.isArray(block.text) && block.text[0]?.type==='bold' && block.text[0].text.startsWith('0430'));
    assert.deepEqual(entries.text[0],{type:'bold',text:'0430 – 0530 · Reveille & Physical Conditioning'});
    assert.deepEqual(entries.text[2],{type:'italic',text:'Instructor: NAB Personnel'});
    assert.ok(entries.text.includes('\n\n'),'explicit blank line separates each activity');
    assert.deepEqual(rich.blocks.at(-1),{type:'footer',text:{type:'italic',text:'Training Directorate announcements take precedence.'}});
    assert.equal(calls.at(-1).body.reply_markup.inline_keyboard[0][0].text,'Full Schedule');
    assert.match(calls.at(-1).body.reply_markup.inline_keyboard[0][0].url,/#day-2026-10-05$/);
    assert.equal(calls.at(-1).body.reply_markup.inline_keyboard[0][1].url,'https://atticus-42.github.io/quiz-hub/');
    assert.deepEqual(calls.at(-1).body.reply_markup.inline_keyboard[1],[
      {text:'Training Directorate',url:'https://atticus-42.github.io/quiz-hub/class/#dir-heading'},
    ]);
    assert.equal((await postTomorrow(options)).skipped,true);
    assert.equal(calls.length,result.messages);
    assert.doesNotMatch(readFileSync(statePath,'utf8'),/fake_token|-1001234/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('rich schedule preserves chronological fields as literal text and scopes bold/italic explicitly', async () => {
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
    const rich=calls[0].rich_message;const plain=richText(rich);
    assert.ok(plain.indexOf('Early event')<plain.indexOf('Late <check>'));
    assert.ok(plain.indexOf('Late <check>')<plain.indexOf('Second late event'));
    assert.match(plain,/Instructor: A & B/);assert.match(plain,/Venue: Hall <1>/);
    assert.match(plain,/Uniform: AU/);assert.match(plain,/Bring "notes"/);
    const spans=rich.blocks.find(block=>block.type==='paragraph' && Array.isArray(block.text) && block.text[0]?.text?.startsWith('0430')).text;
    assert.ok(spans.some(span=>span.type==='bold' && span.text==='2130 · Late <check>'));
    assert.ok(spans.some(span=>span.type==='italic' && span.text==='Note: Bring "notes"'));
    assert.ok(spans.some(span=>span.type==='italic' && span.text==='Instructor: A & B'));
    assert.ok(spans.some(span=>span.type==='italic' && span.text==='Venue: Hall <1>'));
    assert.match(plain,/SGOU\n\n2130/);
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
      const text=richText(call.rich_message);assert.ok(text.length<=26000);
      assert.ok(Array.isArray(call.rich_message.blocks));
    }
    const full=calls.map(call=>richText(call.rich_message)).join('\n');
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
    await assert.rejects(postTomorrow({token:'123:fake_token',chatId:'-1001234',statePath:join(dir,'sent.json'),
      fetchFn:async()=>({ok:false,status:400,json:async()=>({ok:false,description:'Bad Request: chat not found 123:fake_token -1001234 https://secret.example'})})}),
      error=>error.message.includes('chat not found') && !/fake_token|1001234|secret.example/.test(error.message));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
