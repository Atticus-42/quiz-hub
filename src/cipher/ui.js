const $=id=>document.getElementById(id);
let selected='dsacs', latest=null, pairIndex=0, pending, playfairOpened=false;
const paddingPreferences={playfair:'five',single:'five',double:'five'};
function paddingForSystem(id){return id===selected?$('padding').value:paddingPreferences[id]||'none';}
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function direction(){return document.querySelector('input[name="direction"]:checked').value;}
function options(){return {system:selected,direction:direction(),text:$('message').value,count:$('count').value,shift:$('shift').value,phrase:$('phrase').value,interval:$('interval').value,key1:$('key1').value,key2:$('key2').value,padding:$('padding').value,nullLetter:$('null-letter').value};}
function table(headers,rows,{square=false,highlight=''}={}) {
  const wrap=element('div',undefined,'table-scroll'),t=element('table',undefined,'cipher-table');
  if(headers){const head=element('thead'),row=element('tr');headers.forEach(value=>{const cell=element('th',String(value));cell.scope='col';row.append(cell);});head.append(row);t.append(head);}
  const body=element('tbody');rows.forEach(row=>{const tr=element('tr');row.forEach(value=>{const cell=element('td',value==='I'&&square?'I/J':value||'·');if(!value)cell.className='empty';if(value&&highlight.includes(value))cell.classList.add('lit');tr.append(cell);});body.append(tr);});t.append(body);wrap.append(t);return wrap;
}
function paintGrids(){
  $('grids').replaceChildren();if(!latest)return;
  latest.grids.forEach((grid,i)=>{
    const box=element('section',undefined,'grid-section'+(selected==='playfair'?' playfair-grid':''));box.append(element('h3',grid.title));
    const pair=selected==='playfair'?latest.steps[pairIndex]:null;
    box.append(table(grid.headers,grid.rows.slice(0,80),{square:!!pair,highlight:pair?pair.input:''}));
    if(grid.rows.length>80)box.append(element('p','First 80 rows shown. The answer uses the full message.','field-note'));
    if(pair){
      const controls=element('div',undefined,'pair-controls');const previous=element('button','← Previous pair'),next=element('button','Next pair →');previous.type=next.type='button';previous.disabled=pairIndex===0;next.disabled=pairIndex===latest.steps.length-1;
      previous.addEventListener('click',()=>{pairIndex--;paintGrids();});next.addEventListener('click',()=>{pairIndex++;paintGrids();});
      controls.append(previous,element('span',`${pairIndex+1} / ${latest.steps.length} · ${pair.input} → ${pair.output}`),next);box.append(controls,element('p',pair.rule+'. Highlighted cells show the input pair.','pair-rule'));
    } else if(grid.columns)box.append(element('p','Column readout: '+grid.columns.map(c=>`${c.rank}: ${c.text||'∅'}`).join(' / '),'grid-output'));
    if(['single','double'].includes(selected))box.append(element('p',`Pass ${i+1} result: ${groupFive(grid.output)}`,'grid-output'));
    $('grids').append(box);
  });
}
function paintWorking(){
  $('method-notes').replaceChildren();latest.details.slice(0,30).forEach(note=>$('method-notes').append(element('p',note)));
  if(latest.details.length>30)$('method-notes').append(element('p','Further null insertions are included in the exact input below.'));
  $('alphabet-chart').replaceChildren();
  if(latest.alphabet){const wrap=element('section',undefined,'grid-section');wrap.append(element('h3','Plain ↔ cipher alphabet'));
    // Laptops get the lesson's single A–Z row; phones get two halves. Shifted charts circle cipher A, as the PDF does.
    const highlight=['dsacs','rsacs'].includes(selected)?'A':'';
    const full=table(['PLAIN',...ABC],[['CIPHER',...latest.alphabet]],{highlight});full.classList.add('alphabet-full');wrap.append(full);
    for(let start=0;start<26;start+=13){const t=table(['PLAIN',...ABC.slice(start,start+13)],[['CIPHER',...latest.alphabet.slice(start,start+13)]],{highlight});t.classList.add('alphabet-half');wrap.append(t);}
    $('alphabet-chart').append(wrap);
  }
  pairIndex=Math.min(pairIndex,Math.max(0,latest.steps.length-1));paintGrids();
  $('trace').replaceChildren();const list=element('ol',undefined,'trace-list');
  latest.steps.slice(0,100).forEach((step,i)=>{const li=element('li',`${i+1}. ${step.input} → ${step.output}`);li.append(element('small',step.rule));list.append(li);});
  $('trace').append(list);$('trace-count').textContent=`${latest.steps.length} ${selected==='playfair'?'pairs':['single','double'].includes(selected)?'passes':'letters'}`;
  if(latest.steps.length>100)$('trace').append(element('p','First 100 steps shown. The answer includes every step.','field-note'));
  $('prepared').textContent=selected==='playfair'?(latest.prepared.match(/.{1,2}/g)||[]).join(' '):latest.prepared;
  $('trace-label').textContent=selected==='playfair'?'Pair-by-pair trace':'Letter-by-letter trace';
}
function update(){
  clearTimeout(pending);const decode=direction()==='decode';
  $('message-label').textContent=decode?'Ciphertext':'Plaintext';$('answer-kind').textContent=decode?'DECIPHERED TEXT':'ENCIPHERED TEXT';
  $('padding-fields').hidden=!['playfair','single','double'].includes(selected)||decode;
  $('null-field').hidden=selected!=='playfair';
  $('playfair-note').hidden=selected!=='playfair';
  $('padding-note').hidden=$('padding-fields').hidden;
  $('padding-note').textContent=selected==='playfair'?($('padding').value==='five'?'Complete five-letter groups: fillers are added automatically, including extra null pairs at the end. No need to add a trailing X yourself.':'Standard preparation: split identical letters within a pair and complete a lone final letter. The final display group may be shorter than five.'):'Lesson option: X nulls complete the final group of five before the first pass. This does not necessarily fill the rectangle. Choose no extra padding for an incomplete-rectangle exercise.';
  const count=Number($('count').value);
  $('count-note').textContent=selected==='dsacs'?`The lesson counts the starting position as 1. Count ${count||'—'} means ${count?count-1:'—'} actual shifts ${$('shift').value}.`:'The indicator is the starting letter’s alphabet position: 10 starts with J, then I, H, G…';
  try {
    latest=solve(options());$('answer').textContent=$('group-five').checked?groupFive(latest.output):latest.output;
    $('answer-state').textContent='ANSWER READY';$('answer-message').textContent='';$('answer-stats').textContent=`${latest.output.length} characters · ${Math.ceil(latest.output.length/5)} display groups`;
    $('working').hidden=false;paintWorking();$('copy-answer').disabled=$('reverse').disabled=false;
  } catch(error){
    latest=null;$('answer').textContent='—';$('answer-state').textContent=$('message').value.trim()?'CHECK INPUT':'AWAITING MESSAGE';$('answer-message').textContent=error.message+(selected==='playfair'&&decode?' Decipher expects encrypted text. To encrypt a normal sentence, select Encipher.':'');$('answer-stats').textContent='';$('working').hidden=true;$('copy-answer').disabled=$('reverse').disabled=true;
  }
}
function choose(id){
  if(Object.hasOwn(paddingPreferences,selected))paddingPreferences[selected]=$('padding').value;
  selected=id;pairIndex=0;const spec=SYSTEMS.find(s=>s.id===id);
  if(id==='playfair'&&!playfairOpened){document.querySelector('input[name="direction"][value="encode"]').checked=true;playfairOpened=true;}
  $('padding').value=paddingPreferences[id]||'none';
  document.querySelectorAll('[data-system]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.system===id)));
  $('method-title').textContent=spec.name;$('method-family').textContent=spec.family.toUpperCase();$('method-description').textContent=spec.description;$('source-reference').textContent='PDF p. '+spec.pages;
  $('count-fields').hidden=$('count-note').hidden=!['dsacs','rsacs'].includes(id);$('shift-field').hidden=id!=='dsacs';
  $('phrase-field').hidden=!['keyword','decimation','numerical','playfair'].includes(id);$('interval-field').hidden=id!=='decimation';$('key1-field').hidden=!['single','double'].includes(id);$('key2-field').hidden=id!=='double';
  $('phrase').value=id==='numerical'?'WHERE THE ZEBRAS FEED':id==='playfair'?'HYPNOTIZED':'THE DANCE OF THE CHIMPANZEES';
  $('count').value=id==='rsacs'?'10':'9';
  update();
}
function example(){
  const examples={dsacs:'KLMVQ ZSJVP',rsacs:'RQPGL CJSGM',keyword:'THEDANCOFIMPZSBGJKLQRUVWXY',decimation:'DOPGQWHCZKVEIJXNBYMUSATFRL',numerical:'ANBMDQEIXFPHGVRJYSOTKWCUZL',playfair:'BALLOON',single:'C9NS0 MUNOP AU2ET IGPXL T0CIB ALXMD',double:'90NXU GX0BP DLPAI CTSI2 TNCMA EOMUL'};
  choose(selected);$('shift').value='right';$('interval').value='4';$('key1').value=KEY05;$('key2').value=KEY04;$('padding').value='five';$('null-letter').value='X';
  document.querySelector(`input[name="direction"][value="${selected==='playfair'?'encode':'decode'}"]`).checked=true;
  $('message').value=examples[selected];pairIndex=0;update();
}
SYSTEMS.forEach((spec,i)=>{const button=element('button');button.type='button';button.dataset.system=spec.id;button.setAttribute('aria-pressed',String(spec.id===selected));button.append(element('span',String(i+1).padStart(2,'0'),'system-no'),element('span',spec.name));button.addEventListener('click',()=>choose(spec.id));$('systems').append(button);});
$('key1').value=KEY05;$('key2').value=KEY04;
$('cipher-form').addEventListener('submit',event=>{event.preventDefault();update();});
$('cipher-form').addEventListener('input',()=>{latest=null;$('copy-answer').disabled=$('reverse').disabled=true;$('answer-state').textContent='UPDATING';clearTimeout(pending);pending=setTimeout(update,150);});
$('cipher-form').addEventListener('change',update);
$('load-example').addEventListener('click',example);$('clear').addEventListener('click',()=>{$('message').value='';update();$('message').focus();});
$('group-five').addEventListener('change',update);
$('reverse').addEventListener('click',()=>{if(!latest)return;const text=latest.output;document.querySelector(`input[name="direction"][value="${direction()==='decode'?'encode':'decode'}"]`).checked=true;$('message').value=text;pairIndex=0;update();});
$('copy-answer').addEventListener('click',async()=>{if(!latest)return;const value=$('group-five').checked?groupFive(latest.output):latest.output;try{await navigator.clipboard.writeText(value);$('answer-message').textContent='Answer copied.';}catch{$('answer').focus();const range=document.createRange();range.selectNodeContents($('answer'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);$('answer-message').textContent='Answer selected. Use your device’s Copy command.';}});
function updateIndicator(){const recover=$('indicator-mode').value==='recover';$('indicator-input-label').textContent=recover?'Five-digit indicator':'Key digits (e.g. 0504)';try{$('indicator-result').textContent=indicator($('subtractor').value.trim(),$('key-digits').value.trim(),recover);}catch(error){$('indicator-result').textContent='—';$('indicator-explanation').textContent=error.message;return;}$('indicator-explanation').textContent=recover?'Recovered key digits: first two digits identify key 1; last two identify key 2. In a single-transposition exercise, 0005 means key 05.':'Subtract each digit without borrowing. Append the units digit of the sum. Single key 05 → 0005; double keys 05 and 04 → 0504.';}
$('indicator-form').addEventListener('submit',event=>{event.preventDefault();updateIndicator();});$('indicator-form').addEventListener('input',updateIndicator);$('indicator-mode').addEventListener('change',()=>{$('key-digits').value=$('indicator-mode').value==='recover'?'23577':'0504';updateIndicator();});
choose('dsacs');updateIndicator();
