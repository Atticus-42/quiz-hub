const input = document.getElementById('reviewer-search');
const output = document.getElementById('reviewer-count');
const groups = [...document.querySelectorAll('.reviewer-module')].map(section => ({
  section,
  title: section.querySelector('h2').textContent.toLowerCase(),
  link: document.querySelector('.study-rail a[href="#' + section.id + '"]').closest('li'),
  cards: [...section.querySelectorAll('.reviewer-card')].map(card => ({ card, text: card.textContent.toLowerCase() })),
}));

function findLessons() {
  const terms = input.value.toLowerCase().trim().split(/\s+/);
  let count = 0;
  for (const { section, title, link, cards } of groups) {
    let matches = 0;
    for (const { card, text } of cards) {
      card.hidden = !terms.every(term => (title + ' ' + text).includes(term));
      if (!card.hidden) matches++;
    }
    section.hidden = link.hidden = matches === 0;
    count += matches;
  }
  output.textContent = count === 0 ? 'No matching lessons' : count + (count === 1 ? ' lesson' : ' lessons');
}

input.closest('.study-finder').hidden = false;
document.getElementById('module-index').open = !matchMedia('(max-width:840px)').matches;
input.addEventListener('input', findLessons);
findLessons();

// Only restore a known lesson from this catalogue, never an arbitrary stored URL.
try {
  const key = 'quiz-hub:last-reviewer:v1';
  const saved = JSON.parse(localStorage.getItem(key) || 'null');
  const known = [...document.querySelectorAll('.reviewer-card a')].find(link => new URL(link.href).pathname === saved?.path);
  if (known) {
    const region = document.getElementById('study-return');
    const copy = document.createElement('div');
    const label = document.createElement('p');
    label.className = 'study-eyebrow';
    label.textContent = 'Pick up where you left off';
    const link = document.createElement('a');
    const sections = ['briefing', 'facts', 'reasoning', 'scenario', 'practice', 'self-check', 'references'];
    link.href = known.href + (sections.includes(saved.section) ? '#' + saved.section : '');
    link.textContent = known.querySelector('span').textContent + ' →';
    const note = document.createElement('p');
    note.className = 'study-muted';
    note.textContent = 'Saved on this device';
    copy.append(label, link, note);
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear bookmark';
    clear.addEventListener('click', () => { try { localStorage.removeItem(key); } catch {} region.hidden = true; });
    region.append(copy, clear);
    region.hidden = false;
  }
} catch { /* Storage is optional. */ }
