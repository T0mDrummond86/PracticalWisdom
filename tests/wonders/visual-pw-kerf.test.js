"use strict";
// Kerf (tip #20, static/wonders/lib/visual-pw-kerf.js + ui/visual-pw-kerf.js) against the visuals
// contract and docs/wonders-plan.md: registration, house rules, and a board measured twice and cut
// once: the grain is the board's own; the first two touches only mark it, and the third cuts along the
// mean of the two marks; nothing moves until the saw does; the sawdust falls with gravity and comes to
// rest; the line shows where the dust has gone, all of it once the board has been cut; and left alone,
// a hand measures twice and cuts once by itself.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-kerf", NAME = "Kerf", PHRASE = "Measure twice, cut once.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.KERF;
const FILES = ["static/wonders/lib/visual-" + ID + ".js", "static/wonders/ui/visual-" + ID + ".js"];
const VIEWPORTS = [[390, 844], [375, 812], [411, 777], [844, 390], [777, 411]];
const W = 300, H = 500;

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

const make = seed => L.kerfCreate({ seed, w: W, h: H });
const run = (s, sec, dt = 1 / 30) => { for (let i = 0; i < Math.round(sec / dt); i++) L.kerfStep(s, dt); };
const dust = s => { let v = 0; for (const d of s.dust) v += d; return v; };
const lettered = s => {
  const b = s.board;
  L.kerfLetters(s, (x, y) => (y > b.y0 + 40 && y < b.y1 - 40 && x > 40 && x < W - 40 && (x % 30) < 18));
};

test("the grain is the board's own: fixed per seed, different per seed", () => {
  const a = make(1), b = make(1), c = make(2);
  let same = 0, diff = 0, n = 0;
  for (let y = a.board.y0 + 2; y < a.board.y1; y += 9) for (let x = 2; x < W; x += 13) {
    n++;
    if (L.kerfGrain(a, x, y) === L.kerfGrain(b, x, y)) same++;
    if (L.kerfGrain(a, x, y) !== L.kerfGrain(c, x, y)) diff++;
  }
  assert.strictEqual(same, n);
  assert.ok(diff > n * 0.9);
});

test("measure twice, cut once: the first two touches mark, the third cuts along the mean of the marks", () => {
  const s = make(3), y = (s.board.y0 + s.board.y1) / 2;
  assert.strictEqual(L.kerfTouch(s, 120, y), "mark");
  assert.strictEqual(s.cut, null);
  assert.strictEqual(L.kerfTouch(s, 126, y), "mark");
  assert.strictEqual(s.cut, null);
  assert.deepStrictEqual(s.marks.map(m => m.x), [120, 126]);
  assert.strictEqual(L.kerfTouch(s, 260, y), "cut");
  assert.ok(s.cut && s.cut.x === 123, "along the mean of the marks, not where the third touch fell: " + (s.cut && s.cut.x));
});

test("nothing moves until the saw does", () => {
  const s = make(4), d0 = dust(s), y = (s.board.y0 + s.board.y1) / 2;
  L.kerfTouch(s, 100, y); run(s, 1);
  L.kerfTouch(s, 104, y); run(s, 1);
  assert.strictEqual(dust(s), d0);
  assert.strictEqual(s.grains.length, 0);
});

test("the sawdust falls with gravity and comes to rest", () => {
  const s = make(5), y = (s.board.y0 + s.board.y1) / 2;
  L.kerfTouch(s, 140, y); L.kerfTouch(s, 146, y); L.kerfTouch(s, 146, y);
  let seen = 0;
  const lastY = new Map();
  for (let k = 0; k < 30 * 4; k++) {
    L.kerfStep(s, 1 / 30);
    for (const g of s.grains) {
      seen++;
      if (lastY.has(g)) assert.ok(g.y >= lastY.get(g) - 1e-9, "a grain went up");
      lastY.set(g, g.y);
    }
  }
  assert.ok(seen > 0, "the cut throws sawdust");
  run(s, 20);
  assert.ok(s.grains.every(g => g.still || g.y > s.h), "all at rest or off the board");
  const d = dust(s); run(s, 3);
  assert.strictEqual(dust(s), d, "the dust has settled");
});

test("the line shows only where the dust has gone, and all of it once the board is cut", () => {
  const s = make(6);
  lettered(s);
  assert.ok(L.kerfLettersShown(s) < 0.05, "hidden under the dust at first");
  const y = (s.board.y0 + s.board.y1) / 2;
  L.kerfTouch(s, 150, y); L.kerfTouch(s, 154, y); L.kerfTouch(s, 154, y);
  let t10 = null, t90 = null;
  for (let k = 0; k < 30 * 20; k++) {
    L.kerfStep(s, 1 / 30);
    for (let i = 0; i < s.dust.length; i++) if (L.kerfShown(s, i) > 0.5) assert.ok(s.dust[i] < C.CLEAR, "shown under dust " + s.dust[i]);
    const sh = L.kerfLettersShown(s);
    if (t10 === null && sh > 0.1) t10 = k / 30;
    if (t90 === null && sh > 0.9) t90 = k / 30;
  }
  assert.ok(L.kerfLettersShown(s) > 0.95, "all of it: " + L.kerfLettersShown(s));
  assert.ok(t90 - t10 >= 2, "over seconds, not at once: " + t10 + " -> " + t90);
});

test("left alone, a hand measures twice and cuts once by itself", () => {
  const s = make(7);
  const kinds = [];
  let prev = 0;
  for (let k = 0; k < 30 * 14; k++) {
    L.kerfStep(s, 1 / 30);
    if (s.marks.length + (s.cut ? 1 : 0) !== prev) { prev = s.marks.length + (s.cut ? 1 : 0); kinds.push(s.cut ? "cut" : "mark"); }
  }
  assert.deepStrictEqual(kinds, ["mark", "mark", "cut"]);
  assert.ok(Math.abs(s.cut.x - (s.marks[0].x + s.marks[1].x) / 2) < 1e-9);
});
