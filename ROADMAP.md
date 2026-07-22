# Gmail Clone — Architecture & Learning Roadmap

Static frontend only. No backend, no framework. Vanilla HTML/CSS/JS, on purpose —
frameworks like React hide the exact mechanics you're trying to learn (DOM
rendering, virtualization, event handling).

**Who writes the code:** I do, every line. You're new to coding and learning
this by understanding *how it's built and why*, not by typing it yourself.
Each phase, I write the code, then walk you through the architecture and
concepts behind it — the same way a senior engineer would explain a design
to a new teammate, not a coding tutorial.

### Design direction

This is not a pixel-for-pixel Gmail clone, and not Apple Mail either. We
borrow Gmail's *information architecture* (sidebar, list, compose) but the
visual language is our own.

**Revision history, kept here on purpose — it's a legitimate part of the
build log:** Phase 1 first shipped Superhuman-inspired (dark-by-default,
flat, one accent color). After seeing it, we pivoted to **Apple/macOS-native**:
light-by-default, translucent "vibrancy" panels (real `backdrop-filter`
blur, not a fake), Apple's actual HIG color tokens (systemBlue `#007AFF`
light / `#0A84FF` dark, label-gray text scale), softer rounded corners, and
a floating topbar that content genuinely scrolls underneath — the same
frosted-glass trick macOS uses in Mail, Finder, and Notes. Full dark mode
still exists via the toggle, matched to macOS's real dark-mode grays
(`#1e1e1e` family, not pure black) rather than an arbitrary palette.

The real lesson here, true under *either* direction: **visual design and
system architecture are separate concerns.** The virtualization engine
doesn't know or care what color a row is — it only cares about scrollTop
and row height. We swapped the entire visual language, mid-project, without
touching the data, state, virtualization, or event layers at all. That
separation is what makes a full redesign a CSS-only change instead of a
rewrite — and it's exactly what let us change our minds here without cost.

---

## PART 1 — THE ARCHITECTURE

### The big picture

A "Gmail clone" sounds like a UI task, but the interesting engineering problem
is: **how do you show a list of 5,000 items without the browser choking?**
Real Gmail doesn't render 5,000 email rows into the DOM — it renders ~15 (the
ones visible in your window) and swaps their content as you scroll. Everything
in this architecture exists to support that one idea.

Think of the app as six small layers, each with one job. None of them know
how the others are implemented — they only agree on a shared shape of data.
That separation is *the* core lesson of this project; it's how every
production frontend (Gmail, Figma, VS Code) is actually built.

```
 ┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
 │  Data Layer │ --> │ State Layer │ --> │ Virtualization    │
 │  (data.js)  │     │ (state.js)  │     │ Engine            │
 └─────────────┘     └─────────────┘     │ (virtualList.js)  │
                                          └─────────┬─────────┘
                                                    │ "render rows 40-55"
                                                    v
 ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │  Keyboard /  │ --> │  App Entry   │ <-- │ Render Layer │
 │  Mouse Events│     │  (app.js)    │     │ (render.js)  │
 │  (keyboard.js)│     └──────────────┘     └──────────────┘
 └──────────────┘
```

1. **Data Layer** (`data.js`) — generates the 5,000 fake emails once (sender,
   subject, snippet, timestamp, read/unread). This is your fake "database."
2. **State Layer** (`state.js`) — the single source of truth: which email is
   selected, current scroll position, which row is keyboard-focused, is the
   compose modal open, is the app still "loading," and which theme (light/
   dark) is active. Nothing else is allowed to hold its own copy of this data.
3. **Virtualization Engine** (`virtualList.js`) — the core feature. Given
   scroll position + row height + viewport height, it computes "only rows 40
   through 55 need to exist right now" and hands that window to the renderer.
4. **Render Layer** (`render.js`) — pure functions that take state and turn it
   into DOM updates. It doesn't decide *what* to show, only *how* to paint it.
5. **Event Layer** (`keyboard.js`, plus listeners in `app.js`) — turns scroll,
   click, and keydown events into state changes.
6. **Entry Point** (`app.js`) — boots the app, wires the other five layers
   together, owns nothing itself.

### Folder structure

```
gmail-clone/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── data.js         # mock email generator
│   ├── state.js         # central state store + subscribe/notify
│   ├── virtualList.js   # windowing math (the "moment")
│   ├── render.js        # state -> DOM
│   ├── keyboard.js      # j/k and other shortcuts
│   ├── compose.js       # modal open/close/logic
│   └── app.js           # entry point
└── README.md
```

### How data actually flows — two concrete examples

**Scrolling:** user scrolls the list container → a `scroll` event fires →
`virtualList.js` reads the new `scrollTop`, computes the new visible index
range → `render.js` updates only the DOM nodes whose content changed →
everything else on screen is untouched. At no point do we touch 5,000 nodes —
we touch ~15, forever, no matter how long the list is.

**Keyboard nav:** user presses `j` → `keyboard.js` catches the keydown →
increments `focusedIndex` in `state.js` → state layer notifies subscribers →
`virtualList.js` checks "is the new focused row currently rendered? if not,
scroll to it" → `render.js` highlights the new row.

