// render.js — RENDER LAYER
//
// Pure functions that take email data and turn it into DOM/HTML. This
// file decides HOW to paint a row — it never decides WHICH rows should
// exist or where; that's virtualList.js's job.

(function () {
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // The inner markup of one row, without the outer <li> — used by
  // updateRow() below, which recycles a persistent <li> rather than
  // creating a new one.
  function rowInnerHTML(email) {
    return (
      '<span class="email-row__indicator" aria-hidden="true"></span>' +
      '<span class="avatar ' + email.avatarClass + '" aria-hidden="true">' + escapeHTML(email.senderInitials) + '</span>' +
      '<span class="email-row__sender">' + escapeHTML(email.sender) + '</span>' +
      '<span class="email-row__subject">' + escapeHTML(email.subject) +
        '<span class="email-row__snippet"> — ' + escapeHTML(email.snippet) + '</span></span>' +
      '<span class="email-row__time">' + escapeHTML(email.time) + '</span>'
    );
  }

  // PHASE 2 approach — full <li> including the wrapper, one per email,
  // 5,000 of them, all real, all permanent. No longer called by app.js
  // after Phase 3, kept here on purpose: it's the clearest side-by-side
  // proof of what changed. Same row markup, same CSS, completely
  // different DOM footprint.
  function emailRowHTML(email, index) {
    var unreadClass = email.unread ? ' email-row--unread' : '';
    return (
      '<li class="email-row' + unreadClass + '" data-index="' + index + '" data-id="' + email.id + '">' +
        rowInnerHTML(email) +
      '</li>'
    );
  }

  function renderAllRows(emails) {
    var list = document.getElementById('emailList');
    if (!list) return;
    list.innerHTML = emails.map(emailRowHTML).join('');
  }

  // PHASE 3 approach — `li` is one of ~20-30 pooled, reused elements.
  // Repaint its content and reposition it for whatever data index
  // virtualList.js has decided it should represent right now.
  function updateRow(li, email, index, rowHeight) {
    li.className = 'email-row' + (email.unread ? ' email-row--unread' : '');
    li.dataset.index = String(index);
    li.dataset.id = email.id;
    li.style.transform = 'translateY(' + (index * rowHeight) + 'px)';
    li.innerHTML = rowInnerHTML(email);
  }

  window.MailRender = {
    escapeHTML: escapeHTML,
    rowInnerHTML: rowInnerHTML,
    emailRowHTML: emailRowHTML,
    renderAllRows: renderAllRows,
    updateRow: updateRow
  };
})();
