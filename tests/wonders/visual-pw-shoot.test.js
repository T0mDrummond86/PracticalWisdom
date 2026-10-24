"use strict";
// Shoot (tip #65, static/wonders/lib/visual-pw-shoot.js + ui/visual-pw-shoot.js) against the visuals
// contract and docs/wonders-plan.md: registration, house rules, and a shoot through snow: it only ever
// rises; the snow it shoulders aside is all still there, heaped and slumped, never lost; the snow's
// surface never breaks into a step (snow that slumps, never fractures); it comes through, a push helps
// it, and the green rises into the line from below, never all at once.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-shoot", NAME = "Shoot", PHRASE = "Keep going. Push through.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.SHOOT;
const FILES = ["static/wonders/lib/visual-" + ID + ".js", "static/wonders/ui/visual-" + ID + ".js"];
const VIEWPORTS = [[390, 844], [375, 812], [411, 777], [844, 390], [777, 411]];
const W = 300, H = 600;

test("registers on TH.VISUALS: id, name, the tip's line, grown in green, and placed clear of the edges", () => {
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

const make = seed => L.shootCreate({ seed, w: W, h: H });
const total = s => { let v = 0; for (const a of s.snow) v += a; return v; };
const lettered = s => {
  const inside = (x, y) => y >= 180 && y < 260 && x >= 60 && x < 240 && (x % 24) < 14;
  L.shootLetters(s, inside, { x: 60, y: 180, w: 180, h: 80 });
  return inside;
};

test("it only ever rises", () => {
  const s = make(1);
  lettered(s);
  let prev = s.tip;
  for (let k = 0; k < 30 * 40; k++) {
    if (k % 97 === 0) L.shootPush(s);
    L.shootStep(s, 1 / 30);
    assert.ok(s.tip >= prev, "the tip went down");
    prev = s.tip;
  }
});

test("the snow it shoulders aside is all still there", () => {
  const s = make(2), v0 = total(s);
  for (let k = 0; k < 30 * 20; k++) {
    L.shootStep(s, 1 / 30);
    assert.ok(Math.abs(total(s) - v0) < 1e-6 * v0, "snow lost or made: " + v0 + " -> " + total(s));
    for (const a of s.snow) assert.ok(a >= 0);
  }
});

test("snow slumps, never fractures: its surface never breaks into a step", () => {
  const s = make(3), dx = s.cell, limit = C.REPOSE * dx + 0.01;
  for (let k = 0; k < 30 * 20; k++) {
    L.shootStep(s, 1 / 30);
    for (let i = 0; i + 1 < s.cols; i++) {
      if (s.isShoot[i] || s.isShoot[i + 1]) continue;
      const d = Math.abs(L.shootSurface(s, i) - L.shootSurface(s, i + 1));
      assert.ok(d <= limit, "a step of " + d.toFixed(2) + " px between columns " + i + " and " + (i + 1));
    }
  }
});

test("it comes through the snow, and a push helps it", () => {
  const climb = pushed => {
    const s = make(4);
    for (let k = 0; k < 30 * 3; k++) { if (pushed && k % 10 === 0) L.shootPush(s); L.shootStep(s, 1 / 30); }
    return s.tip;
  };
  assert.ok(climb(true) > climb(false) * 1.3, climb(true) + " vs " + climb(false));
  const s = make(5);
  let through = null;
  for (let k = 0; k < 30 * 30 && through === null; k++) { L.shootStep(s, 1 / 30); if (s.through) through = k / 30; }
  assert.ok(through !== null, "through within half a minute");
  assert.ok(s.tip > s.depth0, "above where the snow lay");
});

test("the green rises into the line from below, never all at once", () => {
  const s = make(6), inside = lettered(s);
  let t10 = null, t90 = null, prev = 0;
  for (let k = 0; k < 30 * 60; k++) {
    L.shootStep(s, 1 / 30);
    const g = L.shootGreen(s);
    assert.ok(g >= prev - 1e-12, "green never goes back");
    if (t10 === null && g > 0.1) t10 = k / 30;
    if (t90 === null && g > 0.9) t90 = k / 30;
    prev = g;
  }
  assert.ok(t10 !== null && t90 !== null, "all of it in a minute: " + prev);
  assert.ok(t90 - t10 >= 3, "from below, over seconds: " + t10 + " -> " + t90);
  // and from below: when part is green, it is the lower part
  const s2 = make(6); lettered(s2);
  while (L.shootGreen(s2) < 0.4) L.shootStep(s2, 1 / 30);
  let lowGreen = 0, highGreen = 0;
  for (const c of s2.letterCells) { if (s2.green[c.i]) { if (c.y > 220) lowGreen++; else highGreen++; } }
  assert.ok(lowGreen > highGreen, "the lower half first: " + lowGreen + " vs " + highGreen);
  void inside;
});
