const catalogue = JSON.parse(document.getElementById('library-data').textContent);
const query = new URLSearchParams(location.search);
const selected = catalogue.find(doc => doc.id === query.get('doc'));
const get = id => document.getElementById(id);
const list = [...document.querySelectorAll('.library-row')];
const search = get('library-search');
let filter = ['lesson', 'manual', 'reviewer'].includes(query.get('type')) ? query.get('type') : 'all';
const moduleFilter = get('library-module');
const availability = get('library-availability');
const sort = get('library-sort');
const container = document.querySelector('.library-list');
const metadata = new Map(catalogue.map(doc => [doc.id, doc]));
const originalOrder = new Map(list.map((row,i) => [row,i]));
search.value = query.get('q') || '';
for (const [control,key] of [[moduleFilter,'module'],[availability,'availability'],[sort,'sort']]) {
  if ([...control.options].some(option=>option.value===query.get(key))) control.value=query.get(key);
}
function filterCatalogue() {
  const words = search.value.toLowerCase().trim().split(/\s+/);
  let count = 0;
  list.forEach(row => {
    row.hidden = (filter !== 'all' && row.dataset.kind !== filter)
      || (moduleFilter.value !== 'all' && !row.dataset.modules.split(' ').includes(moduleFilter.value))
      || (availability.value !== 'all' && row.dataset.format !== availability.value)
      || !words.every(word => row.textContent.toLowerCase().includes(word));
    if (!row.hidden) count++;
  });
  const ordered=[...list].sort((a,b)=> {
    const first=metadata.get(a.dataset.id),second=metadata.get(b.dataset.id);
    if (sort.value==='title') return first.title.localeCompare(second.title);
    if (sort.value==='kind') return first.kind.localeCompare(second.kind)||first.title.localeCompare(second.title);
    return originalOrder.get(a)-originalOrder.get(b);
  });
  ordered.forEach(row=>container.append(row));
  get('library-count').textContent = count + ' of ' + list.length + ' documents';
  get('library-empty').hidden = count !== 0;
  document.querySelectorAll('[data-type]').forEach(link=>{
    if(link.dataset.type===filter) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  });
  const state=new URLSearchParams(location.search);
  for(const [key,value,empty] of [['type',filter,'all'],['q',search.value,''],['module',moduleFilter.value,'all'],['availability',availability.value,'all'],['sort',sort.value,'course']]) {
    if(value===empty)state.delete(key);else state.set(key,value);
  }
  history.replaceState(null,'',location.pathname+(state.size?'?'+state:'')+location.hash);
}
document.querySelectorAll('[data-type]').forEach(link=>link.addEventListener('click',event=>{
  if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
  event.preventDefault();filter=link.dataset.type;filterCatalogue();
}));
search.addEventListener('input',filterCatalogue);
[moduleFilter,availability,sort].forEach(control=>control.addEventListener('change',filterCatalogue));
get('library-reset').addEventListener('click',()=>{filter='all';search.value='';moduleFilter.value='all';availability.value='all';sort.value='course';filterCatalogue();});
function setView(compact) {
  container.classList.toggle('compact-list',compact);
  get('library-cards').setAttribute('aria-pressed',String(!compact));
  get('library-list-view').setAttribute('aria-pressed',String(compact));
  try {localStorage.setItem('library-layout',compact?'list':'cards');}catch{}
}
get('library-cards').addEventListener('click',()=>setView(false));
get('library-list-view').addEventListener('click',()=>setView(true));
try {setView(localStorage.getItem('library-layout')==='list');}catch{}
filterCatalogue();
if (selected) {
  // Keep old saved references working, using the browser's own PDF handling.
  if (selected.file) {
    const requestedPage = Number(query.get('page'));
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? '#page=' + requestedPage : '';
    location.replace('files/' + selected.file + '.pdf' + page);
  } else if (selected.web) {
    location.replace('../' + selected.web);
  } else {
    get('main').classList.add('document-open');
    get('document').hidden = false;
    get('document-title').textContent = selected.title;
    get('document-meta').textContent = selected.edition || 'Course reference';
    get('document-availability').textContent = 'Citation record. A matching PDF is not available in the public library yet.';
    get('document-lesson-summary').textContent = 'Connected lessons (' + selected.lessons.length + ')';
    for (const lesson of selected.lessons) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '../reviewer/' + lesson.key + '/';
      link.textContent = lesson.title;
      item.append(link, lesson.cited ? '' : ' · Related reading');
      get('document-lessons').append(item);
    }
  }
}
