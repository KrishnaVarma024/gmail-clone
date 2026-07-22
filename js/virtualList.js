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
  var ROW_HEIGHT = 56; // keep in sync with --row-height in styles.css
  var OVERSCAN = 4;    // extra rows kept rendered above/below the visible
                        // window, so a fast scroll or fling doesn't show
                        // a blank flash for a frame while content catches up

  var viewport = null;
  var container = null;
  var pool = [];
  var poolSize = 0;
  var emails = [];
  var ticking = false;
  var lastRange = { start: -1, end: -1 };

  // Pure function, no DOM — this is what makes it testable outside a
  // browser (see the Node test run during Phase 3 verification).
  function computeRange(scrollTop, viewportHeight, rowHeight, overscan, total) {
    var firstVisible = Math.floor(scrollTop / rowHeight);
    var visibleCount = Math.ceil(viewportHeight / rowHeight);
    // Clamped on both ends — scrollTop can't actually leave [0, scrollHeight]
    // in a real browser, but this stays correct even if it's ever called
    // with a bogus value (defensive, cheap, and a fair interview question).
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

    var range = computeRange(scrollTop, viewportHeight, ROW_HEIGHT, OVERSCAN, emails.length);

    if (range.start === lastRange.start && range.end === lastRange.end) return;
    lastRange = range;

    for (var i = 0; i < poolSize; i++) {
      var dataIndex = range.start + i;
      var li = pool[i];

      if (dataIndex >= range.end) {
        li.style.display = 'none';
        continue;
      }

      var email = emails[dataIndex];
      li.style.display = '';
      window.MailRender.updateRow(li, email, dataIndex, ROW_HEIGHT);
    }
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
    lastRange = { start: -1, end: -1 }; // force a re-render even if scrollTop didn't change
    renderVisible();
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
    computeRange: computeRange, // exposed for testing
    ROW_HEIGHT: ROW_HEIGHT
  };
})();
