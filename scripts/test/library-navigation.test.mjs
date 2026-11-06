import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const html = readFileSync(new URL('../../library/index.html', import.meta.url), 'utf8');
const docs = JSON.parse(html.match(/<script type="application\/json" id="library-data">([\s\S]*?)<\/script>/)[1]);
test('original PDFs link to files; Reviewer 101 links to web pages', () => {
  for (const doc of docs) {
    if (doc.file) {
      assert.ok(existsSync(new URL('../../library/files/' + doc.file + '.pdf', import.meta.url)));
      assert.ok(html.includes('href="../library/files/' + doc.file + '.pdf" target="_blank" rel="noopener"'));
    }
    if (doc.kind === 'reviewer') {
      assert.ok(doc.web.startsWith('reviewer/'));
      assert.equal(doc.file, undefined);
      assert.ok(html.includes('href="../' + doc.web + '"'));
    }
  }
  assert.equal(docs.filter(doc => doc.kind === 'reviewer').length, 32);
});
test('library no longer embeds a custom PDF viewer', () => {
  const code = readFileSync(new URL('../../assets/library.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="pdf-surface"|<canvas|<iframe|id="pdf-zoom"/);
  assert.doesNotMatch(code, /pdfjs|getDocument\(|mountPages/);
  assert.ok(code.includes("location.replace('files/'"));
  assert.ok(code.includes("location.replace('../' + selected.web)"));
});

test('catalogue omits every record without a readable file or web reviewer', () => {
  for (const doc of docs) {
    const appears = html.includes('data-id="' + doc.id + '"');
    assert.equal(appears, Boolean(doc.file || doc.web), doc.id);
  }
  for (const field of ['library-module','library-availability','library-sort','library-reset','library-list-view']) assert.ok(html.includes('id="'+field+'"'));
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
