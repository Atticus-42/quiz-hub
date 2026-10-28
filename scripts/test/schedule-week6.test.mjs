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

test('complete week 7 replaces the partial screenshot with all 77 supplied source rows',()=>{
 const week=loadSchedule(ROOT,join(ROOT,'data/schedules/2026-11-02_2026-11-08.json'));
 assert.equal(week.notice,undefined);assert.equal(week.prepared,'2026-10-28');
 assert.deepEqual(week.days.map(d=>d.blocks.length),[1,15,16,10,9,13,13]);
 assert.deepEqual(week.days[0].blocks,[{time:'',activity:'Admin Break',kind:'routine',instructor:'Not stated',venue:null,remarks:'Time not printed in the source schedule.'}]);
 const exam=week.days[4].blocks.find(b=>b.kind==='exam');
 assert.equal(exam.activity,'MODULE 6 ASSESSMENT');assert.equal(exam.time,'0800-0900');
 assert.equal(week.days[2].blocks.find(b=>b.activity==='TLP').time,'0830-1130');
 assert.equal(week.days[4].blocks.find(b=>b.activity==='MDMP').time,'0900-1130');
 assert.equal(week.days[4].blocks.find(b=>b.activity==='TATTOO').time,'');
 assert.equal(week.days[1].blocks.find(b=>b.activity==='TATTOO').time,'2100-2130');
 assert.match(week.days[1].blocks.find(b=>b.activity==='TATTOO').remarks,/overlaps/);
 const pages=build({write:false}),html=pages['schedule-2026-11-02/index.html'];
 assert.doesNotMatch(html,/Partial schedule/);assert.ok(html.includes('day-2026-11-08'));
 assert.ok(!html.includes('CEOI/CESI Management'));
});

test('week 8 includes all 89 rows and both future weeks reach the bot feed without old menus',()=>{
 const week=loadSchedule(ROOT,join(ROOT,'data/schedules/2026-11-09_2026-11-15.json'));
 assert.equal(week.week.number,8);assert.equal(week.prepared,'2026-11-04');
 assert.deepEqual(week.days.map(d=>d.blocks.length),[15,15,15,10,8,13,13]);
 const exam=week.days[3].blocks.find(b=>b.kind==='exam');
 assert.equal(exam.activity,'MODULE 8 ASSESSMENT');assert.equal(exam.time,'0800-0900');
 assert.equal(exam.uniform,'PHILARPAT');assert.equal(exam.venue,'Mabini Hall');
 const monday=week.days[0].blocks.find(b=>b.kind==='lecture');
 assert.equal(monday.activity,'Cont’n MDMP');assert.equal(monday.instructor,'MAJ PEREZ / MAJ PANDI');assert.equal(monday.uniform,'SGOU');
 const feed=loadSchedule(ROOT,undefined,{allDays:true});assert.equal(feed.days.length,21);assert.equal(feed.week.end,'2026-11-15');
 assert.deepEqual(feed.days.slice(7,14),loadSchedule(ROOT,join(ROOT,'data/schedules/2026-11-02_2026-11-08.json')).days);
 assert.deepEqual(feed.days.slice(14),week.days);
 assert.equal(feed.days.slice(7).flatMap(d=>d.blocks).filter(b=>b.menu).length,0);
 for(const day of feed.days.slice(7)){const rich=JSON.stringify(formatRichSchedule(feed,day.date));assert.doesNotMatch(rich,/not been uploaded/);for(const b of day.blocks)assert.ok(rich.includes(b.activity));}
 const pages=build({write:false});assert.ok(pages['schedule-2026-11-09/index.html'].includes('day-2026-11-15'));
 assert.ok(pages['schedule/index.html'].includes('../schedule-2026-11-09/'));
});
