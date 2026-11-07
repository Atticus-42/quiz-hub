(() => {
  const finder = document.querySelector('[data-signal-finder]');
  if (finder) {
    const search = document.querySelector('#signal-search');
    const category = document.querySelector('#signal-category');
    const equipment = document.querySelector('#signal-equipment');
    const count = document.querySelector('#signal-count');
    const empty = document.querySelector('#signal-empty');
    const cards = [...document.querySelectorAll('[data-signal-card]')];
    const filter = () => {
      const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      let visible = 0;
      for (const card of cards) {
        const { signalSearch, signalType, signalModel } = card.dataset;
        const match = (!category.value || category.value === signalType)
          && (!equipment.value || equipment.value === signalModel)
          && terms.every(term => signalSearch.toLowerCase().includes(term));
        card.hidden = !match;
        if (match) visible++;
      }
      count.textContent = visible === 1 ? '1 guide' : visible + ' guides';
      empty.hidden = visible > 0;
    };
    search.value = new URLSearchParams(location.search).get('q') ?? '';
    search.addEventListener('input', filter);
    category.addEventListener('change', filter);
    equipment.addEventListener('change', filter);
    finder.hidden = false;
    filter();
  }

  const guide = document.querySelector('[data-signal-guide]');
  if (!guide) return;

  const play = guide.querySelector('[data-signal-play]');
  const diagram = guide.querySelector('.signal-diagram');
  play.hidden = false;
  play.addEventListener('click', () => {
    const playing = diagram.classList.toggle('is-playing');
    play.textContent = playing ? 'Pause signal flow' : 'Play signal flow';
  });

  const print = guide.querySelector('[data-signal-print]');
  print.hidden = false;
  print.addEventListener('click', () => window.print());

  const calculator = guide.querySelector('[data-signal-dipole]');
  if (calculator) {
    const frequency = calculator.querySelector('input');
    const result = calculator.querySelector('output');
    const format = new Intl.NumberFormat('en', { maximumFractionDigits: 3 });
    const length = value => value < 0.01 || value >= 1e7 ? value.toExponential(3) : format.format(value);
    const calculate = () => {
      const mhz = frequency.valueAsNumber;
      const total = 468 / mhz;
      if (!Number.isFinite(mhz) || mhz <= 0 || !Number.isFinite(total)) {
        result.textContent = 'Enter a positive frequency in MHz.';
        return;
      }
      const arm = total / 2;
      result.textContent = `Total ${length(total)} ft (${length(total * 0.3048)} m) · Each arm ${length(arm)} ft (${length(arm * 0.3048)} m)`;
    };
    calculator.addEventListener('submit', event => {
      event.preventDefault();
      calculate();
    });
    frequency.addEventListener('input', calculate);
    calculate();
    calculator.hidden = false;
  }

  const steps = [...guide.querySelectorAll('[data-signal-step]')];
  const keys = steps.map(step => step.closest('li').querySelector('h3').textContent);
  const progress = guide.querySelector('[data-signal-progress]');
  const progressText = guide.querySelector('[data-signal-progress-text]');
  const progressBar = progress.querySelector('progress');
  const reset = guide.querySelector('[data-signal-reset]');
  const storageNote = guide.querySelector('[data-signal-storage]');
  const storageKey = 'quiz-hub:signal-howto:' + guide.dataset.signalGuide;
  const storageUnavailable = () => {
    storageNote.textContent = 'Progress is available while this guide is open.';
  };

  function updateProgress() {
    const complete = steps.filter(step => step.checked).length;
    progressBar.value = complete;
    progressText.textContent = complete + ' of ' + steps.length + ' steps complete';
    reset.disabled = complete === 0;
  }

  function saveProgress() {
    const completedKeys = keys.filter((_, index) => steps[index].checked);
    try {
      if (completedKeys.length) localStorage.setItem(storageKey, JSON.stringify(completedKeys));
      else localStorage.removeItem(storageKey);
    } catch {
      storageUnavailable();
    }
    updateProgress();
  }

  let saved = [];
  try {
    const state = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (Array.isArray(state)) saved = state;
  } catch {
    storageUnavailable();
  }

  steps.forEach((step, index) => {
    step.checked = saved.includes(keys[index]);
    step.closest('label').hidden = false;
    step.addEventListener('change', saveProgress);
  });
  reset.addEventListener('click', () => {
    steps.forEach(step => { step.checked = false; });
    saveProgress();
    steps[0]?.focus();
  });
  progress.hidden = false;
  updateProgress();
})();
