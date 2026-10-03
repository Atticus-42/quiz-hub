// Shared test helpers: a tiny runner, a fake DOM that runs the real page scripts in node:vm, a CSS parser,
// a fake fetch and a fake Google Sheets runtime for apps-script/Code.gs. No network access, ever.
import assert from 'node:assert/strict';
import vm from 'node:vm';

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export const results = { tests: 0, failures: 0, failed: [] };

export async function test(name, run) {
  results.tests++;
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    results.failures++;
    results.failed.push(name);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

export const plain = value => JSON.parse(JSON.stringify(value));

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// ---------------------------------------------------------------------------
// Fake DOM
// ---------------------------------------------------------------------------

const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TEXT_ELEMENTS = new Set(['script', 'style']);
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', middot: '·', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return String.fromCodePoint(value);
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

class FakeText {
  constructor(text) {
    this.nodeType = 3;
    this.data = String(text);
    this.parentNode = null;
  }
  get textContent() { return this.data; }
  set textContent(value) { this.data = String(value); }
}

class FakeClassList {
  constructor(element) { this.element = element; }
  values() { return (this.element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean); }
  contains(name) { return this.values().includes(name); }
  add(...names) { this.element.setAttribute('class', [...new Set([...this.values(), ...names])].join(' ')); }
  remove(...names) { this.element.setAttribute('class', this.values().filter(name => !names.includes(name)).join(' ')); }
  toggle(name, force) {
    const on = force === undefined ? !this.contains(name) : Boolean(force);
    if (on) this.add(name); else this.remove(name);
    return on;
  }
}

function reflectAttribute(attribute) {
  return {
    get() { return this.getAttribute(attribute) ?? ''; },
    set(value) { this.setAttribute(attribute, value); },
  };
}

function reflectBoolean(attribute) {
  return {
    get() { return this.hasAttribute(attribute); },
    set(value) { if (value) this.setAttribute(attribute, ''); else this.removeAttribute(attribute); },
  };
}

export class FakeElement {
  constructor(tagName, ownerDocument) {
    this.nodeType = 1;
    this.localName = tagName.toLowerCase();
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.checkedState = null;
    this.classList = new FakeClassList(this);
  }
  get children() { return this.childNodes.filter(node => node.nodeType === 1); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  get type() {
    return (this.getAttribute('type') ?? (this.localName === 'button' ? 'submit' : 'text')).toLowerCase();
  }
  set type(value) { this.setAttribute('type', value); }
  get checked() { return this.checkedState ?? this.hasAttribute('checked'); }
  set checked(value) { this.checkedState = Boolean(value); }
  get textContent() { return this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value) {
    this.replaceChildren();
    if (String(value) !== '') this.appendChild(new FakeText(value));
  }
  set innerHTML(_) { throw new Error('innerHTML must not be used'); }
  get innerHTML() { throw new Error('innerHTML must not be read'); }
  insertAdjacentHTML() { throw new Error('insertAdjacentHTML must not be used'); }
  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }
  append(...nodes) {
    for (const node of nodes) this.appendChild(typeof node === 'string' ? new FakeText(node) : node);
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index === -1) throw new Error('removeChild: not a child');
    this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }
  replaceChildren(...nodes) {
    for (const node of this.childNodes) node.parentNode = null;
    this.childNodes = [];
    this.append(...nodes);
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const list = this.listeners.get(type) ?? [];
    const index = list.indexOf(listener);
    if (index !== -1) list.splice(index, 1);
  }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    for (const listener of [...(this.listeners.get(event.type) ?? [])]) listener.call(this, event);
    return !event.defaultPrevented;
  }
  click() {
    if (this.disabled) return;
    const event = type => ({ type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });
    if (this.localName === 'input' && this.type === 'checkbox') {
      this.checked = !this.checked;
      this.dispatchEvent(event('click'));
      this.dispatchEvent(event('input'));
      this.dispatchEvent(event('change'));
      return;
    }
    if (this.localName === 'input' && this.type === 'radio') {
      const wasChecked = this.checked;
      if (!wasChecked) {
        for (const other of findAll(this.ownerDocument.root, node => node.localName === 'input' && node.type === 'radio' && node.name === this.name)) {
          other.checked = false;
        }
        this.checked = true;
      }
      this.dispatchEvent(event('click'));
      if (!wasChecked) {
        this.dispatchEvent(event('input'));
        this.dispatchEvent(event('change'));
      }
      return;
    }
    this.dispatchEvent(event('click'));
  }
  focus() {
    // Mirror browsers: hidden or non-focusable elements silently ignore focus().
    if (!isShown(this)) return;
    const interactive = ['button', 'input', 'select', 'textarea'].includes(this.localName) && !this.disabled;
    if (!interactive && !this.hasAttribute('tabindex')) return;
    this.ownerDocument.activeElement = this;
  }
}

