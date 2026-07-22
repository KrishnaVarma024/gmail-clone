// render.js — RENDER LAYER
//
// Pure functions that take state + the currently-visible row window
// and turn them into DOM updates. This file decides HOW to paint a row
// (recycle a node, set its text, position it with translateY) — it
// never decides WHAT should be visible; that's virtualList.js's job.
//
// Built in Phase 3.
