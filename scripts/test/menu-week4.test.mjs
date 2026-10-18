import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatSchedule } from '../telegram-schedule.mjs';
const current=JSON.parse(readFileSync(new URL('../../data/schedules/2026-10-12_2026-10-18.json',import.meta.url)));
test('archived week 4 retains all 21 meals',()=>{
  assert.equal(current.days.flatMap(d=>d.blocks.filter(b=>Array.isArray(b.menu)&&b.menu.length)).length,21);
  const monday=current.days[0];
  assert.deepEqual(monday.blocks.find(b=>b.activity==='Morning Mess').menu,['Daing na bangus','Sarciadong itlog','Non- Fried Pork','Soup','Coffee']);
  assert.deepEqual(monday.blocks.find(b=>b.activity==='Noon Mess').menu,['Chicken inasal','Pickled cucumber and carrots','Non- Pork liempo','Sinigang soup','Buko pandan','Juice']);
  assert.deepEqual(monday.blocks.find(b=>b.activity==='Evening Mess').menu,['Beef Caldereta','Garlic baguio beans w/ carrots','Non - Pork caldereta','Chocolate bar']);
});
test('October 12 uniforms changed only SGOU, and Telegram includes all meals',()=>{
  const monday=current.days[0];
  assert.equal(monday.blocks.filter(b=>b.uniform==='PHILARPAT').length,5);
  assert.equal(monday.blocks.some(b=>b.uniform==='SGOU'),false);
  assert.equal(monday.blocks.find(b=>b.activity==='Reveille & Physical Conditioning').uniform,'AU');
  const text=formatSchedule(current,'2026-10-12');
  for(const item of ['Daing na bangus','Chicken inasal','Beef Caldereta']) assert.ok(text.includes(item));
});
