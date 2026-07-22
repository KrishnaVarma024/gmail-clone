// data.js — DATA LAYER
//
// Generates the mock dataset this whole app runs on: 5,000 fake emails
// (sender, subject, snippet, timestamp, read/unread, avatar color). This
// is the app's fake "database" — the only file allowed to invent data.
// Everything downstream (state, virtualList, render) just reads what
// this produces.
//
// Deterministic on purpose: given the same index, you always get the
// same email. No Math.random(). That means the dataset is reproducible
// between reloads, which matters once you're debugging "why does row
// #3241 look wrong" — you want that row to be the same row every time,
// not a new random one.

(function () {
  var SENDERS = [
    'Stripe', 'GitHub', 'Vercel', 'AWS', 'LeetCode', 'Codeforces',
    'Goldman Sachs Careers', 'Priya Sharma', 'Rahul Mehta', 'Notion',
    'Figma', 'Linear', 'Slack', 'Google Calendar', 'LinkedIn',
    'Morgan Stanley Careers', 'JPMorgan Recruiting', 'Discord',
    'Docker', 'Netlify', 'Cloudflare', 'OpenAI', 'Anthropic',
    'Arjun Patel', 'Sneha Rao', 'HackerRank', 'Coursera',
    'edX', 'ICPC Regionals', 'Figma Community'
  ];

  var SUBJECTS = [
    'Your invoice is ready', 'New push to master', 'Deployment successful',
    'Your monthly billing statement', 'Daily challenge reminder',
    'Div. 2 Round starts soon', 'Thank you for your application',
    'Re: team registration', 'Weekly digest', 'Security alert: new sign-in',
    'Your subscription renews soon', 'Meeting notes attached',
    'Action required: verify your email', 'Interview scheduling',
    'Your order has shipped', 'New comment on your pull request',
    'Reminder: contest starts in 1 hour', 'Welcome to the team',
    'Your resume has been reviewed', "Product update: what's new"
  ];

  var SNIPPETS = [
    'Just wanted to follow up on this before end of week.',
    'Let me know if this works for you, happy to adjust.',
    'Everything looks good on our end, ready when you are.',
    'Please review and let us know if you have any questions.',
    'This is an automated message, no reply needed.',
    'Thanks for your patience while we looked into this.',
    'Attached below are the details you requested.',
    'Quick heads up before the deadline tomorrow.'
  ];

  // Simple deterministic string hash (djb2-ish). Used to assign each
  // sender a consistent avatar color — same sender, same color, always.
  function hashString(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function initials(name) {
    var parts = name.split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function pick(list, seed) {
    return list[seed % list.length];
  }

  function formatTime(date, now) {
    var sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
      var h = date.getHours();
      var m = date.getMinutes();
      var ampm = h >= 12 ? 'PM' : 'AM';
      var h12 = h % 12 || 12;
      return h12 + ':' + (m < 10 ? '0' + m : m) + ' ' + ampm;
    }
    var oneDay = 86400000;
    var diffDays = Math.floor((now.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / oneDay);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'short' });
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Generates `count` emails, newest first, spaced a few minutes apart
  // going backward in time from right now.
  function generateEmails(count) {
    var emails = [];
    var nowTs = Date.now();

    for (var i = 0; i < count; i++) {
      var sender = pick(SENDERS, i * 7 + 3);
      var subject = pick(SUBJECTS, i * 13 + 5);
      var snippet = pick(SNIPPETS, i * 17 + 11);
      var date = new Date(nowTs - i * 9 * 60000); // ~9 minutes apart
      var colorIndex = (hashString(sender) % 8) + 1;

      emails.push({
        id: 'email-' + i,
        sender: sender,
        senderInitials: initials(sender),
        avatarClass: 'avatar--' + colorIndex,
        subject: subject,
        snippet: snippet,
        time: formatTime(date, new Date(nowTs)),
        timestamp: date.getTime(),
        unread: i % 3 === 0
      });
    }

    return emails;
  }

  window.MailData = { generateEmails: generateEmails };
})();
