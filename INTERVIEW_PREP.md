# Interview Q&A — Phases 0 through 7

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

---

## Phase 6 — Skeleton Loading States

**Q: Is your loading state simulated with `setTimeout`, or does it mirror a real async fetch pattern?**
Both, deliberately layered: `generateEmails()` stays a synchronous, pure
function (so it's easy to unit-test in isolation — which is exactly how
it got verified back in Phase 2). `fetchEmails()` wraps it in a real
`Promise` and resolves it after a randomized 600-1000ms `setTimeout`,
simulating network latency. `app.js` only ever calls `.then()` on it —
it has no idea whether the data came from a fake timer or a real
`fetch()` call. Swap the inside of `fetchEmails()` for an actual network
request later and nothing downstream changes.

**Q: How do you avoid layout shift when skeletons are replaced by real rows?**
Skeleton rows use the exact same `.email-row` class as real rows — same
`height: var(--row-height)`, same `grid-template-columns`, positioned
with the same `translateY()` math. A skeleton row and a real row occupy
pixel-identical space; swapping one for the other only changes what's
drawn inside that space, never its size or position. Verified this in
Node: rendered 14 skeleton rows, confirmed the container height was
exactly `14 × 56px`, then let the real fetch resolve and confirmed the
pool took over with zero leftover skeleton markup.

**Q: Why skeleton screens over a spinner?**
A spinner tells you "something is happening" with no information about
*what's coming*. A skeleton that matches the final layout lets your
brain start parsing the page structure before the content exists — by
the time real text pops in, you already know where everything goes, so
it reads as an update rather than a page appearing from scratch. It's
also honest about layout: a spinner gives zero indication of how many
rows or how tall the content will be, so real content arriving can
still cause a jump. A shaped skeleton can't lie about that.

---

## Phase 7 — Polish, Accessibility & Final Pass

**Q: What's your Lighthouse performance score, and what's the remaining bottleneck?**
Honestly — I don't have a real number, and I'd rather say that plainly
than invent one. There's no headless browser available in the
environment this was built in (Puppeteer's Chromium download is
blocked by the sandbox's network allowlist, and there's no root to
install a system browser — documented in AUDIT.md), so Lighthouse
itself never ran. What I *can* stand behind: the specific things
Lighthouse's performance/accessibility/best-practices audits actually
check were verified independently — DOM node count stays ~20
regardless of list size (that's the whole point of virtualization),
skeleton-to-real swaps cause zero layout shift (verified in
`tests/render.test.js` by asserting the container height is exactly
`count × rowHeight`), and every interactive element has a real
accessible name (verified by hand in AUDIT.md, catching two gaps a
tool like Lighthouse would have flagged: the compose textarea's
missing label and the account avatar's `title`-only identification).
That's real signal, just not a single number from the actual tool.

**Q: How did you verify color contrast holds up in both your light and dark themes?**
Wrote a WCAG 2.1 relative-luminance/contrast-ratio calculator from the
actual formula (`0.2126R + 0.7152G + 0.0722B` with sRGB linearization,
then `(L1+0.05)/(L2+0.05)`) and ran it against the live CSS custom
property values — not eyeballed, computed. It found two real failures
in both themes: `--text-tertiary` (timestamps/snippets) was below
4.5:1 against the background, and white button text on the accent
gradient was below 4.5:1 (dark theme's `--accent-strong` had
accidentally been defined as a *lighter* hover-brighten shade,
`#409cff`, which made the weakest point of the gradient even less
contrasty). Fixed by restructuring the gray scale and introducing a
genuinely darker `--accent-strong`/`--accent-strong-2` pair for
buttons specifically. Final numbers: dark theme's button text sits at
5.78:1 (vs. required 4.5:1), light theme's at 7.68:1 — both with real
margin, not just barely passing. Re-verified after every subsequent
CSS change in this phase.

**Q: If this needed a real backend tomorrow, what in your architecture changes vs. stays the same?**
Exactly one file changes in a meaningful way: `data.js`'s
`fetchEmails()` already returns a `Promise` that resolves to an array
of email objects — swap its internals from `setTimeout(() =>
resolve(generateEmails(count)))` to a real `fetch('/api/emails').then(r
=> r.json())`, and every caller (`app.js`) is already written against
"a Promise that resolves to emails," so nothing downstream notices the
difference. `state.js`, `virtualList.js`, `render.js`, and
`keyboard.js` never talk to the network at all — they only ever read
`state.emails`, however it got populated. The one place that *would*
need new code: `compose.js`'s `onSend()` currently just clears fields
and logs to console — that's where a real `POST /api/emails` call
would go, plus optimistic-UI handling for the send-in-flight state and
error handling for a failed send, neither of which exists yet because
there's nothing to fail against right now.

**Q: How would you add automated tests to this, with no framework?**
Already done, not hypothetical — `tests/` has 60 tests across 7 files
using only Node's built-in `node:test` and `node:assert/strict`
modules (`node --test`, zero installed dependencies). The one real
obstacle was having no browser to run them in: `js/*.js` reads
`document`/`window` directly, so `test-support/fakeDom.js` is a small
hand-rolled fake DOM (Element/Document/Window) — not jsdom or
Puppeteer, both of which would violate the project's zero-dependency
rule — built for exactly the subset of the DOM API this codebase
actually touches, then the real source files load unmodified into a
Node `vm` context against it. That means tests exercise the actual
shipped code, not a reimplementation of its logic. Coverage highlights:
`computeRange()` gets an exhaustive sweep (13px steps across the full
5,000-row range, a step size deliberately not a multiple of the 56px
row height, to catch alignment bugs) plus a named regression test for
the real TOP_OFFSET bug found and fixed back in Phase 5; the compose
modal's focus trap is tested by actually building the real DOM tree
and asserting Tab/Shift+Tab wrap correctly, not stubbed out.

**Q: How did you make the virtualized list itself accessible, not just keyboard-operable?**
This was an explicitly named gap from the Phase 5 answer above, closed
in this phase. `#emailList` is `role="listbox"` with `tabindex="0"` —
it needs real DOM focus for what comes next to actually get announced.
Every pooled row gets `role="option"`, a stable id keyed to the EMAIL
(`email-row-{id}`, not the pooled node, since nodes get recycled
constantly), `aria-selected`, and `aria-posinset`/`aria-setsize` so a
screen reader can announce "item 3,242 of 5,000" even though only
~20 siblings physically exist in the DOM at once. On every repaint,
`virtualList.js` points `#emailList`'s `aria-activedescendant` at
whichever row is the current keyboard cursor — reusing the exact same
guarantee `scrollToIndex()`'s forced synchronous repaint already gives
`.email-row--focused` (the row is guaranteed to exist by the time the
attribute is set). For state changes that activedescendant alone
doesn't cover — "this email is now marked read and opened" — a
visually-hidden `aria-live="polite"` region gets an explicit
announcement. Verified all of it in Node: activedescendant tracking
row 0 and row 4999 correctly with the referenced row confirmed
actually rendered (not just claimed), and the exact announcement text
after opening an email.
