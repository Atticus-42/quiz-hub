(() => {
  const root=document.querySelector('[data-review-focus]');
  if(!root) return;
  const cards=[...root.querySelectorAll('[data-focus-card]')], storageKey='quiz-hub:focus:v1:'+root.dataset.reviewFocus;
  let marks={}, filtered=false, recall=false, persistent=true;
  try {const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');if(saved && typeof saved==='object' && !Array.isArray(saved)) marks=saved;} catch {persistent=false;}
  const pointKey=card=>card.querySelector('h3').textContent;
  function update(){
    let ready=0,again=0;
    cards.forEach(card=>{const mark=marks[pointKey(card)];if(mark==='ready') ready++;if(mark==='again')again++;card.dataset.state=mark==='ready'||mark==='again'?mark:'';card.hidden=filtered&&mark!=='again';card.querySelectorAll('[data-focus-mark]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.focusMark===mark)));});
    root.querySelector('[data-focus-status]').textContent=`${ready} can explain · ${again} review again · ${cards.length-ready-again} unmarked`;
    root.querySelector('[data-focus-empty]').hidden=!(filtered&&again===0);
    root.querySelector('[data-focus-storage]').textContent=persistent?'Your marks stay on this device. They are not an exam score.':'Marks last while this page is open; browser storage is unavailable.';
  }
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(marks));}catch{persistent=false;}update();}
  cards.forEach(card=>{card.querySelector('.focus-mark').hidden=false;card.querySelectorAll('[data-focus-mark]').forEach(b=>b.addEventListener('click',()=>{marks[pointKey(card)]=b.dataset.focusMark;save();}));});
  root.querySelector('[data-focus-recall]').addEventListener('click',event=>{recall=!recall;event.currentTarget.setAttribute('aria-pressed',String(recall));event.currentTarget.textContent=recall?'Show all answers':'Test my recall';cards.forEach(card=>card.querySelector('details').open=!recall);});
  root.querySelector('[data-focus-filter]').addEventListener('click',event=>{filtered=!filtered;event.currentTarget.setAttribute('aria-pressed',String(filtered));update();});
  root.querySelector('[data-focus-reset]').addEventListener('click',()=>{marks={};save();});
  root.querySelector('[data-focus-tools]').hidden=false;root.querySelector('[data-focus-storage]').hidden=false;update();
})();
