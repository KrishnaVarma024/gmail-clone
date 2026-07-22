// render.js — RENDER LAYER
//
// Pure functions that take email data and turn it into DOM/HTML. This
// file decides HOW to paint a row — it never decides WHICH rows should
// exist; that's virtualList.js's job starting Phase 3.
//
// PHASE 2 VERSION — INTENTIONALLY NAIVE:
// renderAllRows() builds one giant HTML string for every single email
// and writes it into the list in one shot. That's still the "fast" way
// to insert many nodes (one reflow instead of thousands) — and it's
// still bad, because the DOM ends up holding 5,000 live <li> elements
// permanently. Open DevTools > Elements and count them. Then scroll and
// watch DevTools > Performance — that jank is backdrop-filter on the
// floating topbar recalculating every frame against thousands of moving
// rows underneath it. Phase 3 fixes both problems at once: never more
// than ~20 rows exist, so there's nothing expensive left to recompute.

(function () {
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function emailRowHTML(email, index) {
    var unreadClass = email.unread ? ' email-row--unread' : '';
    return (
      '<li class="email-row' + unreadClass + '" data-index="' + index + '" data-id="' + email.id + '">' +
        '<span class="email-row__indicator" aria-hidden="true"></span>' +
        '<span class="avatar ' + email.avatarClass + '" aria-hidden="true">' + escapeHTML(email.senderInitials) + '</span>' +
        '<span class="email-row__sender">' + escapeHTML(email.sender) + '</span>' +
        '<span class="email-row__subject">' + escapeHTML(email.subject) +
          '<span class="email-row__snippet"> — ' + escapeHTML(email.snippet) + '</span></span>' +
        '<span class="email-row__time">' + escapeHTML(email.time) + '</span>' +
      '</li>'
    );
  }

  function renderAllRows(emails) {
    var list = document.getElementById('emailList');
    if (!list) return;
    list.innerHTML = emails.map(emailRowHTML).join('');
  }

  window.MailRender = { renderAllRows: renderAllRows, emailRowHTML: emailRowHTML, escapeHTML: escapeHTML };
})();
