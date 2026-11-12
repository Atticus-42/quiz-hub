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
  for(const s of group.sources){
   if(s.toe){ assert.equal(s.edition,'DND-approved PA TO 2019'); assert.ok(s.label&&s.locator); assert.equal(s.file,undefined); continue; }
   assert.ok(existsSync(root+'library/files/'+s.file+'.pdf')); assert.ok(Number.isInteger(s.page)&&s.page>0);
  }
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

test('EW provisional personnel exclude parenthesized dual designations and preserve conflicting HQ total',()=>{
 const ew=loadOrganizations(root).find(g=>g.id==='ew-company');
 assert.equal(ew.tree.personnel,undefined);
 const hq=ew.tree.children[0];assert.equal(hq.sourceTotal,4);assert.equal(hq.personnel,8);assert.equal(hq.officers,2);assert.equal(hq.ep,6);
 for(const platoon of ew.tree.children.slice(1)){
  assert.equal(platoon.personnel,11);assert.equal(platoon.officers,1);assert.equal(platoon.ep,10);
  assert.equal(platoon.children.reduce((n,x)=>n+x.personnel,0),11);
 }
 const walk=n=>[n,...(n.children||[]).flatMap(walk)];
 const dual=walk(ew.tree).filter(n=>n.dualDesignation);
 assert.equal(dual.length,32);assert.ok(dual.every(n=>n.personnel===undefined&&n.rawRequirement==='(1)'));
 assert.match(ew.notes.join(' '),/Neither is presented as a confirmed/);
});

test('every formation has a connected schematic and source-derived subunit labels',async()=>{
 const {renderOrganizationCharts}=await import('../organization-charts.mjs');
 for(const group of loadOrganizations(root)){
  const html=renderOrganizationCharts(group,x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;'));
  assert.match(html,/org-chart-parent/);assert.match(html,/org-chart-branches/);
  assert.match(html,/tabindex="0" role="region"/);
  for(const child of group.tree.children) assert.ok(html.includes(child.title.replaceAll('&','&amp;')));
  assert.match(html,/Schematic teaching graphic/);
 }
});

test('TOE 2019 groups: every counted parent equals its children and totals match the approved charts',()=>{
 const data=loadOrganizations(root);
 const walk=n=>[n,...(n.children||[]).flatMap(walk)];
 const toe=data.filter(g=>g.estimate==='toe');
 assert.ok(toe.length>=10);
 for(const g of toe){
  assert.ok(g.sources.some(s=>s.toe&&s.edition==='DND-approved PA TO 2019'),g.id);
  for(const n of walk(g.tree)){
   const kids=(n.children||[]).filter(c=>c.personnel!==undefined&&!c.relation);
   if(n.personnel===undefined||!kids.length||kids.length!==(n.children||[]).filter(c=>!c.relation).length) continue;
   assert.equal(kids.reduce((t,c)=>t+c.personnel*(c.quantity||1),0),n.personnel,g.id+' / '+n.title);
  }
 }
 const total=id=>{const t=data.find(g=>g.id===id).tree;return [t.officers,t.ep,t.civilians||0];};
 assert.deepEqual(total('signal'),[169,1713,55]);
 assert.deepEqual(total('infantry-division'),[516,6528,78]);
 assert.deepEqual(total('armor-division'),[384,4630,28]);
 assert.deepEqual(total('infantry-battalion'),[32,570,0]);
 assert.deepEqual(total('infantry'),[5,130,0]);
 assert.deepEqual(total('artillery-signal'),[17,199,0]);
});
test('TOE citations are text-only, carry no URL and no equipment quantities',()=>{
 const raw=readFileSync(root+'data/unit-organizations.json','utf8');
 assert.doesNotMatch(raw,/https?:\/\//);
 assert.doesNotMatch(raw,/Table of Equipment|TE S2019/i);
 let output;renderOrganizations(root,(...args)=>{output=args},s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'));
 assert.match(output[5],/DND-approved PA TO 2019/);
 assert.match(output[5],/class="org-source-ref"/);
 assert.doesNotMatch(output[5],/href="[^"]*TOE/i);
});

test('dual-designated elements show their parenthesized figures, cite a sheet and never add to totals',async()=>{
 const {renderOrganizationCharts}=await import('../organization-charts.mjs');
 const data=loadOrganizations(root);
 const walk=n=>[n,...(n.children||[]).flatMap(walk)];
 const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;');
 let dualCount=0;
 for(const g of data){
  const dual=walk(g.tree).filter(n=>n.dualPersonnel!==undefined);
  dualCount+=dual.length;
  for(const n of dual){
   assert.equal(n.personnel,0,'added strength stays 0: '+n.title);
   assert.ok(n.dualPersonnel===null||Number.isInteger(n.dualPersonnel),n.title);
   assert.match(n.dualSource,/sheet “[^”]+” · rows \d+–\d+/,'dual figures cite a sheet and rows: '+n.title);
  }
  const html=renderOrganizationCharts(g,esc);
  if(dual.length){
   assert.match(html,/dual-designated/);assert.match(html,/\(n\) · dual-designated, not added to totals/);assert.match(html,/org-chart-card is-dual/);
   assert.doesNotMatch(html,/\b0 personnel/,g.id+': no "0 personnel" for dual-designated elements');
   assert.doesNotMatch(html,/\b0 officers \/ 0 EP/,g.id);
  }
 }
 assert.equal(dualCount,17);
 const rear=walk(data.find(g=>g.id==='signal-battalion').tree).find(n=>n.title==='Message Center Team'&&n.dualPersonnel!==undefined);
 assert.deepEqual([rear.dualPersonnel,rear.dualOfficers,rear.dualEp],[6,0,6]);
 const html=renderOrganizationCharts(data.find(g=>g.id==='signal-battalion'),esc);
 assert.match(html,/\(6\) personnel · \(0\) officers \/ \(6\) EP · dual-designated/);
});

test('unreadable dual figures render as (—), never 0, and every chart emblem has a label',async()=>{
 const {renderOrganizationCharts}=await import('../organization-charts.mjs');
 const group={id:'x',title:'X',tag:'t',estimate:'toe',tree:{title:'X',children:[{title:'Message Center Team',personnel:0,officers:0,ep:0,dualPersonnel:null,dualOfficers:null,dualEp:null,dualSource:'sheet “S” · rows 1–2'}]}};
 const html=renderOrganizationCharts(group,x=>x);
 assert.match(html,/\(—\) personnel · \(—\) officers \/ \(—\) EP · dual-designated/);
 assert.match(html,/>MSG</);
 for(const g of loadOrganizations(root)){
  const out=renderOrganizationCharts(g,x=>String(x));
  assert.doesNotMatch(out,/org-chart-emblem[^>]*aria-hidden="true"><\/span>/,g.id+': empty emblem');
 }
});

test('organization charts scroll inside their frame on small screens instead of clipping',()=>{
 const css=readFileSync(root+'assets/unit-organizations.css','utf8');
 assert.match(css,/\.org-chart-viewport\{[^}]*overflow-x:auto/);
 assert.match(css,/\.org-chart-branches\{justify-content:safe center\}/);
});
