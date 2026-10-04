// Combined Exam specific checks (run by scripts/verify.mjs after the shared engine suite).
export default async function combinedChecks({ test, assert, lesson, lessons, loadApi, plain, seededRandom }) {
  const LESSONS = ['ISR Operations', 'Armor Operations', 'Field Artillery Operations', 'Army Operations'];
  const REFERENCE_PATTERNS = {
    'ISR Operations': / \(ISR Operations, slides? \d+(?:, \d+)*\)$/,
    'Armor Operations': / \(Armor Operations, pages? \d+(?:, \d+)*\)$/,
    'Field Artillery Operations': / \(Field Artillery Operations, slides? \d+(?:, \d+)*\)$/,
    // Army Operations page references are optional: only items that cite pages get one.
    'Army Operations': / \(Army Operations, pages? \d+(?:, \d+)*\)$/,
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

  await test('[combined] the sampler deals 15 each to the lessons at random, covers terms inside each lesson share and shuffles all 60', () => {
    const api = loadApi();
    assert.deepEqual(plain(api.poolQuotas()), [15, 15, 15, 15]);
    let draws = 0;
    const counting = () => { draws++; return 0.5; };
    const questions = plain(api.sampleQuestions(lesson.banks.easy, counting));
    assert.ok(draws > 0, 'every random choice uses the injected random');
    assert.equal(questions.length, 60);
    assert.equal(new Set(questions.map(item => item.id)).size, 60, 'no duplicates');
    const shares = lesson.pool.lessons.map(key => questions.filter(item => item.lessonKey === key).length);
    assert.deepEqual([...shares].sort(), [15, 15, 15, 15]);
    // Inside a share the first picks are the greedy cover: a lesson's share touches more terms than the same number of arbitrary questions would.
    for (const key of lesson.pool.lessons) {
      const own = lesson.banks.easy.filter(item => item.lessonKey === key);
      const share = questions.filter(item => item.lessonKey === key);
      const termsOf = list => new Set(list.flatMap(item => plain(api.questionTerms(item))));
      assert.ok(termsOf(share).size >= termsOf(own.slice(0, share.length)).size, `${key}: the share covers at least as many terms as the first ${share.length} questions`);
    }
    const lessonCounts = new Map(LESSONS.map(name => [name, new Set()]));
    const seen = new Set();
    for (let index = 1; index <= 200; index++) {
      const seed = Math.imul(index, 0x9e3779b1) >>> 0;
      const questions = plain(api.sampleQuestions(lesson.banks.hard, seededRandom(seed)));
      assert.equal(questions.length, 60);
      LESSONS.forEach(name => lessonCounts.get(name).add(questions.filter(item => item.lesson === name).length));
      questions.forEach(item => seen.add(item.id));
      assert.deepEqual(plain(api.sampleQuestions(lesson.banks.hard, seededRandom(seed))), questions, 'the same injected random reproduces the same draw');
    }
    for (const [name, counts] of lessonCounts) assert.deepEqual([...counts].sort(), [15], `${name} always receives 15`);
    assert.ok(seen.size > 60, 'different draws ask different questions');
    // Rotation: marking what was asked as seen makes later draws prefer the questions not yet asked, so a few attempts reach all of them.
    const progress = Object.fromEntries(lesson.pool.lessons.map(key => [key, {}]));
    const reached = new Set();
    for (let attempt = 0; attempt < 40 && reached.size < lesson.banks.hard.length; attempt++) {
      for (const item of plain(api.sampleQuestions(lesson.banks.hard, seededRandom(attempt + 1), progress))) {
        reached.add(item.id);
        progress[item.lessonKey][item.qid] = 's';
      }
    }
    assert.equal(reached.size, lesson.banks.hard.length, 'rotation reaches every question of the pool');
  });

  await test('[combined] the page speaks of all four lessons (warning, buttons, lede, lesson analysis)', () => {
    assert.match(lesson.text.studyWarningLead, /ALL four lessons/);
    assert.equal(lesson.text.topicNoun, 'Lesson');
    assert.equal(lesson.pool.count, 60);
    assert.match(lesson.lede, /\{count\} situational questions/);
  });
}
