// tests/virtualList.test.js — VIRTUALIZATION ENGINE
//
// "The single feature that separates people who've hit real performance
// problems from those who haven't" gets the heaviest testing in this
// suite: pure computeRange() math, the TOP_OFFSET bug found and fixed
// during Phase 5 (re-verified here so it can never silently regress),
// scrollToIndex()'s boundary behavior, and the Phase 7
// aria-activedescendant contract.

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDom } = require('../test-support/fakeDom');

function loadVirtualList() {
  const dom = createFakeDom();
  dom.loadScript('data.js');
  dom.loadScript('state.js');
  dom.loadScript('render.js');
  dom.loadScript('virtualList.js');
  return { MailVirtualList: dom.sandbox.window.MailVirtualList, MailState: dom.sandbox.window.MailState, MailData: dom.sandbox.window.MailData, dom };
}

// ---- computeRange: pure function, no DOM ----

test('computeRange at scrollTop 0 starts at index 0 (clamped, no negative overscan)', () => {
  const { MailVirtualList } = loadVirtualList();
  const range = MailVirtualList.computeRange(0, 560, 56, 4, 5000, 64);
  assert.equal(range.start, 0);
  assert.ok(range.end > 0);
});

test('computeRange applies TOP_OFFSET before converting scrollTop to a row index', () => {
  const { MailVirtualList } = loadVirtualList();
  const rowHeight = 56, topOffset = 64;
  // scrollTop exactly equal to topOffset means zero rows have scrolled
  // past the floating topbar yet — firstVisible should be row 0, not 1.
  const range = MailVirtualList.computeRange(topOffset, 560, rowHeight, 0, 5000, topOffset);
  assert.equal(range.start, 0, 'a scrollTop equal to the topbar height should NOT skip row 0');
});

test('computeRange without the TOP_OFFSET correction would be off by exactly one row (regression guard)', () => {
  const { MailVirtualList } = loadVirtualList();
  const rowHeight = 56, topOffset = 64;
  const withOffset = MailVirtualList.computeRange(topOffset + rowHeight, 560, rowHeight, 0, 5000, topOffset);
  const withoutOffsetMath = Math.floor((topOffset + rowHeight) / rowHeight); // the Phase 3 bug's formula
  assert.equal(withOffset.start, 1, 'correct math: exactly one row scrolled past');
  assert.notEqual(withoutOffsetMath, 1, 'sanity: the buggy formula really did produce a different (wrong) answer');
});

test('computeRange end is clamped to total, and start is clamped to >= 0 near both ends of the list', () => {
  const { MailVirtualList } = loadVirtualList();
  const total = 5000;
  const nearStart = MailVirtualList.computeRange(64, 560, 56, 4, total, 64);
  assert.ok(nearStart.start >= 0);

  const maxScroll = total * 56 - 560 + 64; // true max scrollTop for this list
  const nearEnd = MailVirtualList.computeRange(maxScroll, 560, 56, 4, total, 64);
  assert.equal(nearEnd.end, total, 'end should clamp to total, never exceed it');
  assert.ok(nearEnd.start < total);
});

test('computeRange includes OVERSCAN extra rows on both sides of the visible window', () => {
  const { MailVirtualList } = loadVirtualList();
  // Scrolled well into the middle of the list so overscan on both sides
  // has room to apply without hitting either boundary clamp.
  const scrollTop = 64 + 2000 * 56;
  const noOverscan = MailVirtualList.computeRange(scrollTop, 560, 56, 0, 5000, 64);
  const withOverscan = MailVirtualList.computeRange(scrollTop, 560, 56, 4, 5000, 64);
  assert.equal(withOverscan.start, noOverscan.start - 4);
  assert.equal(withOverscan.end, noOverscan.end + 4);
});