Object.defineProperties(FakeElement.prototype, {
  id: reflectAttribute('id'),
  className: reflectAttribute('class'),
  name: reflectAttribute('name'),
  value: reflectAttribute('value'),
  htmlFor: reflectAttribute('for'),
  hidden: reflectBoolean('hidden'),
  disabled: reflectBoolean('disabled'),
  open: reflectBoolean('open'),
  isContentEditable: {
    get() { return this.hasAttribute('contenteditable') && this.getAttribute('contenteditable') !== 'false'; },
  },
  tabIndex: {
    get() { return Number(this.getAttribute('tabindex') ?? 0); },
    set(value) { this.setAttribute('tabindex', value); },
  },
});

export class FakeDocument {
  constructor() {
    this.root = new FakeElement('#document', this);
    this.activeElement = null;
    this.listeners = new Map();
  }
  // Document-level listeners (the app's keydown shortcuts); keyboard events are dispatched here with their target set.
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const list = this.listeners.get(type) ?? [];
    const index = list.indexOf(listener);
    if (index !== -1) list.splice(index, 1);
  }
  listenerCount(type) { return (this.listeners.get(type) ?? []).length; }
  dispatchEvent(event) {
    event.currentTarget = this;
    for (const listener of [...(this.listeners.get(event.type) ?? [])]) listener.call(this, event);
    return !event.defaultPrevented;
  }
  get body() { return findAll(this.root, node => node.localName === 'body')[0] ?? null; }
  createElement(tagName) { return new FakeElement(tagName, this); }
  createTextNode(text) { return new FakeText(text); }
  getElementById(id) { return findAll(this.root, node => node.getAttribute('id') === id)[0] ?? null; }
}

export function findAll(root, predicate) {
  const found = [];
  const visit = node => {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) continue;
      if (predicate(child)) found.push(child);
      visit(child);
    }
  };
  visit(root);
  return found;
}

export function isShown(node) {
  for (let current = node; current; current = current.parentNode) {
    if (current.nodeType === 1 && current.hasAttribute('hidden')) return false;
  }
  return true;
}

export const hasClass = (node, name) => (node.getAttribute('class') ?? '').split(/\s+/).includes(name);

export function parseHtml(html) {
  const document = new FakeDocument();
  const stack = [document.root];
  const tagPattern = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi;
  const attributePattern = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let cursor = 0;
  let match;
  while ((match = tagPattern.exec(html))) {
    if (match.index > cursor) stack.at(-1).appendChild(new FakeText(decodeEntities(html.slice(cursor, match.index))));
    cursor = tagPattern.lastIndex;
    const [whole, closingName, openingName, attributeText = '', selfClosing] = match;
    if (whole.startsWith('<!')) continue;
    if (closingName) {
      const name = closingName.toLowerCase();
      const index = stack.findLastIndex(node => node.localName === name);
      if (index > 0) stack.length = index;
      continue;
    }
    const element = document.createElement(openingName);
    for (const [, name, doubleQuoted, singleQuoted, bare] of attributeText.matchAll(attributePattern)) {
      element.setAttribute(name.toLowerCase(), decodeEntities(doubleQuoted ?? singleQuoted ?? bare ?? ''));
    }
    stack.at(-1).appendChild(element);
    if (RAW_TEXT_ELEMENTS.has(element.localName)) {
      const end = html.toLowerCase().indexOf(`</${element.localName}`, cursor);
      if (end === -1) throw new Error(`Unclosed <${element.localName}>`);
      element.appendChild(new FakeText(html.slice(cursor, end)));
      tagPattern.lastIndex = html.indexOf('>', end) + 1;
      cursor = tagPattern.lastIndex;
    } else if (!VOID_ELEMENTS.has(element.localName) && !selfClosing) {
      stack.push(element);
    }
  }
  if (cursor < html.length) stack.at(-1).appendChild(new FakeText(decodeEntities(html.slice(cursor))));
  return document;
}

