# Tip Wonders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An "Animations (demo)" section in Practical Wisdom holding ten touchable Wonders, each built from one tip and linked back to it.

**Architecture:** Port the small core of the Wonders engine (fonts, word fields, gallery) from Tao into `static/wonders/`, minus the crossing transitions, which the gallery already degrades to a crossfade without. Add one shared canvas-2D runtime so each Wonder supplies only its physics, drawing and touch. Load the whole set lazily, the first time the section opens, so the rest of the app does not pay for it.

**Tech Stack:** Vanilla JS (no build step), canvas 2D, `node --test` (Node 18), Flask static serving, pytest.

**Spec:** `docs/wonders-plan.md` (the ten treatments, approved 2026-10-24). Engine source: `~/Documents/apps/tao` (`lib/fonts.js`, `lib/wordfield.js`, `ui/gallery.js`, `docs/visuals-contract.md`).

## Global Constraints

The contract and house rules, verbatim from Tao, with the test that enforces each here:

- A visual registers `TH.VISUALS[id] = { id, name, phrase, mount(el, { reduced, words }) → { destroy, pause, resume } }` — `tests/wonders/visual-<id>.test.js` registration test.
- `phrase` is the tip's line exactly as in `docs/wonders-plan.md` — registration test.
- `wordsMode` ∈ `become | around | revealed` with a `wordsAt(W, H)` giving `{ at, size, maxWidth }` where `18 ≤ size ≤ 40` and `maxWidth ≤ 0.9·W`, the line clear of the top 64 px and the bottom 120 px, at 390×844, 375×812, 411×777, 844×390, 777×411 — registration test.
- "Leave the outer 56 px of the left and right edges free of essential interaction … and the top 64 px": `EDGE_X = 56, EDGE_TOP = 64` — `tests/wonders/runtime.test.js`.
- "`touch-action: none` on your canvas" — runtime test.
- "`destroy()` stops everything … and removes what you added. `pause()`/`resume()` are called when the gallery hides or shows you"; `removeEventListener("visibilitychange"` — runtime test.
- "`reduced` (prefers-reduced-motion): a still or very slow version that still answers touch": `const pace = reduced ? 0.3 : 1;` and `reduced ? 100 : 1000 / 30` — runtime test.
- "cap 30 fps … devicePixelRatio cap 2, pause when the page is hidden" — runtime test.
- "Calm bound: any sin/cos of TIME has a multiplier ≤ 0.8 rad/s" — `tests/wonders/house.js` `houseRules()`, applied to every visual.
- "No emoji, no star/sparkle glyphs"; no `sparkle|twinkle` — `houseRules()`.
- "NEVER the 'Claude artifact' look (left-border accent stripes, coloured capsule/pill labels)": no `border-left:`, no `border-radius: 99|999|9999px` — `houseRules()`.
- "Styles: one injected `<style id="vis-<id>-style">`, classes `vis-<id>-`" — `houseRules()`.
- No `fract(sin(` hash, no CSS `filter: blur` — `houseRules()`.
- Nothing that reads as eyes, a face, cracks or lightning — phone review (Task 6, Task 14); not machine-checkable.
- Every lib export is prefixed with its Wonder's name (Altitude's `tests/visual-namespace.test.js`) — `houseRules()`.
- Practical Wisdom: no build step; a shell asset change bumps `CACHE` in `static/sw.js`; all work on `main`, mirrored to `pwa`, which Railway deploys. `pytest` and `node tests/test_marker_placement.mjs` stay green.

---

## File structure

```
static/wonders/
  core.js            TH.h (DOM builder), TH.esc — trimmed from Tao lib/core.js
  fonts.js           the ten house fonts; files under /static/wonders/fonts/
  wordfield.js       verbatim from Tao lib/wordfield.js
  runtime.js         TH.wonder2d(): the shared canvas-2D runtime; TH.wonderRand(seed)
  gallery.js         TH.renderWonders(): one Wonder at a time, arrows, dots, crossfade, the reading
  reading.js         TH.tipReading(): the tip and its anecdote, fetched live, "Open this tip"
  lib/visual-pw-<name>.js   each Wonder's physics, dual-exported, node-tested
  ui/visual-pw-<name>.js    each Wonder's drawing and touch, on TH.wonder2d
  fonts/*.woff2      copied from Tao fonts/
tests/wonders/
  house.js           shared house-rule assertions
  runtime.test.js    the runtime's enforced strings and its seeded rand
  wordfield.test.js  ported from Tao tests/wordfield.test.js
  gallery.test.js    order, fonts, neighbour, start
  visual-pw-<name>.test.js  registration + house rules + physics, one per Wonder
```

