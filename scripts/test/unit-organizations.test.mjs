import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOrganizations, renderOrganizations } from '../unit-organizations.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('organization evidence links resolve to available PDFs and exact pages', () => {
 const data=loadOrganizations(root);
 assert.ok(data.length>=3);
 for(const group of data){
  assert.ok(group.sources.length);
  for(const s of group.sources){ assert.ok(existsSync(root+'library/files/'+s.file+'.pdf')); assert.ok(Number.isInteger(s.page)&&s.page>0); }
 }
});
test('documented nine-person squad counts existing marksman once',()=>{
 const data=loadOrganizations(root);
 const walk=n=>[n,...(n.children||[]).flatMap(walk)];
 const squad=data.flatMap(x=>walk(x.tree)).find(n=>n.id==='rifle-squad');
 assert.equal(squad.personnel,9);
 assert.equal(squad.children.reduce((n,c)=>n+c.personnel*(c.quantity||1),0),9);
 assert.equal(squad.officers,undefined);
 assert.equal(squad.children[1].title,'Fire Team A');
 assert.equal(squad.children[2].title,'Fire Team B');
 assert.equal(squad.children[2].children.at(-1).title,'Rifleman');
});
test('native trees preserve unknown counts, attachments and direct references',()=>{
 let output;renderOrganizations(root,(...args)=>{output=args},s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'));
 assert.equal(output[0],'library/unit-organization/index.html');
 assert.match(output[5],/<details/);assert.match(output[5],/<summary/);
 assert.match(output[5],/Not specified/);assert.match(output[5],/Attached/);
 assert.match(output[5],/pam-3-0101-04.pdf#page=14/);
 assert.doesNotMatch(output[5],/iframe|<canvas/);
});

test('restricted sources cannot be introduced as organization downloads',()=>{
 const fixture=mkdtempSync(join(tmpdir(),'organization-test-'));
 try {
  mkdirSync(join(fixture,'data'));mkdirSync(join(fixture,'library/files'),{recursive:true});
  writeFileSync(join(fixture,'library/files/restricted.pdf'),'fixture');
  writeFileSync(join(fixture,'data/library.json'),JSON.stringify({manuals:[{file:'restricted',restricted:true}],lessonSources:{}}));
  writeFileSync(join(fixture,'data/unit-organizations.json'),JSON.stringify([{id:'example',sources:[{file:'restricted',page:1}],tree:{title:'Example'}}]));
  assert.throws(()=>loadOrganizations(fixture),/Unavailable organization source/);
 } finally { rmSync(fixture,{recursive:true,force:true}); }
});
