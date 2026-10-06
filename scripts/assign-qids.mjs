// Helper for appending questions: renumbers `id` 1..n in each lessons/<key>/{easy,medium,hard}.json and gives
// every question without a `qid` the next free permanent id (<key>-<e|m|h>-NN). Existing qids never change,
// so the instructor's question analysis keeps its history.
//
//   node scripts/assign-qids.mjs            all lessons
//   node scripts/assign-qids.mjs signal     one lesson
//
// Then: node scripts/build.mjs && node scripts/verify.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, MODES, MODE_LETTERS } from './build.mjs';

const only = process.argv[2];
const lessonsDir = join(ROOT, 'lessons');
for (const key of readdirSync(lessonsDir)) {
  if (key.startsWith('_') || (only && key !== only)) continue;
  for (const mode of MODES) {
    const path = join(lessonsDir, key, `${mode}.json`);
    if (!existsSync(path)) continue;
    const bank = JSON.parse(readFileSync(path, 'utf8'));
    const prefix = `${key}-${MODE_LETTERS[mode]}-`;
    // qids listed in lessons/<key>/retired.json were removed from the banks and are never issued again
    const retiredPath = join(lessonsDir, key, 'retired.json');
    const retired = existsSync(retiredPath) ? JSON.parse(readFileSync(retiredPath, 'utf8')) : [];
    let next = Math.max(0, ...[...bank.map(item => item.qid), ...retired].map(qid => (typeof qid === 'string' && qid.startsWith(prefix) ? Number(qid.slice(prefix.length)) || 0 : 0))) + 1;
    let added = 0;
    const out = bank.map((item, index) => {
      const { id, qid, ...rest } = item;
      const assigned = typeof qid === 'string' && qid ? qid : `${prefix}${String(next++).padStart(2, '0')}`;
      if (assigned !== qid) added++;
      return { id: index + 1, qid: assigned, ...rest };
    });
    writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`${key} ${mode}: ${out.length} questions, ${added} new qid${added === 1 ? '' : 's'}`);
  }
}