App changes: `templates/index.html` (the tab and the pane), `static/app.js` (lazy loader, view wiring, per-tip link), `static/styles.css` (the pane), `static/sw.js` (cache bump), `tests/test_app.py` (assets served).

---

## Task 1: Port the engine core

**Files:** Create `static/wonders/{core,fonts,wordfield}.js`, `static/wonders/fonts/*.woff2`, `tests/wonders/wordfield.test.js`.

**Interfaces:** Produces `TH.h`, `TH.esc`, `TH.FONTS`, `TH.FONT_IDS`, `TH.loadFont(id)`, `TH.fontString(id, px, opts)`, `TH.buildWordField(text, o)` (unchanged from Tao).

- [ ] Copy `lib/wordfield.js` verbatim and `tests/wordfield.test.js` (path adjusted to `../../static/wonders/wordfield.js`).
- [ ] Copy `lib/fonts.js`; change only the font URL from `"url(./fonts/" + file + ")"` to `"url(/static/wonders/fonts/" + file + ")"`.
- [ ] Write `core.js` with `esc` and `h` exactly as in Tao `lib/core.js`; drop `updateNow`, `sideways`, `LANDSCAPE_PHONE` (Altitude routing, unused here).
- [ ] Copy the 15 woff2 files and `OFL.txt`.
- [ ] Run `node --test tests/wonders/` — wordfield tests pass.
- [ ] Commit.

**Arithmetic:** the 15 font files total 633,484 bytes. None are precached; a visit loads only the face its Wonder speaks in (plus an italic for Fraunces or Instrument), so a full pass through all ten loads 10 normal faces + 2 italics.

## Task 2: The shared runtime

**Files:** Create `static/wonders/runtime.js`, `tests/wonders/runtime.test.js`, `tests/wonders/house.js`.

**Interfaces:** Produces

```js
TH.wonderRand(seed) -> () => number in [0, 1)          // mulberry32, deterministic per seed
TH.wonder2d(el, opts, spec) -> { destroy(), pause(), resume(), _advance(seconds), _state(), _touch(kind, x, y), _canvas }
// opts: { reduced, words, seed }
// spec: {
//   id, css,                        // extra CSS, classes vis-<id>-...
//   create(ctx) -> state,           // ctx: { W, H, S, rand, reduced, seed }
//   words?(state, field, ctx),      // when opts.words.ready resolves
//   step(state, dt, ctx),           // dt already multiplied by pace
//   draw(g, state, ctx),            // g: 2D context, in CSS px
//   touch?(state, kind, x, y, ctx), // kind "down" | "move" | "up"; never inside the edges
//   resize?(state, ctx),
//   info?(state) -> object          // merged into _state()
// }
```

