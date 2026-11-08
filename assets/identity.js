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

/* Attributed quotations: sources recorded in docs/domain-quotes.json. */
(() => {
  const quotes = [
    {
      "text": "Can’t stop the signal, Mal.",
      "speaker": "Mr. Universe",
      "work": "Serenity (2005)"
    },
    {
      "text": "The needs of the many outweigh the needs of the few.",
      "speaker": "Spock",
      "work": "Star Trek II: The Wrath of Khan (1982)"
    },
    {
      "text": "Do. Or do not. There is no try.",
      "speaker": "Yoda",
      "work": "Star Wars: The Empire Strikes Back (1980)"
    },
    {
      "text": "You must unlearn what you have learned.",
      "speaker": "Yoda",
      "work": "Star Wars: The Empire Strikes Back (1980)"
    },
    {
      "text": "You see, but you do not observe.",
      "speaker": "Sherlock Holmes",
      "work": "A Scandal in Bohemia · Arthur Conan Doyle"
    },
    {
      "text": "Gongs and drums, banners and flags, are means whereby the ears and eyes of the host may be focussed on one particular point.",
      "speaker": "Sun Tzu",
      "work": "The Art of War, VII.24 · Lionel Giles translation (1910)"
    },
    {
      "text": "I never go back on my word.",
      "speaker": "Naruto Uzumaki",
      "work": "Naruto · English translation"
    },
    {
      "text": "Believe in the you that believes in yourself.",
      "speaker": "Kamina",
      "work": "Gurren Lagann · English translation"
    },
    {
      "text": "Plans are worthless, but planning is everything.",
      "speaker": "Dwight D. Eisenhower",
      "work": "Remarks to the National Defense Executive Reserve Conference, 14 Nov 1957"
    },
    {
      "text": "War is the realm of uncertainty; three quarters of the factors on which action is based are wrapped in a fog of greater or lesser uncertainty.",
      "speaker": "Carl von Clausewitz",
      "work": "On War, Book I, Ch. 3 · Howard and Paret translation"
    },
    {
      "text": "If you know the enemy and know yourself, you need not fear the result of a hundred battles.",
      "speaker": "Sun Tzu",
      "work": "The Art of War, III · Lionel Giles translation (1910)"
    },
    {
      "text": "All warfare is based on deception.",
      "speaker": "Sun Tzu",
      "work": "The Art of War, I · Lionel Giles translation (1910)"
    },
    {
      "text": "Rapidity is the essence of war: take advantage of the enemy’s unreadiness, make your way by unexpected routes, and attack unguarded spots.",
      "speaker": "Sun Tzu",
      "work": "The Art of War, XI · Lionel Giles translation (1910)"
    },
    {
      "text": "When you have eliminated the impossible, whatever remains, however improbable, must be the truth.",
      "speaker": "Sherlock Holmes",
      "work": "The Sign of the Four, Ch. 6 · Arthur Conan Doyle (1890)"
    },
    {
      "text": "What hath God wrought.",
      "speaker": "Samuel F. B. Morse",
      "work": "First long-distance telegraph message, 24 May 1844 (Numbers 23:23)"
    },
    {
      "text": "Mr. Watson—come here—I want to see you.",
      "speaker": "Alexander Graham Bell",
      "work": "Laboratory notebook, 10 March 1876 · first telephone call"
    },
    {
      "text": "Trust, but verify.",
      "speaker": "Ronald Reagan",
      "work": "Remarks at the INF Treaty signing, 8 Dec 1987 · Russian proverb"
    },
    {
      "text": "Help me, Obi-Wan Kenobi. You’re my only hope.",
      "speaker": "Princess Leia",
      "work": "Star Wars: A New Hope (1977)"
    },
    {
      "text": "In the moment when I truly understand my enemy, understand him well enough to defeat him, then in that very moment I also love him.",
      "speaker": "Ender Wiggin",
      "work": "Ender’s Game · Orson Scott Card (1985)"
    },
    {
      "text": "Security is a process, not a product.",
      "speaker": "Bruce Schneier",
      "work": "Secrets and Lies (2000)"
    },
    {
      "text": "The more they overthink the plumbing, the easier it is to stop up the drain.",
      "speaker": "Scotty",
      "work": "Star Trek III: The Search for Spock (1984)"
    },
    {
      "text": "What is the cost of lies?",
      "speaker": "Valery Legasov",
      "work": "Chernobyl (HBO miniseries, 2019), Episode 1"
    },
    {
      "text": "With great power there must also come—great responsibility!",
      "speaker": "Stan Lee (narration caption)",
      "work": "Amazing Fantasy #15 · Stan Lee and Steve Ditko (1962)"
    },
    {
      "text": "Who watches the Watchmen?",
      "speaker": "Graffiti",
      "work": "Watchmen · Alan Moore and Dave Gibbons (1986–87)"
    },
    {
      "text": "A strange game. The only winning move is not to play.",
      "speaker": "Joshua (WOPR)",
      "work": "WarGames (1983 film)"
    },
    {
      "text": "Too many secrets.",
      "speaker": "Martin Bishop",
      "work": "Sneakers (1992 film) · anagram of “Setec Astronomy”"
    },
    {
      "text": "Failure is not an option.",
      "speaker": "Gene Kranz (film character)",
      "work": "Apollo 13 (1995 film) · line written for the film"
    },
    {
      "text": "Who controls the past controls the future: who controls the present controls the past.",
      "speaker": "The Party slogan",
      "work": "Nineteen Eighty-Four · George Orwell (1949)"
    },
    {
      "text": "Fear is the mind-killer.",
      "speaker": "Paul Atreides",
      "work": "Dune · Frank Herbert (1965)"
    },
    {
      "text": "Don’t Panic.",
      "speaker": "The Guide",
      "work": "The Hitchhiker’s Guide to the Galaxy · Douglas Adams (1979)"
    },
    {
      "text": "Small moves, Ellie. Small moves.",
      "speaker": "S. R. Hadden",
      "work": "Contact (1997 film)"
    }
  ];
  const nodes = document.querySelectorAll('[data-domain-quote]');
  if (!nodes.length) return;
  const key = 'quiz-hub:domain-quotes:v2';
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
  nodes.forEach(node => { node.textContent = "“" + quotes[state.last].text + "”"; });
  document.querySelectorAll("[data-domain-attribution]").forEach(node => { node.textContent = "— " + quotes[state.last].speaker + " · " + quotes[state.last].work; });
  try { sessionStorage.setItem(key, JSON.stringify(state)); } catch {}
})();
