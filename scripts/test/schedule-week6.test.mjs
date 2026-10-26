import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSchedule,ROOT,build} from '../build.mjs';
import {formatRichSchedule} from '../telegram-schedule.mjs';
import {join} from 'node:path';

test('revised week 6 is active, with all supplied meals and corrected assessment dates',()=>{
 const current=loadSchedule(),feed=loadSchedule(ROOT,undefined,{allDays:true});
 const archive=loadSchedule(ROOT,join(ROOT,'data/schedules/2026-10-26_2026-11-01.json'));
 assert.deepEqual(current,archive);
 assert.equal(current.week.start,'2026-10-26');
 assert.equal(current.days.flatMap(d=>d.blocks).filter(b=>b.menu).length,21);
 const exams=current.days.flatMap(d=>d.blocks.filter(b=>b.kind==='exam').map(b=>[d.date,b.activity]));
 assert.deepEqual(exams,[['2026-10-28','MODULE 5 ASSESSMENT'],['2026-10-30','MODULE 7 ASSESSMENT']]);
 assert.equal(current.days[0].blocks.find(b=>b.kind==='lecture').activity,'GPE WINTAK/Signal Propagation');
 assert.equal(current.days[1].blocks.find(b=>b.kind==='lecture').activity,'Info drive PMC');
 assert.deepEqual(current.days[1].blocks.find(b=>b.activity==='Noon Mess').menu,
  ['Beef kare-kare','Stirfry vegetable w/ chili flakes and slice meat','Non- pork kare-kare','Beef soup','Orange','Juice']);
 for(const day of current.days){const rich=JSON.stringify(formatRichSchedule(feed,day.date));for(const b of day.blocks.filter(b=>b.menu))for(const food of b.menu)assert.ok(rich.includes(food));}
 const pages=build({write:false});
 assert.ok(pages['schedule/index.html'].includes('day-2026-10-27'));
 assert.ok(pages['schedule-2026-10-26/index.html'].includes('Beef kare-kare'));
});

test('November screenshot is separate and explicitly partial, with no invented weekend or cropped entries',()=>{
 const partial=loadSchedule(ROOT,join(ROOT,'data/schedules/2026-11-02_2026-11-06.json'));
 assert.match(partial.notice,/partial/i);assert.equal(partial.days.length,5);
 assert.equal(partial.days[0].blocks[0].time,'0830-1100');
 assert.equal(partial.days[4].blocks.at(-1).activity,'Evening Formation');
 assert.equal(partial.days[4].blocks.at(-1).time,'2100-2130');
 assert.equal(partial.days[4].blocks.at(-1).instructor,'Not stated');
 assert.equal(partial.days[4].blocks.at(-1).venue,null);
 assert.ok(partial.days.every(d=>d.blocks[0].remarks.includes('Partial')));
 const feed=loadSchedule(ROOT,undefined,{allDays:true});assert.equal(feed.days.length,12);
 assert.equal(feed.days.at(-1).date,'2026-11-06');
 const pages=build({write:false});assert.match(pages['schedule-2026-11-02/index.html'],/Partial schedule/);
 assert.ok(!pages['schedule-2026-11-02/index.html'].includes('day-2026-11-07'));
});
