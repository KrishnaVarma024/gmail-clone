// app.js — ENTRY POINT
//
// Boots the app once the DOM is ready and wires the other layers
// together: show a skeleton -> fetch data -> put it in state -> hand it
// to the virtualization engine. Owns no logic of its own — if you're
// looking for "how something works," it's never here, only "how it's
// connected."

document.addEventListener('DOMContentLoaded', function () {
  var listViewport = document.getElementById('listViewport');
  var rowHeight = window.MailVirtualList.ROW_HEIGHT;

  window.MailState.setState({ isLoading: true });

  // Phase 6: show skeleton rows immediately — enough to fill whatever
  // the viewport actually is, plus a couple extra so there's no gap at
  // the bottom on a tall window.
  var skeletonCount = Math.ceil(listViewport.clientHeight / rowHeight) + 2;
  window.MailRender.renderSkeleton(skeletonCount, rowHeight);

  window.MailData.fetchEmails(5000).then(function (emails) {
    window.MailState.setState({ emails: emails, isLoading: false });

    // Phase 3: virtualized render. init() clears the skeleton rows and
    // rebuilds the real pool — the DOM now holds a couple dozen row
    // elements, not 5,000. Open DevTools > Elements and count them.
    window.MailVirtualList.init(emails);

    // eslint-disable-next-line no-console
    console.log(
      '[Phase 6] Skeleton shown while ' + emails.length + ' emails "loaded" ' +
      'over a simulated network delay, then swapped in with zero layout ' +
      'shift (skeleton rows and real rows share the exact same height and ' +
      'grid). Only ~' +
      (Math.ceil(listViewport.clientHeight / rowHeight) + 8) +
      ' <li> elements exist in the DOM at any time — try scrolling.'
    );
  });
});
