import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSchedule } from '../build.mjs';
import { formatRichSchedule } from '../telegram-schedule.mjs';
test('active feed uses October 19–25 without stale menus',()=>{
  const data=loadSchedule();
  assert.equal(data.week.start,'2026-10-19');
  assert.equal(data.week.end,'2026-10-25');assert.equal(data.week.number,5);
  assert.equal(data.prepared,'2026-10-14');
  assert.deepEqual(data.days.map(d=>d.blocks.length),[16,17,17,10,8,13,13]);
  assert.equal(data.days.flatMap(d=>d.blocks).some(b=>b.menu),false);
  assert.equal(data.menuNotice,undefined);
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
