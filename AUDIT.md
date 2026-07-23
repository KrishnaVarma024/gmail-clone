# Phase 7 Audit — Cross-Browser Compatibility & Best Practices

Honest documentation of what was checked and how, and what genuinely
can't be verified in this environment. No headless browser or DevTools
was available to build this project (see ROADMAP.md's git-workflow
history — Puppeteer's Chromium download was blocked by the sandbox's
network allowlist, and there's no `sudo` to install a system browser),
so there is no real Lighthouse score to report here. What follows
instead: a manual feature-by-feature compatibility review of every
non-trivial CSS/JS feature this codebase actually uses, cross-checked
against real browser support data, plus a second accessibility pass
that found and fixed two real gaps the Phase 7 ARIA work hadn't
covered yet.

---

## 1. JavaScript: ES5-first by design

A grep across every shipped file in `js/` (not `tests/`, which uses
modern Node and never ships to a browser) for the ES6+ features most
likely to trip up an older browser:

| Feature | Found in shipped JS? |
|---|---|
| `const` / `let` | No — `var` throughout |
| Arrow functions (`=>`) | No — `function () {}` throughout |
| Template literals | No — string concatenation (`'a' + b + 'c'`) throughout |
| `class` | No |
| `Array.prototype.includes/find/startsWith` | No |
| `async`/`await`, real `fetch()` | No (Promise + setTimeout only) |
| `Object.assign` | Yes — one call, in `state.js`'s `setState()` |
| `classList` | Yes — `compose.js` |
| `Element.closest()` | Yes — `keyboard.js`'s `onListClick()` |
| `Promise` | Yes — `data.js`'s `fetchEmails()` |
| `Array.prototype.filter` (ES5, not ES6) | Yes — widely available since IE9 |

The only four modern-ish features actually used —`Object.assign`,
`classList`, `Element.closest()`, `Promise` — have all shipped in
every evergreen browser since roughly 2015-2016 (Object.assign:
Chrome 45/Firefox 34/Safari 9; closest: Safari 9/Chrome 41/Firefox 35;
Promise: universal since ES2015). None of them need a polyfill for any
browser released in the last ~9 years. The rest of the codebase reads
like pre-ES6 JS on purpose — not cargo-culted, just simple enough that
newer syntax wasn't needed.

## 2. CSS: the real compatibility floor

| Feature | Where | Minimum browser | Fallback present? |
|---|---|---|---|
| CSS custom properties (`--var`) | Everywhere (design tokens) | Safari 9.1, Chrome 49, Firefox 31, Edge 15 | No fallback — this is the floor. No IE11 support at all, by design. |
| CSS Grid | `.app`, `.email-row` | Safari 10.1, Chrome 57, Firefox 52 | No |
| Flexbox `gap` | Sidebar, nav, topbar, modal footer | **Safari 14.1** (Apr 2021), Chrome 84, Firefox 63 | No — this is the tightest real constraint in the whole stylesheet |
| `backdrop-filter` | Sidebar/topbar/modal vibrancy | Safari 9 (`-webkit-` prefix, present), Chrome 76, Firefox 103 | **Yes** — `@supports not (...)` swaps to a solid `--bg-elevated` background |
| `:focus-visible` | Keyboard focus rings | Safari 15.4, Chrome 86, Firefox 85 | No fallback needed — unsupported browsers just show no ring there, not broken |
| `prefers-reduced-motion` | Global animation-disable rule | Safari 10.1, Chrome 74, Firefox 63 | No fallback needed — unsupported browsers just keep animating |
| `prefers-color-scheme` | Initial theme detection | Safari 12.1, Chrome 76, Firefox 67 | Yes — falls back to dark if unsupported (`matches` is `false`) |
| `scrollbar-width` / `scrollbar-color` | Custom scrollbar (Firefox syntax) | Firefox only | **Yes** — paired with `::-webkit-scrollbar` for Chrome/Safari/Edge |
| `color-scheme` (added this pass) | Native form control/scrollbar theming | Safari 13, Chrome 81, Firefox 96 | No fallback needed — browsers that don't understand it just keep current behavior |

**Bottom line:** the real floor is Safari 14.1 (April 2021), driven by
flex `gap`, not by anything exotic like `backdrop-filter` (which
already has a fallback). Every other feature is either older than that
or has one. That's a perfectly reasonable floor for a portfolio
project in 2026 — nobody demoing this is going to be on a
five-year-old Safari — but it's worth being able to name precisely
*why* that's the floor rather than shrugging at "should work
everywhere."

## 3. Accessibility pass — two real gaps found and fixed

Beyond the ARIA work already done (listbox/option roles,
aria-activedescendant, live-region announcements, focus trap — see
INTERVIEW_PREP.md's Phase 5/7 answers), a manual re-read of
`index.html` looking specifically for "does every interactive element
have a real accessible name" turned up two gaps:

1. **Compose modal's message body had no label.** `<textarea
   id="composeBody" placeholder="Write your message...">` relied on
   its `placeholder` alone. Placeholder text is not a reliable
   accessible name — it disappears the moment the user types
   anything, and some screen readers don't announce it as a label at
   all. Fixed by adding `<label class="sr-only" for="composeBody">`
   (same pattern already used for `#ariaLiveRegion`'s visual hiding).
2. **Account avatar only had a `title` attribute.** `title` tooltips
   aren't reliably exposed to screen readers and don't exist at all on
   touch devices (no hover). Added `aria-label="Account:
   krishnavarma024@gmail.com"` alongside the existing `title`, so
   sighted mouse users still get the hover tooltip and everyone else
   gets the same information a different way.

Also verified while auditing (no changes needed, confirming existing
work holds up):
- Zero duplicate `id` attributes across `index.html` (15 total, 15
  unique) — checked programmatically, not by eye.
- Both `<label for="...">` pairs (`composeTo`, `composeSubject`) point
  at real, existing ids.
- `lang="en"` is set on `<html>`, and the viewport meta tag is present
  — both easy to forget, both actually there.

## 4. What still genuinely can't be verified here

Being direct about the limits of this audit rather than papering over
them:

- **No real Lighthouse/PageSpeed score.** Performance, accessibility,
  and best-practices scores all require an actual browser instance
  running Lighthouse's audits against a loaded page — not obtainable
  in this sandbox (see the top of this file). The *logic* those
  audits would check (layout-shift-free skeletons, contrast ratios,
  ARIA structure, DOM node counts) has all been verified independently
  by other means — the automated test suite (`tests/`), the WCAG
  contrast script, and this manual feature audit — but that's a
  substitute for the tool, not the tool itself.
- **No real cross-browser screenshot comparison.** This audit checked
  *feature support tables*, not actual rendering — it can tell you
  Safari 14.1 supports flex `gap` in principle, not that this specific
  layout renders pixel-identical there. The honest framing for an
  interview: "I audited feature compatibility against caniuse-style
  support data and verified all interaction logic in Node; I have not
  visually confirmed rendering in every browser myself."
- **Screen reader testing was logic-only, not audio.** The ARIA
  contract (roles, live-region text, activedescendant sync) is
  verified in `tests/keyboard.test.js` and `tests/virtualList.test.js`
  by asserting the exact DOM attributes a screen reader would read —
  but nobody has actually run VoiceOver/NVDA against this app and
  listened to it. That's a real gap, not a solved problem dressed up
  as one.
