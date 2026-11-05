const catalogue = JSON.parse(document.getElementById('library-data').textContent);
const query = new URLSearchParams(location.search);
const selected = catalogue.find(doc => doc.id === query.get('doc'));
const get = id => document.getElementById(id);
const list = [...document.querySelectorAll('.library-row')];
const search = get('library-search');
const requestedType = query.get('type');
const filter = ['lesson', 'manual', 'reviewer'].includes(requestedType) ? requestedType : 'all';
const searchText = list.map(row => row.textContent.toLowerCase());
function filterCatalogue() {
  const words = search.value.toLowerCase().trim().split(/\s+/);
  let count = 0;
  list.forEach((row, index) => {
    row.hidden = (filter !== 'all' && row.dataset.kind !== filter) || !words.every(word => searchText[index].includes(word));
    if (!row.hidden) count++;
  });
  get('library-count').textContent = count === 0 ? 'No matching documents' : count + (count === 1 ? ' document' : ' documents');
}
document.querySelector('[data-type="' + filter + '"]').setAttribute('aria-current', 'page');
search.addEventListener('input', filterCatalogue);
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
