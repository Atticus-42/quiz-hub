import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
for (const name of ['leadership-planning','signal-c2','cyber-signalplanning']) {
 const data = JSON.parse(readFileSync(new URL('../../data/reviewers/'+name+'.json',import.meta.url)));
 for (const [key,item] of Object.entries(data)) test(key+' supports objective and analytical study with source links',()=>{
  const guide=item.examGuide;
  assert.ok(guide.topics.length>=4);
  assert.ok(guide.practice.some(q=>q.type==='objective'));
  assert.ok(guide.practice.some(q=>q.type==='analytical'));
  for(const entry of [...guide.topics,...guide.practice]) assert.ok(entry.pages.length && entry.pages.every(p=>Number.isInteger(p)&&p>0));
  const html=readFileSync(new URL('../../reviewer/'+key+'/index.html',import.meta.url),'utf8');
  for(const section of ['detailed-review','exam-practice','exam-checklist']) assert.ok(html.includes('id="'+section+'"'));
  assert.ok(html.includes('Supplementary manuals provide context'));
 });
}
