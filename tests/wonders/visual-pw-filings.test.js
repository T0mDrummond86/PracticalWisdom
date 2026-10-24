"use strict";
// Filings (tip #67, static/wonders/lib/visual-pw-filings.js + ui/visual-pw-filings.js) against the
// visuals contract and docs/wonders-plan.md: registration, house rules, and iron filings between two
// opposite poles: the field is the same line whichever pole is which (a filing has no head); each
// filing turns toward the field and the whole scatter comes into line; move a pole and the field
// swings and the filings follow; and the filings drawn to the line settle into its letters.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-filings", NAME = "Filings", PHRASE = "Polar opposite views can both be true.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.FILINGS;
const FILES = ["static/wonders/lib/visual-" + ID + ".js", "static/wonders/ui/visual-" + ID + ".js"];
const VIEWPORTS = [[390, 844], [375, 812], [411, 777], [844, 390], [777, 411]];
const W = 300, H = 400;

test("registers on TH.VISUALS: id, name, the tip's line, made of filings, and placed clear of the edges", () => {
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

const make = seed => L.filingsCreate({ seed, w: W, h: H });
const run = (s, sec, dt = 1 / 30) => { for (let i = 0; i < Math.round(sec / dt); i++) L.filingsStep(s, dt); };

test("both poles stay off the paper, one each side", () => {
  for (let seed = 1; seed < 20; seed++) {
    const s = make(seed), [a, b] = s.poles;
    assert.ok(a.x < 0 && b.x > W, JSON.stringify(s.poles));
    assert.ok(a.q * b.q < 0, "opposite");
  }
});

test("the field is the same line whichever pole is which: swapping them only reverses it", () => {
  const s = make(2), [a, b] = s.poles;
  for (const [x, y] of [[10, 10], [150, 200], [290, 390], [70, 300]]) {
    const f = L.filingsField(a, b, x, y), g = L.filingsField(b, a, x, y);
    // the sum is the same either way round; and with the charges swapped it reverses, the same axis
    assert.ok(Math.abs(f[0] - g[0]) < 1e-12 && Math.abs(f[1] - g[1]) < 1e-12);
    const sa = Object.assign({}, a, { q: -a.q }), sb = Object.assign({}, b, { q: -b.q });
    const r = L.filingsField(sa, sb, x, y);
    assert.ok(Math.abs(r[0] + f[0]) < 1e-12 && Math.abs(r[1] + f[1]) < 1e-12);
    assert.ok(Math.abs(Math.sin(Math.atan2(r[1], r[0]) - Math.atan2(f[1], f[0]))) < 1e-9, "same axis");
  }
});

test("the same seed is the same scatter; another seed is another", () => {
  const a = make(4), b = make(4), c = make(5);
  assert.deepStrictEqual(Array.from(a.x.slice(0, 50)), Array.from(b.x.slice(0, 50)));
  assert.notDeepStrictEqual(Array.from(a.x.slice(0, 50)), Array.from(c.x.slice(0, 50)));
});

test("each filing turns toward the field, and the whole scatter comes into line", () => {
  const s = make(6);
  const e0 = L.filingsError(s);
  assert.ok(e0 > 0.4, "scattered at first: " + e0);
  const i = 17, err = () => { const f = L.filingsField(s.poles[0], s.poles[1], s.x[i], s.y[i]); return Math.abs(Math.sin(s.a[i] - Math.atan2(f[1], f[0]))); };
  let prev = err(), prevAll = e0;
  for (let k = 0; k < 6; k++) {
    run(s, 0.5);
    const now = err(), all = L.filingsError(s);
    assert.ok(now <= prev + 1e-9, "filing " + i + " turned away: " + prev + " -> " + now);
    assert.ok(all < prevAll, "mean error " + prevAll + " -> " + all);
    prev = now; prevAll = all;
  }
  assert.ok(L.filingsError(s) < 0.08, "in line: " + L.filingsError(s));
});

test("move a pole and the field swings round, and the filings follow it", () => {
  const s = make(7);
  run(s, 6);
  const settled = L.filingsError(s);
  const f0 = L.filingsField(s.poles[0], s.poles[1], 150, 80);
  L.filingsMovePole(s, 0, H * 0.95);
  const f1 = L.filingsField(s.poles[0], s.poles[1], 150, 80);
  assert.ok(Math.abs(Math.sin(Math.atan2(f1[1], f1[0]) - Math.atan2(f0[1], f0[0]))) > 0.05, "the field swung");
  assert.ok(L.filingsError(s) > settled * 2, "out of line for a moment");
  run(s, 6);
  assert.ok(L.filingsError(s) < 0.08, "back in line: " + L.filingsError(s));
});

test("a pole stays off the paper however far it is dragged", () => {
  const s = make(8);
  L.filingsMovePole(s, 1, -500);
  assert.ok(s.poles[1].x > W && s.poles[1].y >= 0 && s.poles[1].y <= H);
});

test("the filings drawn to the line settle into its letters, each on a place of its own", () => {
  const s = make(9);
  // letter points as wordfield.js would hand them: a bar and a ring in the middle of the sheet
  const pts = [];
  for (let k = 0; k < 300; k++) pts.push({ x: 80 + (k * 0.618 % 1) * 140, y: 180 + (k * 0.381 % 1) * 12 });
  for (let k = 0; k < 200; k++) { const t = k / 200 * 2 * Math.PI; pts.push({ x: 150 + 30 * Math.cos(t), y: 240 + 22 * Math.sin(t) }); }
  L.filingsLetters(s, pts);
  assert.ok(s.targets.size >= pts.length, "a filing for each place, and the loose ones beside it");
  const places = new Set(); for (const [i] of s.targets) places.add(i);
  assert.strictEqual(places.size, s.targets.size, "no filing given two places");
  run(s, 1);
  let arrived = 0;
  for (const [i, p] of s.targets) if (Math.hypot(s.x[i] - p.x, s.y[i] - p.y) < 1.5) arrived++;
  assert.ok(arrived < s.targets.size * 0.9, "not all at once: " + arrived);
  run(s, 6);
  arrived = 0;
  for (const [i, p] of s.targets) if (Math.hypot(s.x[i] - p.x, s.y[i] - p.y) < 1.5) arrived++;
  assert.ok(arrived === s.targets.size, "all settled: " + arrived + "/" + s.targets.size);
  assert.ok(L.filingsError(s) < 0.08, "and in line with the field");
});
