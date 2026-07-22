// app.js — ENTRY POINT
//
// Boots the app once the DOM is ready and wires the other layers
// together: generate data -> put it in state -> hand it to the
// virtualization engine. Owns no logic of its own — if you're looking
// for "how something works," it's never here, only "how it's connected."

document.addEventListener('DOMContentLoaded', function () {
  var emails = window.MailData.generateEmails(5000);

  window.MailState.setState({ emails: emails, isLoading: false });

  // Phase 3: virtualized render. The DOM now holds a couple dozen row
  // elements, not 5,000 — open DevTools > Elements and count them.
  window.MailVirtualList.init(emails);

  // eslint-disable-next-line no-console
  console.log(
    '[Phase 3] ' + emails.length + ' emails in memory, but only ~' +
    (Math.ceil(document.getElementById('listViewport').clientHeight / window.MailVirtualList.ROW_HEIGHT) + 8) +
    ' <li> elements in the DOM at any time. Scroll — it should stay smooth ' +
    'now. Compare against Phase 2 (window.MailRender.renderAllRows) if you ' +
    'want to feel the difference directly.'
  );
});
