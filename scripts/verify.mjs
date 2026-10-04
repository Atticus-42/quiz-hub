// The whole test gate, no network access (the class history endpoint is cleared or faked):
//   node scripts/build.mjs && node scripts/verify.mjs
// 1. the build and every question bank, 2. the engine suite once per lesson quiz and pool exam (plus the
// lesson's own lessons/<key>/checks.mjs, if any), 3. apps-script/Code.gs in a sandbox, 4. the hub,
// 5. the instructor page, the class page and the weekly schedule, 6. the shared design system (fonts, assets, contrast, overflow).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadLessons } from './build.mjs';
import { results, test, plain, seededRandom, runPage, withEndpoint } from './test/harness.mjs';
import { buildSuite } from './test/build.test.mjs';
import { engineSuite } from './test/engine.test.mjs';
import { codeGsSuite } from './test/codegs.test.mjs';
import { hubSuite } from './test/hub.test.mjs';
import { instructorSuite, classSuite } from './test/instructor.test.mjs';
import { designSuite } from './test/design.test.mjs';
import { scheduleSuite } from './test/schedule.test.mjs';

const { modules, lessons } = loadLessons();
// Shares per pool lesson, as the engine computes them.
for (const lesson of lessons.filter(item => item.pool)) {
  const count = lesson.pool.count;
  const n = lesson.pool.lessons.length;
  lesson.poolQuotas = Array.from({ length: n }, (_, index) => Math.floor(count / n) + (index < count % n ? 1 : 0));
}

await buildSuite({ modules, lessons });
for (const lesson of lessons) {
  await engineSuite(lesson);
  const checks = join(lesson.dir, 'checks.mjs');
  if (existsSync(checks)) {
    const { default: run } = await import(pathToFileURL(checks).href);
    const loadApi = () => runPage(withEndpoint(readFileSync(join(ROOT, lesson.slug, 'index.html'), 'utf8'), '')).window.__quiz;
    await run({ test, assert, lesson, lessons, loadApi, plain, seededRandom });
  }
}
await codeGsSuite();
await hubSuite({ lessons });
await instructorSuite({ lessons });
await classSuite();
await scheduleSuite({ lessons });
await designSuite({ lessons });

if (results.failures > 0) {
  console.error(`\n${results.failures} of ${results.tests} verification tests failed:\n  ${results.failed.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${results.tests} verification tests passed`);
}
