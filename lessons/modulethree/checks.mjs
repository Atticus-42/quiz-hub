import { checkLessonConfig } from '../../scripts/build.mjs';

// Runs in the standard scripts/verify.mjs gate alongside the shared pool suite.
export default async function moduleThreeChecks({ test, assert, lesson, lessons, loadApi, plain, seededRandom }) {
  await test('[modulethree] pool limits cap Module 3 at 50 without changing Module 2', () => {
    assert.doesNotThrow(() => checkLessonConfig(lesson, lesson.dir));
    assert.throws(() => checkLessonConfig({ ...lesson, pool: { ...lesson.pool, count: 51 } }, lesson.dir), /45 to 50/);
    const moduleTwo = lessons.find(item => item.key === 'combined');
    assert.throws(() => checkLessonConfig({ ...moduleTwo, pool: { ...moduleTwo.pool, count: 45 } }, moduleTwo.dir), /50 to 69/);
  });

  await test('[modulethree] all difficulties balance the three lessons and reshuffle with explanations', () => {
    for (const mode of ['easy', 'medium', 'hard']) {
      const api = loadApi();
      const banks = api.getBanks();
      const first = plain(api.createAttempt(mode, banks, seededRandom(12)));
      const next = plain(api.createAttempt(mode, banks, seededRandom(81)));
      assert.equal(first.questions.length, 45);
      assert.equal(new Set(first.questions.map(q => q.qid)).size, 45);
      for (const key of ['signal', 'signaljoint', 'coalition']) {
        assert.equal(first.questions.filter(q => q.lessonKey === key).length, 15);
      }
      assert.ok(first.questions.every(q => q.difficulty === mode && q.explanation && q.options.length === 4));
      assert.notDeepEqual(first.questions.map(q => q.qid), next.questions.map(q => q.qid));
      assert.equal(api.startQuiz(mode), false, 'study confirmation is required');
    }
  });
}
