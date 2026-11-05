import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';

const script = readFileSync(new URL('../../assets/identity.js', import.meta.url), 'utf8');
const catalogue = JSON.parse(readFileSync(new URL('../../assets/crests/catalogue.json', import.meta.url), 'utf8'));
const memory = new Map();
function visit({ blocked = false, fail = false } = {}) {
  const images = [{ src: 'original.png', alt: 'Crest', dataset: {} }, { src: 'original.png', alt: '', dataset: {} }];
  const labels = [{}];
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const context = { URL, Math, sessionStorage: storage, Image: class {
    set src(url) { this.url = url; if (!fail) this.onload(); }
    get src() { return this.url; }
  }, document: { currentScript: { src: 'https://example.test/quiz-hub/assets/identity.js' }, querySelectorAll: selector => selector === '[data-crest-label]' ? labels : images } };
  if (blocked) Object.defineProperty(context, 'sessionStorage', { get() { throw Error('disabled'); } });
  vm.runInNewContext(script, context);
  return { images, labels };
}
test('all 13 source editions exist, including original', () => {
  assert.equal(catalogue.length, 13);
  assert.ok(catalogue.some(item => item.file === 'colored.png'));
  for (const item of catalogue) assert.ok(existsSync(new URL('../../assets/crests/' + item.file, import.meta.url)));
});
test('all editions appear once per deck, with no consecutive repeat between decks', () => {
  let previous;
  for (let deck = 0; deck < 3; deck++) {
    const seen = new Set();
    for (let i = 0; i < 13; i++) {
      const { images } = visit();
      const edition = images[0].dataset.crestEdition;
      assert.notEqual(edition, previous);
      assert.equal(images[0].src, images[1].src);
      assert.equal(images[1].alt, '');
      assert.ok(images[0].src.startsWith('https://example.test/quiz-hub/assets/crests/'));
      seen.add(edition); previous = edition;
    }
    assert.equal(seen.size, 13);
  }
});
test('blocked or corrupted storage still displays a crest', () => {
  assert.ok(visit({ blocked: true }).images[0].dataset.crestEdition);
  memory.set('quiz-hub:crest-deck:v1', '{broken');
  assert.ok(visit().images[0].dataset.crestEdition);
});
test('failed image preserves original and does not advance the deck', () => {
  const before = memory.get('quiz-hub:crest-deck:v1');
  assert.equal(visit({ fail: true }).images[0].src, 'original.png');
  assert.equal(memory.get('quiz-hub:crest-deck:v1'), before);
});

