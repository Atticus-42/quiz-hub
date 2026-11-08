const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '../..');
const guides = JSON.parse(fs.readFileSync(path.join(root, 'data/howto.json'), 'utf8'));
const routes = ['/how-to/', ...guides.map(guide => '/how-to/' + guide.id + '/')];
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

const server = http.createServer((req, res) => {
  let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (name.endsWith('/')) name += 'index.html';
  const file = path.resolve(root, '.' + name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader('Content-Type', contentTypes[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

async function main() {
  assert.equal(guides.length, 10, 'The signal directory must contain ten sourced guides.');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const options = { headless: true };
  if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(options);

  try {
    const context = await browser.newContext();
    const errors = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const page = await context.newPage();

    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        const response = await page.goto(base + route);
        assert.equal(response.status(), 200, route);
        const overflow = await page.evaluate(() => {
          if (document.documentElement.scrollWidth <= innerWidth) return [];
          return [...document.querySelectorAll('*')]
            .filter(element => element.getBoundingClientRect().right > innerWidth)
            .map(element => element.tagName + '.' + element.getAttribute('class'));
        });
        assert.deepEqual(overflow, [], route + ' overflows at ' + width + 'px');
        if ([375, 1440].includes(width) && /program-rf5800v-net|configure-rf5800v-scan|check-repeater-channel-pair/.test(route)) {
          await page.locator('.signal-diagram').screenshot({path: path.join(root, 'tmp', route.split('/')[2] + '-' + width + '.png')});
        }
        assert.equal(await page.locator('.identity-ribbon').count(), 0, 'Duplicate identity header');
      }
    }

    await page.goto(base + '/how-to/');
    const cards = page.locator('[data-signal-card]');
    assert.equal(await cards.count(), guides.length);
    for (const guide of guides) {
      const card = page.locator('[data-signal-card]').filter({ has: page.locator('a[href="./' + guide.id + '/"]') });
      assert.equal(await card.count(), 1, 'Missing guide card ' + guide.id);
      assert.equal(await card.locator('svg').count(), 1);
    }
    await page.locator('#signal-search').fill('USB');
    assert(await page.locator('[data-signal-card]:visible').count() > 0);
    await page.locator('#signal-category').selectOption('repeater');
    assert(await page.locator('#signal-empty').isVisible());
    await page.locator('#signal-search').fill('');
    assert.equal(await page.locator('[data-signal-card]:visible').count(), guides.filter(guide => guide.diagram === 'repeater').length);
    await page.locator('#signal-category').selectOption('');
    const model = await page.locator('[data-signal-card]').first().getAttribute('data-signal-model');
    await page.locator('#signal-equipment').selectOption(model);
    const modelCards = await page.locator('[data-signal-card]:visible').evaluateAll(elements =>
      elements.map(element => element.dataset.signalModel));
    assert(modelCards.length > 0);
    assert(modelCards.every(value => value === model));
    await page.goto(base + '/how-to/?q=radio');
    assert(await page.locator('[data-signal-card]:visible').count() > 1);

    const sourceFiles = new Set();
    for (const guide of guides) {
      await page.goto(base + '/how-to/' + guide.id + '/');
      assert.equal(await page.locator('.signal-steps li').count(), guide.steps.length);
      assert.equal(await page.locator('.signal-diagram svg[role="img"]').count(), 1);
      const sourceLinks = await page.locator('.signal-source-pages a').evaluateAll(elements =>
        elements.map(element => ({ href: element.getAttribute('href'), text: element.textContent })));
      assert.equal(sourceLinks.length, guide.sources.length);
      for (const [index, source] of guide.sources.entries()) {
        const pdf = source.file.endsWith('.pdf') ? source.file : source.file + '.pdf';
        assert.equal(sourceLinks[index].href, '../../library/files/' + pdf + '#page=' + source.pdfPage);
        assert(sourceLinks[index].text.includes('Page ' + source.page));
        sourceFiles.add('/library/files/' + pdf);
      }
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.signal-steps li:visible').count(), guide.steps.length);
      assert.equal(await page.locator('[data-signal-play]:visible').count(), 0);
      await page.emulateMedia({ media: 'screen' });
    }
    assert.equal(sourceFiles.size, 10);
    for (const file of sourceFiles) {
      const response = await context.request.get(base + file);
      assert.equal(response.status(), 200, file);
      assert.match(response.headers()['content-type'], /application\/pdf/);
      assert.equal((await response.body()).subarray(0, 5).toString(), '%PDF-', file);
    }

    const firstGuide = guides[0];
    await page.goto(base + '/how-to/' + firstGuide.id + '/');
    const play = page.locator('[data-signal-play]');
    const flow = page.locator('.signal-diagram .sig-flow').first();
    assert.equal(await flow.evaluate(element => getComputedStyle(element).animationPlayState), 'paused');
    await play.click();
    assert.equal(await flow.evaluate(element => getComputedStyle(element).animationPlayState), 'running');
    await play.click();
    assert.equal(await flow.evaluate(element => getComputedStyle(element).animationPlayState), 'paused');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert(!(await play.isVisible()));
    assert.equal(await flow.evaluate(element => getComputedStyle(element).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    const steps = page.locator('[data-signal-step]');
    await steps.first().check();
    assert.equal(await page.locator('[data-signal-progress-text]').textContent(),
      '1 of ' + firstGuide.steps.length + ' steps complete');
    await page.reload();
    assert(await steps.first().isChecked());
    await page.locator('[data-signal-reset]').click();
    assert(!(await steps.first().isChecked()));
    assert(await page.locator('[data-signal-reset]').isDisabled());
    await page.reload();
    assert(!(await steps.first().isChecked()));

    await page.goto(base + '/how-to/how-to-size-a-half-wave-dipole/');
    const result = page.locator('[data-signal-dipole] output');
    const frequency = page.locator('#signal-frequency');
    assert.match(await result.textContent(), /62.4 ft .*31.2 ft/);
    assert.match(await result.textContent(), /19.02 m.*9.51 m/);
    await frequency.fill('10');
    assert.match(await result.textContent(), /46.8 ft .*23.4 ft/);
    for (const invalid of ['-1', '0', '']) {
      await frequency.fill(invalid);
      assert.match(await result.textContent(), /Enter a positive frequency/);
    }

    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJs.newPage();
    await staticPage.goto(base + '/how-to/');
    assert.equal(await staticPage.locator('[data-signal-card]:visible').count(), guides.length);
    for (const guide of guides) {
      await staticPage.goto(base + '/how-to/' + guide.id + '/');
      assert.equal(await staticPage.locator('.signal-steps li:visible').count(), guide.steps.length);
      assert.equal(await staticPage.locator('[data-signal-play]:visible').count(), 0);
    }
    await noJs.close();

    const storageBlocked = await browser.newContext();
    await storageBlocked.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
      Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
      Storage.prototype.removeItem = () => { throw new Error('Storage unavailable'); };
    });
    const blockedPage = await storageBlocked.newPage();
    await blockedPage.goto(base + '/how-to/' + firstGuide.id + '/');
    await blockedPage.locator('[data-signal-step]').first().check();
    assert.match(await blockedPage.locator('[data-signal-storage]').textContent(), /while this guide is open/);
    await storageBlocked.close();

    assert.deepEqual(errors, []);
    console.log(`PASS signal guides: ${routes.length * 4} responsive layouts, ${sourceFiles.size} exact local PDF sources, filters, signal flow, reduced motion, checklist persistence/reset/storage fallback, print, dipole calculator, and script-free pages.`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => server.close());
