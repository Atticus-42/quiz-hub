const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const all=fs.readFileSync('assets/identity.js','utf8');const script=all.slice(all.indexOf('/* Attributed quotations:'));const store=new Map();const quote={},credit={};const context={document:{querySelectorAll:s=>s==='[data-domain-quote]'?[quote]:[credit]},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}};
const sources=JSON.parse(fs.readFileSync('docs/domain-quotes.json','utf8'));const seen=[];
for(let i=0;i<24;i++){vm.runInNewContext(script,context);seen.push(quote.textContent);const record=sources.find(q=>'“'+q.text+'”'===quote.textContent);assert(record);assert.equal(credit.textContent,'— '+record.speaker+' · '+record.work)}
for(let i=0;i<24;i+=8)assert.equal(new Set(seen.slice(i,i+8)).size,8);
for(let i=1;i<24;i++)assert.notEqual(seen[i],seen[i-1]);
context.sessionStorage={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}};vm.runInNewContext(script,context);assert(quote.textContent&&credit.textContent);
console.log('PASS: 24 visits, complete shuffle cycles, paired attribution, blocked-storage fallback.');