Notice the pattern: **input never touches the DOM directly.** Input changes
state, state changes trigger a re-render. That one rule is what keeps this
app debuggable as it grows — you can always answer "why does the screen look
like this?" by looking at state, instead of hunting through event handlers.

---

## PART 2 — CONCEPTS, IN THE ORDER YOU'LL NEED THEM

1. **Box model & Flexbox/Grid** — how elements size and stack. Foundation for
   the sidebar/list/modal layout.
2. **The DOM tree** — HTML becomes a live object tree; JS reads and mutates
   it via `createElement`, `appendChild`, `textContent`, etc.
3. **Separation of concerns** — data vs. state vs. view as three distinct
   jobs. This is a smaller cousin of the MVC pattern you'll see in every
   real codebase.
4. **Why 5,000 DOM nodes is slow** — each node costs memory and forces the
   browser to recompute layout (reflow) and repaint pixels. This is the
   "why" behind virtualization, not just the "how."
5. **Scroll mechanics** — `scrollTop`, `clientHeight`, `scrollHeight`: the
   three numbers that tell you what's currently visible.
6. **Windowing / list virtualization** — the algorithm: visible start index
   = `floor(scrollTop / rowHeight)`, visible count = `ceil(viewportHeight /
   rowHeight) + buffer`. This is what react-window / react-virtualized do
   under the hood — you're building the primitive by hand.
7. **DOM recycling** — reusing a small pool of row elements and rewriting
   their content, instead of creating/destroying nodes every scroll tick.
8. **CSS transforms for positioning** — `translateY(Npx)` instead of `top`
   or margins, because transforms don't trigger layout recalculation (they
   run on the GPU compositor).
9. **Event delegation & throttling** — one scroll listener, not 5,000 click
   listeners; throttling scroll math to animation frames so you don't
   recompute on every single pixel.
10. **Keyboard event handling & focus management** — `keydown`, `preventDefault`,
    and keeping a "focused index" in sync with rows that may not currently
    exist in the DOM.
11. **Perceived performance / skeleton screens** — why a gray placeholder
    that matches the final layout feels faster than a spinner, even at the
    same actual load time.
12. **Design tokens & theming (CSS custom properties)** — defining every
    color, spacing, and radius once as a CSS variable, then flipping a
    `data-theme` attribute to swap the entire palette instantly. This is
    how real design systems (and dark-mode toggles everywhere) work under
    the hood, no framework required.
13. **`backdrop-filter` / material vibrancy** — how macOS's "frosted glass"
    panels actually work: blur + saturate whatever is rendered behind an
    element, with a `@supports` fallback for browsers that don't support
    it. The trick only reads as intentional if something with color is
    actually behind the glass — which is why there's a soft gradient wash
    sitting behind the whole app.

---

## PART 3 — THE PHASES

Each phase below is a self-contained session: what we build, what you'll be
able to point at and demo afterward, the concepts that made it work, and the
questions a senior dev would actually ask if they saw this on your resume.
After each phase is verified working, I commit it and push to GitHub — so
your commit history becomes a second artifact: proof you built this
incrementally and understood each piece, not that you pasted it in one shot.

### Phase 0 — Project & Git Setup

**Build:** folder skeleton, empty files wired together, `.gitignore`,
`README.md`, GitHub repo connected.
**Accomplish after:** a repo that runs (even if blank) and a clean git
history starting point.
**Concepts used:** project structure, git basics (init/add/commit/remote/push).
**Interview questions:**
- "Why did you split the JS into separate files instead of one script.js?"
- "Walk me through your commit history — what does it tell me about how you
  built this?"

### Phase 1 — Static Shell & Design System (Apple/macOS-Native, Light/Dark)

**Build:** sidebar (Compose button, folder list), top header (search,
account), main content grid — Gmail's information architecture, an
Apple/macOS-native visual language: light-by-default, real `backdrop-filter`
vibrancy on the sidebar and a floating topbar (content genuinely scrolls
underneath it, frosted-glass style), Apple's actual systemBlue/label-gray
tokens, softer rounded corners — every color/spacing/radius defined once as
a CSS custom property, with a full dark-mode toggle (matched to macOS's real
dark-mode grays) that swaps the whole token set instantly. No data yet.
**Accomplish after:** a static, zero-JS-data page that already looks
native to a Mac in both themes, and a theming architecture every later
phase inherits for free — nobody has to think about "does this new
component support dark mode," it already does.
**Concepts used:** box model, Flexbox/Grid, responsive layout, CSS custom
properties & design tokens, `backdrop-filter` vibrancy, theme toggling
without a framework.
**Interview questions:**
- "Why Flexbox/Grid here instead of floats or absolute positioning?"
- "How does this layout behave at 320px wide, and how did you handle it?"
- "Walk me through your theming system — why CSS variables over two
  stylesheets or a CSS-in-JS approach?"
- "How do you avoid a flash of the wrong theme on page load?"
- "Your topbar is `position: absolute`, not a normal flex child — why?
  What does that buy you?"
