import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const html = readFileSync(new URL('../../library/index.html', import.meta.url), 'utf8');
const docs = JSON.parse(html.match(/<script type="application\/json" id="library-data">([\s\S]*?)<\/script>/)[1]);
test('original PDFs link to files; Reviewer 101 stays out of the library', () => {
  for (const doc of docs) {
    if (doc.file) {
      assert.ok(existsSync(new URL('../../library/files/' + doc.file + '.pdf', import.meta.url)));
      assert.ok(html.includes('href="../library/files/' + doc.file + '.pdf" target="_blank" rel="noopener"'));
    }
  }
  assert.equal(docs.filter(doc => doc.kind === 'reviewer' || doc.web).length, 0);
  assert.doesNotMatch(html, /data-kind="reviewer"|data-type="reviewer"|REVIEWER 101|Web reviewers|href="\.\.\/reviewer\/[a-z]/);
});
test('library no longer embeds a custom PDF viewer', () => {
  const code = readFileSync(new URL('../../assets/library.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="pdf-surface"|<canvas|<iframe|id="pdf-zoom"/);
  assert.doesNotMatch(code, /pdfjs|getDocument\(|mountPages/);
  assert.ok(code.includes("location.replace('files/'"));
  assert.ok(!code.includes("'reviewer'"));
});

test('catalogue omits every record without a readable file or web reviewer', () => {
  for (const doc of docs) {
    const appears = html.includes('data-id="' + doc.id + '"');
    assert.equal(appears, Boolean(doc.file || doc.web), doc.id);
  }
  for (const field of ['library-module','library-availability','library-sort','library-reset','library-list-view']) assert.ok(html.includes('id="'+field+'"'));
});

test('restricted references have citation records and no public download', () => {
  for (const id of ['afpm-6-07', 'source-elint', 'source-eccm', 'fc-8-039']) {
    const doc = docs.find(record => record.id === id);
    assert.ok(doc?.restricted, id);
    assert.ok(!doc.file && !doc.web, id);
  }
  for (const file of ['lesson-electronic-intelligence', 'lesson-electronic-counter-countermeasures']) {
    assert.ok(!existsSync(new URL('../../library/files/' + file + '.pdf', import.meta.url)));
  }
});

test('shared style and crest favicon are local files on library and exams', () => {
  for (const path of ['library/index.html','module-6-exam/index.html','reviewer/eccm/index.html']) {
    const page = readFileSync(new URL('../../'+path, import.meta.url),'utf8');
    const prefix = '../'.repeat(path.split('/').length-1);
    assert.ok(page.includes('href="'+prefix+'assets/ui-polish.css"'));
    assert.ok(page.includes('<link rel="icon" type="image/png" href="'+prefix+'assets/bandwidth-brothers-colored.png">'));
  }
  assert.ok(existsSync(new URL('../../assets/ui-polish.css',import.meta.url)));
  assert.ok(existsSync(new URL('../../assets/bandwidth-brothers-colored.png',import.meta.url)));
});