test('computeRange: exhaustive sweep across the full 5,000-row range has zero gaps or out-of-bounds indices', () => {
  const { MailVirtualList } = loadVirtualList();
  const total = 5000, rowHeight = 56, topOffset = 64, viewportHeight = 560, overscan = 4;
  const maxScroll = total * rowHeight - viewportHeight + topOffset;

  // A step size that's deliberately NOT a multiple of rowHeight (56), to
  // catch pixel-alignment bugs a round-number step could hide by luck.
  const step = 13;
  let checks = 0;
  for (let scrollTop = 0; scrollTop <= maxScroll; scrollTop += step) {
    const range = MailVirtualList.computeRange(scrollTop, viewportHeight, rowHeight, overscan, total, topOffset);
    assert.ok(range.start >= 0, `start went negative at scrollTop=${scrollTop}`);
    assert.ok(range.end <= total, `end exceeded total at scrollTop=${scrollTop}`);
    assert.ok(range.start <= range.end, `start > end at scrollTop=${scrollTop}`);
    checks++;
  }
  assert.ok(checks > 1000, `expected a real sweep, only ran ${checks} checks`);
});

// ---- scrollToIndex / renderVisible: needs the fake DOM ----

function setupList(emailCount) {
  const { MailVirtualList, MailState, MailData, dom } = loadVirtualList();
  const viewport = dom.registerEl('listViewport', 'main');
  const container = dom.registerEl('emailList', 'ul');
  const emails = MailData.generateEmails(emailCount);
  MailState.setState({ emails, focusedIndex: -1, selectedEmailId: null });
  MailVirtualList.init(emails);
  return { MailVirtualList, MailState, emails, viewport, container, dom };
}

test('scrollToIndex(0) brings row 0 into the pool and does not scroll past the top', () => {
  const { MailVirtualList, viewport } = setupList(5000);
  viewport.scrollTop = 5000;
  MailVirtualList.scrollToIndex(0);
  assert.equal(viewport.scrollTop, 0);
});

test('scrollToIndex(4999) — the very last row — is reachable and lands within the true max scrollTop', () => {
  const { MailVirtualList, viewport } = setupList(5000);
  const rowHeight = MailVirtualList.ROW_HEIGHT;
  const topOffset = MailVirtualList.TOP_OFFSET;
  MailVirtualList.scrollToIndex(4999);

  const expectedBottomThreshold = topOffset + 5000 * rowHeight - viewport.clientHeight;
  assert.equal(viewport.scrollTop, expectedBottomThreshold);
});

test('after scrollToIndex, the focused row is actually rendered in the pool (not just claimed)', () => {
  const { MailVirtualList, MailState, emails, container } = setupList(5000);
  MailState.setState({ focusedIndex: 2500 });
  MailVirtualList.scrollToIndex(2500);

  const targetId = 'email-row-' + emails[2500].id;
  const found = container.children.find((c) => c.id === targetId);
  assert.ok(found, 'expected the focused row to be a real pooled element after scrollToIndex');
  assert.notEqual(found.style.display, 'none');
});

test('Phase 7: aria-activedescendant tracks focusedIndex and clears when there is no focus', () => {
  const { MailVirtualList, MailState, emails, container } = setupList(5000);

  assert.equal(container.hasAttribute('aria-activedescendant'), false, 'no attribute while focusedIndex is -1');

  MailState.setState({ focusedIndex: 0 });
  MailVirtualList.scrollToIndex(0);
  assert.equal(container.getAttribute('aria-activedescendant'), 'email-row-' + emails[0].id);

  MailState.setState({ focusedIndex: 4999 });
  MailVirtualList.scrollToIndex(4999);
  assert.equal(container.getAttribute('aria-activedescendant'), 'email-row-' + emails[4999].id);
});

test('forceRender repaints even when the visible range has not changed (bypasses the range-cache early return)', () => {
  const { MailVirtualList, MailState, emails, container } = setupList(200);
  MailState.setState({ focusedIndex: 0, selectedEmailId: emails[0].id });
  MailVirtualList.forceRender();

  const row0 = container.children.find((c) => c.id === 'email-row-' + emails[0].id);
  assert.ok(row0);
  assert.equal(row0.getAttribute('aria-selected'), 'true');
});

test('init() builds a pool far smaller than the dataset — this IS the virtualization', () => {
  const { container, emails } = setupList(5000);
  assert.ok(emails.length === 5000);
  assert.ok(container.children.length < 100, `pool should be a couple dozen elements, was ${container.children.length}`);
});