- "What's your fallback for browsers that don't support `backdrop-filter`?"
- "What's the difference between reflow and repaint — does your layout
  trigger unnecessary ones?"

### Phase 2 — Mock Data + Naive Full Render (Feel the Problem First)

**Build:** `data.js` generates 5,000 fake emails; we render *all 5,000* as
real DOM rows, no virtualization yet — on purpose.
**Accomplish after:** you can open DevTools, watch scroll performance tank,
and *feel* the exact problem virtualization solves, instead of taking it on
faith.
**Concepts used:** DOM tree, why-5,000-nodes-is-slow, basic profiling
(Performance tab, FPS meter).
**Interview questions:**
- "What's the actual browser cost of 5,000 DOM nodes — memory, layout,
  paint?"
- "How did you generate mock data — seeded/deterministic, or random each
  run?"
- "What did you measure to prove it was slow?"

### Phase 3 — List Virtualization (The Core Feature — "The Moment")

**Build:** `virtualList.js` — computes the visible index range from
scrollTop, renders only ~15-20 rows (with a small overscan buffer), recycles
a fixed pool of DOM nodes, positions rows with `translateY`.
**Accomplish after:** scrolling through all 5,000 emails stays smooth (60fps)
because the DOM never holds more than ~20 nodes at once. This is the single
feature that separates this project from a toy.
**Concepts used:** scroll mechanics, windowing algorithm, DOM recycling, CSS
transforms, throttling.
**Interview questions:**
- "Walk me through your virtualization algorithm — how do you compute which
  rows are visible?"
- "Why `translateY` instead of `top` or margin for positioning rows?"
- "Do you support variable-height rows, or only fixed height? What would it
  take to support variable height?"
- "What happens on a fast scroll fling — do you ever see blank rows? How did
  you handle overscan?"
- "This is called 'list virtualization' — how is it different from React's
  'virtual DOM'? People conflate these; what's actually different?"
- "How would you test this for correctness — e.g., prove scrolling to email
  #4999 shows the right content?"

### Phase 4 — Compose Modal

**Build:** the compose button opens a modal (To/Subject/Body fields, no
actual sending — static only), overlay, close behavior.
**Accomplish after:** a working modal that doesn't fight with the virtualized
list underneath it.
**Concepts used:** stacking contexts (`z-index`), focus trapping, event
bubbling.
**Interview questions:**
- "How do you trap focus inside the modal for accessibility?"
- "Does opening the modal interact badly with the list's scroll/keyboard
  listeners underneath? How did you isolate them?"
- "What's your z-index / stacking strategy?"

### Phase 5 — Keyboard Navigation (j/k, Real Gmail Bindings)

**Build:** `keyboard.js` — `j`/`k` move focus down/up through the list,
`Enter` opens the focused email, focus auto-scrolls into view.
**Accomplish after:** you can navigate the entire inbox without touching the
mouse, exactly like real Gmail.
**Concepts used:** keydown handling, focus management, syncing a logical
"focused index" with rows that may not currently exist in the virtualized
DOM.
**Interview questions:**
- "The focused row might not currently be rendered — how do you keep
  keyboard focus in sync with a virtualized list?"
- "How did you avoid conflicts with the browser's default scroll/tab
  behavior?"
- "How would you make this accessible to screen reader users, not just
  keyboard users?"

### Phase 6 — Skeleton Loading States

**Build:** on initial load (and simulated slow network), show gray
placeholder rows matching the final layout before real content pops in.
**Accomplish after:** the app *feels* fast even before data is ready, and
there's no layout shift when real content replaces the skeleton.
**Concepts used:** perceived performance, `Promise`/`setTimeout` to simulate
async loading, layout-shift-free placeholder design.
**Interview questions:**
- "Is your loading state simulated with setTimeout, or does it mirror a real
  async data-fetch pattern (Promises)?"
- "How do you avoid layout shift when skeletons are replaced by real rows?"
- "Why skeleton screens over a spinner — what's the actual UX reasoning?"

### Phase 7 — Polish, Accessibility & Final Pass

**Build:** cross-browser check, Lighthouse pass, ARIA labels + color-contrast
verification on *both* themes, micro-animation timing pass, README with
setup + architecture notes.
**Accomplish after:** a portfolio-ready project with a README a senior dev
(or IB recruiter doing a "tell me about a project" round) can skim in two
minutes — and a demo that looks intentional, not like a tutorial project.
**Concepts used:** accessibility basics (ARIA, contrast ratios), performance
auditing, technical writing.
**Interview questions:**
- "What's your Lighthouse performance score, and what's the remaining
  bottleneck?"
- "How did you verify color contrast holds up in both your light and dark
  themes?"
- "If this needed a real backend tomorrow, what in your architecture changes
  vs. stays the same?"
- "How would you add automated tests to this, with no framework?"

---

## PART 4 — GIT WORKFLOW (repeats after every phase)

Once a phase is verified working:

```
git add -A
git commit -m "Phase N: <what was built>"
git push
```

Each commit message says which phase it closes, so your GitHub history reads
as a build log recruiters and interviewers can scroll through.
