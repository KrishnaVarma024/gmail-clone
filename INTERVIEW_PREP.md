# Interview Q&A — Phases 0 through 5

Real answers to every interview question listed in ROADMAP.md so far,
grounded in what's actually in this codebase — not generic textbook
answers. Where something genuinely isn't built yet, that's said plainly;
"I know exactly what I built and where its limits are" is a stronger
answer than pretending it's all done.

---

## Phase 0 — Setup & Git

**Q: Why did you split the JS into separate files instead of one script.js?**
Each file maps to exactly one job in the architecture: `data.js` only
generates data, `state.js` only holds it, `virtualList.js` only decides
what's visible, `render.js` only paints, `keyboard.js` only handles
input. That means you can change *how* a row is painted without
touching *how* scrolling is computed, and you can find a bug by asking
"which layer owns this" instead of scanning one huge file.

**Q: Walk me through your commit history — what does it tell me?**
One phase, one (or a few) commits, each message states which phase it
closes — scrolling the history top to bottom on GitHub *is* the build
order, from an empty roadmap to a working virtualized list with
keyboard nav. The Phase 5 commit even documents a bug found and fixed
in the same message ("fix topbar-offset bug in scroll math") — that's
a better signal than a spotless history would be; it shows real
iteration, not a one-shot dump.

---

## Phase 1 — Static Shell & Design System

**Q: Why Flexbox/Grid instead of floats or absolute positioning?**
CSS Grid defines the two-column app shell (sidebar + main) in one line
(`grid-template-columns`); Flexbox handles internal stacking in the
sidebar, topbar, and rows. Floats were built for wrapping text around
images, not application layout — using them here means fighting
clearfix hacks for something Grid/Flex solve natively.

**Q: How does this layout behave at 320px wide, and how did you handle it?**
A `@media (max-width: 720px)` breakpoint collapses the sidebar to a
72px icon-only rail (labels `display:none`), shrinks row padding and
avatar size, and turns the compose button into a circular icon button.
The grid reflows rather than breaking.

**Q: Walk me through your theming system — why CSS variables over two stylesheets or CSS-in-JS?**
Every color/spacing/radius is one custom property in `:root`, with
`[data-theme="light"]` overriding only the values that differ.
Switching themes is one attribute change on `<html>` — every component
reading `var(--bg)` etc. updates instantly, no JS re-render. Two
stylesheets double the maintenance burden (change a color, remember to
change it twice); CSS-in-JS needs a JS runtime just to compute styles.
Variables are native and the browser already optimizes for them.

**Q: How do you avoid a flash of the wrong theme on page load?**
An inline `<script>` in `<head>` runs synchronously *before* any CSS
paints — it reads `localStorage` (or falls back to the OS's
`prefers-color-scheme`) and sets `data-theme` on `<html>` immediately.
If that script were deferred or at the bottom of `<body>`, you'd see a
flash of the default theme before it snapped to the saved one.

**Q: Your topbar is `position: absolute`, not a normal flex child — why?**
So the list can scroll underneath it and show genuine translucency —
content blurring through frosted glass, the way macOS does it in
Mail/Finder. If it were a normal flex child, the list would just start
below it; you'd get a sticky header, not vibrancy.

**Q: What's your fallback for browsers without `backdrop-filter`?**
An `@supports not (backdrop-filter: blur(1px))` block around the
sidebar, topbar, and compose modal swaps the translucent background for
a solid one (`var(--bg-elevated)`) — those browsers get a normal opaque
panel instead of a broken/unstyled one.

**Q: Difference between reflow and repaint — does your layout trigger unnecessary ones?**
Reflow recomputes geometry (position/size); repaint redraws pixels with
no geometry change. Rows are positioned with `transform: translateY()`,
which only triggers a compositor-level repaint — that's specifically
why moving rows during virtualized scrolling stays cheap instead of
reflowing the whole list on every frame.

---

## Phase 2 — Mock Data & Naive Render

**Q: What's the actual browser cost of 5,000 DOM nodes?**
Memory (each node carries attributes, computed style, potential
listeners) and, more importantly, layout cost that scales with *total*
nodes, not *visible* nodes — any geometry recalculation has to consider
all 5,000 boxes even though ~15 are on screen. That's the concrete case
for virtualization.

**Q: Is your mock data seeded/deterministic, or random each run?**
Deterministic — `data.js` uses index-based math (`i*7+3`, `i*13+5`,
etc. as pick-seeds) instead of `Math.random()`, so email #3241 is the
same sender/subject/snippet every reload. Verified in Node by
generating the dataset twice and diffing everything except the
live timestamp (which legitimately depends on wall-clock "now").

**Q: What did you measure to prove it was slow?**
Honestly — I couldn't profile it myself; I had no way to run DevTools
or take a screenshot in my environment. So instead I built it to *be*
measurable: a console log points at DevTools Elements (count the 5,000
`<li>`) and Performance (scroll, watch it stutter), and I verified
correctness of the generation/render logic by actually executing it in
Node rather than just reading the code.

