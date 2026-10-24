"use strict";
// Reduction (tip #86, static/wonders/lib/visual-pw-reduction.js + ui/visual-pw-reduction.js) against
// the visuals contract and docs/wonders-plan.md: registration, house rules, and a pan at the boil: the
// stock only goes down while it boils and never below the base; bubbles come thicker where it is
// hotter; a press turns the heat up there and it falls back after; more heat boils more away; the
// letters, the reduction itself, show only where the stock has boiled down to nothing, and by the end
// of the boil all of them do; then the pan is topped up and it begins again.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-reduction", NAME = "Reduction", PHRASE = "Boil things down to their essence.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.REDUCTION;
const FILES = ["static/wonders/lib/visual-" + ID + ".js", "static/wonders/ui/visual-" + ID + ".js"];
const VIEWPORTS = [[390, 844], [375, 812], [411, 777], [844, 390], [777, 411]];
const W = 240, H = 300;

test("registers on TH.VISUALS: id, name, the tip's line, revealed, and placed clear of the edges", () => {
  const before = globalThis.TH;
  globalThis.TH = {};
  try {
    const p = require.resolve("../../static/wonders/ui/visual-" + ID + ".js");
    delete require.cache[p];
    require(p);
    const v = globalThis.TH.VISUALS && globalThis.TH.VISUALS[ID];
    assert.ok(v);
    assert.strictEqual(v.id, ID); assert.strictEqual(v.name, NAME); assert.strictEqual(v.phrase, PHRASE);
    assert.strictEqual(typeof v.mount, "function");
    assert.strictEqual(v.wordsMode, "revealed");
    for (const [w, h] of VIEWPORTS) {
      const o = v.wordsAt(w, h);
      assert.ok(o.size >= 18 && o.size <= 40 && o.maxWidth <= w * 0.9, w + "x" + h + " " + JSON.stringify(o));
      assert.ok(o.at.y - o.size * 1.6 > 64, "clear of the top at " + w + "x" + h);
      assert.ok(o.at.y + o.size * 1.6 < h - 120, "clear of the dots at " + w + "x" + h);
    }
  } finally { globalThis.TH = before; }
});

test("house rules", () => { houseRules(ID, FILES, C.MAX_RATE); });

const make = seed => L.reductionCreate({ seed, w: W, h: H });
const run = (s, sec, dt = 1 / 30) => { for (let i = 0; i < Math.round(sec / dt); i++) L.reductionStep(s, dt); };
const volume = s => { let v = 0; for (const d of s.depth) v += d; return v; };
// letters as wordfield.js would hand them: a bar across the middle and a block lower down
function fakeField() {
  const cell = 1.5, rect = { x: 40, y: 120, w: 160, h: 60 };
  const inside = (x, y) => (y >= 130 && y < 140 && x >= 50 && x < 190) || (y >= 155 && y < 172 && x >= 90 && x < 150);
  return { cell, rect, inside, ready: Promise.resolve() };
}

test("the same seed is the same pan; another seed is another", () => {
  const a = make(1), b = make(1), c = make(2);
  run(a, 2); run(b, 2); run(c, 2);
  assert.deepStrictEqual(Array.from(a.depth.slice(0, 200)), Array.from(b.depth.slice(0, 200)));
  assert.notDeepStrictEqual(Array.from(a.heat.slice(0, 200)), Array.from(c.heat.slice(0, 200)));
});

test("while it boils, the stock only goes down, and never below the base", () => {
  const s = make(3);
  let v = volume(s);
  for (let k = 0; k < 600 && s.phase === "boil"; k++) {
    L.reductionStep(s, 1 / 30);
    if (k % 40 === 0) L.reductionHeat(s, 60 + k % 120, 100 + k % 80);
    const nv = volume(s);
    assert.ok(nv <= v + 1e-6, "volume rose " + v + " -> " + nv);
    v = nv;
    for (const d of s.depth) assert.ok(d >= 0);
  }
});

