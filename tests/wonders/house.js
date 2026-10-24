"use strict";
// The house rules every tip Wonder answers to (docs/superpowers/plans/2026-10-24-tip-wonders.md,
// Global Constraints), shared so each Wonder's test states them in one line. Ported from the
// assertions Tao repeats in every tests/visual-way-*.test.js, adjusted for the canvas-2D runtime:
// the edges, touch-action, the frame cap and the teardown live once in static/wonders/runtime.js
// (tests/wonders/runtime.test.js), so here a ui file only has to be built on it.
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const src = f => fs.readFileSync(path.join(ROOT, f), "utf8");

// files: [lib, ui], repo-relative
function houseRules(id, files, MAX_RATE) {
  assert.ok(MAX_RATE <= 0.8, "the calm bound is 0.8 rad/s at most");
  for (const f of files) {
    const s = src(f);
    assert.deepStrictEqual([...s].filter(ch => /[☀-➿⬀-⯿\u{1F000}-\u{1FAFF}✦✨★☆⭐✴✳]/u.test(ch)), [], f + ": no emoji or star glyphs");
    const ks = [...s.matchAll(/\b(?:t|T|time)\s*\*\s*([0-9]*\.?[0-9]+)/g)].map(m => Number(m[1]));
    assert.ok(ks.every(k => k <= MAX_RATE), f + " time multipliers " + JSON.stringify(ks));
    assert.ok(!/fract\(\s*sin\(/.test(s), f + ": no sine hash");
    assert.ok(!/filter\s*:\s*blur/.test(s), f + ": no CSS blur");
    assert.ok(!/sparkle|twinkle/i.test(s), f + ": no sparkle");
  }
  const ui = src(files[1]);
  assert.ok(ui.includes('"vis-' + id + '-style"'), "style id vis-" + id + "-style");
  assert.ok(!/border-left\s*:/.test(ui), "no left-border stripe");
  assert.ok(!/border-radius:\s*(99|999|9999)px/.test(ui), "no pill");
  const classes = [...ui.matchAll(/\.(vis-[\w-]+)/g)].map(m => m[1]);
  assert.ok(classes.every(c => c === "vis-" + id || c.startsWith("vis-" + id + "-")), "classes prefixed: " + classes.join(","));
  assert.match(ui, /T\.wonder2d\(/, "built on the shared runtime");
  // every lib export carries the Wonder's name (Altitude's tests/visual-namespace.test.js)
  const name = id.replace(/^pw-/, "");
  const lib = require(path.join(ROOT, files[0]));
  for (const k of Object.keys(lib)) assert.ok(k.startsWith(name) || k === name.toUpperCase(), files[0] + " export " + k);
}

module.exports = { houseRules };
