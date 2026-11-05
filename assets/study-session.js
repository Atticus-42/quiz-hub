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
    const current = sections.filter(section => section.getBoundingClientRect().top <= innerHeight * .3).at(-1) || sections[0];
    const id = current.id;
    const range = document.documentElement.scrollHeight - innerHeight;
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
  update();
})();
