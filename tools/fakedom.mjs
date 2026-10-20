import fs from 'node:fs';

const ROOT = 'E:/zhuzhucheng/www';

function makeEl(tag, id) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    id: id || '',
    attrs: {},
    style: { setProperty: function (k, v) { this[k] = v; }, removeProperty: function (k) { delete this[k]; } },
    children: [],
    _text: '',
    _html: '',
    _listeners: {},
    value: '',
    files: null,
    classList: {
      _s: new Set(),
      add(...a) { a.forEach(x => x && this._s.add(x)); },
      remove(...a) { a.forEach(x => x && this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
      toggle(c, f) {
        if (f === undefined) f = !this._s.has(c);
        if (f) this._s.add(c); else this._s.delete(c);
        return f;
      }
    },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
    focus() { doc.activeElement = this; },
    blur() {},
    click() { this.fire('click', { target: this }); },
    scrollIntoView() {},
    closest(sel) { return this._closest || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    fire(type, ev) { const self = this; (this._listeners[type] || []).forEach(fn => fn.call(self, Object.assign({ target: self, preventDefault() {} }, ev))); }
  };
  Object.defineProperty(el, 'textContent', {
    get() { return this._text; },
    set(v) { this._text = String(v); this._html = ''; }
  });
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._html; },
    set(v) { this._html = String(v); this._text = ''; }
  });
  return el;
}

const registry = {};
const byClass = {};

function register(id, cls) {
  const el = makeEl('div', id);
  registry[id] = el;
  (cls || []).forEach(c => { (byClass[c] = byClass[c] || []).push(el); });
  return el;
}

const html = fs.readFileSync(ROOT + '/index.html', 'utf8');
const ids = [];
let m;
const re = /id="([a-zA-Z0-9_-]+)"/g;
while ((m = re.exec(html))) ids.push(m[1]);
ids.forEach(i => register(i));

/* 带 class 的组：.tab / .view / .chip */
['home', 'trend', 'records', 'me'].forEach(name => {
  const t = registry['tab-' + name];
  t.classList.add('view');
  if (name === 'home') t.classList.add('active');
  (byClass.view = byClass.view || []).push(t);
  const tab = makeEl('button');
  tab.setAttribute('data-tab', name);
  tab.classList.add('tab');
  (byClass.tab = byClass.tab || []).push(tab);
});
['7', '30', 'all'].forEach(r => {
  const b = makeEl('button');
  b.setAttribute('data-range', r);
  b._closest = b;
  (byClass['#range-seg button'] = byClass['#range-seg button'] || []).push(b);
});

const body = makeEl('body');
const doc = {
  body,
  documentElement: makeEl('html'),
  activeElement: null,
  _listeners: {},
  querySelector(sel) {
    if (sel[0] === '#') {
      const id = sel.slice(1).split(/[\s.]/)[0];
      if (!registry[id]) throw new Error('假DOM：找不到 #' + id);
      if (sel.includes(' ')) {
        const stub = makeEl('span');
        stub.classList.add('show');
        return stub;
      }
      return registry[id];
    }
    if (sel[0] === '.') return (byClass[sel.slice(1)] || [])[0] || null;
    return null;
  },
  querySelectorAll(sel) {
    if (sel[0] === '.') return (byClass[sel.slice(1)] || []).slice();
    if (sel.startsWith('#')) {
      const key = sel.replace(/[#\s>]/g, '');
      const direct = byClass[sel];
      if (direct) return direct.slice();
      if (sel === '#range-seg button') return (byClass['#range-seg button'] || []).slice();
      return [];
    }
    return [];
  },
  getElementById(id) { return registry[id] || null; },
  createElement(tag) { return makeEl(tag); },
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
  fire(type, ev) { (this._listeners[type] || []).forEach(fn => fn(Object.assign({ target: body, preventDefault() {} }, ev))); }
};

const storeMem = {};
const win = {
  document: doc,
  localStorage: {
    getItem: k => (k in storeMem ? storeMem[k] : null),
    setItem: (k, v) => { storeMem[k] = String(v); },
    removeItem: k => { delete storeMem[k]; }
  },
  navigator: { standalone: false, serviceWorkers: undefined },
  location: { protocol: 'https:', hash: '', search: '', href: 'https://localhost/index.html' },
  devicePixelRatio: 2,
  addEventListener() {},
  scrollTo() {},
  matchMedia() { return { matches: false }; },
  setTimeout, clearTimeout, setInterval, clearInterval,
  Blob: function () {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  FileReader: function () {}
};

export const FAKE_DOM = { registry, byClass, doc, win, storeMem, makeEl };
