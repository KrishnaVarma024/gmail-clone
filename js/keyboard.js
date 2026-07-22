// keyboard.js — EVENT LAYER (keyboard)
//
// j / k move the keyboard-focused row down/up, Enter opens it — exactly
// like real Gmail. The tricky part: the focused row might not currently
// exist in the DOM (it's virtualized), so this file keeps a logical
// "focusedIndex" in state.js in sync rather than tracking a DOM element
// directly.
//
// Built in Phase 5.
