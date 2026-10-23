import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSchedule,ROOT,build} from '../build.mjs';
import {formatRichSchedule} from '../telegram-schedule.mjs';
import {join} from 'node:path';

test('week 6 photo transcription and bot feed preserve the active week and upcoming dates',()=>{
  const current=loadSchedule(),feed=loadSchedule(ROOT,undefined,{allDays:true});
  const next=loadSchedule(ROOT,join(ROOT,'data/schedules/2026-10-26_2026-11-01.json'));
  assert.equal(current.week.start,'2026-10-19');assert.equal(current.days.length,7);
  assert.equal(feed.days.length,14);assert.deepEqual(feed.days.slice(7),next.days);
  assert.deepEqual(next.week,{number:6,of:12,start:'2026-10-26',end:'2026-11-01'});
  assert.deepEqual(next.days.map(d=>d.blocks.length),[15,16,15,10,8,13,13]);
  assert.equal(next.days.flatMap(d=>d.blocks).filter(b=>b.menu).length,0);
  assert.equal(next.days[1].blocks.find(b=>b.kind==='exam').activity,'MODULE 5 ASSESSMENT');
  assert.equal(next.days[3].blocks.find(b=>b.kind==='exam').activity,'MODULE 7 ASSESSMENT');
  assert.equal(next.days[1].blocks.find(b=>b.activity==='Study Period').time,'2100-2130');
  assert.equal(next.days[0].blocks.find(b=>b.activity==='Noon Mess').venue,'SGOU');
  for(const d of next.days.slice(4,6))assert.equal(d.blocks.find(b=>b.activity==='TATTOO').time,'');
  for(const day of next.days)assert.ok(!JSON.stringify(formatRichSchedule(feed,day.date)).includes('has not been uploaded'));
  const pages=build({write:false});
  assert.ok(pages['schedule/index.html'].includes('day-2026-10-19'));
  assert.ok(pages['schedule/index.html'].includes('schedule-2026-10-26'));
  assert.ok(pages['schedule-2026-10-26/index.html'].includes('MODULE 7 ASSESSMENT'));
});