- [ ] Write `runtime.test.js` first: the source contains `EDGE_X = 56, EDGE_TOP = 64`, `touch-action: none`, `removeEventListener("visibilitychange"`, `_advance(seconds)`, `const pace = reduced ? 0.3 : 1;`, `reduced ? 100 : 1000 / 30`, `Math.min(2,` (DPR cap); `wonderRand(7)` gives the same first five numbers twice and different ones for seed 8; every value is in [0, 1).
- [ ] Write `house.js` exporting `houseRules(id, files, MAX_RATE)` that asserts, for each file: no glyphs (Tao's regex), every `(t|T|time) * k` has `k ≤ MAX_RATE`, no `fract(sin(`, no `filter: blur`, no `sparkle|twinkle`; and for the ui file: `"vis-<id>-style"` passed as the style id, no `border-left:`, no pill radius, at least 3 classes and all prefixed `vis-<id>`, and it calls `TH.wonder2d`.
- [ ] Run — fails (no runtime).
- [ ] Write `runtime.js`. One injected style per id, refcounted; the base CSS gives the root `position:absolute; inset:0; overflow:hidden; background:#04050a` and the canvas `touch-action: none`. Canvas sized `W·dpr × H·dpr`, `dpr = Math.min(2, devicePixelRatio)`, context scaled so `draw` works in CSS px. Pointer events with capture, ignored inside the edges. Frame loop throttled to `FRAME_MS = reduced ? 100 : 1000 / 30`, `dt` clamped to 0.1 s, `step(state, dt * pace)`. Pauses on `visibilitychange` and on `pause()`. `destroy()` removes every listener, the root, and the style when its last user goes.
- [ ] Run — passes.
- [ ] Commit.

## Task 3: Gallery, reading and the section

**Files:** Create `static/wonders/gallery.js`, `static/wonders/reading.js`, `tests/wonders/gallery.test.js`. Modify `templates/index.html`, `static/app.js`, `static/styles.css`, `static/sw.js`, `tests/test_app.py`.

**Interfaces:** Produces `TH.renderWonders(stageEl, { start })` returning `{ el, teardown() }`; `TH.WONDER_ORDER`; `TH.wonderFont(id)`; `TH.wonderNeighbour(list, id, step)`; `TH.wonderStart(list, last, asked)`; `TH.tipReading(layer)` returning `{ el, set({ tipId }), destroy() }`.

- [ ] `gallery.test.js`: ORDER is exactly the ten ids in the build order; every id has a FONT; no font is used twice; `wonderNeighbour` wraps both ways; `wonderStart` prefers the asked id, then the last, then the first.
- [ ] Gallery: Tao's `renderGallery` without crossings and without hash routing (Practical Wisdom has no hash routes). The stage is the section pane, so word fields are laid out against the pane's size, not the window's. Remembers the last Wonder under `pw:wonder-last`.
- [ ] Reading: a quiet "Read the tip" control in the corner that opens the tip's text and anecdote (from `/api/tips`, matched by `tipId`) and an "Open this tip" link. The anecdote is shown exactly as written; when a tip has none, the reading is the tip alone.
- [ ] Section: a `view-animations` tab labelled "Animations (demo)" and an `#animations-view` pane. Shown in Read view and to every visitor, hidden in Author view (like Ask). On first open, the scripts load in order — `core, fonts, wordfield, runtime, lib/*, ui/*, reading, gallery` — then the gallery renders; leaving the section calls `teardown()`.
- [ ] Per-tip link: in the Explore pane, a tip that has a Wonder shows "See its wonder", which opens the section on that Wonder.
- [ ] `test_app.py`: `/static/wonders/gallery.js` and `/static/wonders/runtime.js` return 200; `index.html` contains `view-animations` and `Animations (demo)`.
- [ ] Bump `CACHE`. Run pytest, the marker test and `node --test tests/wonders/` — all pass.
- [ ] Commit.

## Tasks 4–6: the pilot (pencil, reduction, filings)

Each Wonder is two files on the shared runtime plus its test. The test is written first and must fail first.

**Every Wonder's test** contains: the registration test (id, name, phrase exactly, `mount` a function, its `wordsMode`, `wordsAt` within bounds at all five viewports); `houseRules(ID, FILES, C.MAX_RATE)`; and the physics tests below. Each lib exports a constant object (`PENCIL`, `REDUCTION`, …) with `MAX_RATE: 0.8` and functions prefixed with the Wonder's name.

### Task 4: `pw-pencil` (tip #39)

Physics to test (`lib/visual-pw-pencil.js`): `pencilCreate({ seed, w, h })`; `pencilTooth(s, x, y)` in [0, 1], deterministic per seed, and different per seed; `pencilDeposit(s, x, y, pressure)` lays graphite only where the tooth's height is above `1 − pressure` (graphite catches the high points and skips the valleys); deposits accumulate and never decrease (what is written stays); `pencilStroke(s, pts)` deposits along the path with no gaps wider than one tooth cell.

Rendering: warm toned paper, side-lit tooth texture, graphite with a soft sheen. The line is written in over about 4 s, letter by letter, along the word field's points. Touch writes.

### Task 5: `pw-reduction` (tip #86)

Physics: `reductionCreate({ seed, w, h })`; the liquid's depth falls monotonically while boiling and never goes below zero; bubble nucleation rises with local heat; `reductionHeat(s, x, y)` raises heat near the touch and it decays back; the boiled-off fraction over a fixed span is greater under higher heat; letters (the residue mask) are uncovered only where the depth has gone to zero.

Rendering: shallow pan from above, a rolling boil of mixed-size bubbles, steam lifting, the line revealed as a glossy reduction on the base.

### Task 6: `pw-filings` (tip #67)

Physics: `filingsField(p1, p2, x, y)` is the field of two opposite poles (a dipole pair) and is symmetric under swapping them; each filing's angle relaxes toward the field direction; the filings' mean alignment error falls over time; moving a pole re-orients the field and the filings follow; filings on letter points settle into the letters.

Rendering: paper, a few thousand short dark filings aligned along curved field lines between two poles just off the left and right edges, never on screen.

## Task 7: Phone review gate (the pilot)

- [ ] Each of the three at 390×844, deviceScaleFactor 2.625, live (not paused), plus 844×390 sideways: the line legible, nothing reading as eyes, a face, cracks or lightning, no small subject in an empty field, touch doing its physical thing, reduced motion at 10 fps still answering touch.
- [x] Write down what review rejected and carry it into Tasks 8–14.
- [x] Commit fixes.

**What the pilot review caught (2026-10-24), to carry into Tasks 8–14:**

1. *Ask for a fine word field.* The default 3 px mask is too coarse for type at 40 px: Pencil's nib
   came out 4 px fat and filled the letters' counters. Every Wonder's `wordsAt` returns `cell: 1.5`.
2. *Measure the line on the real field, not only the test's.* A test's fake letters can be the wrong
   thickness (Pencil's first fake letters were 15 px blocks). Each Wonder's `info()` reports its
   line's coverage or progress, read live at phone size.
3. *Every patch and clearing is a pareidolia check.* Reduction's machining rings centred under a
   central light made a target; Filings drawing its letters from the scatter cleared an almond with
   a dark band through it. Both are eyes. Keep centres off-frame and take a line's material from
   nowhere visible.
4. *A reveal must take seconds, and a test must say so.* Reduction first showed the whole line in
   about 1 s, because a broad flame and a fast-levelling film dried the pan at once. Tests now require
   at least 3 s from 10% to 90%.
5. *No two state keys alike.* Reduction's state had `h` twice (the pan's height and the letters
   array); the array won, and `s.h / 2` stringified 8,000 numbers per cell (NaN, 800 ms a step).
6. *Paper is a texture you see through what lies on it.* Pencil's first tooth was stucco; low relief
   with the grain showing through the graphite reads as paper.
7. *The section hides the search bar*, so a phone turned sideways gives the Wonder 287 px, not 243.
8. *Verification:* the browser pane here runs no animation frames while hidden, so every check
   steps the Wonder by hand (`document.querySelector(".wonder")._wonder()._advance(s)`). Live frames
   at phone size are for Tom's own phone.

## Tasks 8–14: the remaining seven

Each as Tasks 4–6: test first, then lib, then ui.

- **8 `pw-kerf` (#20):** touches counted; the first two leave ticks and do not cut; the third cuts along the mean of the two ticks; sawdust particles fall with gravity and settle; letters revealed where dust has left. Grain is deterministic per seed.
- **9 `pw-swing` (#122):** a pendulum with energy conserved to within 1% over 20 periods unpushed; a push adds energy and raises the peak; speed at the bottom exceeds speed at the top, and the time spent near the top grows with amplitude.
- **10 `pw-threshold` (#181):** the light wedge's angle grows monotonically with the door's opening; dust motes are lit only inside the wedge; the door eases toward the opening asked for and never overshoots past fully open.
- **11 `pw-stalagmite` (#12):** each drop adds a ring of positive mass and the total mass never decreases; the letters' coverage grows with drops and is never complete after one; a touch drops one now.
- **12 `pw-shoot` (#65):** the shoot's tip height never decreases; snow displaced by the shoot is conserved (slumps aside, is not destroyed); no snow cell is split into two by a line (no fracture).
- **13 `pw-bloom` (#3):** a touch opens plants within an annulus around it and leaves the plant under the finger as it was; openness never decreases; letters revealed where blooms cover them.
- **14 `pw-petal` (#107):** the petal's displacement from the centre decays toward zero after a ripple (it returns unforced); a ripple pushes it outward; it never leaves the pool.

## Task 15: Final review and ship

- [ ] All ten at phone size and sideways, the same checks as Task 7.
- [ ] `pytest`, `node tests/test_marker_placement.mjs`, `node --test tests/wonders/` — all green.
- [ ] Commit, push `main`, mirror to `pwa` (deploys), and confirm the live site serves `/static/wonders/gallery.js` with the new cache version.
