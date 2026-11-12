import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = path => readFileSync(join(root, path), 'utf8');
const data = JSON.parse(read('data/gallery.json'));
const html = read('gallery/index.html');
const file = src => join(root, src.split('?')[0]);

test('gallery data lists photos with files, alt, caption and real sizes', () => {
  assert.ok(data.photos.length >= 3);
  const ids = new Set();
  for (const photo of data.photos.filter(item => item.type !== 'video')) {
    assert.ok(!ids.has(photo.id), photo.id + ' is unique'); ids.add(photo.id);
    for (const key of ['src800', 'src1600']) assert.ok(existsSync(file(photo[key])), `${photo.id}: ${photo[key]} exists`);
    assert.ok(photo.alt.trim() && photo.caption.trim(), photo.id + ' alt and caption');
    assert.ok(Number.isInteger(photo.width) && Number.isInteger(photo.height) && photo.width > 0 && photo.height > 0, photo.id + ' size');
    const jpg = readFileSync(file(photo.src1600));
    let i = 2, size;
    while (i < jpg.length) { const m = jpg[i + 1]; if (m >= 0xc0 && m <= 0xc2) { size = [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)]; break; } i += 2 + jpg.readUInt16BE(i + 2); }
    assert.deepEqual(size, [photo.width, photo.height], photo.id + ' recorded size matches the 1600 file');
    assert.ok(!jpg.includes(Buffer.from('Exif\0\0')), photo.id + ' has no EXIF/GPS metadata');
  }
  const first = data.photos.map(photo => photo.id);
  assert.deepEqual(first.slice(0, 3), ['krav-maga', 'pft-1', 'class-photo']);
});

test('gallery page renders every photo as a lazy, sized, srcset image linking to the 1600 file', () => {
  const photos = data.photos.filter(item => item.type !== 'video');
  const imgs = [...html.matchAll(/<a class="gallery-open" href="([^"]+)"[^>]*>\s*<img ([^>]+)>/g)];
  assert.equal(imgs.length, photos.length);
  imgs.forEach(([, href, attrs], index) => {
    const photo = photos[index];
    assert.equal(href, '../' + photo.src1600);
    assert.match(attrs, /srcset="[^"]+ 800w, [^"]+ 1600w"/);
    assert.match(attrs, new RegExp(`width="${photo.width}" height="${photo.height}"`));
    assert.match(attrs, /loading="lazy"/);
    assert.match(attrs, /sizes="/);
    assert.match(attrs, /alt="[^"]+"/);
  });
  assert.match(html, /<h1[^>]*>Gallery<\/h1>/);
  assert.match(html, /<title>Gallery/);
  assert.match(html, /property="og:url" content="https:\/\/atticus-42\.github\.io\/quiz-hub\/gallery\/"/);
  assert.match(html, /<dialog class="lightbox"/);
});

test('gallery videos are listed with files, posters and lazy controls', () => {
  const videos = data.photos.filter(item => item.type === 'video');
  assert.ok(videos.length >= 1);
  const tags = [...html.matchAll(/<video ([^>]+)>/g)];
  assert.equal(tags.length, videos.length);
  videos.forEach((video, index) => {
    assert.ok(existsSync(file(video.src)), video.id + ': ' + video.src + ' exists');
    assert.ok(existsSync(file(video.poster)), video.id + ': ' + video.poster + ' exists');
    assert.ok(video.alt.trim() && video.caption.trim(), video.id + ' alt and caption');
    assert.ok(Number.isInteger(video.width) && Number.isInteger(video.height), video.id + ' size');
    assert.ok(readFileSync(file(video.src)).length < 20 * 1024 * 1024, video.id + ' is under 20 MB');
    const attrs = tags[index][1];
    assert.match(attrs, /(?:^| )controls(?: |$)/);
    assert.match(attrs, /preload="none"/);
    assert.match(attrs, /(?:^| )playsinline(?: |$)/);
    assert.ok(attrs.includes(`poster="../${video.poster}"`), video.id + ' poster attribute');
    if (video.loop) assert.match(attrs, /(?:^| )loop(?: |$)/);
    if (video.muted) assert.match(attrs, /(?:^| )muted(?: |$)/);
    assert.ok(html.includes(`<source src="../${video.src}" type="video/mp4">`), video.id + ' source');
  });
});

test('Gallery is in the main navigation, the site index and the quick finder; the class page links to it', () => {
  for (const path of ['index.html', 'reviewer/index.html', 'library/index.html', 'how-to/index.html', 'los-radios/index.html', 'codes-ciphers/index.html', 'class/index.html']) {
    const page = read(path);
    assert.match(page, /<a href="(?:\.\.\/)*gallery\/">(?:<span>)?Gallery|href="(?:\.\.\/)*gallery\/"[^>]*>Gallery/, path + ' links to the Gallery');
  }
  assert.match(read('index.html'), /<a href="gallery\/">Gallery<\/a>/);
  assert.match(read('index.html'), /"u":"gallery\/"/);
  assert.match(read('class/index.html'), /<a href="\.\.\/gallery\/">See the Gallery/);
  assert.ok(!read('class/index.html').includes('class-gallery'));
  assert.match(read('class/index.html'), /id="pft-1"/);
});

test('no stray originals: gallery assets are only processed jpg pairs, mp4 videos and posters', () => {
  const files = readdirSync(join(root, 'assets', 'gallery'));
  assert.ok(files.every(name => /-(800|1600)\.jpg$|-poster\.jpg$|\.mp4$/.test(name)), files.join(', '));
});

test('every gallery item has a valid focus point and the grid crops around it to a 4:5 or 4:3 tile', () => {
  const valid = /^(\d{1,3}(?:\.\d)?)% (\d{1,3}(?:\.\d)?)%$/;
  for (const item of data.photos) {
    const m = valid.exec(item.focus || '');
    assert.ok(m && Number(m[1]) <= 100 && Number(m[2]) <= 100, `${item.id}: focus "${item.focus}" must be "X% Y%" within 0-100`);
  }
  const photos = data.photos.filter(item => item.type !== 'video');
  const imgs = [...html.matchAll(/<a class="gallery-open" href="[^"]+"[^>]*>\s*<img ([^>]+)>/g)];
  assert.equal(imgs.length, photos.length);
  imgs.forEach(([, attrs], index) => {
    const photo = photos[index];
    assert.ok(attrs.includes(`object-position: ${photo.focus}`), `${photo.id}: img renders object-position ${photo.focus}`);
    assert.ok(attrs.includes(`--tile: ${photo.height > photo.width ? '4 / 5' : '4 / 3'}`), `${photo.id}: tile aspect follows orientation`);
  });
  for (const video of data.photos.filter(item => item.type === 'video')) {
    assert.ok(html.includes(`object-position: ${video.focus}`), `${video.id}: video renders object-position`);
  }
  assert.match(html, /\.gallery-open img \{[^}]*aspect-ratio: var\(--tile, 4 \/ 3\)[^}]*object-fit: cover/);
});