export function appScripts(document) {
  return findAll(document.root, node => node.localName === 'script' && !/json/i.test(node.getAttribute('type') ?? ''));
}

// Runs a page's inline scripts in a fresh vm context; returns the document, sandbox and recorded side effects.
export function runPage(html, { fetch, globals = {}, setup } = {}) {
  const document = parseHtml(html);
  const printCalls = [];
  const consoleErrors = [];
  const sandbox = {
    document,
    console: { log() {}, info() {}, warn() {}, error: (...args) => consoleErrors.push(args.map(String).join(' ')) },
    print: () => printCalls.push(Date.now()),
    ...globals,
  };
  if (fetch) sandbox.fetch = fetch;
  sandbox.window = sandbox;
  if (setup) setup(sandbox);
  vm.createContext(sandbox);
  for (const script of appScripts(document)) {
    vm.runInContext(script.textContent, sandbox, { filename: 'index.html' });
  }
  return { document, printCalls, consoleErrors, window: sandbox };
}

// A Web Storage stand-in (localStorage) that records every key written.
export class FakeStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
  clear() { this.map.clear(); }
  entries() { return Object.fromEntries(this.map); }
}

// ---------------------------------------------------------------------------
// Network fakes. The class history endpoint is never contacted: tests run with the endpoint cleared, or
// with TEST_ENDPOINT and a recording fake fetch.
// ---------------------------------------------------------------------------

export const ENDPOINT_PATTERN = /var HISTORY_ENDPOINT = '([^']*)';/;
export const TEST_ENDPOINT = 'https://script.google.com/macros/s/TEST-DEPLOYMENT/exec';

export function withEndpoint(html, url) {
  assert.match(html, ENDPOINT_PATTERN, 'the page script must declare HISTORY_ENDPOINT');
  return html.replace(ENDPOINT_PATTERN, () => `var HISTORY_ENDPOINT = '${url}';`);
}

// Records every request and answers through handler(call); a throwing handler is a network error.
export function fakeFetch(handler) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const call = { url: String(url), method: String(init.method ?? 'GET').toUpperCase(), headers: { ...(init.headers ?? {}) }, body: init.body, init };
    calls.push(call);
    const result = await handler(call);
    const status = result.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => result.body, text: async () => JSON.stringify(result.body) };
  };
  fetch.calls = calls;
  return fetch;
}

// ---------------------------------------------------------------------------
// Fake Google Apps Script runtime for apps-script/Code.gs
// ---------------------------------------------------------------------------

export class FakeSheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map(row => [...row]);
    this.frozen = 0;
  }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
  appendRow(row) { this.rows.push([...row]); }
  setFrozenRows(count) { this.frozen = count; }
  getDataRange() {
    const width = this.getLastColumn();
    return { getValues: () => this.rows.map(row => Array.from({ length: width }, (_, index) => (index < row.length ? row[index] : ''))) };
  }
  getRange(row, column, rows = 1, columns = 1) {
    const sheet = this;
    return {
      getValues() {
        return Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => sheet.rows[row - 1 + r]?.[column - 1 + c] ?? ''));
      },
      setValues(values) {
        assert.equal(values.length, rows, 'setValues row count matches the range');
        values.forEach((line, r) => {
          assert.equal(line.length, columns, 'setValues column count matches the range');
          while (sheet.rows.length < row + r) sheet.rows.push([]);
          const target = sheet.rows[row - 1 + r];
          line.forEach((value, c) => {
            while (target.length < column - 1 + c) target.push('');
            target[column - 1 + c] = value;
          });
        });
      },
      setValue(value) { this.setValues([[value]]); },
    };
  }
}

