// tests/theme.test.js — the light/dark toggle button's click handler.
// (The FOUC-avoiding inline <head> script that sets the INITIAL theme
// lives directly in index.html, not in a .js file, so it isn't
// unit-testable here — this only covers what theme.js itself owns.)

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDom } = require('../test-support/fakeDom');

function setup() {
  const dom = createFakeDom();
  const toggle = dom.registerEl('themeToggle', 'button');
  dom.loadScript('theme.js');
  return { dom, toggle };
}

test('clicking the toggle flips data-theme from dark to light', () => {
  const { dom, toggle } = setup();
  dom.document.documentElement.setAttribute('data-theme', 'dark');

  toggle._dispatch('click', {}, false);

  assert.equal(dom.document.documentElement.getAttribute('data-theme'), 'light');
});

test('clicking the toggle flips data-theme from light back to dark', () => {
  const { dom, toggle } = setup();
  dom.document.documentElement.setAttribute('data-theme', 'light');

  toggle._dispatch('click', {}, false);

  assert.equal(dom.document.documentElement.getAttribute('data-theme'), 'dark');
});

test('the chosen theme is persisted to localStorage so it survives a reload', () => {
  const { dom, toggle } = setup();
  dom.document.documentElement.setAttribute('data-theme', 'dark');

  toggle._dispatch('click', {}, false);

  assert.equal(dom.sandbox.localStorage.getItem('theme'), 'light');
});
