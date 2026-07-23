// test-support/fakeDom.js
//
// Lives OUTSIDE the tests/ directory on purpose: Node's built-in test
// runner treats every .js file inside a directory literally named
// "test" or "tests" as a test file to execute, recursively — including
// helper modules. Keeping this one level up (repo root) is what lets a
// beginner-friendly bare `node --test` just work without needing to
// know to type `node --test tests/*.test.js` instead.
//
// This project is deliberately dependency-free (see README: "no build
// step, no dependencies") and there's no real browser available in the
// environment these tests were written in — so instead of Puppeteer/
// jsdom, this is a hand-rolled fake DOM: just enough of the Element/
// Document/Window surface for app.js's files to run unmodified inside
// Node's vm module. It is NOT a general-purpose DOM shim; it only
// implements what this specific codebase actually touches. If a future
// test needs something this doesn't support (classList.toggle, for
// example), extend it here rather than reaching for a real dependency —
// that's a deliberate project constraint, not an oversight.

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC_DIR = path.join(__dirname, '..', 'js');

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this._attrs = {};
    this._classes = [];
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.parentNode = null;
    this._id = '';
    this._innerHTML = '';
    this._listeners = {};
    this.disabled = false;
    this.offsetParent = {}; // "visible" by default for getFocusable() filters
    this.value = '';
    this._text = '';
    this.scrollTop = 0;
    this.clientHeight = 560;
    this.clientWidth = 900;
  }

  get id() { return this._id; }
  set id(v) { this._id = v; }

  get className() { return this._classes.join(' '); }
  set className(v) { this._classes = String(v).split(' ').filter(Boolean); }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) { this._innerHTML = v; }

  get textContent() { return this._text; }
  set textContent(v) { this._text = v; }

  get classList() {
    const self = this;
    return {
      add(c) { if (self._classes.indexOf(c) === -1) self._classes.push(c); },
      remove(c) { self._classes = self._classes.filter((x) => x !== c); },
      contains(c) { return self._classes.indexOf(c) !== -1; },
      toggle(c) { self._classes.indexOf(c) === -1 ? this.add(c) : this.remove(c); }
    };
  }

  setAttribute(name, val) { this._attrs[name] = String(val); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null; }
  removeAttribute(name) { delete this._attrs[name]; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this._attrs, name); }

  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }

  addEventListener(type, fn, capture) {
    const key = type + '|' + (capture ? 'capture' : 'bubble');
    this._listeners[key] = this._listeners[key] || [];
    this._listeners[key].push(fn);
  }
  removeEventListener(type, fn, capture) {
    const key = type + '|' + (capture ? 'capture' : 'bubble');
    if (!this._listeners[key]) return;
    this._listeners[key] = this._listeners[key].filter((f) => f !== fn);
  }
  // Test helper (not a real DOM method): fire a registered handler directly.
  _dispatch(type, evt, capture) {
    const key = type + '|' + (capture ? 'capture' : 'bubble');
    (this._listeners[key] || []).forEach((fn) => fn(evt));
  }

  focus() { this.ownerFakeDocument.activeElement = this; }
  closest(selector) {
    // Only supports the one pattern this codebase actually uses:
    // '.email-row' — a class selector walk up parentNode.
    if (!selector.startsWith('.')) return null;
    const cls = selector.slice(1);
    let node = this;
    while (node) {
      if (node.classList && node.classList.contains(cls)) return node;
      node = node.parentNode;
    }
    return null;
  }

  // Not a general CSS engine — just enough to run compose.js's actual
  // getFocusable() selector ('input, textarea, button, [href],
  // [tabindex]:not([tabindex="-1"])') against a real tree of appended
  // children, so the focus-trap Tab-wrap logic can be tested for real
  // instead of stubbed out.
  querySelectorAll(selectorList) {
    const matchers = selectorList.split(',').map((s) => s.trim()).map((sel) => {
      if (sel === 'input') return (el) => el.tagName === 'INPUT';
      if (sel === 'textarea') return (el) => el.tagName === 'TEXTAREA';
      if (sel === 'button') return (el) => el.tagName === 'BUTTON';
      if (sel === '[href]') return (el) => el.hasAttribute('href');
      if (sel === '[tabindex]:not([tabindex="-1"])') {
        return (el) => el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1';
      }
      return () => false;
    });
    const results = [];
    (function walk(node) {
      node.children.forEach((child) => {
        if (matchers.some((m) => m(child))) results.push(child);
        walk(child);
      });
    })(this);
    return results;
  }
}

function createFakeDom() {
  const fakeDocument = {
    _byId: {},
    activeElement: null,
    _docListeners: {},
    documentElement: new FakeElement('html'),
    createElement(tag) {
      const el = new FakeElement(tag);
      el.ownerFakeDocument = fakeDocument;
      return el;
    },
    getElementById(id) { return this._byId[id] || null; },
    addEventListener(type, fn, capture) {
      const key = type + '|' + (capture ? 'capture' : 'bubble');
      this._docListeners[key] = this._docListeners[key] || [];
      this._docListeners[key].push(fn);
    },
    removeEventListener(type, fn, capture) {
      const key = type + '|' + (capture ? 'capture' : 'bubble');
      if (!this._docListeners[key]) return;
      this._docListeners[key] = this._docListeners[key].filter((f) => f !== fn);
    },
    // Test helper: fire every DOMContentLoaded handler registered so far.
    _fireDOMContentLoaded() {
      (this._docListeners['DOMContentLoaded|bubble'] || []).forEach((fn) => fn());
    },
    // Test helper: fire a document-level keydown (bubble phase first is
    // wrong for real DOM ordering, but this project's compose.js
    // capture-phase trap and keyboard.js's bubble-phase handler are
    // exercised independently per test, so ordering here doesn't matter).
    _dispatchKeydown(evt, capture) {
      const key = 'keydown|' + (capture ? 'capture' : 'bubble');
      (this._docListeners[key] || []).forEach((fn) => fn(evt));
    },
    querySelector(sel) {
      if (sel === '.app') return this._byId.__app__ || null;
      return null;
    }
  };
  fakeDocument.documentElement.ownerFakeDocument = fakeDocument;

  function registerEl(id, tag) {
    const el = fakeDocument.createElement(tag);
    el.id = id;
    fakeDocument._byId[id] = el;
    return el;
  }

  const store = {};
  const fakeWindow = {
    requestAnimationFrame(fn) { fn(); return 0; },
    addEventListener() {},
    removeEventListener() {},
    matchMedia() { return { matches: false }; },
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }
    }
  };

  const sandbox = {
    document: fakeDocument,
    window: fakeWindow,
    localStorage: fakeWindow.localStorage,
    console,
    Math,
    Date,
    setTimeout,
    clearTimeout,
    Promise,
    requestAnimationFrame: fakeWindow.requestAnimationFrame
  };
  vm.createContext(sandbox);

  function loadScript(fileName) {
    const code = fs.readFileSync(path.join(SRC_DIR, fileName), 'utf8');
    vm.runInContext(code, sandbox, { filename: fileName });
  }

  return { document: fakeDocument, window: fakeWindow, sandbox, loadScript, registerEl };
}

module.exports = { createFakeDom, FakeElement };
