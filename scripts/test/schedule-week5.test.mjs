import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSchedule } from '../build.mjs';
import { formatRichSchedule } from '../telegram-schedule.mjs';
import { readFileSync } from 'node:fs';
test('October 22 classes use PHILARPAT only in SNCOAC ROOM 306',()=>{
  const data=loadSchedule();
  const archive=JSON.parse(readFileSync(new URL('../../data/schedules/2026-10-19_2026-10-25.json',import.meta.url),'utf8'));
  const day=data.days.find(d=>d.date==='2026-10-22');
  assert.deepEqual(day,archive.days.find(d=>d.date===day.date));
  const classes=day.blocks.filter(b=>['lecture','exam'].includes(b.kind));
  assert.equal(classes.length,2);
  for(const block of classes){assert.equal(block.uniform,'PHILARPAT');assert.equal(block.venue,'SNCOAC ROOM 306');}
  assert.match(classes[0].remarks,/PHILARPAT only/);
  assert.equal(day.blocks[0].uniform,'AU');
  const rich=JSON.stringify(formatRichSchedule(data,day.date));
  assert.ok(rich.includes('PHILARPAT'));assert.ok(!rich.includes('SGOU'));
});
test('NIST exam occurs only on Friday with time and venue unconfirmed',()=>{
  const data=loadSchedule();
  const exams=data.days.flatMap(day=>day.blocks.filter(b=>b.kind==='exam'&&b.activity.includes('NIST FRAMEWORK')).map(block=>({date:day.date,block})));
  assert.equal(exams.length,1);assert.equal(exams[0].date,'2026-10-23');
  assert.equal(exams[0].block.time,'');assert.equal(exams[0].block.venue,null);assert.match(exams[0].block.activity,/TBAL/);
  const archive=JSON.parse(readFileSync(new URL('../../data/schedules/2026-10-19_2026-10-25.json',import.meta.url),'utf8'));
  assert.deepEqual(data.days,archive.days);
  assert.ok(!JSON.stringify(formatRichSchedule(data,'2026-10-22')).includes('NIST FRAMEWORK'));
  assert.ok(JSON.stringify(formatRichSchedule(data,'2026-10-23')).includes('NIST FRAMEWORK (TBAL)'));
});
test('active feed uses October 19–25 with all 21 uploaded menus',()=>{
  const data=loadSchedule();
  assert.equal(data.week.start,'2026-10-19');
  assert.equal(data.week.end,'2026-10-25');assert.equal(data.week.number,5);
  assert.equal(data.prepared,'2026-10-14');
  assert.deepEqual(data.days.map(d=>d.blocks.length),[16,17,17,11,11,13,13]);
  assert.equal(data.days.flatMap(d=>d.blocks).filter(b=>b.menu).length,21);
  assert.match(data.menuNotice,/PAALALA/);
  assert.deepEqual(data.days[0].blocks.find(b=>b.activity==='Morning Mess').menu,['Hungarian Sausage','Boiled Egg','Non - Beef Hungarian','Soup','Coffee']);
  assert.deepEqual(data.days[6].blocks.find(b=>b.activity==='Evening Mess').menu,['Chicken mushroom','Stirfry broccoli','Non- Pork mushroom','Saging lakatan']);
  for(const day of data.days.slice(3,5))for(const meal of ['Morning Mess','Evening Mess']){
    const block=day.blocks.find(b=>b.activity===meal);
    assert.equal(block.time,'');assert.equal(block.venue,null);
    assert.match(block.remarks,/time not printed/i);
  }
});
test('Monday resend preserves all activities and printed uniforms',async()=>{
  const data=loadSchedule();assert.equal(data.week.start,'2026-10-19');
  const monday=data.days[0];assert.equal(monday.blocks[4].activity,'LOE3 GSOMIA');
  assert.equal(monday.blocks[7].activity,'C4ISTAR Sensor Integration Assessment');
  assert.equal(monday.blocks[2].uniform,'SGOU');
  assert.equal(monday.blocks[5].uniform,'AU');assert.equal(monday.blocks[5].venue,'SGOU');
  assert.match(monday.blocks[5].remarks,/printed as SGOU/);
  const rich=JSON.stringify(formatRichSchedule(data,'2026-10-19'));
  for(const block of monday.blocks)assert.ok(rich.includes(block.activity));
  assert.equal(rich.includes('has not been uploaded'),false);
});
