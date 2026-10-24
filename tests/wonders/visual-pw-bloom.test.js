"use strict";
// Bloom (tip #3, static/wonders/lib/visual-pw-bloom.js + ui/visual-pw-bloom.js) against the visuals
// contract and docs/wonders-plan.md: registration, house rules, and a bed of seedlings: a touch opens
// the plants in a ring round it and leaves the one under the finger as it was; a plant that has opened
// helps its own neighbours open, so one touch spreads through the bed; nothing closes again; the line,
// planted in another colour, shows only as its plants bloom; and left alone, someone else helps.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-bloom", NAME = "Bloom", PHRASE = "Help others to flourish.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.BLOOM;
const FILES = ["static/wonders/lib/visual-" + ID + ".js", "static/wonders/ui/visual-" + ID + ".js"];
const VIEWPORTS = [[390, 844], [375, 812], [411, 777], [844, 390], [777, 411]];
const W = 260, H = 300;

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

const make = seed => L.bloomCreate({ seed, w: W, h: H });
const run = (s, sec, dt = 1 / 30) => { for (let i = 0; i < Math.round(sec / dt); i++) L.bloomStep(s, dt); };
const dist = (s, i, x, y) => Math.hypot(s.x[i] - x, s.y[i] - y);

test("a touch opens the plants in a ring round it, and leaves the one under the finger as it was", () => {
  const s = make(1), x = 130, y = 150;
  L.bloomTouch(s, x, y);
  let ring = 0;
  for (let i = 0; i < s.n; i++) {
    const d = dist(s, i, x, y);
    if (d <= C.INNER) assert.ok(!s.helped[i], "the plant under the finger is not the one helped");
    else if (d <= C.OUTER) { assert.ok(s.helped[i], "a plant in the ring is helped"); ring++; }
    else assert.ok(!s.helped[i], "beyond the ring, not yet");
  }
  assert.ok(ring > 20, "a ring of plants: " + ring);
  run(s, 0.6);
  for (let i = 0; i < s.n; i++) {
    const d = dist(s, i, x, y);
    if (d <= C.INNER) assert.strictEqual(s.open[i], 0, "under the finger, still a seedling");
    else if (d <= C.OUTER) assert.ok(s.open[i] > 0, "round it, opening");
  }
});

test("nothing closes again", () => {
  const s = make(2);
  L.bloomTouch(s, 80, 80);
  let prev = Float32Array.from(s.open);
  for (let k = 0; k < 30 * 20; k++) {
    if (k === 200) L.bloomTouch(s, 200, 220);
    L.bloomStep(s, 1 / 30);
    for (let i = 0; i < s.n; i++) assert.ok(s.open[i] >= prev[i] && s.open[i] <= 1);
    prev = Float32Array.from(s.open);
  }
});

test("a plant that has opened helps its neighbours open: one touch spreads through the bed", () => {
  const s = make(3);
  L.bloomTouch(s, 130, 150);
  run(s, 8);
  const share = () => { let n = 0; for (let i = 0; i < s.n; i++) if (s.open[i] > 0.5) n++; return n / s.n; };
  const mid = share();
  run(s, 60);
  assert.ok(share() > 0.95, "the whole bed in the end: " + share());
  assert.ok(mid < 0.7, "over time, not at once: " + mid);
  // and the plant that was under the finger flourished too, in its turn
  let under = -1, bd = Infinity;
  for (let i = 0; i < s.n; i++) { const d = dist(s, i, 130, 150); if (d < bd) { bd = d; under = i; } }
  assert.ok(s.open[under] > 0.5);
});

test("the line, planted in another colour, shows only as its plants bloom", () => {
  const s = make(4);
  const inside = (x, y) => y > 120 && y < 150 && x > 40 && x < 220 && (x % 20) < 12;
  L.bloomLetters(s, inside);
  assert.ok(s.letterPlants.length > 30);
  assert.strictEqual(L.bloomShown(s), 0, "all seedlings look alike at first");
  L.bloomTouch(s, 30, 30);
  let t10 = null, t90 = null;
  for (let k = 0; k < 30 * 80; k++) {
    L.bloomStep(s, 1 / 30);
    const sh = L.bloomShown(s);
    if (t10 === null && sh > 0.1) t10 = k / 30;
    if (t90 === null && sh > 0.9) t90 = k / 30;
  }
  assert.ok(t10 !== null && t90 !== null && t90 - t10 >= 3, "it fills in over seconds: " + t10 + " -> " + t90);
});

test("left alone, someone else helps", () => {
  const s = make(5);
  run(s, C.WAIT + 1);
  let any = false;
  for (let i = 0; i < s.n; i++) if (s.open[i] > 0) any = true;
  assert.ok(any);
});

test("the same seed is the same bed; another is another", () => {
  const a = make(6), b = make(6), c = make(7);
  assert.deepStrictEqual(Array.from(a.x.slice(0, 30)), Array.from(b.x.slice(0, 30)));
  assert.notDeepStrictEqual(Array.from(a.x.slice(0, 30)), Array.from(c.x.slice(0, 30)));
});
