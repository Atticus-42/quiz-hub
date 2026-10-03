// Lesson-specific content rules for Signal Support in Combined Arms Operations (run by scripts/verify.mjs
// after the shared engine suite). Questions appended later must keep these rules.
export default async function signalChecks({ test, assert, lesson }) {
  const banks = lesson.banks;
  const allQuestions = [...banks.easy, ...banks.medium, ...banks.hard];
  const CONJUNCTION = /\b(but|because|since)\b/i;
  const isListOption = option => (option.match(/[,;]/g) ?? []).length >= 2;

  await test('[signal] every question cites substantive handout pages and the explanation names the page', () => {
    for (const item of allQuestions) {
      const label = `${item.difficulty} ${item.id}`;
      assert.ok(item.sourceSlides.every(page => page >= 1 && page <= 19), `${label} pages`);
      assert.deepEqual(item.sourceSlides, [...new Set(item.sourceSlides)].sort((a, b) => a - b), `${label} pages are sorted and unique`);
      assert.match(item.explanation, /\bPages? \d+/i, `${label} explanation must cite a handout page`);
      for (const [, page] of item.explanation.matchAll(/\bpages? (\d+)/gi)) {
        assert.ok(item.sourceSlides.includes(Number(page)), `${label} explanation cites page ${page} missing from sourceSlides`);
      }
    }
  });

  await test('[signal] all three banks span the whole handout and its key terms', () => {
    const pages = new Set(allQuestions.flatMap(item => item.sourceSlides));
    for (let page = 1; page <= 19; page++) assert.ok(pages.has(page), `no question draws on handout page ${page}`);
    const corpus = allQuestions.map(item => `${item.prompt} ${item.options.join(' ')} ${item.explanation}`).join(' ').toLowerCase();
    const terms = ['Signal Operations', 'Signal Support Operations', 'Combined Arms Operations', 'Archipelagic', 'Disaster-Prone', 'Highly Urbanized', 'Universally Connected', 'Politically', 'Collective Environment', 'Culturally Diverse', 'PMESII-PT', 'METT-TC', 'physical environment', 'cyberspace', 'electromagnetic spectrum', 'logical domain', 'people domain', 'BONTEX', 'PANET', 'VoIP', 'DBTOCS', 'HF', 'UHF', 'Combat Net Radio', 'ROIP', 'Ad hoc', 'SMMART', 'SMTF', 'electro-optic', 'CSIRT', 'Connect, Sustain, and Recover', 'Operations Focused', 'Interoperable', 'Redundant', 'Scalable', 'Secured', 'METAL', 'site survey', 'MDMP', 'Troop Leading Procedures', 'PACE', 'Alternate', 'Contingency', 'Emergency', 'C4S Annex', 'CEOI', 'CESI', 'COMSEC', 'Confidentiality', 'Integrity', 'Availability', 'Defensive Cyber Operations', 'Active Defense', 'frequency hopping', 'support, attack and protect', 'coalition', 'joint', 'disaster-response net', 'compromise', 'video teleconferencing', 'collaboration systems', 'backbone', 'mobile ad hoc networks', 'incident response plan', 'cellular phones', 'satellite phones', 'administrative and logistical requirements', 'unit policies', 'detailed security procedure'];
    for (const term of terms) assert.ok(corpus.includes(term.toLowerCase()), `the banks never address "${term}"`);
  });

  for (const [name, bank] of Object.entries(banks)) {
    await test(`[signal] ${name} keys carry no give-away cues: never the only option with but/because/since or the only list`, () => {
      for (const item of bank) {
        const others = item.options.filter((_, index) => index !== item.answer);
        const key = item.options[item.answer];
        if (CONJUNCTION.test(key)) assert.ok(others.some(option => CONJUNCTION.test(option)), `${name} ${item.id}: key is the only option with but/because/since`);
        if (isListOption(key)) assert.ok(others.some(isListOption), `${name} ${item.id}: key is the only list-style option`);
      }
    });
  }

  // Prompts may share a template ("What does X stand for?") as long as each asks about a distinct X: two
  // prompts with word overlap of 0.4 or more must have clearly different keys, and no two prompts may
  // overlap by 0.85 or more at all.
  await test('[signal] no two questions are near-duplicates (similar prompts ask about distinct subjects with distinct keys)', () => {
    const words = text => new Set(text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(word => word.length > 3));
    const overlap = (left, right) => {
      const shared = [...left].filter(word => right.has(word)).length;
      return shared / (left.size + right.size - shared);
    };
    const sets = allQuestions.map(item => [`${item.difficulty} ${item.id}`, words(item.prompt), words(item.options[item.answer])]);
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const [a, left, leftKey] = sets[i];
        const [b, right, rightKey] = sets[j];
        const similarity = overlap(left, right);
        assert.ok(similarity < 0.85, `${a} and ${b} prompts are too similar`);
        if (similarity >= 0.4) assert.ok(overlap(leftKey, rightKey) < 0.5, `${a} and ${b} have similar prompts and similar keys`);
      }
    }
  });
}
