// tests/keyboard.test.js — EVENT LAYER (keyboard)
//
// The core claim keyboard.js makes (see its header comment) is: it
// never touches a DOM row directly, only state.focusedIndex, and lets
// virtualList.js reconcile the DOM. These tests check that contract —
// clamping at both list boundaries, the isTypingTarget bail-out, the
// Phase 4 isComposeOpen contract, and Phase 7's live-region announcement.

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDom } = require('../test-support/fakeDom');

function setup(emailCount) {
  const dom = createFakeDom();
  dom.loadScript('data.js');
  dom.loadScript('state.js');
  dom.loadScript('render.js');
  dom.loadScript('virtualList.js');

  dom.registerEl('listViewport', 'main');
  dom.registerEl('emailList', 'ul');
  dom.registerEl('ariaLiveRegion', 'div');

  const MailData = dom.sandbox.window.MailData;
  const MailState = dom.sandbox.window.MailState;
  const MailVirtualList = dom.sandbox.window.MailVirtualList;
  const emails = MailData.generateEmails(emailCount);
  MailState.setState({ emails, focusedIndex: -1, selectedEmailId: null, isComposeOpen: false });
  MailVirtualList.init(emails);

  dom.loadScript('keyboard.js');
  dom.document._fireDOMContentLoaded();

  return { dom, MailState, MailVirtualList, MailKeyboard: dom.sandbox.window.MailKeyboard, emails };
}

test('isTypingTarget is true for INPUT/TEXTAREA/contentEditable, false otherwise', () => {
  const { dom, MailKeyboard } = setup(5);
  const input = dom.document.createElement('input');
  const textarea = dom.document.createElement('textarea');
  const div = dom.document.createElement('div');
  const editableDiv = dom.document.createElement('div');
  editableDiv.isContentEditable = true;

  assert.equal(MailKeyboard.isTypingTarget(input), true);
  assert.equal(MailKeyboard.isTypingTarget(textarea), true);
  assert.equal(MailKeyboard.isTypingTarget(div), false);
  assert.equal(MailKeyboard.isTypingTarget(editableDiv), true);
  assert.equal(MailKeyboard.isTypingTarget(null), false);
});

test('moveFocus(1) from -1 (nothing focused yet) lands on index 0, not 0 + delta', () => {
  const { MailState, MailKeyboard } = setup(100);
  MailKeyboard.moveFocus(1);
  assert.equal(MailState.getState().focusedIndex, 0);
});

test('moveFocus clamps at the bottom of the list — cannot go past the last index', () => {
  const { MailState, MailKeyboard } = setup(10);
  MailState.setState({ focusedIndex: 9 });
  MailKeyboard.moveFocus(1);
  assert.equal(MailState.getState().focusedIndex, 9, 'should stay at the last valid index (9), not go to 10');
});

test('moveFocus clamps at the top of the list — cannot go below 0', () => {
  const { MailState, MailKeyboard } = setup(10);
  MailState.setState({ focusedIndex: 0 });
  MailKeyboard.moveFocus(-1);
  assert.equal(MailState.getState().focusedIndex, 0);
});

test('moveFocus is a no-op when the email list is empty', () => {
  const { MailState, MailKeyboard } = setup(0);
  MailKeyboard.moveFocus(1);
  assert.equal(MailState.getState().focusedIndex, -1, 'should remain untouched, not clamp to a bogus 0-of-0');
});

test('Phase 7: moveFocus puts real DOM focus onto #emailList so aria-activedescendant gets announced', () => {
  const { dom, MailKeyboard } = setup(50);
  dom.document.activeElement = null;
  MailKeyboard.moveFocus(1);
  assert.equal(dom.document.activeElement, dom.document.getElementById('emailList'));
});

test('openFocused marks the email read, sets selectedEmailId, and does nothing when nothing is focused', () => {
  const { MailState, MailKeyboard, emails } = setup(20);

  // Nothing focused (-1) — should be a safe no-op.
  MailKeyboard.openFocused();
  assert.equal(MailState.getState().selectedEmailId, null);

  MailState.setState({ focusedIndex: 3 });
  MailKeyboard.openFocused();
  assert.equal(MailState.getState().selectedEmailId, emails[3].id);
  assert.equal(emails[3].unread, false, 'opening an email should mark it read');
});

test('Phase 7: openFocused announces "Opened: subject, from sender" via the live region', () => {
  const { dom, MailState, MailKeyboard, emails } = setup(20);
  MailState.setState({ focusedIndex: 5 });

  const region = dom.document.getElementById('ariaLiveRegion');
  region.textContent = '';
  MailKeyboard.openFocused();

  assert.equal(region.textContent, `Opened: ${emails[5].subject}, from ${emails[5].sender}`);
});

test('selectByIndex focuses AND opens a specific index in one call (backs both click and keyboard select)', () => {
  const { MailState, MailKeyboard, emails } = setup(20);
  MailKeyboard.selectByIndex(7);
  assert.equal(MailState.getState().focusedIndex, 7);
  assert.equal(MailState.getState().selectedEmailId, emails[7].id);
});

test('onKeydown: j/k/Enter are ignored entirely while the compose modal is open (Phase 4 contract)', () => {
  const { dom, MailState, MailKeyboard } = setup(20);
  MailState.setState({ isComposeOpen: true, focusedIndex: 2 });

  dom.document._dispatchKeydown({ key: 'j', preventDefault() {} }, false);
  assert.equal(MailState.getState().focusedIndex, 2, 'j should be ignored while compose is open');

  dom.document._dispatchKeydown({ key: 'Enter', preventDefault() {} }, false);
  assert.equal(MailState.getState().selectedEmailId, null, 'Enter should be ignored while compose is open');
});

test('onKeydown: j/k are ignored while focus is in a text input (e.g. search box)', () => {
  const { dom, MailState, MailKeyboard } = setup(20);
  const searchInput = dom.document.createElement('input');
  dom.document.activeElement = searchInput;

  dom.document._dispatchKeydown({ key: 'j', preventDefault() {} }, false);
  assert.equal(MailState.getState().focusedIndex, -1, 'j should type as a letter, not navigate, while typing');
});

test('onKeydown: j moves down, k moves up, Enter opens — the real end-to-end sequence', () => {
  const { dom, MailState, emails } = setup(20);
  let prevented = 0;
  const evt = (key) => ({ key, preventDefault() { prevented++; } });

  dom.document._dispatchKeydown(evt('j'), false);
  assert.equal(MailState.getState().focusedIndex, 0);

  dom.document._dispatchKeydown(evt('j'), false);
  assert.equal(MailState.getState().focusedIndex, 1);

  dom.document._dispatchKeydown(evt('k'), false);
  assert.equal(MailState.getState().focusedIndex, 0);

  dom.document._dispatchKeydown(evt('Enter'), false);
  assert.equal(MailState.getState().selectedEmailId, emails[0].id);

  assert.equal(prevented, 4, 'every handled key should call preventDefault so the browser default does not also fire');
});

test('clicking a row (via delegated onListClick) selects that exact index', () => {
  const { dom, MailState, emails } = setup(20);
  const list = dom.document.getElementById('emailList');
  const row = dom.document.createElement('li');
  row.classList.add('email-row');
  row.dataset.index = '4';
  list.appendChild(row);

  list._dispatch('click', { target: row }, false);

  assert.equal(MailState.getState().focusedIndex, 4);
  assert.equal(MailState.getState().selectedEmailId, emails[4].id);
});
