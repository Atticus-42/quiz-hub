const catalogue = JSON.parse(document.getElementById('library-data').textContent);
const query = new URLSearchParams(location.search);
const selected = catalogue.find(doc => doc.id === query.get('doc'));
const get = id => document.getElementById(id);
const list = [...document.querySelectorAll('.library-row')];
const search = get('library-search');
const requestedType = query.get('type');
const filter = ['lesson', 'manual'].includes(requestedType) ? requestedType : 'all';
const searchText = list.map(row => row.textContent.toLowerCase());

function filterCatalogue() {
  const words = search.value.toLowerCase().trim().split(/\s+/);
  let count = 0;
  list.forEach((row, index) => {
    row.hidden = (filter !== 'all' && row.dataset.kind !== filter) ||
      !words.every(word => searchText[index].includes(word));
    if (!row.hidden) count++;
  });
  get('library-count').textContent = count === 0 ? 'No matching documents' : count + (count === 1 ? ' document' : ' documents');
}
document.querySelector('[data-type="' + filter + '"]').setAttribute('aria-current', 'page');
search.addEventListener('input', filterCatalogue);
filterCatalogue();

if (selected) {
  get('main').classList.add('document-open');
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
    const loading = pdfjs.getDocument({
      url, isEvalSupported: false, useWasm: true,
      // Fetch requested ranges only when the host supports them.
      disableStream: true, disableAutoFetch: true, rangeChunkSize: 262144,
      wasmUrl: new URL('./vendor/pdfjs/wasm/', import.meta.url).href,
      standardFontDataUrl: new URL('./vendor/pdfjs/standard_fonts/', import.meta.url).href,
      cMapUrl: new URL('./vendor/pdfjs/cmaps/', import.meta.url).href,
    });
    let timeout;
    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('PDF load timed out')), 45000);
    });
    let pdf;
    try {
      pdf = await Promise.race([loading.promise, deadline]);
    } catch (error) {
      void loading.destroy().catch(() => {});
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    await mountPages(pdf);
    get('document').scrollIntoView({ block: 'start' });
  } catch {
    status.textContent = 'This browser could not load the viewer. Open the PDF file to read it.';
  }

  async function mountPages(pdf) {
    const total = pdf.numPages;
    const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
    const slots = Array.from({ length: total }, (_, index) => {
      const slot = document.createElement('div');
      slot.className = 'pdf-page';
      slot.dataset.page = index + 1;
      slot.style.aspectRatio = first.width + ' / ' + first.height;
      return slot;
    });
    const nearby = new Map();
    let page = 0;
    let width = surface.clientWidth;
    const clamp = value => Math.min(total, Math.max(1, Math.trunc(Number(value) || 1)));
    const sizePages = () => surface.style.setProperty('--pdf-page-width', Math.max(1, width - 12) * Number(zoom.value) + 'px');
    sizePages();
    surface.replaceChildren(...slots);

    function selectPage(number) {
      if (page === number) return;
      page = number;
      input.value = page;
      previous.disabled = page === 1;
      next.disabled = page === total;
      status.textContent = 'Page ' + page + ' of ' + total;
      query.set('page', page);
      history.replaceState(null, '', '?' + query + '#document');
    }

    function jump(value) {
      const number = clamp(value);
      const slot = slots[number - 1];
      input.value = number;
      surface.scrollTop = slot.offsetTop - slots[0].offsetTop;
      selectPage(number);
    }

    function discard(slot) {
      nearby.get(slot)?.task?.cancel();
      nearby.delete(slot);
      slot.replaceChildren();
    }

    async function paint(slot) {
      discard(slot);
      const state = {};
      nearby.set(slot, state);
      try {
        const pdfPage = await pdf.getPage(Number(slot.dataset.page));
        if (nearby.get(slot) !== state) return;
        const native = pdfPage.getViewport({ scale: 1 });
        slot.style.aspectRatio = native.width + ' / ' + native.height;
        const scale = slot.clientWidth / native.width;
        const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(8e6 / (native.width * native.height * scale * scale)));
        const viewport = pdfPage.getViewport({ scale: scale * ratio });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.setAttribute('aria-label', 'PDF page ' + slot.dataset.page + ' of ' + total);
        state.task = pdfPage.render({ canvas, viewport });
        await state.task.promise;
        if (nearby.get(slot) === state) slot.append(canvas);
      } catch {
        if (nearby.get(slot) !== state) return;
        const error = document.createElement('p');
        error.textContent = 'This page could not render. Open the PDF file to read it.';
        slot.append(error);
      }
    }

    function resize() {
      const slot = slots[page - 1];
      const start = slot.offsetTop - slots[0].offsetTop;
      const fraction = (surface.scrollTop - start) / slot.offsetHeight;
      width = surface.clientWidth;
      sizePages();
      surface.scrollTop = slot.offsetTop - slots[0].offsetTop + fraction * slot.offsetHeight;
      [...nearby.keys()].forEach(paint);
    }

    input.max = total;
    get('pdf-total').textContent = 'of ' + total;
    input.disabled = zoom.disabled = false;
    jump(query.get('page'));
    previous.addEventListener('click', () => jump(page - 1));
    next.addEventListener('click', () => jump(page + 1));
    input.addEventListener('change', () => jump(input.value));
    zoom.addEventListener('change', resize);
    surface.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = surface;
      if (scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 1) {
        selectPage(total);
        return;
      }
      const top = scrollTop + slots[0].offsetTop;
      const index = slots.findIndex(slot => slot.offsetTop + slot.offsetHeight > top);
      if (index >= 0) selectPage(index + 1);
    }, { passive: true });
    const observer = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (isIntersecting) paint(target);
        else discard(target);
      }
    }, { root: surface, rootMargin: '280px 0px' });
    slots.forEach(slot => observer.observe(slot));
    new ResizeObserver(() => {
      if (width !== surface.clientWidth) resize();
    }).observe(surface);
  }
}
