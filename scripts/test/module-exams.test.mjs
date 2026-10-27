import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadLessons,build} from '../build.mjs';
const settings={modulefive:{count:30,share:10,module:'module-5',slug:'module-5-exam',sources:['manet','sensors','weapons']},moduleseven:{count:32,share:8,module:'module-7',slug:'module-7-exam',sources:['nist','zerotrust','gsomia','cyberrisk']}};

test('hybrid module exams have exact lesson shares and source-backed foundation/scenario provenance',()=>{
 const {byKey}=loadLessons();
 for(const[key,expected]of Object.entries(settings)){
  assert.ok(byKey.has(key),`${key} exam is missing`);const lesson=byKey.get(key);
  assert.equal(lesson.module,expected.module);assert.equal(lesson.slug,expected.slug);assert.equal(lesson.historyLesson,key);assert.equal(lesson.prominent,true);
  assert.deepEqual(lesson.categoryOrder,expected.sources.map(k=>byKey.get(k).name));
  const coverage=JSON.parse(fs.readFileSync(new URL(`../../lessons/${key}/coverage.json`,import.meta.url),'utf8'));
  for(const mode of ['easy','medium','hard']){
   const bank=lesson.banks[mode];assert.equal(bank.length,expected.count);assert.equal(coverage[mode].length,expected.count);
   const letters=[0,0,0,0];
   for(const sourceKey of expected.sources){
    assert.equal(bank.filter(q=>q.category===byKey.get(sourceKey).name).length,expected.share);
    for(const kind of ['foundation','scenario'])assert.equal(coverage[mode].filter(q=>q.primaryLesson===sourceKey&&q.kind===kind).length,expected.share/2);
   }
   for(const q of bank){
    letters[q.answer]++;assert.equal(new Set(q.options).size,4);
    const origin=coverage[mode].find(c=>c.qid===q.qid);assert.ok(origin,q.qid);
    assert.equal(q.category,byKey.get(origin.primaryLesson).name);assert.ok(q.qid.startsWith(`${key}-${mode[0]}-`));
    const supports=origin.supportQids.map(id=>{const source=byKey.get(id.split('-')[0]);assert.ok(source,id);const item=Object.values(source.banks).flat().find(x=>x.qid===id);assert.ok(item,id);assert.ok(q.explanation.includes(source.name));for(const n of item.sourceSlides)assert.ok(q.explanation.includes(String(n)));return {source,item};});
    assert.ok(supports.some(s=>s.source.key===origin.primaryLesson));
    if(origin.kind==='foundation'){
     assert.equal(supports.length,1);const original=supports[0].item;
     assert.equal(q.prompt,original.prompt);assert.deepEqual([...q.options].sort(),[...original.options].sort());assert.equal(q.options[q.answer],original.options[original.answer]);
    }else{
     assert.ok(new Set(supports.map(s=>s.source.key)).size>=2,`${q.qid}: scenario must integrate lessons`);
     assert.ok(!supports.some(s=>s.item.prompt===q.prompt));
    }
   }
   assert.ok(Math.max(...letters)-Math.min(...letters)<=1);
   for(const measure of [s=>s.length,s=>s.trim().split(/\s+/).length])for(const extreme of [Math.min,Math.max]){
    const count=bank.filter(q=>{const a=q.options.map(measure),v=a[q.answer];return v===extreme(...a)&&a.filter(n=>n===v).length===1;}).length;
    assert.ok(count<=bank.length*.35,`${key} ${mode}: ${count}/${bank.length} keyed options have a length cue`);
   }
  }
 }
});

test('module examination cards and independent history identities are present',()=>{
 const pages=build({write:false,endpoint:''});
 const context=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../../apps-script/Code.gs',import.meta.url),'utf8'),context);
 for(const[key,expected]of Object.entries(settings)){
  assert.ok(pages[`${expected.slug}/index.html`]);assert.ok(pages['index.html'].includes(`id="card-${key}"`));
  assert.equal(context.tabFor(key),key==='modulefive'?'Module 5 Exam History':'Module 7 Exam History');
  assert.ok(pages[`${expected.slug}/index.html`].includes('Lesson analysis'));
  assert.ok(pages[`${expected.slug}/index.html`].includes('Module examination'), 'module exams must not be labelled Lesson 00');
  assert.ok(!pages[`${expected.slug}/index.html`].includes('Lesson 00'));
  assert.ok(pages[`${expected.slug}/index.html`].includes('references in explanations'));
  assert.ok(!pages[`${expected.slug}/index.html`].includes('Ref. references 1–82'), 'mixed-source references must not imply one continuous document');
 }
});
