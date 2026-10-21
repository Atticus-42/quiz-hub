import test from 'node:test';
import assert from 'node:assert/strict';
import {solve,indicator,keyed,sequence,transpose,ABC,KEY05,KEY04} from '../../src/cipher/engine.mjs';
const crypt=(system,text,extra={})=>solve({system,text,direction:'encode',padding:'none',...extra});
const key='THE DANCE OF THE CHIMPANZEES';
test('PDF pp. 1–2: inclusive direct shifts and reverse chart reproduce all worked messages',()=>{
  assert.equal(crypt('dsacs','STUDYHARDX',{count:9,shift:'right'}).output,'KLMVQZSJVP');
  assert.equal(crypt('dsacs','STUDYHARDX',{count:9,shift:'left'}).output,'ABCLGPIZLF');
  assert.equal(crypt('dsacs','A',{count:5,shift:'right'}).output,'W');
  assert.equal(crypt('dsacs','A',{count:5,shift:'left'}).output,'E');
  assert.equal(crypt('rsacs',ABC,{count:10}).output,'JIHGFEDCBAZYXWVUTSRQPONMLK');
  assert.equal(crypt('rsacs','STUDYHARDX',{count:10}).output,'RQPGLCJSGM');
});
test('PDF pp. 3–6: all three keyed cipher alphabets match the printed charts exactly',()=>{
  assert.equal(keyed(key).alphabet,'THEDANCOFIMPZSBGJKLQRUVWXY');
  assert.equal(crypt('keyword',ABC,{phrase:key}).output,'THEDANCOFIMPZSBGJKLQRUVWXY');
  assert.equal(crypt('decimation',ABC,{phrase:key,interval:4}).output,'DOPGQWHCZKVEIJXNBYMUSATFRL');
  assert.equal(crypt('numerical',ABC,{phrase:'WHERE THE ZEBRAS FEED'}).output,'ANBMDQEIXFPHGVRJYSOTKWCUZL');
});
test('substitution round trips retain every letter for boundary counts and key lengths',()=>{
  const cases=[];for(let count=1;count<=26;count++){cases.push({system:'dsacs',count,shift:'left'},{system:'dsacs',count,shift:'right'},{system:'rsacs',count});}
  for(const phrase of ['A','AABBCC',ABC,key])for(const system of ['keyword','decimation','numerical'])for(const interval of [1,4,26,100])cases.push({system,phrase,interval});
  for(const o of cases){const enc=solve({...o,text:ABC,direction:'encode'});assert.equal(new Set(enc.output).size,26);assert.equal(solve({...o,text:enc.output,direction:'decode'}).output,ABC);}
});
test('PDF p. 7: Playfair square and all three rules, including wraparound and I/J',()=>{
  const opts={phrase:'HYPNOTIZED'};
  assert.equal(keyed(opts.phrase,true).alphabet,'HYPNOTIZEDABCFGKLMQRSUVWX');
  for(const [plain,cipher] of [['HP','YN'],['OH','HY'],['HT','TA'],['SH','HT'],['HG','OA']]){
    assert.equal(crypt('playfair',plain,opts).output,cipher);
    assert.equal(crypt('playfair',cipher,{...opts,direction:'decode'}).output,plain);
  }
  assert.equal(crypt('playfair','JI',opts).prepared,'IXIX');
});
test('Playfair handles repeated letters, literal X, odd lengths and explicit five-group padding',()=>{
  const pair=crypt('playfair','BALLOON',{phrase:'HYPNOTIZED'});assert.equal(pair.prepared,'BALXLOON');assert.equal(pair.output,'CBRURYHO');
  const five=crypt('playfair','BALLOON',{phrase:'HYPNOTIZED',padding:'five'});assert.equal(five.prepared,'BALXLOONXQ');assert.equal(five.output,'CBRURYHOWR');
  for(const text of ['X','XX','XXX','HELLO','JIGGLE','EXXON','BALLOON'])for(const padding of ['none','five']){
    const enc=crypt('playfair',text,{phrase:'HYPNOTIZED',padding});assert.ok(enc.prepared.match(/.{2}/g).every(p=>p[0]!==p[1]));
    assert.equal(crypt('playfair',enc.output,{phrase:'HYPNOTIZED',direction:'decode'}).output,enc.prepared);
    if(padding==='five')assert.equal(enc.output.length%10,0);
  }
});
test('PDF pp. 8–12: single and double transposition, including digits and nulls',()=>{
  const text='SUBMIT COMPLIANCE NLT 02 AUG 09 PD';const single='C9NS0MUNOPAU2ETIGPXLT0CIBALXMD',double='90NXUGX0BPDLPAICTSI2TNCMAEOMUL';
  for(const [system,expected] of [['single',single],['double',double]]){
    const enc=crypt(system,text,{key1:KEY05,key2:KEY04,padding:'five'});assert.equal(enc.output,expected);
    assert.equal(crypt(system,expected,{key1:KEY05,key2:KEY04,direction:'decode'}).output,'SUBMITCOMPLIANCENLT02AUG09PDXX');
  }
});
test('ragged grids and reversed double passes are correct across lengths shorter than a row',()=>{
  for(const key of ['1','3 1 4 2',KEY05,KEY04])for(let n=1;n<=90;n++){
    const plain=(ABC+'0123456789').repeat(3).slice(0,n),seq=sequence(key);
    assert.equal(transpose(transpose(plain,seq).output,seq,true).output,plain);
    const opts={key1:key,key2:'2 1 3'};const enc=crypt('double',plain,opts);
    assert.equal(crypt('double',enc.output,{...opts,direction:'decode'}).output,plain);
  }
});
test('PDF pp. 9, 11–12: no-borrow indicator arithmetic and check digit',()=>{
  assert.equal(indicator('2851','0005'),'28561');assert.equal(indicator('2851','0504'),'23577');
  assert.equal(indicator('2851','28561',true),'0005');assert.equal(indicator('2851','23577',true),'0504');
  assert.throws(()=>indicator('2851','23578',true),/check digit/);
  assert.throws(()=>indicator('285','0504'),/four digits/);assert.throws(()=>indicator('2851','504'),/four key digits/);
});
test('invalid inputs produce actionable errors instead of plausible wrong answers',()=>{
  assert.throws(()=>crypt('dsacs','TEST',{count:0,shift:'left'}),/1 to 26/);
  assert.throws(()=>crypt('dsacs','TEST',{count:'',shift:'right'}),/whole number/);
  assert.throws(()=>crypt('keyword','TEXT',{phrase:''}),/assigned keyword/);
  assert.throws(()=>crypt('keyword','TEXT123',{phrase:'KEY'}),/letters only/);
  for(const value of ['','1 1 2','1 3','A B C','0 1','1.5 2'])assert.throws(()=>sequence(value));
  assert.throws(()=>crypt('playfair','ABC',{phrase:'KEY',direction:'decode'}),/even number/);
  assert.throws(()=>crypt('playfair','AA',{phrase:'KEY',direction:'decode'}),/identical pair/);
  assert.throws(()=>crypt('playfair','JA',{phrase:'KEY',direction:'decode'}),/uses I/);
  assert.throws(()=>crypt('keyword','<script>',{phrase:'KEY'}),/Use A/);
  assert.throws(()=>crypt('keyword','A'.repeat(2001),{phrase:'KEY'}),/2,000/);
  assert.throws(()=>crypt('wrong','TEST'),/Choose a cipher/);
});
