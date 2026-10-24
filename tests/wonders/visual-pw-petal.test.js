"use strict";
// Petal (tip #107, static/wonders/lib/visual-pw-petal.js + ui/visual-pw-petal.js) against the visuals
// contract and docs/wonders-plan.md: registration, house rules, and a petal on a brimful pool: a ripple
// pushes it away from where it began; unforced it comes back to the top of the water's dome; it never
// leaves the pool; and it comes to rest off the line, so the line can be read.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-petal", NAME = "Petal", PHRASE = "Whenever my mind wanders off, bring it back.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.PETAL;
const FILES = ["static/wonders/lib/visual-" + ID + ".js", "static/wonders/ui/visual-" + ID + ".js"];
const VIEWPORTS = [[390, 844], [375, 812], [411, 777], [844, 390], [777, 411]];
const W = 390, H = 740;

let V = null;
test("registers on TH.VISUALS: id, name, the tip's line, on the water, and placed clear of the edges", () => {
  const before = globalThis.TH;
  globalThis.TH = {};
  try {
    const p = require.resolve("../../static/wonders/ui/visual-" + ID + ".js");
    delete require.cache[p];
    require(p);
    const v = globalThis.TH.VISUALS && globalThis.TH.VISUALS[ID];
    V = v;
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

const make = seed => L.petalCreate({ seed, w: W, h: H });
const run = (s, sec, dt = 1 / 30) => { for (let i = 0; i < Math.round(sec / dt); i++) L.petalStep(s, dt); };
const off = s => Math.hypot(s.x - s.home.x, s.y - s.home.y);

test("it rests off the line, so the line can be read", () => {
  for (const [w, h] of VIEWPORTS.concat([[390, 697], [844, 287]])) {
    const home = L.petalHome(w, h), o = V.wordsAt(w, h);
    const lines = 3, bottom = o.at.y + o.size * 1.22 * lines / 2 + o.size * 0.25;
    assert.ok(home.y - C.SIZE > bottom, w + "x" + h + ": home " + home.y + " under the line's foot " + bottom);
  }
});

test("a ripple pushes it away from where the ripple began", () => {
  const s = make(1);
  run(s, 20);
  const x0 = s.x;
  L.petalRipple(s, s.x - 40, s.y);
  let most = 0;
  for (let k = 0; k < 30 * 3; k++) { L.petalStep(s, 1 / 30); most = Math.max(most, s.x - x0); }
  assert.ok(most > 15, "pushed away: " + most);
});

test("unforced, it comes back to the top of the dome", () => {
  const s = make(2);
  run(s, 2);
  L.petalRipple(s, s.home.x + 30, s.home.y + 20);
  L.petalRipple(s, s.home.x - 50, s.home.y - 10);
  run(s, 2);
  const away = off(s);
  assert.ok(away > 10, "it was sent off: " + away);
  run(s, 25);
  assert.ok(off(s) < 5, "back: " + off(s));
});

test("it never leaves the pool", () => {
  const s = make(3);
  for (let k = 0; k < 400; k++) {
    if (k % 3 === 0) L.petalRipple(s, s.x + (k % 2 ? 6 : -6), s.y + (k % 5) - 2);
    L.petalStep(s, 1 / 30);
    assert.ok(s.x >= C.EDGE && s.x <= W - C.EDGE && s.y >= C.EDGE && s.y <= H - C.EDGE, s.x + "," + s.y);
  }
});

test("the same seed is the same pool; another is another", () => {
  const a = make(4), b = make(4), c = make(5);
  run(a, 3); run(b, 3); run(c, 3);
  assert.deepStrictEqual([a.x, a.y, a.angle], [b.x, b.y, b.angle]);
  assert.notDeepStrictEqual([a.x, a.y, a.angle, a.hue], [c.x, c.y, c.angle, c.hue]);
});
