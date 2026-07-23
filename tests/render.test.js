// tests/render.test.js — RENDER LAYER
//
// escapeHTML is the one function in this whole app where a bug is a
// real security bug (XSS via a malicious sender/subject string), so it
// gets tested adversarially, not just happy-path. updateRow's Phase 7
// ARIA contract is tested here too, since render.js is what actually
// sets those attributes (virtualList.js just calls it).

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDom } = require('../test-support/fakeDom');

function loadRender() {
  const dom = createFakeDom();
  dom.loadScript('render.js');
  return { MailRender: dom.sandbox.window.MailRender, dom };
}

test('escapeHTML neutralizes all five dangerous characters', () => {
  const { MailRender } = loadRender();
  assert.equal(MailRender.escapeHTML('<script>'), '&lt;script&gt;');
  assert.equal(MailRender.escapeHTML('"quoted"'), '&quot;quoted&quot;');
  assert.equal(MailRender.escapeHTML('a & b'), 'a &amp; b');
});

test('escapeHTML defeats a realistic stored-XSS payload in a sender/subject field', () => {
  const { MailRender } = loadRender();
  const payload = '<img src=x onerror="alert(document.cookie)">';
  const escaped = MailRender.escapeHTML(payload);
  assert.ok(!escaped.includes('<img'), 'no raw tag should survive escaping');
  assert.ok(!escaped.includes('"'), 'no raw quote should survive escaping (breaks attribute-context payloads)');
  assert.equal(escaped, '&lt;img src=x onerror=&quot;alert(document.cookie)&quot;&gt;');
});

test('escapeHTML coerces non-string input instead of throwing', () => {
  const { MailRender } = loadRender();
  assert.equal(MailRender.escapeHTML(42), '42');
  assert.equal(MailRender.escapeHTML(null), 'null');
});

test('rowInnerHTML escapes every interpolated field, not just some of them', () => {
  const { MailRender } = loadRender();
  const email = {
    sender: '<b>Evil</b>',
    subject: '"><script>x</script>',
    snippet: 'a & b',
    time: '<time>',
    senderInitials: '<X>',
    avatarClass: 'avatar--1'
  };
  const html = MailRender.rowInnerHTML(email);
  assert.ok(!html.includes('<b>Evil</b>'), 'sender must be escaped');
  assert.ok(!html.includes('<script>x</script>'), 'subject must be escaped');
  assert.ok(!html.includes('<time>'), 'time must be escaped');
});

test('rowAriaLabel prefixes "Unread" only when the email is actually unread', () => {
  const { MailRender } = loadRender();
  const unread = { unread: true, sender: 'A', subject: 'B', time: 'C' };
  const read = { unread: false, sender: 'A', subject: 'B', time: 'C' };
  assert.equal(MailRender.rowAriaLabel(unread), 'Unread, A, B, C');
  assert.equal(MailRender.rowAriaLabel(read), 'A, B, C');
});

test('updateRow sets the full Phase 7 ARIA contract on the recycled <li>', () => {
  const { MailRender, dom } = loadRender();
  const li = dom.document.createElement('li');
  const email = { id: 'email-42', sender: 'Ada', subject: 'Hi', time: '1:00 PM', unread: false, avatarClass: 'avatar--2', senderInitials: 'AD', snippet: 'x' };

  MailRender.updateRow(li, email, 42, 56, /* focusedIndex */ 42, /* selectedEmailId */ null, /* total */ 5000);

  assert.equal(li.id, 'email-row-email-42', 'id must be stable per EMAIL, not per pooled node');
  assert.equal(li.getAttribute('role'), 'option');
  assert.equal(li.getAttribute('aria-selected'), 'false');
  assert.equal(li.getAttribute('aria-posinset'), '43', 'posinset is 1-indexed (index + 1)');
  assert.equal(li.getAttribute('aria-setsize'), '5000');
  assert.equal(li.getAttribute('aria-label'), 'Ada, Hi, 1:00 PM');
  assert.ok(li.classList.contains('email-row--focused'), 'index === focusedIndex should apply the focused class');
  assert.ok(!li.classList.contains('email-row--selected'));
});

test('updateRow flips aria-selected and the --selected class when email.id matches selectedEmailId', () => {
  const { MailRender, dom } = loadRender();
  const li = dom.document.createElement('li');
  const email = { id: 'email-7', sender: 'A', subject: 'B', time: 'C', unread: true, avatarClass: 'avatar--1', senderInitials: 'AB', snippet: 'x' };

  MailRender.updateRow(li, email, 7, 56, -1, 'email-7', 100);

  assert.equal(li.getAttribute('aria-selected'), 'true');
  assert.ok(li.classList.contains('email-row--selected'));
  assert.ok(li.classList.contains('email-row--unread'));
  assert.ok(!li.classList.contains('email-row--focused'), 'focusedIndex (-1) does not match index (7)');
});

test('updateRow positions the row with translateY(index * rowHeight), never top/margin', () => {
  const { MailRender, dom } = loadRender();
  const li = dom.document.createElement('li');
  const email = { id: 'email-1', sender: 'A', subject: 'B', time: 'C', unread: false, avatarClass: 'avatar--1', senderInitials: 'AB', snippet: 'x' };

  MailRender.updateRow(li, email, 10, 56, -1, null, 100);

  assert.equal(li.style.transform, 'translateY(560px)');
  assert.equal(li.style.top, undefined, 'must not use top for positioning (defeats compositor-only repaint)');
});

test('renderSkeleton sizes the container to exactly count * rowHeight (zero layout shift contract)', () => {
  const { MailRender, dom } = loadRender();
  dom.registerEl('emailList', 'ul');
  MailRender.renderSkeleton(14, 56);

  const list = dom.document.getElementById('emailList');
  assert.equal(list.style.height, '784px'); // 14 * 56
  assert.equal(list.children.length, 0, 'renderSkeleton sets innerHTML as a string — children[] (real appendChild calls) stays empty in this fake DOM, that is expected');
  assert.ok(list.innerHTML.includes('email-row--skeleton'));
  // Every skeleton row must be aria-hidden — it's fake content, a
  // screen reader should never see or announce it.
  const hiddenCount = (list.innerHTML.match(/aria-hidden="true"/g) || []).length;
  assert.equal(hiddenCount, 14, 'every skeleton row must be aria-hidden');
});
