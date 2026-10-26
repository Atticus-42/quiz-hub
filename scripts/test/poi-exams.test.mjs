import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {loadLessons,validateBank,checkLessonConfig} from '../build.mjs';
const keys=['manet','sensors','weapons','nist','zerotrust','gsomia','cyberrisk'];
const read=(key,file)=>JSON.parse(readFileSync(new URL(`../../lessons/${key}/${file}`,import.meta.url),'utf8'));

test('seven source-backed lessons have valid 20–35-question banks covering every declared category',()=>{
  for(const key of keys){
    assert.ok(existsSync(new URL(`../../lessons/${key}/lesson.json`,import.meta.url)),`Missing ${key}`);
    const config=read(key,'lesson.json'),allPrompts=new Set(),allIds=new Set();
    for(const mode of ['easy','medium','hard']){
      const bank=read(key,`${mode}.json`);
      assert.ok(bank.length>=20&&bank.length<=35,`${key} ${mode} size`);
      for(const category of config.categoryOrder)assert.ok(bank.some(q=>q.category===category),`${key} ${mode} lacks ${category}`);
      const answers=[0,0,0,0];
      for(const q of bank){
        assert.equal(q.difficulty,mode);assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);
        assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4);answers[q.answer]++;
        assert.ok(!allIds.has(q.qid),q.qid);allIds.add(q.qid);
        const prompt=q.prompt.trim().toLowerCase();assert.ok(!allPrompts.has(prompt),`${key} duplicate prompt`);allPrompts.add(prompt);
        assert.ok(q.explanation.length>35,`${q.qid} explanation`);
        assert.ok(q.sourceSlides.length>0&&q.sourceSlides.every(n=>Number.isInteger(n)&&n>=config.sourceRef.min&&n<=config.sourceRef.max),`${q.qid} source`);
      }
      assert.ok(Math.max(...answers)-Math.min(...answers)<=1,`${key} ${mode} answer balance`);
      for(const measure of [s=>s.length,s=>s.trim().split(/\s+/).length])for(const extreme of [Math.min,Math.max]){
        const count=bank.filter(q=>{const lengths=q.options.map(measure),value=lengths[q.answer];return value===extreme(...lengths)&&lengths.filter(n=>n===value).length===1;}).length;
        assert.ok(count<=bank.length*.35,`${key} ${mode}: correct options have a length cue in ${count}/${bank.length} items`);
      }
    }
    assert.ok(existsSync(new URL(`../../lessons/${key}/coverage.md`,import.meta.url)),`${key} coverage`);
  }
});

test('standalone and combined limits are 20–35, with large source pools permitted',()=>{
  const config=read('nist','lesson.json');
  const rules={key:'nist',categoryOrder:config.categoryOrder,ref:config.sourceRef,pool:null};
  const source=read('nist','easy.json');
  const fixture=n=>Array.from({length:n},(_,i)=>({...source[i%source.length],id:i+1,qid:`nist-e-${String(i+1).padStart(2,'0')}`}));
  for(const n of [20,35])assert.deepEqual(validateBank(fixture(n),'easy',rules),[]);
  for(const n of [19,36])assert.ok(validateBank(fixture(n),'easy',rules).length);
  const pool=read('combined','lesson.json');
  for(const count of [20,35])assert.doesNotThrow(()=>checkLessonConfig({...pool,pool:{...pool.pool,count}},'lessons/combined'));
  for(const count of [19,36])assert.throws(()=>checkLessonConfig({...pool,pool:{...pool.pool,count}},'lessons/combined'));
});

test('POI placement preserves legacy routes and history identities without unsupported cards',()=>{
  const {lessons,modules}=loadLessons();const byKey=new Map(lessons.map(l=>[l.key,l]));
  for(const [key,module,order,slug] of [
    ['fieldartillery','module-2',2,'field-artillery'],['armor','module-2',3,'armor'],['isr','module-2',4,'isr'],
    ['signal','module-4',1,'signal-support'],['signaljoint','module-4',2,'joint-signal'],['coalition','module-4',3,'coalition-signal'],
    ['sigint','module-6',1,'signals-intelligence'],['rdf','module-6',3,'radio-direction-finding'],
    ['armyops','supplemental',1,'army-operations'],['intcycle','supplemental',2,'intelligence-cycle']]){
    const lesson=byKey.get(key);assert.equal(lesson.module,module);assert.equal(lesson.order,order);assert.equal(lesson.slug,slug);assert.equal(lesson.historyLesson,key);
  }
  assert.equal(byKey.get('modulethree').slug,'module-3-exam');assert.equal(byKey.get('modulethree').module,'module-4');
  for(const key of ['combined','modulethree']){assert.equal(byKey.get(key).pool.count,30);assert.ok(byKey.get(key).banks.easy.length>35);}
  assert.deepEqual(modules.map(m=>m.id),['module-2','module-4','module-5','module-6','module-7','supplemental']);
  for(const key of ['cpa','bms','elint','eccm','infantry'])assert.ok(!byKey.has(key));
});
