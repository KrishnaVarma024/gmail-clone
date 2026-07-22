// app.js — ENTRY POINT
//
// Boots the app once the DOM is ready and wires the other layers
// together: generate data -> put it in state -> render it. Owns no
// logic of its own — if you're looking for "how something works," it's
// never here, only "how it's connected."

document.addEventListener('DOMContentLoaded', function () {
  var emails = window.MailData.generateEmails(5000);

  window.MailState.setState({ emails: emails, isLoading: false });
  window.MailRender.renderAllRows(emails);

  // eslint-disable-next-line no-console
  console.log(
    '[Phase 2] Rendered ' + emails.length + ' real DOM rows into the list.\n' +
    'Open DevTools → Elements and count the <li> nodes.\n' +
    'Then scroll the inbox and watch DevTools → Performance — ' +
    'that jank is the point. Phase 3 fixes it with virtualization.'
  );
});
