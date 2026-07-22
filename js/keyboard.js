// keyboard.js — EVENT LAYER (keyboard)
//
// j / k move a logical "focusedIndex" (in state.js) down/up through the
// list, Enter opens the focused email — exactly like real Gmail.
//
// The hard part, stated in the roadmap: the focused row might not exist
// in the DOM right now (it's virtualized — only ~20-30 rows are ever
// real nodes). This file never touches a DOM row directly. It only ever
// changes state.focusedIndex and then asks virtualList.js to make sure
// that index is on screen (scrollToIndex), which forces a repaint. The
// DOM is a rendering of the state, not the other way around — same rule
// every other file in this app follows.

(function () {
  function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true;
  }

  function moveFocus(delta) {
    var state = window.MailState.getState();
    var total = state.emails.length;
    if (total === 0) return;

    var current = state.focusedIndex;
    var next = current < 0 ? 0 : current + delta;
    next = Math.max(0, Math.min(total - 1, next));

    window.MailState.setState({ focusedIndex: next });
    window.MailVirtualList.scrollToIndex(next);
  }

  // Opens whatever is currently focused: marks it read (like real Gmail
  // does the moment you open a message) and records it as selected.
  // There's no separate reading pane in this project — "open" means
  // "this row is now the selected one," visually distinct from merely
  // being keyboard-focused.
  function openFocused() {
    var state = window.MailState.getState();
    var index = state.focusedIndex;
    if (index < 0 || index >= state.emails.length) return;

    var email = state.emails[index];
    email.unread = false;

    window.MailState.setState({ selectedEmailId: email.id });
    window.MailVirtualList.scrollToIndex(index); // repaint so read + selected show immediately
  }

  function selectByIndex(index) {
    window.MailState.setState({ focusedIndex: index });
    openFocused();
  }

  function onKeydown(e) {
    var state = window.MailState.getState();

    // Phase 4's contract: never hijack input while the compose modal is
    // open, its own focus trap owns keyboard input completely.
    if (state.isComposeOpen) return;

    // Don't steal "j"/"k"/Enter while the user is typing somewhere,
    // e.g. the search box — those are real letters and a real submit
    // there, not navigation shortcuts.
    if (isTypingTarget(document.activeElement)) return;

    if (e.key === 'j') {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === 'k') {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openFocused();
    }
  }

  // Clicking a row does the same thing keyboard nav + Enter would do —
  // one function (selectByIndex) backs both input methods, so there's
  // no risk of mouse and keyboard behaving inconsistently.
  function onListClick(e) {
    var row = e.target.closest('.email-row');
    if (!row || row.dataset.index === undefined) return;
    selectByIndex(Number(row.dataset.index));
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('keydown', onKeydown);

    var list = document.getElementById('emailList');
    if (list) list.addEventListener('click', onListClick);
  });

  window.MailKeyboard = { moveFocus: moveFocus, openFocused: openFocused, selectByIndex: selectByIndex };
})();
