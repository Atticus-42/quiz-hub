// A reading bookmark stays on this browser and never leaves the device.
(() => {
  const key = 'quiz-hub:last-reviewer:v1';
  const title = document.querySelector('h1').textContent;
  const sections = [...document.querySelectorAll('.lesson-section')];
  const links = [...document.querySelectorAll('.study-rail a')];
  const progress = document.createElement('div');
  progress.className = 'study-reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);
  let queued = false;
  let last = '';
  function update() {
    queued = false;
    // The section whose heading has reached the top band of the viewport; at the very end, the last one.
    const range = document.documentElement.scrollHeight - innerHeight;
    const band = Math.min(innerHeight * .3, 160);
    const current = (range > 0 && scrollY >= range - 2 ? sections.at(-1) : sections.filter(section => section.getBoundingClientRect().top <= band).at(-1)) || sections[0];
    const id = current.id;
    progress.style.transform = 'scaleX(' + (range > 0 ? Math.min(1, Math.max(0, scrollY / range)) : 1) + ')';
    if (id === last) return;
    last = id;
    links.forEach(link => {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    try { localStorage.setItem(key, JSON.stringify({ title, path: location.pathname, section: id })); } catch { /* Reading works without storage. */ }
  }
  addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('resize', update);
  // A printed reviewer is a handout: every recall answer prints open, then the reader's view is restored.
  let closed = [];
  addEventListener('beforeprint', () => {
    closed = [...document.querySelectorAll('.lesson-reading details:not([open])')];
    closed.forEach(details => { details.open = true; });
  });
  addEventListener('afterprint', () => { closed.forEach(details => { details.open = false; }); closed = []; });
  update();
})();
