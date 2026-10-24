import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSettings,SYSTEMS,solve,sequence} from '../../src/cipher/engine.mjs';

test('generated settings round trip every cipher, including RNG boundaries',()=>{
  for(const random of [()=>0,n=>n-1,undefined])for(const {id:system} of SYSTEMS){
    const settings=generateSettings(system,{random});
    if(settings.count)assert.ok(settings.count>=1&&settings.count<=26);
    if(settings.shift)assert.ok(['left','right'].includes(settings.shift));
    if(settings.phrase)assert.match(settings.phrase,/^[A-Z]+(?: [A-Z]+)+$/);
    if(settings.interval)assert.ok(settings.interval>=2&&settings.interval<=26);
    const encoded=solve({system,...settings,text:'MEET AT DAWN',direction:'encode',padding:'none'});
    const decoded=solve({system,...settings,text:encoded.output,direction:'decode',padding:'none'});
    assert.equal(decoded.output,encoded.prepared,system);
  }
});

test('transposition generator creates valid permutations and distinct double keys',()=>{
  for(const columns of [2,10,20,40])for(const random of [()=>0,n=>n-1,undefined]){
    const {key1,key2}=generateSettings('double',{columns,random});
    assert.equal(sequence(key1).length,columns);
    assert.equal(sequence(key2).length,columns);
    assert.notEqual(key1,key2);
    assert.deepEqual(Object.keys(generateSettings('single',{columns,random})),['key1']);
  }
  for(const columns of ['',1,41,2.5,'invalid'])assert.throws(()=>generateSettings('single',{columns}),/Column count/);
  assert.throws(()=>generateSettings('unknown'),/supported cipher/);
});

test('generation never supplies text, mode or padding overrides',()=>{
  for(const {id} of SYSTEMS){
    const settings=generateSettings(id);
    for(const field of ['text','direction','padding','nullLetter'])assert.equal(Object.hasOwn(settings,field),false);
  }
});
