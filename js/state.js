// state.js — STATE LAYER
//
// The single source of truth for what the app is currently showing:
// the email list, which one is selected, keyboard-focused row, whether
// the compose modal is open, whether the app is still "loading." No
// other file keeps its own copy of this data — they read getState(),
// and get notified via subscribe() when something changes.
//
// This is a deliberately tiny version of the pattern Redux/Zustand/etc.
// formalize: one object, one way to change it (setState), one way to
// react to changes (subscribe). You don't need a library to get the
// benefit — you need the *rule* that nothing else holds its own copy.

(function () {
  var state = {
    emails: [],
    isLoading: true,
    selectedEmailId: null,
    focusedIndex: -1,
    isComposeOpen: false
  };

  var listeners = [];

  function getState() {
    return state;
  }

  function setState(patch) {
    Object.assign(state, patch);
    listeners.forEach(function (fn) { fn(state); });
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  window.MailState = { getState: getState, setState: setState, subscribe: subscribe };
})();
