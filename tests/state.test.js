// tests/state.test.js — STATE LAYER
//
// The whole point of state.js is "one object, one way to change it,
// one way to react to it" (see its header comment) — these tests check
// exactly that contract, not implementation details.

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDom } = require('../test-support/fakeDom');

function loadState() {
  const dom = createFakeDom();
  dom.loadScript('state.js');
  return dom.sandbox.window.MailState;
}

test('getState returns the documented initial shape', () => {
  const MailState = loadState();
  const s = MailState.getState();
  assert.deepEqual(
    { emails: s.emails.length, isLoading: s.isLoading, selectedEmailId: s.selectedEmailId, focusedIndex: s.focusedIndex, isComposeOpen: s.isComposeOpen },
    { emails: 0, isLoading: true, selectedEmailId: null, focusedIndex: -1, isComposeOpen: false }
  );
});

test('setState merges a partial patch without clobbering untouched keys', () => {
  const MailState = loadState();
  MailState.setState({ isLoading: false });
  const s = MailState.getState();
  assert.equal(s.isLoading, false);
  assert.equal(s.focusedIndex, -1, 'untouched key should survive the patch');
  assert.equal(s.isComposeOpen, false, 'untouched key should survive the patch');
});

test('getState always returns the SAME object reference (single source of truth, not a copy)', () => {
  const MailState = loadState();
  const first = MailState.getState();
  MailState.setState({ focusedIndex: 5 });
  const second = MailState.getState();
  assert.equal(first, second, 'getState should return the same object identity across calls');
  assert.equal(first.focusedIndex, 5, 'mutating via setState should be visible on the reference already held');
});

test('subscribe calls every listener with the state on each setState', () => {
  const MailState = loadState();
  const calls = [];
  MailState.subscribe((s) => calls.push(s.focusedIndex));

  MailState.setState({ focusedIndex: 1 });
  MailState.setState({ focusedIndex: 2 });

  assert.deepEqual(calls, [1, 2]);
});

test('subscribe returns an unsubscribe function that actually stops notifications', () => {
  const MailState = loadState();
  let count = 0;
  const unsubscribe = MailState.subscribe(() => { count++; });

  MailState.setState({ focusedIndex: 1 });
  assert.equal(count, 1);

  unsubscribe();
  MailState.setState({ focusedIndex: 2 });
  assert.equal(count, 1, 'listener should not fire again after unsubscribing');
});

test('multiple independent listeners all get notified', () => {
  const MailState = loadState();
  let a = 0, b = 0;
  MailState.subscribe(() => { a++; });
  MailState.subscribe(() => { b++; });

  MailState.setState({ isComposeOpen: true });

  assert.equal(a, 1);
  assert.equal(b, 1);
});
