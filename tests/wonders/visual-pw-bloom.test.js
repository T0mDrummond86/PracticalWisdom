"use strict";
// Bloom (tip #3, static/wonders/lib/visual-pw-bloom.js + ui/visual-pw-bloom.js) against the visuals
// contract and docs/wonders-plan.md: registration, house rules, and a meadow side-on: a touch sends
// pollen from the nearest open flower to the buds round the finger, not to the one under it; a bud opens
// only once help has reached it; an opened flower sends help on to its own neighbours, so one touch
// spreads through the meadow, multifold; nothing closes again; the line comes into its colour as the
// meadow flourishes; and left alone, a breeze carries the first pollen.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-bloom", NAME = "Bloom", PHRASE = "Help others to flourish.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.BLOOM;
const FILES = ["static/wonders/lib/visual-" + ID + ".js", "static/wonders/ui/visual-" + ID + ".js"];
const VIEWPORTS = [[390, 844], [375, 812], [411, 777], [844, 390], [777, 411]];
const W = 390, H = 740;

test("registers on TH.VISUALS: id, name, the tip's line, in the scene, and placed clear of the edges", () => {
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
    assert.strictEqual(v.wordsMode, "around");
    for (const [w, h] of VIEWPORTS) {
      const o = v.wordsAt(w, h);
      assert.ok(o.size >= 18 && o.size <= 40 && o.maxWidth <= w * 0.9, w + "x" + h + " " + JSON.stringify(o));
      assert.ok(o.at.y - o.size * 1.6 > 64, "clear of the top at " + w + "x" + h);
      assert.ok(o.at.y + o.size * 1.6 < h - 120, "clear of the dots at " + w + "x" + h);
    }
  } finally { globalThis.TH = before; }
});

test("house rules", () => { houseRules(ID, FILES, C.MAX_RATE); });

const make = seed => L.bloomCreate({ seed, w: W, h: H });
const run = (s, sec, dt = 1 / 30) => { for (let i = 0; i < Math.round(sec / dt); i++) L.bloomStep(s, dt); };
const share = s => s.plants.filter(p => p.open >= 1).length / s.plants.length;
const nearest = (s, x, y) => s.plants.reduce((b, p) => Math.hypot(p.hx - x, p.hy - y) < Math.hypot(b.hx - x, b.hy - y) ? p : b);

test("a few flowers are already open; the rest are buds", () => {
  const s = make(1), open = s.plants.filter(p => p.open >= 1).length;
  assert.ok(s.plants.length > 60 && open >= 1 && open <= 4, s.plants.length + " plants, " + open + " open");
});

test("a touch sends pollen from an open flower to the buds round the finger, not to the one under it", () => {
  const s = make(2), bud = s.plants.find(p => p.open === 0 && p.hy > H * 0.75), x = bud.hx, y = bud.hy;
  const under = nearest(s, x, y);
  L.bloomTouch(s, x, y);
  assert.ok(s.motes.length > 2, "pollen in the air");
  for (const m of s.motes) {
    assert.ok(s.plants[m.from].open >= 1, "from an open flower");
    assert.notStrictEqual(s.plants[m.to], under, "not to the bud under the finger");
    assert.ok(Math.hypot(s.plants[m.to].hx - x, s.plants[m.to].hy - y) <= C.RING, "to buds round the finger");
  }
});

test("a bud opens only once help has reached it", () => {
  const s = make(3), bud = s.plants.find(p => p.open === 0 && p.hy > H * 0.75);
  L.bloomTouch(s, bud.hx, bud.hy);
  const target = s.plants[s.motes[0].to], arrive = s.motes[0].dur;
  run(s, arrive * 0.8);
  assert.strictEqual(target.open, 0, "still a bud while the pollen is on its way");
  run(s, arrive * 0.4 + C.OPEN);
  assert.ok(target.open > 0.5, "opening once it arrived");
});

test("an opened flower helps its own neighbours: one touch spreads through the meadow, multifold", () => {
  const s = make(4), bud = s.plants.find(p => p.open === 0 && p.hy > H * 0.75);
  L.bloomTouch(s, bud.hx, bud.hy);
  run(s, 8);
  const mid = share(s);
  run(s, 60);
  assert.ok(share(s) > 0.95, "the whole meadow in the end: " + share(s));
  assert.ok(mid < 0.75, "over time, not at once: " + mid);
});

test("nothing closes again", () => {
  const s = make(5);
  L.bloomTouch(s, W / 2, H * 0.8);
  let prev = s.plants.map(p => p.open);
  for (let k = 0; k < 30 * 20; k++) {
    L.bloomStep(s, 1 / 30);
    s.plants.forEach((p, i) => { assert.ok(p.open >= prev[i] && p.open <= 1); prev[i] = p.open; });
  }
});

test("the line comes into its colour as the meadow flourishes", () => {
  const s = make(6);
  const c0 = L.bloomColour(s);
  L.bloomTouch(s, W / 2, H * 0.8);
  let t10 = null, t90 = null, prev = c0;
  for (let k = 0; k < 30 * 70; k++) {
    L.bloomStep(s, 1 / 30);
    const c = L.bloomColour(s);
    assert.ok(c >= prev - 1e-12);
    if (t10 === null && c > 0.1) t10 = k / 30;
    if (t90 === null && c > 0.9) t90 = k / 30;
    prev = c;
  }
  assert.ok(c0 < 0.1 && t90 !== null && t90 - t10 >= 3, c0 + " " + t10 + " -> " + t90);
});

test("left alone, a breeze carries the first pollen", () => {
  const s = make(7);
  run(s, C.WAIT + 0.2);
  assert.ok(s.motes.length > 0 || s.plants.some(p => p.helped && p.open < 1));
});

test("the same seed is the same meadow; another is another", () => {
  const a = make(8), b = make(8), c = make(9);
  assert.deepStrictEqual(a.plants.slice(0, 10).map(p => [p.hx, p.hy]), b.plants.slice(0, 10).map(p => [p.hx, p.hy]));
  assert.notDeepStrictEqual(a.plants.slice(0, 10).map(p => [p.hx, p.hy]), c.plants.slice(0, 10).map(p => [p.hx, p.hy]));
});
