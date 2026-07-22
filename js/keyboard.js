// keyboard.js — EVENT LAYER (keyboard)
//
// j / k move the keyboard-focused row down/up, Enter opens it — exactly
// like real Gmail. The tricky part: the focused row might not currently
// exist in the DOM (it's virtualized), so this file keeps a logical
// "focusedIndex" in state.js in sync rather than tracking a DOM element
// directly.
//
// REQUIRED CHECK, set by Phase 4: every handler in here must bail out
// early if window.MailState.getState().isComposeOpen is true. Otherwise
// typing "j" or "k" while writing an email in the compose modal would
// hijack the list underneath instead of typing a letter. compose.js's
// focus trap keeps Tab/Escape contained, but it can't stop a global "j"
// listener from also firing — that's this file's responsibility.
//
// Built in Phase 5.
