# Mail — a from-scratch email client UI

A static, no-framework front end exploring how real-world apps handle large
lists efficiently: list virtualization, keyboard-driven navigation, and a
light/dark design system — all in vanilla HTML/CSS/JS.

Not trying to look like Gmail — same information architecture (sidebar,
list, compose), but an Apple/macOS-native visual language: light-by-default,
real translucent "vibrancy" panels, systemBlue accents, full dark mode.

## Run it

Just open `index.html` in a browser. No build step, no dependencies, no
package.json — that's the point.

## Why

Built as a learning project to understand, hands-on, how something like
Gmail renders thousands of list items without the browser choking. The
full architecture and phase-by-phase build log live in
[ROADMAP.md](./ROADMAP.md).

## Status

- [x] Phase 0 — Project & git setup
- [x] Phase 1 — Static shell & design system (dark/light)
- [x] Phase 2 — Mock data + naive render
- [x] Phase 3 — List virtualization
- [ ] Phase 4 — Compose modal
- [ ] Phase 5 — Keyboard navigation (j/k)
- [ ] Phase 6 — Skeleton loading states
- [ ] Phase 7 — Polish & accessibility
