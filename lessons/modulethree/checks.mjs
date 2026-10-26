import { checkLessonConfig } from '../../scripts/build.mjs';

// Runs in the standard scripts/verify.mjs gate alongside the shared pool suite.
export default async function moduleThreeChecks({ test, assert, lesson, lessons, loadApi, plain, seededRandom }) {
  await test('[modulethree] both pool exams enforce 20–35 attempts', () => {
    assert.doesNotThrow(() => checkLessonConfig(lesson, lesson.dir));
    assert.throws(() => checkLessonConfig({ ...lesson, pool: { ...lesson.pool, count: 36 } }, lesson.dir), /20 to 35/);
    const moduleTwo = lessons.find(item => item.key === 'combined');
    assert.throws(() => checkLessonConfig({ ...moduleTwo, pool: { ...moduleTwo.pool, count: 45 } }, moduleTwo.dir), /20 to 35/);
  });

  await test('[modulethree] all difficulties balance the three lessons and reshuffle with explanations', () => {
    for (const mode of ['easy', 'medium', 'hard']) {
      const api = loadApi();
      const banks = api.getBanks();
      const first = plain(api.createAttempt(mode, banks, seededRandom(12)));
      const next = plain(api.createAttempt(mode, banks, seededRandom(81)));
      assert.equal(first.questions.length, 30);
      assert.equal(new Set(first.questions.map(q => q.qid)).size, 30);
      for (const key of ['signal', 'signaljoint', 'coalition']) {
        assert.equal(first.questions.filter(q => q.lessonKey === key).length, 10);
      }
      assert.ok(first.questions.every(q => q.difficulty === mode && q.explanation && q.options.length === 4));
      assert.notDeepEqual(first.questions.map(q => q.qid), next.questions.map(q => q.qid));
      assert.equal(api.startQuiz(mode), false, 'study confirmation is required');
    }
  });
}
