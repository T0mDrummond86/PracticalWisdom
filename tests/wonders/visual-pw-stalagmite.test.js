"use strict";
// Stalagmite (tip #12, static/wonders/lib/visual-pw-stalagmite.js + ui/visual-pw-stalagmite.js) against
// the visuals contract and docs/wonders-plan.md: registration, house rules, and a cave seen side-on: a
// drop swells at a stalactite's tip, lets go, falls faster and faster, and lands on the top of what is
// growing below it; each drop lays down a little mineral and none is ever taken away; the letters grow
// up from their ledge, bottom first, a little with every drop, never whole after one and never all at
// once; and a touch lets the nearest drop fall now.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-stalagmite", NAME = "Stalagmite", PHRASE = "Big success is tiny successes building on each other.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.STALAGMITE;
const FILES = ["static/wonders/lib/visual-" + ID + ".js", "static/wonders/ui/visual-" + ID + ".js"];
const VIEWPORTS = [[390, 844], [375, 812], [411, 777], [844, 390], [777, 411]];
const W = 300, H = 400;

test("registers on TH.VISUALS: id, name, the tip's line, built of mineral, and placed clear of the edges", () => {
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
    assert.strictEqual(v.wordsMode, "become");
    for (const [w, h] of VIEWPORTS) {
      const o = v.wordsAt(w, h);
      assert.ok(o.size >= 18 && o.size <= 40 && o.maxWidth <= w * 0.9, w + "x" + h + " " + JSON.stringify(o));
      assert.ok(o.at.y - o.size * 1.6 > 64, "clear of the top at " + w + "x" + h);
      assert.ok(o.at.y + o.size * 1.6 < h - 120, "clear of the dots at " + w + "x" + h);
    }
  } finally { globalThis.TH = before; }
});

test("house rules", () => { houseRules(ID, FILES, C.MAX_RATE); });

// two lines of "letters" as the drawing hands them over: each a mask of 1.5 px cells over a box, with
// the ledge it stands on (blocks with gaps, and a stem dropping below the ledge like a descender)
function rows() {
  const out = [];
  for (const top of [140, 240]) {
    const cell = 1.5, gw = 120, gh = 30, mask = new Uint8Array(gw * gh);
    for (let y = 2; y < 26; y++) for (let x = 6; x < 114; x++) if (x % 16 < 10) mask[y * gw + x] = 1;
    for (let y = 26; y < 30; y++) for (let x = 20; x < 23; x++) mask[y * gw + x] = 1;
    out.push({ cell, gw, gh, mask, rect: { x: 60, y: top, w: gw * cell, h: gh * cell }, ledge: top + 26 * cell });
  }
  return out;
}
const make = seed => { const s = L.stalagmiteCreate({ seed, w: W, h: H }); L.stalagmiteLetters(s, rows(), 70); return s; };
const run = (s, sec, dt = 1 / 30) => { for (let i = 0; i < Math.round(sec / dt); i++) L.stalagmiteStep(s, dt); };
const mass = s => { let v = 0; for (const r of s.rows) for (const f of r.front) v += f; return v; };

test("a drop swells at the tip, lets go, falls faster and faster, and lands on top of the growth below", () => {
  const s = make(1);
  let seen = null;
  for (let k = 0; k < 30 * 6 && !seen; k++) { L.stalagmiteStep(s, 1 / 60); if (s.falling.length) seen = s.falling[0]; }
  assert.ok(seen, "a drop falls within a few seconds");
  const d = s.drips[seen.drip];
  assert.ok(Math.abs(seen.x - d.x) < 1e-9 && seen.y >= d.tip - 1e-9, "from the tip it hung at");
  let prevY = seen.y, prevV = seen.vy;
  while (s.falling.includes(seen)) {
    L.stalagmiteStep(s, 1 / 120);
    if (!s.falling.includes(seen)) break;
    assert.ok(seen.y > prevY && seen.vy > prevV, "falling faster");
    prevY = seen.y; prevV = seen.vy;
  }
  const r = s.rows[d.row];
  assert.ok(prevY <= L.stalagmiteTop(s, d.row, seen.x) + 12, "it landed on top of the growth, not through it");
  void r;
});

test("each drop lays down a little mineral, and none is ever taken away", () => {
  const s = make(2);
  let m = mass(s), drops = s.drops;
  const prev = s.rows.map(r => Float32Array.from(r.front));
  for (let k = 0; k < 30 * 20; k++) {
    L.stalagmiteStep(s, 1 / 30);
    s.rows.forEach((r, i) => { for (let c = 0; c < r.front.length; c++) { assert.ok(r.front[c] >= prev[i][c]); prev[i][c] = r.front[c]; } });
    if (s.drops > drops) { assert.ok(mass(s) > m, "a landed drop added mineral"); m = mass(s); drops = s.drops; }
  }
  assert.ok(drops > 20);
});

test("the letters grow up from their ledge: never whole after one drop, and never all at once", () => {
  const s = make(3);
  let t10 = null, t90 = null, prev = 0;
  for (let k = 0; k < 30 * 90; k++) {
    L.stalagmiteStep(s, 1 / 30);
    const c = L.stalagmiteCoverage(s);
    assert.ok(c >= prev - 1e-12, "it never shrinks");
    if (s.drops === 1) assert.ok(c < 0.05, "not whole after one drop");
    if (t10 === null && c > 0.1) t10 = k / 30;
    if (t90 === null && c > 0.9) t90 = k / 30;
    prev = c;
  }
  assert.ok(t10 !== null && t90 !== null, "built within a minute and a half: " + prev);
  assert.ok(t90 - t10 >= 8, "gradually: " + t10 + " -> " + t90);
});

test("bottom first: part built, it is the lower part of each letter that stands", () => {
  const s = make(4);
  while (L.stalagmiteCoverage(s) < 0.4) L.stalagmiteStep(s, 1 / 30);
  let low = 0, high = 0;
  for (const r of s.rows) for (const cell of r.cells) if (cell.built) { if (cell.y > r.rect.y + r.rect.h * 0.45) low++; else high++; }
  assert.ok(low > 2 * high, "lower " + low + ", upper " + high);
});

test("a touch lets the nearest drop fall now", () => {
  const s = make(5);
  run(s, 0.2);
  const before = s.falling.length;
  const d = s.drips[7];
  L.stalagmiteTouch(s, d.x, d.tip + 5);
  assert.ok(s.falling.length === before + 1 && s.falling[s.falling.length - 1].drip === 7, "that drip's drop is falling");
});

test("the same seed is the same cave; another is another", () => {
  const a = make(6), b = make(6), c = make(7);
  run(a, 4); run(b, 4); run(c, 4);
  assert.deepStrictEqual(Array.from(a.rows[0].front), Array.from(b.rows[0].front));
  assert.notDeepStrictEqual(a.drips.map(d => d.period), c.drips.map(d => d.period));
});
