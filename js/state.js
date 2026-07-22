// state.js — STATE LAYER
//
// The single source of truth for what the app is currently showing:
// selected email, scroll position, keyboard-focused row, whether the
// compose modal is open, whether the app is still "loading," which
// theme is active. No other file is allowed to keep its own copy of
// this data — they all read from here, and re-render when it changes.
//
// Built in Phase 2, grows through Phases 3-6.
