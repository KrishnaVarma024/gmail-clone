// compose.js — the compose modal: open/close behavior and focus
// trapping (keeping Tab from escaping the modal while it's open).
//
// Coordination contract with keyboard.js (Phase 5): before acting on
// j/k/Enter, keyboard.js must check
// window.MailState.getState().isComposeOpen and bail out if true. This
// file is what keeps that flag accurate — it's the only file allowed to
// flip isComposeOpen, the same rule state.js enforces everywhere else.

(function () {
  var overlay, modal, closeBtn, discardBtn, sendBtn, composeBtn, firstField;
  var lastFocusedElement = null;

  function getFocusable() {
    var nodes = modal.querySelectorAll(
      'input, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
    );
    return Array.prototype.filter.call(nodes, function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
  }

  function openModal() {
    lastFocusedElement = document.activeElement;
    window.MailState.setState({ isComposeOpen: true });

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');

    // Wait a frame so the CSS transition has a "before" state to animate
    // from, and so focus lands after the modal is actually visible.
    requestAnimationFrame(function () {
      firstField.focus();
    });

    // Capture phase (the `true` third argument): this listener sees
    // Escape/Tab BEFORE anything else does, including Phase 5's future
    // document-level j/k handler. That ordering is what makes focus
    // trapping actually reliable instead of racing other listeners.
    document.addEventListener('keydown', onKeydown, true);
  }

  function closeModal() {
    window.MailState.setState({ isComposeOpen: false });

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');

    document.removeEventListener('keydown', onKeydown, true);

    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }

    if (e.key === 'Tab') {
      var focusable = getFocusable();
      if (focusable.length === 0) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function clearFields() {
    document.getElementById('composeTo').value = '';
    document.getElementById('composeSubject').value = '';
    document.getElementById('composeBody').value = '';
  }

  function onSend(e) {
    e.preventDefault();
    // Static demo — no backend exists, nothing is actually sent.
    // eslint-disable-next-line no-console
    console.log('[Phase 4] Compose is a static demo — no email was sent.');
    clearFields();
    closeModal();
  }

  function onDiscard(e) {
    e.preventDefault();
    clearFields();
    closeModal();
  }

  document.addEventListener('DOMContentLoaded', function () {
    overlay = document.getElementById('composeOverlay');
    modal = document.getElementById('composeModal');
    closeBtn = document.getElementById('composeClose');
    discardBtn = document.getElementById('composeDiscard');
    sendBtn = document.getElementById('composeSend');
    composeBtn = document.getElementById('composeBtn');
    firstField = document.getElementById('composeTo');

    if (!overlay || !modal || !composeBtn) return;

    composeBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    discardBtn.addEventListener('click', onDiscard);
    sendBtn.addEventListener('click', onSend);

    // Backdrop click closes; click anywhere inside the panel must not
    // bubble up and trigger this (the modal itself doesn't stop
    // propagation — this listener only reacts when the click target IS
    // the overlay, i.e. the dimmed area, not any of its children).
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
  });
})();
