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
