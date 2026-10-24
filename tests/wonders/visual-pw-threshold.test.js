"use strict";
// Threshold (tip #181, static/wonders/lib/visual-pw-threshold.js + ui/visual-pw-threshold.js) against
// the visuals contract and docs/wonders-plan.md: registration, house rules, and a door ajar at dawn:
// the wedge of light on the floor widens steadily as the door opens; dust in the air shows only inside
// the beam; and the door eases to the opening asked of it and never past fully open.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-threshold", NAME = "Threshold", PHRASE = "As soon as I wake up, go outside into the sun.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.THRESHOLD;
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

const make = seed => L.thresholdCreate({ seed, w: 390, h: 740 });
const run = (s, sec, dt = 1 / 30) => { for (let i = 0; i < Math.round(sec / dt); i++) L.thresholdStep(s, dt); };

test("the same seed is the same morning; another seed is another", () => {
  const a = make(1), b = make(1), c = make(2);
  assert.deepStrictEqual([a.sun, a.phi], [b.sun, b.phi]);
  assert.notDeepStrictEqual([a.sun, a.phi], [c.sun, c.phi]);
});

test("the wedge of light widens steadily as the door opens, from nothing when it is shut", () => {
  for (let seed = 1; seed < 8; seed++) {
    const s = make(seed);
    let prevW = -1, prevA = -1;
    for (let phi = 0; phi <= C.FULL + 1e-9; phi += C.FULL / 40) {
      const [xl, xr] = L.thresholdGap(s, phi), w = Math.max(0, xr - xl), a = L.thresholdWedge(s, phi);
      if (phi === 0) assert.ok(w < 1e-9 && a < 1e-9, "shut: no light");
      assert.ok(w >= prevW - 1e-12 && a >= prevA - 1e-12, "seed " + seed + " phi " + phi.toFixed(2));
      prevW = w; prevA = a;
    }
    assert.ok(prevW > 0.6 * s.door.width, "wide open lets most of the doorway's light in");
  }
});

test("dust shows only inside the beam", () => {
  const s = make(3);
  s.phi = s.target = C.FULL * 0.6;
  run(s, 2);
  let lit = 0;
  for (const m of s.motes) {
    assert.strictEqual(m.lit, L.thresholdLit(s, m.x, m.y, m.z));
    if (m.lit) lit++;
  }
  assert.ok(lit > 10 && lit < s.motes.length, "some in the light, not all: " + lit);
  // a point just inside the open doorway, at waist height, is in the light; one behind the door is not
  const [xl, xr] = L.thresholdGap(s, s.phi);
  assert.ok(L.thresholdLit(s, (xl + xr) / 2 + 0.3 * s.sun.drift, 0.3, 1.0 - 0.3 * s.sun.drop));
  assert.ok(!L.thresholdLit(s, s.door.x0 - 0.3, 0.3, 1.0));
  // shut the door and the room goes dark: nothing lit anywhere
  s.phi = s.target = 0; run(s, 0.1);
  assert.ok(s.motes.every(m => !m.lit));
});

test("the door eases to the opening asked of it, and never past fully open", () => {
  const s = make(4);
  let prev = s.phi;
  for (let k = 0; k < 20; k++) {
    L.thresholdOpen(s);
    for (let j = 0; j < 20; j++) {
      L.thresholdStep(s, 1 / 30);
      assert.ok(s.phi >= prev - 1e-12, "it does not swing back");
      assert.ok(s.phi <= s.target + 1e-12 && s.phi <= C.FULL + 1e-12, "no overshoot");
      prev = s.phi;
    }
  }
  run(s, 5);
  assert.ok(Math.abs(s.phi - C.FULL) < 1e-3, "fully open in the end: " + s.phi);
});