test("bubbles come thicker where it is hotter", () => {
  const born = (heated) => {
    const s = make(4);
    let n = 0;
    for (let k = 0; k < 90; k++) {
      if (heated && k % 10 === 0) L.reductionHeat(s, 60, 80);
      L.reductionStep(s, 1 / 30);
      for (const b of s.bubbles) if (b.age === 0 && Math.hypot(b.x - 60, b.y - 80) < 30) n++;
    }
    return n;
  };
  assert.ok(born(true) > born(false) * 1.5, born(true) + " vs " + born(false));
});

test("a press turns the heat up where it lands, and the heat falls back after", () => {
  const s = make(5);
  const h0 = L.reductionHeatAt(s, 120, 150), far0 = L.reductionHeatAt(s, 20, 20);
  L.reductionHeat(s, 120, 150);
  assert.ok(L.reductionHeatAt(s, 120, 150) > h0 + 0.2);
  assert.ok(Math.abs(L.reductionHeatAt(s, 20, 20) - far0) < 0.02, "only near the press");
  run(s, 12);
  assert.ok(Math.abs(L.reductionHeatAt(s, 120, 150) - h0) < 0.03, "back to the burner's own heat");
});

test("more heat boils more away", () => {
  // the stock within 30 px of the press: liquid levels out slowly, so what boils there is lost there
  const near = s => { let v = 0; for (let i = 0; i < s.depth.length; i++) { const x = (i % s.gw + 0.5) * s.cell, y = (Math.floor(i / s.gw) + 0.5) * s.cell; if (Math.hypot(x - 120, y - 150) < 30) v += s.depth[i]; } return v; };
  const boiled = heated => {
    const s = make(6), v0 = near(s);
    for (let k = 0; k < 90; k++) { if (heated && k % 6 === 0) L.reductionHeat(s, 120, 150); L.reductionStep(s, 1 / 30); }
    return (v0 - near(s)) / v0;
  };
  assert.ok(boiled(true) > boiled(false) * 1.15, boiled(true) + " vs " + boiled(false));
});

test("the letters show only where the stock has boiled down to nothing, and by the end all of them do", () => {
  const s = make(7);
  L.reductionLetters(s, fakeField());
  let t10 = null, t90 = null;
  for (let k = 0; k < 30 * 60 && s.phase === "boil"; k++) {
    L.reductionStep(s, 1 / 30);
    for (let i = 0; i < s.depth.length; i++) {
      if (L.reductionShown(s, i) > 0.5) assert.ok(s.depth[i] < C.FILM, "shown under " + s.depth[i]);
    }
    const shown = L.reductionLettersShown(s);
    if (t10 === null && shown > 0.1) t10 = k / 30;
    if (t90 === null && shown > 0.9) t90 = k / 30;
  }
  assert.notStrictEqual(s.phase, "boil", "the boil ends within a minute");
  // it comes up through the stock over seconds, from the hot middle out, not all at once
  assert.ok(t10 !== null && t90 !== null && t90 - t10 >= 3, "10% at " + t10 + " s, 90% at " + t90 + " s");
  assert.ok(L.reductionLettersShown(s) > 0.95, "all the letters at the end: " + L.reductionLettersShown(s));
});

test("boiled down, it rests, is topped up, and boils down again", () => {
  const s = make(8);
  const v0 = volume(s), seen = [s.phase];
  let low = Infinity, afterFill = null;
  for (let k = 0; k < 30 * 120; k++) {
    L.reductionStep(s, 1 / 30);
    if (s.phase !== seen[seen.length - 1]) { if (seen[seen.length - 1] === "fill") afterFill = volume(s); seen.push(s.phase); }
    if (seen.length < 3) low = Math.min(low, volume(s));
  }
  assert.deepStrictEqual(seen.slice(0, 4), ["boil", "rest", "fill", "boil"]);
  assert.ok(low < v0 * 0.05, "boiled down: " + low / v0);
  assert.ok(afterFill > v0 * 0.8, "topped up: " + afterFill / v0);
});
