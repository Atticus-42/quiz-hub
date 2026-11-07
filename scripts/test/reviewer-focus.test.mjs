import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const root=new URL('../../',import.meta.url);
for(const file of readdirSync(new URL('data/reviewer-focus/',root))){
 const focus=JSON.parse(readFileSync(new URL('data/reviewer-focus/'+file,root)));
 const original=JSON.parse(readFileSync(new URL('data/reviewers/'+file,root)));
 test(file+' covers every lesson with objective and analytical recall',()=>assert.deepEqual(Object.keys(focus).sort(),Object.keys(original).sort()));
 for(const [key,item] of Object.entries(focus))test(key+' has sourced, complete exam-review content',()=>{
  assert(item.takeaway&&item.memoryCue&&item.lastCheck.length>=3);
  assert(item.keyPoints.length>=4&&item.distinctions.length>=2);
  assert(item.examAngles.some(q=>q.type==='Objective')&&item.examAngles.some(q=>q.type==='Analytical'));
  const pages=new Set([...original[key].examGuide.topics,...original[key].examGuide.practice].flatMap(t=>t.pages));
  for(const entry of [...item.keyPoints,...item.distinctions,...item.examAngles])assert(entry.pages.length&&entry.pages.every(p=>pages.has(p)),'source page outside reviewed lesson');
  for(const p of item.keyPoints)assert(p.label&&p.answer&&p.why);
  const html=readFileSync(new URL('reviewer/'+key+'/index.html',root),'utf8');
  for(const id of ['exam-focus','compare-concepts','question-styles','detailed-review','exam-practice'])assert(html.includes('id="'+id+'"'));
  assert(html.includes('not confirmed questions'));
 });
}
