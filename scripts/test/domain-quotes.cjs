const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const all=fs.readFileSync('assets/identity.js','utf8');const script=all.slice(all.indexOf('/* Attributed quotations:'));const store=new Map();const quote={},credit={};const context={document:{querySelectorAll:s=>s==='[data-domain-quote]'?[quote]:[credit]},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)}};
const sources=JSON.parse(fs.readFileSync('docs/domain-quotes.json','utf8'));const N=sources.length,V=N*3;const seen=[];assert(N>=8);assert.equal(new Set(sources.map(q=>q.text)).size,N);for(const q of sources)assert(q.text&&q.speaker&&q.work&&/^https:/.test(q.verificationUrl));
for(let i=0;i<V;i++){vm.runInNewContext(script,context);seen.push(quote.textContent);const record=sources.find(q=>'“'+q.text+'”'===quote.textContent);assert(record);assert.equal(credit.textContent,'— '+record.speaker+' · '+record.work)}
for(let i=0;i<V;i+=N)assert.equal(new Set(seen.slice(i,i+N)).size,N);
for(let i=1;i<V;i++)assert.notEqual(seen[i],seen[i-1]);
context.sessionStorage={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}};vm.runInNewContext(script,context);assert(quote.textContent&&credit.textContent);
console.log('PASS: '+V+' visits, complete shuffle cycles, paired attribution, blocked-storage fallback.');
