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
  const images = [...document.querySelectorAll('[data-class-crest], img[src*="bandwidth-brothers-colored"]')];
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
  preview.src = new URL(file + '-320.webp', base).href;
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
    },
    {
      "text": "Humankind cannot gain anything without first giving something in return.",
      "speaker": "Alphonse Elric",
      "work": "Fullmetal Alchemist (2003 anime) · opening narration"
    },
    {
      "text": "Someone who can’t sacrifice anything, can’t ever change anything.",
      "speaker": "Armin Arlert",
      "work": "Attack on Titan · English translation"
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
/* Class playlist: a small launcher on every page. Nothing loads from Spotify until a visitor opens it.
   Shuffle (the default) plays the tracks listed in assets/playlist.json in random order, one track at a time,
   through Spotify's iFrame API. With shuffle off, Spotify plays the playlist in its own order. */
(() => {
  if (!document.body || !document.createElement) return;
  const base = new URL('./', document.currentScript ? document.currentScript.src : location.href);
  const PLAYLIST = 'spotify:playlist:6qFNGPhnQVge6pWv8zaKY8';
  const API = 'https://open.spotify.com/embed/iframe-api/v1';
  const popout = document.body.hasAttribute('data-playlist-popout');
  const prefKey = 'quiz-hub:playlist-shuffle';
  const deckKey = 'quiz-hub:playlist-deck:v1';
  const read = (store, key) => { try { return window[store].getItem(key); } catch { return null; } };
  const write = (store, key, value) => { try { window[store].setItem(key, value); } catch {} };
  const icon = (path, fill) => '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="' + path + '" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let shuffle = read('localStorage', prefKey) !== 'off';
  let tracks = null, deck = [], at = -1, saved = '', ended = '';
  let controller = null, started = false, wantPlay = false, playing = false, apiPromise = null;

  const box = document.createElement('div');
  box.className = 'bb-music' + (popout ? ' is-popout' : '');
  box.innerHTML = '<div class="bb-music-panel' + (popout ? '' : ' is-hidden') + '" id="bb-music-panel" role="region" aria-label="Class playlist">'
    + '<div class="bb-music-head"><span>Class playlist</span>'
    + '<button type="button" data-music-shuffle title="Shuffle" aria-label="Shuffle" aria-pressed="' + shuffle + '">' + icon('M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5') + '</button>'
    + '<button type="button" data-music-next title="Next song" aria-label="Next song"' + (shuffle ? '' : ' hidden') + '>' + icon('M6 5l9 7-9 7z M18 5v14', true) + '</button>'
    + (popout ? '' : '<button type="button" data-music-pop title="Pop out" aria-label="Pop out: keeps playing while you move between pages">' + icon('M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5') + '</button>'
      + '<button type="button" data-music-hide title="Hide" aria-label="Hide the player (music keeps playing)">' + icon('M6 9l6 6 6-6') + '</button>')
    + '</div><div class="bb-music-frame"></div></div>'
    + (popout ? '' : '<button type="button" class="bb-music-toggle" aria-controls="bb-music-panel" aria-expanded="false" aria-label="Class playlist" title="Class playlist">'
      + '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" fill="currentColor"/><circle cx="17" cy="16" r="3" fill="currentColor"/></svg></button>');
  document.body.appendChild(box);
  const panel = box.querySelector('.bb-music-panel');
  const slot = box.querySelector('.bb-music-frame');
  const toggle = box.querySelector('.bb-music-toggle');
  const shuffleButton = box.querySelector('[data-music-shuffle]');
  const nextButton = box.querySelector('[data-music-next]');

  // The shuffled order lasts for the browser tab, so moving between pages does not replay songs.
  const reshuffle = () => {
    deck = tracks.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    at = -1;
  };
  const restore = () => {
    let state;
    try { state = JSON.parse(read('sessionStorage', deckKey)); } catch {}
    if (state && Array.isArray(state.deck) && state.deck.length === tracks.length && Number.isInteger(state.at) && state.at < tracks.length) { deck = state.deck; at = state.at; } else reshuffle();
  };
  const pick = () => {
    if (++at >= deck.length) { reshuffle(); at = 0; }
    return tracks[deck[at]];
  };
  const nextTrack = () => (tracks ? Promise.resolve() : fetch(new URL('playlist.json', base)).then(response => response.json()).then(data => {
    tracks = data.tracks.map(id => 'spotify:track:' + id);
    restore();
  })).then(pick);

  const api = () => apiPromise || (apiPromise = new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement('script');
    script.src = API;
    script.async = true;
    script.onerror = reject;
    document.head.appendChild(script);
  }));
  const load = (uri, play) => { wantPlay = play; ended = ''; controller.loadUri(uri); };
  const onUpdate = event => {
    const d = event.data || {};
    playing = !d.isPaused && d.position > 0;
    if (!shuffle || !tracks || d.playingURI !== tracks[deck[at]]) return;
    if (playing && saved !== d.playingURI) { saved = d.playingURI; write('sessionStorage', deckKey, JSON.stringify({ deck, at })); }
    if (d.duration > 0 && d.position >= d.duration - 400 && ended !== d.playingURI) { ended = d.playingURI; nextTrack().then(uri => load(uri, true)); }
  };
  const start = () => {
    if (started) return;
    started = true;
    const host = document.createElement('div');
    slot.appendChild(host);
    Promise.all([api(), shuffle ? nextTrack() : PLAYLIST]).then(([IFrameAPI, uri]) => IFrameAPI.createController(host, { uri, width: '100%', height: 152 }, c => {
      controller = c;
      if (c.iframeElement) c.iframeElement.title = 'Spotify player: Bandwidth Brothers class playlist';
      c.addListener('ready', () => { if (wantPlay) { wantPlay = false; c.play(); } });
      c.addListener('playback_update', onUpdate);
    })).catch(() => {
      // Spotify's player script could not load: fall back to the plain playlist player.
      slot.innerHTML = '<iframe title="Spotify player: Bandwidth Brothers class playlist" src="https://open.spotify.com/embed/playlist/6qFNGPhnQVge6pWv8zaKY8?theme=0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>';
    });
    if (toggle) toggle.classList.add('is-loaded');
  };
  const stop = () => {
    if (controller) controller.destroy();
    slot.innerHTML = '';
    controller = null; started = false; playing = false;
    if (toggle) toggle.classList.remove('is-loaded');
  };
  // Hiding uses visibility, not display:none, so a playing track keeps going.
  const show = open => {
    panel.classList.toggle('is-hidden', !open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
    if (open) start();
  };

  shuffleButton.addEventListener('click', () => {
    shuffle = !shuffle;
    write('localStorage', prefKey, shuffle ? 'on' : 'off');
    shuffleButton.setAttribute('aria-pressed', String(shuffle));
    nextButton.hidden = !shuffle;
    if (!controller) return;
    const resume = playing;
    if (shuffle) nextTrack().then(uri => load(uri, resume)); else load(PLAYLIST, resume);
  });
  nextButton.addEventListener('click', () => { if (controller && shuffle) nextTrack().then(uri => load(uri, true)); });
  if (popout) { start(); return; }
  toggle.addEventListener('click', () => show(panel.classList.contains('is-hidden')));
  box.querySelector('[data-music-hide]').addEventListener('click', () => { show(false); toggle.focus(); });
  box.querySelector('[data-music-pop]').addEventListener('click', () => {
    if (!window.open(new URL('playlist.html', base).href, 'bb-playlist', 'popup,width=420,height=250')) return;
    stop();
    show(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.classList.contains('is-hidden') && box.contains(document.activeElement)) { show(false); toggle.focus(); }
  });
  // Quiz pages pin their answer controls to the bottom of the screen; sit above them.
  const bar = document.querySelector('.quiz-actions');
  const lift = () => box.style.setProperty('--bb-music-lift', bar && getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight + 'px' : '0px');
  lift();
  addEventListener('resize', lift);
  // The bar is empty until a quiz starts, so follow its size as it appears and changes.
  if (bar && window.ResizeObserver) new ResizeObserver(lift).observe(bar);
})();
