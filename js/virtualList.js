// virtualList.js — VIRTUALIZATION ENGINE
// "The single feature that separates people who've hit real performance
// problems from those who haven't." — this is the moment.
//
// The idea: the DOM never holds more than a couple dozen row elements,
// no matter whether the list has 50 emails or 5,000,000. Instead of
// creating/destroying rows as you scroll, we keep a fixed POOL of row
// elements and just move + repaint them (that's the "recycling" part).
//
// Three pieces:
//   1. computeRange()  — pure math, no DOM. Given scrollTop and sizes,
//      which data indices should currently be visible? Pulled out on
//      purpose so this logic can be unit-tested without a browser.
//   2. The pool         — a fixed set of <li> elements, created once.
//   3. renderVisible()  — on every scroll frame, decide which data index
//      each pooled element should now represent, and move it there with
//      CSS transform: translateY(index * rowHeight) instead of changing
//      `top`. Transforms are handled by the compositor, not layout — so
//      moving a row doesn't force the browser to recompute anyone else's
//      position, the way changing `top`/margin would.

(function () {
  var ROW_HEIGHT = 56;   // keep in sync with --row-height in styles.css
  var TOP_OFFSET = 64;   // keep in sync with --topbar-height. #emailList
                          // sits inside #listViewport's padding-top, so
                          // every row's real position is offset by this
                          // much from raw scrollTop — miss this and both
                          // the visible range AND scroll-to-row land
                          // about one row off near the edges.
  var OVERSCAN = 4;      // extra rows kept rendered above/below the
                          // visible window, so a fast scroll or fling
                          // doesn't show a blank flash for a frame

  var viewport = null;
  var container = null;
  var pool = [];
  var poolSize = 0;
  var emails = [];
  var ticking = false;
  var lastRange = { start: -1, end: -1 };

  // Pure function, no DOM — this is what makes it testable outside a
  // browser (see the Node test run during Phase 3/5 verification).
  // topOffset accounts for the floating topbar covering the first
  // `topOffset` px of the viewport (see TOP_OFFSET above).
  function computeRange(scrollTop, viewportHeight, rowHeight, overscan, total, topOffset) {
    var localTop = Math.max(0, scrollTop - topOffset);
    var firstVisible = Math.floor(localTop / rowHeight);
    var visibleCount = Math.ceil(viewportHeight / rowHeight);
    var start = Math.max(0, Math.min(firstVisible - overscan, total));
    var end = Math.max(start, Math.min(total, firstVisible + visibleCount + overscan));
    return { start: start, end: end };
  }

  function requiredPoolSize(viewportHeight) {
    return Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2 + 2;
  }

  function ensurePool(size) {
    while (pool.length < size) {
      var li = document.createElement('li');
      li.className = 'email-row';
      li.style.display = 'none';
      container.appendChild(li);
      pool.push(li);
    }
    poolSize = pool.length;
  }

  function renderVisible() {
    var scrollTop = viewport.scrollTop;
    var viewportHeight = viewport.clientHeight;
    var required = requiredPoolSize(viewportHeight);
    if (required > poolSize) ensurePool(required);

    var range = computeRange(scrollTop, viewportHeight, ROW_HEIGHT, OVERSCAN, emails.length, TOP_OFFSET);

    if (range.start === lastRange.start && range.end === lastRange.end) return;
    lastRange = range;

    // Read focus/selection state ONCE per repaint and pass it down as
    // plain arguments — updateRow() stays a pure function of its inputs
    // instead of reaching into global state itself, which is what keeps
    // it unit-testable without mocking MailState.
    var appState = window.MailState.getState();

    for (var i = 0; i < poolSize; i++) {
      var dataIndex = range.start + i;
      var li = pool[i];

      if (dataIndex >= range.end) {
        li.style.display = 'none';
        continue;
      }

      var email = emails[dataIndex];
      li.style.display = '';
      window.MailRender.updateRow(li, email, dataIndex, ROW_HEIGHT, appState.focusedIndex, appState.selectedEmailId, emails.length);
    }

    // Phase 7 — keep the listbox's aria-activedescendant pointed at
    // whichever row is the current keyboard cursor. This is safe to set
    // unconditionally here (not just from keyboard.js) because
    // scrollToIndex() always forces a synchronous renderVisible() call
    // before returning — by the time this line runs, the option with
    // that id is guaranteed to actually exist in the DOM, the same
    // guarantee .email-row--focused already relies on.
    if (appState.focusedIndex >= 0 && appState.focusedIndex < emails.length) {
      container.setAttribute('aria-activedescendant', 'email-row-' + emails[appState.focusedIndex].id);
    } else {
      container.removeAttribute('aria-activedescendant');
    }
  }

  // Bypasses the "range unchanged" early-return in renderVisible() by
  // invalidating the cached range first. Needed whenever something
  // OTHER than scrolling should change what's painted — focusedIndex
  // moving within the same visible window, or an email being marked
  // read, for example. Cheap: it only ever repaints the existing pool
  // (~20-30 nodes), never touches the other 4,970+ emails.
  function forceRender() {
    lastRange = { start: -1, end: -1 };
    renderVisible();
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      renderVisible();
      ticking = false;
    });
  }

  function onResize() {
    forceRender();
  }

  // Scrolls just enough to bring row `index` fully into the unobstructed
  // view (i.e., not clipped by the viewport edge, and not hidden behind
  // the floating topbar) — then forces a repaint so the newly-focused
  // row exists in the DOM immediately instead of waiting on the next
  // scroll event. This is the answer to "how do you keep keyboard focus
  // in sync with a virtualized list": the row might not be rendered at
  // all when you press 'j' — this function is what guarantees it will be,
  // synchronously, before the frame is done.
  function scrollToIndex(index) {
    if (!viewport) return;

    var rowTop = index * ROW_HEIGHT;
    var rowBottomThreshold = TOP_OFFSET + (index + 1) * ROW_HEIGHT - viewport.clientHeight;
    var scrollTop = viewport.scrollTop;

    if (scrollTop > rowTop) {
      viewport.scrollTop = rowTop;
    } else if (scrollTop < rowBottomThreshold) {
      viewport.scrollTop = rowBottomThreshold;
    }
    // else: row is already fully visible, no scroll needed.

    forceRender();
  }

  function init(emailList) {
    emails = emailList;
    viewport = document.getElementById('listViewport');
    container = document.getElementById('emailList');
    if (!viewport || !container) return;

    container.innerHTML = '';
    pool = [];
    container.style.position = 'relative';
    container.style.height = (emails.length * ROW_HEIGHT) + 'px';

    ensurePool(requiredPoolSize(viewport.clientHeight));
    renderVisible();

    viewport.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
  }

  window.MailVirtualList = {
    init: init,
    scrollToIndex: scrollToIndex,
    forceRender: forceRender,
    computeRange: computeRange, // exposed for testing
    ROW_HEIGHT: ROW_HEIGHT,
    TOP_OFFSET: TOP_OFFSET
  };
})();
