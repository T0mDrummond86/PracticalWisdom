"use strict";
// Swing (tip #122, static/wonders/lib/visual-pw-swing.js + ui/visual-pw-swing.js) against the visuals
// contract and docs/wonders-plan.md: registration, house rules, and a swing as a pendulum: left alone
// it keeps its energy (within 1% over twenty swings); a push adds energy and it climbs higher; it is
// fastest through the bottom and slowest at the top; and the higher it climbs, the longer it hangs there.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-swing", NAME = "Swing", PHRASE = "Life is swings and roundabouts.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.SWING;
const FILES = ["static/wonders/lib/visual-" + ID + ".js", "static/wonders/ui/visual-" + ID + ".js"];
const VIEWPORTS = [[390, 844], [375, 812], [411, 777], [844, 390], [777, 411]];

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

const make = (seed, amp) => { const s = L.swingCreate({ seed, w: 390, h: 740 }); if (amp != null) { s.theta = amp; s.omega = 0; } return s; };
const run = (s, sec, dt = 1 / 30) => { for (let i = 0; i < Math.round(sec / dt); i++) L.swingStep(s, dt); };

test("the same seed is the same swing; another seed is another", () => {
  const a = make(1), b = make(1), c = make(2);
  run(a, 3); run(b, 3); run(c, 3);
  assert.strictEqual(a.theta, b.theta);
  assert.notStrictEqual(a.theta, c.theta);
});

test("left alone it keeps its energy: within 1% over twenty swings", () => {
  for (const amp of [0.3, 0.8, 1.2]) {
    const s = make(3, amp), e0 = L.swingEnergy(s);
    run(s, 20 * s.period);
    const e = L.swingEnergy(s);
    assert.ok(Math.abs(e - e0) / Math.abs(e0 + s.G) < 0.01, amp + ": " + e0 + " -> " + e);
    assert.ok(Math.abs(L.swingAmplitude(s) - amp) < 0.01 * amp + 1e-3, "same height: " + L.swingAmplitude(s));
  }
});

test("a push adds energy, and it climbs higher", () => {
  const s = make(4, 0.5);
  run(s, 0.3);
  const e0 = L.swingEnergy(s), a0 = L.swingAmplitude(s);
  L.swingPush(s);
  assert.ok(L.swingEnergy(s) > e0);
  run(s, 2 * s.period);
  assert.ok(L.swingAmplitude(s) > a0 + 0.05, a0 + " -> " + L.swingAmplitude(s));
});

test("pushes never send it over the top", () => {
  const s = make(5, 0.5);
  for (let k = 0; k < 60; k++) { L.swingPush(s); run(s, 0.4); }
  assert.ok(L.swingAmplitude(s) <= C.MAX_ARC + 1e-6, String(L.swingAmplitude(s)));
});

test("fastest through the bottom, slowest at the top", () => {
  const s = make(6, 1.0);
  let atBottom = 0, atTop = Infinity;
  for (let k = 0; k < 30 * 2 * s.period; k++) {
    L.swingStep(s, 1 / 30);
    if (Math.abs(s.theta) < 0.05) atBottom = Math.max(atBottom, Math.abs(s.omega));
    if (Math.abs(s.theta) > 0.95) atTop = Math.min(atTop, Math.abs(s.omega));
  }
  assert.ok(atBottom > 3 * atTop, atBottom + " vs " + atTop);
});

test("the higher it climbs, the longer it hangs at the top", () => {
  // the time in each swing spent in the top tenth of its own climb
  const hang = amp => {
    const s = make(7, amp), top = 1 - Math.cos(amp);
    let t = 0;
    const dt = 1 / 240;
    for (let k = 0; k < Math.round(s.period * 4 / dt); k++) { L.swingStep(s, dt); if (1 - Math.cos(s.theta) > 0.9 * top) t += dt; }
    return t / 8;   // per half-swing
  };
  const low = hang(0.4), mid = hang(0.9), high = hang(1.3);
  assert.ok(low < mid && mid < high, low + " < " + mid + " < " + high);
});
