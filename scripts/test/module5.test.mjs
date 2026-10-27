import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadLessons,build } from '../build.mjs';
import { runPage,findAll } from './harness.mjs';

test('Legacy lesson quizzes retain their banks after POI placement, without a combined exam',()=>{
  const {modules,lessons}=loadLessons();
  assert.ok(modules.some(m=>m.id==='module-5'));
  const own=lessons.filter(l=>['intcycle','rdf','sigint'].includes(l.key)).sort((a,b)=>['intcycle','rdf','sigint'].indexOf(a.key)-['intcycle','rdf','sigint'].indexOf(b.key));
  assert.deepEqual(own.map(l=>l.key),['intcycle','rdf','sigint']);
  for(const lesson of own)for(const mode of ['easy','medium','hard'])assert.equal(lesson.banks[mode].length,25);
  assert.equal(own.some(l=>l.pool),false);
});
test('new pages keep study confirmation and difficulty choice',()=>{
  const pages=build({write:false,endpoint:''});
  for(const slug of ['intelligence-cycle','radio-direction-finding','signals-intelligence']){
    assert.ok(pages[slug+'/index.html']);
    const doc=runPage(pages[slug+'/index.html']).document;
    assert.ok(findAll(doc.root,n=>n.localName==='input'&&n.getAttribute('type')==='checkbox').length);
    for(const mode of ['easy','medium','hard'])assert.ok(pages[slug+'/index.html'].includes(mode));
  }
});

test('Legacy lesson correct answers are neither predictably shortest nor longest',()=>{
  const {lessons}=loadLessons();
  for(const lesson of lessons.filter(l=>l.module==='module-5'))for(const mode of ['easy','medium','hard']){
    const bank=lesson.banks[mode];
    for(const [metric,measure] of [['characters',s=>s.length],['words',s=>s.trim().split(/\s+/).length]])for(const extreme of [Math.min,Math.max]){
      const count=bank.filter(q=>{
        const lengths=q.options.map(measure),key=lengths[q.answer];
        return key===extreme(...lengths)&&lengths.filter(n=>n===key).length===1;
      }).length;
      assert.ok(count<=bank.length*.35,`${lesson.key} ${mode}: ${extreme===Math.min?'shortest':'longest'} correct ${count}/${bank.length} by ${metric}`);
    }
  }
});
test('class-history registry accepts Module 5 while rejecting unknown keys',()=>{
  const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../../apps-script/Code.gs',import.meta.url),'utf8'),context);
  assert.equal(context.tabFor('intcycle'),'Intelligence Cycle History');
  assert.equal(context.tabFor('rdf'),'RDF History');
  assert.equal(context.tabFor('sigint'),'SIGINT History');
  assert.equal(context.tabFor('modulefive'),'Module 5 Exam History');
  assert.equal(context.tabFor('moduleunknown'),null);
});
