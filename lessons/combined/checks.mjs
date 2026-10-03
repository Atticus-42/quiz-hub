// Combined Exam specific checks (run by scripts/verify.mjs after the shared engine suite).
export default async function combinedChecks({ test, assert, lesson, lessons, loadApi, plain, seededRandom }) {
  const LESSONS = ['ISR Operations', 'Armor Operations', 'Field Artillery Operations', 'Army Operations'];
  const REFERENCE_PATTERNS = {
    'ISR Operations': / \(ISR Operations, slides? \d+(?:, \d+)*\)$/,
    'Armor Operations': / \(Armor Operations, pages? \d+(?:, \d+)*\)$/,
    'Field Artillery Operations': / \(Field Artillery Operations, slides? \d+(?:, \d+)*\)$/,
  };

  for (const [mode, bank] of Object.entries(lesson.banks)) {
    await test(`[combined] ${mode} pool: every question of the four lesson banks, in lesson order, lesson = category, references moved into the explanation`, () => {
      const sources = lesson.pool.lessons.map(key => lessons.find(item => item.key === key));
      assert.deepEqual(sources.map(source => source.name), LESSONS);
      assert.equal(bank.length, sources.reduce((sum, source) => sum + source.banks[mode].length, 0));
      let index = 0;
      for (const source of sources) {
        for (const original of source.banks[mode]) {
          const item = bank[index++];
          assert.equal(item.id, index);
          assert.equal(item.qid, original.qid, 'the source question id is kept');
          assert.equal(item.lessonKey, source.key);
          assert.equal(item.category, source.name);
          assert.equal(item.lesson, source.name);
          assert.equal(item.prompt, original.prompt);
          assert.deepEqual(item.options, original.options, 'option order unchanged');
          assert.equal(item.answer, original.answer);
          assert.equal('sourceSlides' in item, false);
          const pattern = REFERENCE_PATTERNS[source.name];
          if (pattern && original.sourceSlides) assert.match(item.explanation, pattern);
          else assert.doesNotMatch(item.explanation, /\((?:ISR|Armor|Field Artillery|Army) Operations, /);
        }
      }
    });
  }

  await test('[combined] the sampler deals 8/8/7/7 to the lessons at random, draws inside each lesson and shuffles all 30 (hand-checked with random = 0)', () => {
    const api = loadApi();
    assert.deepEqual(plain(api.poolQuotas()), [8, 8, 7, 7]);
    // Fisher-Yates with every draw 0 rotates an array left by one. Quotas [8,8,7,7] become [8,7,7,8]
    // (ISR 8, Armor 7, Field Artillery 7, Army Operations 8); each lesson pool starts at its 2nd question;
    // the final shuffle moves the first pick (ISR id 2) to the end.
    let draws = 0;
    const zero = () => { draws++; return 0; };
    const ids = plain(api.sampleQuestions(lesson.banks.easy, zero)).map(item => item.id);
    const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
    assert.deepEqual(ids, [...range(3, 9), ...range(27, 33), ...range(52, 58), ...range(77, 84), 2]);
    assert.equal(draws, 3 + 4 * 24 + 29, 'quota deal, four lesson shuffles and the final shuffle all use the injected random');
    const lessonCounts = new Map(LESSONS.map(name => [name, new Set()]));
    const seen = new Set();
    for (let index = 1; index <= 200; index++) {
      const seed = Math.imul(index, 0x9e3779b1) >>> 0;
      const questions = plain(api.sampleQuestions(lesson.banks.hard, seededRandom(seed)));
      assert.equal(questions.length, 30);
      LESSONS.forEach(name => lessonCounts.get(name).add(questions.filter(item => item.lesson === name).length));
      questions.forEach(item => seen.add(item.id));
      assert.deepEqual(plain(api.sampleQuestions(lesson.banks.hard, seededRandom(seed))), questions, 'the same injected random reproduces the same draw');
    }
    for (const [name, counts] of lessonCounts) assert.deepEqual([...counts].sort(), [7, 8], `${name} receives both 7 and 8 across attempts`);
    assert.equal(seen.size, lesson.banks.hard.length, 'every question of the pool can be drawn');
  });

  await test('[combined] the page speaks of all four lessons (warning, buttons, lede, lesson analysis)', () => {
    assert.match(lesson.text.studyWarningLead, /ALL four lessons/);
    assert.equal(lesson.text.topicNoun, 'Lesson');
    assert.equal(lesson.pool.count, 30);
    assert.match(lesson.lede, /\{count\} situational questions/);
  });
}
