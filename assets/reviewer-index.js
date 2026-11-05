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
