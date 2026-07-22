// virtualList.js — VIRTUALIZATION ENGINE
// "The single feature that separates people who've hit real performance
// problems from those who haven't." — this is the moment.
//
// Given scrollTop + --row-height (see styles.css) + viewport height,
// computes which ~15-20 rows are actually visible right now and hands
// that window to render.js. The DOM never holds more than a couple
// dozen row nodes, no matter how long the list is — that's what keeps
// scrolling through 5,000 emails smooth.
//
// Built in Phase 3.
