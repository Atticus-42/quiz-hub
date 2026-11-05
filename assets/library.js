const catalogue = JSON.parse(document.getElementById('library-data').textContent);
const query = new URLSearchParams(location.search);
const selected = catalogue.find(doc => doc.id === query.get('doc'));
const get = id => document.getElementById(id);
const list = [...document.querySelectorAll('.library-row')];
const search = get('library-search');
const filter = get('library-type');
const searchText = list.map(row => row.textContent.toLowerCase());

function filterCatalogue() {
  const words = search.value.toLowerCase().trim().split(/\s+/);
  let count = 0;
  list.forEach((row, index) => {
    row.hidden = (filter.value !== 'all' && row.dataset.kind !== filter.value) ||
      !words.every(word => searchText[index].includes(word));
    if (!row.hidden) count++;
  });
  get('library-count').textContent = count + (count === 1 ? ' document' : ' documents');
}
if (['lesson', 'manual'].includes(query.get('type'))) filter.value = query.get('type');
search.addEventListener('input', filterCatalogue);
filter.addEventListener('change', filterCatalogue);
filterCatalogue();

if (selected) {
  get('document').hidden = false;
  get('document-title').textContent = selected.title;
  get('document-meta').textContent = [selected.edition, selected.file ? 'PDF available' : 'Citation record · PDF unavailable in the public library'].filter(Boolean).join(' · ');
  get('document-lesson-summary').textContent = 'Connected lessons (' + selected.lessons.length + ')';
  for (const lesson of selected.lessons) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = '../reviewer/' + lesson.key + '/';
    link.textContent = lesson.title;
    item.append(link, lesson.cited ? '' : ' · Related reading');
    get('document-lessons').append(item);
  }
  if (selected.file) showPdf(selected.file);
}

async function showPdf(file) {
  const reader = get('reader');
  const canvas = get('pdf-canvas');
  const surface = get('pdf-surface');
  const status = get('pdf-status');
  const input = get('pdf-page');
  const zoom = get('pdf-zoom');
  const previous = get('pdf-prev');
  const next = get('pdf-next');
  const url = 'files/' + file + '.pdf';
  get('pdf-file').href = url;
  reader.hidden = false;
  status.textContent = 'Loading PDF…';
  previous.disabled = next.disabled = input.disabled = zoom.disabled = true;
  try {
    const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    const pdf = await pdfjs.getDocument({
      url, isEvalSupported: false, useWasm: true,
      wasmUrl: new URL('./vendor/pdfjs/wasm/', import.meta.url).href,
      standardFontDataUrl: new URL('./vendor/pdfjs/standard_fonts/', import.meta.url).href,
      cMapUrl: new URL('./vendor/pdfjs/cmaps/', import.meta.url).href,
    }).promise;
    input.max = pdf.numPages;
    get('pdf-total').textContent = 'of ' + pdf.numPages;
    const clamp = value => Math.min(pdf.numPages, Math.max(1, Math.trunc(Number(value) || 1)));
    let page = clamp(query.get('page'));
    let version = 0;
    let task;
    async function draw(value) {
      const current = ++version;
      page = clamp(value);
      input.value = page;
      previous.disabled = page === 1;
      next.disabled = page === pdf.numPages;
      status.textContent = 'Rendering page ' + page + '…';
      if (task) {
        task.cancel();
        try { await task.promise; } catch {}
      }
      try {
        const pdfPage = await pdf.getPage(page);
        if (current !== version) return;
        const native = pdfPage.getViewport({ scale: 1 });
        const scale = Math.max(1, surface.clientWidth - 12) / native.width * Number(zoom.value);
        const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(8e6 / (native.width * native.height * scale * scale)));
        const viewport = pdfPage.getViewport({ scale: scale * ratio });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = Math.round(native.width * scale) + 'px';
        canvas.style.height = Math.round(native.height * scale) + 'px';
        canvas.setAttribute('aria-label', 'PDF page ' + page + ' of ' + pdf.numPages);
        task = pdfPage.render({ canvas, viewport });
        await task.promise;
        if (current !== version) return;
        query.set('page', page);
        history.replaceState(null, '', '?' + query + '#document');
        status.textContent = 'Page ' + page + ' of ' + pdf.numPages;
      } catch (error) {
        if (current === version && error.name !== 'RenderingCancelledException') status.textContent = 'This page could not render. Open the PDF file to read it.';
      }
    }
    input.disabled = zoom.disabled = false;
    previous.addEventListener('click', () => draw(page - 1));
    next.addEventListener('click', () => draw(page + 1));
    input.addEventListener('change', () => draw(input.value));
    zoom.addEventListener('change', () => draw(page));
    let width = surface.clientWidth;
    new ResizeObserver(() => {
      if (surface.clientWidth === width) return;
      width = surface.clientWidth;
      draw(page);
    }).observe(surface);
    await draw(page);
    get('document').scrollIntoView({ block: 'start' });
  } catch {
    status.textContent = 'This browser could not load the viewer. Open the PDF file to read it.';
  }
}
