# Mail — a from-scratch email client UI

A static, no-framework front end exploring how real-world apps handle large
lists efficiently: list virtualization, keyboard-driven navigation, and a
light/dark design system — all in vanilla HTML/CSS/JS, zero dependencies.

Not trying to look like Gmail — same information architecture (sidebar,
list, compose), but an Apple/macOS-native visual language: a warm dark
"cement" theme by default, real translucent "vibrancy" panels, systemBlue
accents, and a full light theme via the toggle.

## Features

- **List virtualization** — 5,000 emails in the dataset, ~20 `<li>` elements
  ever touch the DOM. A fixed pool of nodes is recycled and repositioned
  with `transform: translateY()` as you scroll, instead of creating and
  destroying rows. This is the core feature the rest of the app is built
  around — see [ROADMAP.md](./ROADMAP.md) Phase 3.
- **Keyboard navigation** — `j`/`k` move a focused row up/down, `Enter`
  opens it, exactly like real Gmail's shortcuts. Works correctly against
  the virtualized list even though the focused row may not currently exist
  as a DOM node.
- **Skeleton loading states** — placeholder rows matching the real layout
  exactly (same height, same grid) while a simulated network fetch is
  pending, so there's zero layout shift when real content swaps in.
- **Compose modal** — focus-trapped (Tab/Shift+Tab can't escape it while
  open), Escape closes it, backdrop click closes it, static demo only (no
  backend, nothing is actually sent).
- **Light/dark theming** — every color is a CSS custom property; the whole
  palette swaps on one attribute change, no flash of the wrong theme on
  load, both themes independently verified against WCAG 2.1 AA contrast
  ratios.
- **Screen-reader accessible list** — the virtualized list uses a real
  `role="listbox"`/`role="option"` pattern with `aria-activedescendant`,
  `aria-posinset`/`aria-setsize` (so "item 3,242 of 5,000" is announced
  correctly even though only ~20 siblings exist in the DOM), and a live
  region that announces when an email is opened.

## Run it

Just open `index.html` in a browser. No build step, no dependencies, no
package.json — that's the point.

## Test it

```
node --test
```

60 tests, zero dependencies — Node's own built-in test runner and assert
module, no framework installed. Covers deterministic data generation, XSS-safe
HTML escaping, the virtualization windowing math (including an exhaustive
sweep across the full 5,000-row range), keyboard focus/selection state,
the compose modal's real focus trap, and the ARIA contract described
above. See [tests/](./tests) — `test-support/fakeDom.js` is a small
hand-rolled fake DOM built specifically for this codebase (no jsdom/
Puppeteer, consistent with the zero-dependency rule).

## Why

Built as a learning project to understand, hands-on, how something like
Gmail renders thousands of list items without the browser choking.

- [ROADMAP.md](./ROADMAP.md) — full architecture, concepts in learning
  order, and the phase-by-phase build log.
- [INTERVIEW_PREP.md](./INTERVIEW_PREP.md) — real, code-grounded answers to
  the interview questions a senior dev would ask about each phase.
- [AUDIT.md](./AUDIT.md) — the Phase 7 cross-browser compatibility review
  and the two accessibility gaps it found and fixed.

## Status

- [x] Phase 0 — Project & git setup
- [x] Phase 1 — Static shell & design system (dark/light)
- [x] Phase 2 — Mock data + naive render
- [x] Phase 3 — List virtualization
- [x] Phase 4 — Compose modal
- [x] Phase 5 — Keyboard navigation (j/k)
- [x] Phase 6 — Skeleton loading states
- [x] Phase 7 — Polish, accessibility, testing & final pass