---

## Phase 3 — List Virtualization

**Q: Walk me through your virtualization algorithm.**
`computeRange()` takes `scrollTop`, converts it to a row index
(correcting for the topbar's 64px offset — more on that below), and
returns `[start, end)` — that index minus/plus an overscan buffer.
`renderVisible()` then loops over a fixed pool of ~22 `<li>` elements
and assigns each one a data index inside that range, moving it with
`translateY` and repainting its content. Only the pool ever touches the
DOM, never the full dataset.

**Q: Why `translateY` instead of `top` or margin?**
`transform` doesn't invalidate layout — the browser moves it purely on
the compositor thread. Changing `top`/margin forces a reflow of
everything after it in the document; at 20-30 repositions per scroll
frame, that adds up fast.

**Q: Fixed or variable-height rows? What would variable height take?**
Fixed only — `--row-height: 56px` is baked into both CSS and a JS
constant that has to stay in sync. Variable height breaks the simple
`index × rowHeight` math; you'd need a running offset cache (prefix
sums of each row's *measured* height) and re-measurement on content
change — meaningfully more complex, which is why libraries like
react-window ship it as a separate implementation from the fixed-size
one rather than a flag.

**Q: What happens on a fast scroll fling — blank rows?**
`OVERSCAN` (4 rows) renders extra rows above and below the visible
window specifically so a fast scroll has a buffer to catch into before
blank space would show. Stress-tested the range math with a 13px scroll
step sweep (deliberately not a multiple of the 56px row height, to
catch alignment bugs) across the entire list — zero gaps between what's
visible and what's pooled.

**Q: "List virtualization" vs React's "virtual DOM" — same thing?**
No, different concepts that share a word. React's virtual DOM is a
*diffing* strategy — build an in-memory tree, diff it against the
previous one, patch only what changed, to minimize DOM writes. List
virtualization is about never creating the DOM nodes for off-screen
content in the first place — no diffing, just a recycled fixed pool.
You can use both together: a React app using react-window still uses
React's virtual DOM to render into whatever's currently in the pool.

**Q: How would you test that scrolling to #4999 shows the right content?**
Did exactly this in Node with a mocked DOM: set `scrollTop` to the
computed true maximum, ran the scroll handler, and asserted the
highest-index pooled row's `data-index` was exactly 4999 and its
content matched that email object.

---

## Phase 4 — Compose Modal

**Q: How do you trap focus inside the modal?**
A capture-phase `keydown` listener on `document` (the `true` third
argument to `addEventListener`) intercepts Tab before anything else
can. It collects every focusable element inside the modal; Tab past the
last one wraps to the first, Shift+Tab from the first wraps to the
last — focus can never escape into the page behind it.

**Q: Does the modal interact badly with the list's scroll/keyboard listeners underneath?**
The overlay covers the full viewport at `z-index: 1000`, so mouse/scroll
events over the dimmed area hit the overlay, not the list — naturally
isolated by full coverage, no JS needed for that part. For keyboard,
the real guarantee is a documented contract: every handler in
`keyboard.js` checks `state.isComposeOpen` and bails out, so `j`/`k`
literally cannot fire while composing, regardless of listener order.

**Q: What's your z-index / stacking strategy?**
Three tiers: `.app` at `z-index: 1` (containing the floating topbar at
`z-index: 10` *relative to it*), and the modal overlay living *outside*
`.app` entirely at `z-index: 1000` — a full magnitude above everything,
so it never has to reason about what's inside `.app`'s stacking
context, just beat it as a whole.

---

## Phase 5 — Keyboard Navigation

**Q: The focused row might not currently be rendered — how do you keep it in sync?**
`focusedIndex` lives in `state.js` as a plain number, never a DOM
reference. Every repaint reads that number fresh and applies
`.email-row--focused` to whichever pooled node currently represents
that index — correct regardless of which physical `<li>` got recycled
into that slot. `scrollToIndex()` also force-repaints *synchronously*
right after moving state, so the newly-focused row is guaranteed to
exist and be styled before the next frame, rather than waiting on the
async scroll event.

**Q: How did you avoid conflicts with the browser's default scroll/tab behavior?**
`preventDefault()` on the j/k/Enter keydown. The bigger conflict avoided
is with normal typing: `isTypingTarget()` checks
`document.activeElement` and bails out completely if focus is in an
`<input>`/`<textarea>` — so "j" and "k" still type as literal letters
in the search box instead of hijacking the list.

**Q: How would you make this accessible to screen reader users, not just keyboard users?**
Honestly — not yet, and worth saying plainly rather than overclaiming.
It's keyboard-*operable* but not screen-reader-*aware*: the focused row
isn't announced (no `aria-activedescendant` / `role="listbox"` pattern
wired up yet), and there's no live region announcing "email opened" or
unread-count changes. That's real, scoped work sitting in Phase 7
(polish/accessibility) — a correct interview answer names the gap
instead of glossing over it.
