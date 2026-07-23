// tests/compose.test.js — the compose modal's focus trap, open/close
// contract, and Phase 7's aria-hidden-the-background-while-open behavior.

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDom } = require('../test-support/fakeDom');

function setup() {
  const dom = createFakeDom();
  const overlay = dom.registerEl('composeOverlay', 'div');
  const modal = dom.registerEl('composeModal', 'div');
  const closeBtn = dom.registerEl('composeClose', 'button');
  const discardBtn = dom.registerEl('composeDiscard', 'button');
  const sendBtn = dom.registerEl('composeSend', 'button');
  const composeBtn = dom.registerEl('composeBtn', 'button');
  const toField = dom.registerEl('composeTo', 'input');
  const subjectField = dom.registerEl('composeSubject', 'input');
  const bodyField = dom.registerEl('composeBody', 'textarea');
  const app = dom.registerEl('__ignored__', 'div');
  dom.document._byId.__app__ = app;

  // Mirror index.html's real nesting (header > closeBtn, body > fields,
  // footer > send/discard) so getFocusable()'s querySelectorAll walk
  // finds them in DOM order: close, to, subject, body, send, discard.
  overlay.appendChild(modal);
  modal.appendChild(closeBtn);
  modal.appendChild(toField);
  modal.appendChild(subjectField);
  modal.appendChild(bodyField);
  modal.appendChild(sendBtn);
  modal.appendChild(discardBtn);

  dom.loadScript('state.js');
  dom.loadScript('compose.js');
  dom.document._fireDOMContentLoaded();

  return { dom, overlay, modal, closeBtn, discardBtn, sendBtn, composeBtn, toField, subjectField, bodyField, app };
}

test('openModal (via clicking Compose) opens the overlay and sets isComposeOpen', () => {
  const { dom, overlay, composeBtn } = setup();
  composeBtn._dispatch('click', {}, false);

  assert.ok(overlay.classList.contains('is-open'));
  assert.equal(overlay.getAttribute('aria-hidden'), 'false');
  assert.equal(dom.sandbox.window.MailState.getState().isComposeOpen, true);
});

test('Phase 7: opening the modal hides .app from assistive tech; closing restores it', () => {
  const { dom, composeBtn, closeBtn, app } = setup();

  assert.equal(app.hasAttribute('aria-hidden'), false, 'app starts visible to AT');
  composeBtn._dispatch('click', {}, false);
  assert.equal(app.getAttribute('aria-hidden'), 'true');

  closeBtn._dispatch('click', {}, false);
  assert.equal(app.hasAttribute('aria-hidden'), false, 'closing should remove aria-hidden entirely, not set it to false');
});

test('closing the modal restores focus to whatever had focus before it opened', () => {
  const { dom, composeBtn, closeBtn } = setup();
  dom.document.activeElement = composeBtn;

  composeBtn._dispatch('click', {}, false);
  closeBtn._dispatch('click', {}, false);

  assert.equal(dom.document.activeElement, composeBtn);
});

test('Escape closes the modal', () => {
  const { dom, overlay, composeBtn } = setup();
  composeBtn._dispatch('click', {}, false);
  assert.ok(overlay.classList.contains('is-open'));

  let prevented = false;
  dom.document._dispatchKeydown({ key: 'Escape', preventDefault() { prevented = true; } }, true);

  assert.ok(prevented);
  assert.ok(!overlay.classList.contains('is-open'));
});

test('Tab on the last focusable element wraps to the first (focus trap)', () => {
  const { dom, composeBtn, closeBtn, discardBtn } = setup();
  composeBtn._dispatch('click', {}, false);

  // discardBtn is last in DOM order (see setup()'s appendChild order,
  // matching index.html) — Tab from there with no shiftKey should wrap
  // to the first focusable element, closeBtn.
  dom.document.activeElement = discardBtn;
  let prevented = false;
  dom.document._dispatchKeydown({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } }, true);

  assert.ok(prevented, 'Tab off the last element must be intercepted');
  assert.equal(dom.document.activeElement, closeBtn, 'focus should wrap to the first focusable element');
});

test('Shift+Tab on the first focusable element wraps to the last (focus trap, reverse direction)', () => {
  const { dom, composeBtn, closeBtn, discardBtn } = setup();
  composeBtn._dispatch('click', {}, false);

  dom.document.activeElement = closeBtn;
  let prevented = false;
  dom.document._dispatchKeydown({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } }, true);

  assert.ok(prevented, 'Shift+Tab off the first element must be intercepted');
  assert.equal(dom.document.activeElement, discardBtn, 'focus should wrap to the last focusable element');
});

test('Tab between two middle fields is left alone — the trap only intervenes at the edges', () => {
  const { dom, composeBtn, toField, subjectField } = setup();
  composeBtn._dispatch('click', {}, false);

  dom.document.activeElement = toField;
  let prevented = false;
  dom.document._dispatchKeydown({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } }, true);

  assert.ok(!prevented, 'Tab between interior fields should not be intercepted — the browser handles it natively');
});

test('backdrop click (target === overlay) closes the modal; clicking inside the panel does not', () => {
  const { dom, overlay, modal, composeBtn } = setup();
  composeBtn._dispatch('click', {}, false);

  overlay._dispatch('click', { target: modal }, false);
  assert.ok(overlay.classList.contains('is-open'), 'clicking the panel itself must not close the modal');

  overlay._dispatch('click', { target: overlay }, false);
  assert.ok(!overlay.classList.contains('is-open'), 'clicking the dimmed backdrop must close the modal');
});

test('Send clears the fields and closes the modal (static demo — no network call)', () => {
  const { dom, composeBtn, sendBtn, toField, subjectField, bodyField, overlay } = setup();
  composeBtn._dispatch('click', {}, false);
  toField.value = 'a@b.com';
  subjectField.value = 'Hi';
  bodyField.value = 'Body text';

  sendBtn._dispatch('click', { preventDefault() {} }, false);

  assert.equal(toField.value, '');
  assert.equal(subjectField.value, '');
  assert.equal(bodyField.value, '');
  assert.ok(!overlay.classList.contains('is-open'));
});

test('Discard clears the fields and closes the modal without pretending to send', () => {
  const { dom, composeBtn, discardBtn, toField, overlay } = setup();
  composeBtn._dispatch('click', {}, false);
  toField.value = 'draft@example.com';

  discardBtn._dispatch('click', { preventDefault() {} }, false);

  assert.equal(toField.value, '');
  assert.ok(!overlay.classList.contains('is-open'));
});
