// tests/data.test.js — DATA LAYER
//
// generateEmails() is pure and deterministic on purpose (see data.js's
// header comment) specifically so it CAN be tested this way: no mocking,
// no DOM, just "call it twice, expect the same answer."

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDom } = require('../test-support/fakeDom');

function loadData() {
  const dom = createFakeDom();
  dom.loadScript('data.js');
  return dom.sandbox.window.MailData;
}

test('generateEmails is deterministic — same index, same email, across separate calls', () => {
  const MailData = loadData();
  const a = MailData.generateEmails(200);
  const b = MailData.generateEmails(200);

  assert.equal(a.length, 200);
  assert.equal(b.length, 200);

  for (let i = 0; i < 200; i++) {
    assert.equal(a[i].id, b[i].id, `id mismatch at ${i}`);
    assert.equal(a[i].sender, b[i].sender, `sender mismatch at ${i}`);
    assert.equal(a[i].subject, b[i].subject, `subject mismatch at ${i}`);
    assert.equal(a[i].snippet, b[i].snippet, `snippet mismatch at ${i}`);
    assert.equal(a[i].senderInitials, b[i].senderInitials, `initials mismatch at ${i}`);
    assert.equal(a[i].avatarClass, b[i].avatarClass, `avatarClass mismatch at ${i}`);
    assert.equal(a[i].unread, b[i].unread, `unread mismatch at ${i}`);
    // timestamp/time legitimately depend on wall-clock "now" at call
    // time, so they're intentionally excluded from this comparison.
  }
});

test('generateEmails produces stable ids in order: email-0 .. email-N-1', () => {
  const MailData = loadData();
  const emails = MailData.generateEmails(50);
  emails.forEach((e, i) => assert.equal(e.id, 'email-' + i));
});

test('unread pattern is exactly "every third email" (i % 3 === 0)', () => {
  const MailData = loadData();
  const emails = MailData.generateEmails(30);
  emails.forEach((e, i) => {
    assert.equal(e.unread, i % 3 === 0, `index ${i}`);
  });
});

test('senderInitials are derived correctly for multi-word and single-word senders', () => {
  const MailData = loadData();
  const emails = MailData.generateEmails(300);
  const bySender = {};
  emails.forEach((e) => { bySender[e.sender] = e.senderInitials; });

  // Spot-check a couple of known senders from data.js's own list.
  assert.equal(bySender['GitHub'], 'GI', 'single-word sender takes first 2 letters');
  assert.equal(bySender['Priya Sharma'], 'PS', 'two-word sender takes first letter of each');
});

test('avatarClass is always one of avatar--1 through avatar--8, consistent per sender', () => {
  const MailData = loadData();
  const emails = MailData.generateEmails(500);
  const seen = {};
  emails.forEach((e) => {
    assert.match(e.avatarClass, /^avatar--[1-8]$/, `unexpected avatarClass ${e.avatarClass}`);
    if (seen[e.sender]) {
      assert.equal(seen[e.sender], e.avatarClass, `same sender ${e.sender} got two different colors`);
    } else {
      seen[e.sender] = e.avatarClass;
    }
  });
});

test('generateEmails(0) returns an empty array without throwing', () => {
  const MailData = loadData();
  const result = MailData.generateEmails(0);
  // Not deepEqual([]) here on purpose: `result` is an Array from the vm
  // sandbox's own realm, which has a different Array.prototype than this
  // test file's — deepStrictEqual flags that as "not reference-equal"
  // even though the values are identical. Length + Array.isArray is the
  // realm-safe way to check this.
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test('fetchEmails resolves a Promise with count emails after a simulated delay', async () => {
  const MailData = loadData();
  const start = Date.now();
  const emails = await MailData.fetchEmails(25);
  const elapsed = Date.now() - start;

  assert.equal(emails.length, 25);
  // data.js documents 600-1000ms simulated latency — assert it's really
  // asynchronous (not resolved on the same tick) without being so tight
  // a slow CI machine flakes.
  assert.ok(elapsed >= 500, `expected a real delay, only took ${elapsed}ms`);
});