export function loadCodeGs(source, { sheets = new Map(), lockFails = false } = {}) {
  const book = {
    getSheetByName: name => sheets.get(name) ?? null,
    insertSheet: name => { const sheet = new FakeSheet(name); sheets.set(name, sheet); return sheet; },
  };
  const lock = { waits: 0, releases: 0 };
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => book },
    LockService: { getScriptLock: () => ({ waitLock() { lock.waits++; if (lockFails) throw new Error('lock timeout'); }, releaseLock() { lock.releases++; } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
  });
  vm.runInContext(source, context, { filename: 'Code.gs' });
  const call = (fn, arg) => JSON.parse(context[fn](arg).text);
  return {
    context,
    sheets,
    lock,
    post: body => call('doPost', { postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }),
    get: parameter => call('doGet', { parameter }),
  };
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

export function stylesheetText(html) {
  const styles = findAll(parseHtml(html).root, node => node.localName === 'style');
  assert.equal(styles.length, 1, 'the page must have exactly one inline <style> element');
  return styles[0].textContent.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Returns flat rules: { selectors: string[], declarations: Map, media: string|null } and keyframe names.
export function parseCss(css) {
  const rules = [];
  const keyframes = new Set();
  const matchingBrace = (text, open) => {
    let depth = 0;
    for (let index = open; index < text.length; index++) {
      if (text[index] === '{') depth++;
      else if (text[index] === '}' && --depth === 0) return index;
    }
    throw new Error('Unbalanced braces in stylesheet');
  };
  const parseDeclarations = body => {
    const declarations = new Map();
    for (const part of body.split(';')) {
      const colon = part.indexOf(':');
      if (colon === -1) continue;
      declarations.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim().replace(/\s+/g, ' '));
    }
    return declarations;
  };
  const walk = (text, media) => {
    let cursor = 0;
    while (cursor < text.length) {
      const open = text.indexOf('{', cursor);
      if (open === -1) break;
      const prelude = text.slice(cursor, open).trim();
      const close = matchingBrace(text, open);
      const body = text.slice(open + 1, close);
      if (/^@media\b/i.test(prelude)) {
        walk(body, prelude.replace(/\s+/g, ' '));
      } else if (/^@(-webkit-)?keyframes\b/i.test(prelude)) {
        keyframes.add(prelude.split(/\s+/)[1]);
      } else if (!prelude.startsWith('@')) {
        rules.push({ selectors: prelude.split(',').map(selector => selector.trim().replace(/\s+/g, ' ')), declarations: parseDeclarations(body), media });
      }
      cursor = close + 1;
    }
  };
  walk(css, null);
  return { rules, keyframes };
}

export const REDUCED_MOTION_MEDIA = /prefers-reduced-motion:\s*reduce/i;
export const hasMotion = value => value !== undefined && !/^none\b/i.test(value.replace(/\s*!important$/, ''));

// Keyboard events go through the page's real document-level listener; the target defaults to the focused element.
export function keyEvent(document, key, options = {}) {
  return {
    type: 'keydown',
    key,
    target: document.activeElement ?? document.body,
    ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, repeat: false, isComposing: false,
    ...options,
    defaultPrevented: Boolean(options.defaultPrevented),
    preventDefault() { this.defaultPrevented = true; },
  };
}

// ---------------------------------------------------------------------------
// Self-hosted assets (fonts and the paper grain) referenced by every page
// ---------------------------------------------------------------------------

// The font preloads the build writes into each page's <head> (scripts/build.mjs PRELOADED_FONTS).
export const FONT_PRELOAD = /<link rel="preload" href="((?:\.\.\/)?assets\/fonts\/[\w-]+\.woff2)" as="font" type="font\/woff2" crossorigin>/g;
export const withoutFontPreloads = html => html.replace(FONT_PRELOAD, '');

// Every url(...) target in a stylesheet (quotes removed).
export const cssUrls = css => [...css.matchAll(/url\(\s*['"]?([^'")]*)/gi)].map(match => match[1]);

// A same-origin asset reference: a relative path into assets/ (fonts or the paper grain), never a scheme or host.
export const isLocalAsset = url => /^(?:\.\.\/)?assets\/(?:fonts\/[\w-]+\.woff2|paper-grain\.svg)$/.test(url);
