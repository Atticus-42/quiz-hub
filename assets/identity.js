/* One edition per page visit. The shuffled deck includes every rendition. */
(() => {
  const script = document.currentScript;
  const base = new URL('crests/', script.src);
  const variants = [['colored','Original'],['philippines','Philippines'],['red','Crimson'],['cartoon','Cartoon'],['anime','Anime'],['jungle','Jungle'],['comic','Comic'],['bronze','Bronze'],['neon','Neon'],['realistic','Realistic'],['colorful-embroidery','Embroidery'],['single-ring','Single ring'],['updated','Updated']];
  const key = 'quiz-hub:crest-deck:v1';
  let state;
  try { state = JSON.parse(sessionStorage.getItem(key)); } catch {}
  const valid = item => Number.isInteger(item) && item >= 0 && item < variants.length;
  if (!state || !Array.isArray(state.deck) || !state.deck.every(valid) || new Set(state.deck).size !== state.deck.length || !valid(state.last)) state = { deck: [], last: -1 };
  if (!state.deck.length) {
    state.deck = variants.map((_, index) => index);
    for (let i = state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
    }
    if (state.deck.at(-1) === state.last) [state.deck[0], state.deck[state.deck.length - 1]] = [state.deck.at(-1), state.deck[0]];
  }
  const choice = state.deck.pop();
  const [file, label] = variants[choice];
  const images = [...document.querySelectorAll('[data-class-crest], img[src$="bandwidth-brothers-colored.png"]')];
  const preview = new Image();
  preview.onload = () => {
    images.forEach(image => {
      image.src = preview.src;
      if (image.alt) image.alt = 'Bandwidth Brothers · ' + label + ' edition';
      image.dataset.crestEdition = file;
    });
    document.querySelectorAll('[data-crest-label]').forEach(el => { el.textContent = label; });
    state.last = choice;
    try { sessionStorage.setItem(key, JSON.stringify(state)); } catch {}
  };
  // Preserve the original on load failure and load only the selected rendition.
  preview.src = new URL(file + '.png', base).href;
})();

/* Original Jujutsu Kaisen-inspired lines; one per visit, without repeats per deck. */
(() => {
  const quotes = [
    'Expand your domain. Refine your technique.',
    'A sharper mind is your strongest technique.',
    'Turn exam-day curses into mastered techniques.',
    'Within this barrier, preparation is power.',
    'No shortcuts to a complete domain.',
    'Your next breakthrough begins beyond your limits.',
    'Channel the pressure. Control the outcome.',
    'Domain Expansion: Unlimited Review.'
  ];
  const nodes = document.querySelectorAll('[data-domain-quote]');
  if (!nodes.length) return;
  const key = 'quiz-hub:domain-quotes:v1';
  const valid = i => Number.isInteger(i) && i >= 0 && i < quotes.length;
  let state;
  try { state = JSON.parse(sessionStorage.getItem(key)); } catch {}
  if (!state || !Array.isArray(state.deck) || !state.deck.every(valid) || new Set(state.deck).size !== state.deck.length || !valid(state.last)) state = { deck: [], last: -1 };
  if (!state.deck.length) {
    state.deck = quotes.map((_, i) => i);
    for (let i = state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
    }
    if (state.deck.at(-1) === state.last) [state.deck[0], state.deck[state.deck.length - 1]] = [state.deck.at(-1), state.deck[0]];
  }
  state.last = state.deck.pop();
  nodes.forEach(node => { node.textContent = quotes[state.last]; });
  try { sessionStorage.setItem(key, JSON.stringify(state)); } catch {}
})();
