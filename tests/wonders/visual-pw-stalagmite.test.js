"use strict";
// Stalagmite (tip #12, static/wonders/lib/visual-pw-stalagmite.js + ui/visual-pw-stalagmite.js) against
// the visuals contract and docs/wonders-plan.md: registration, house rules, and mineral laid down drop
// by drop: each drop leaves a ring of mineral and takes none away; the line's letters build up drop on
// drop, a little more with each, never whole after one and never all at once; and a touch lets a drop
// fall there now.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-stalagmite", NAME = "Stalagmite", PHRASE = "Big success is tiny successes building on each other.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.STALAGMITE;
const FILES = ["static/wonders/lib/visual-" + ID + ".js", "static/wonders/ui/visual-" + ID + ".js"];
const VIEWPORTS = [[390, 844], [375, 812], [411, 777], [844, 390], [777, 411]];
const W = 240, H = 200;

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

const make = seed => L.stalagmiteCreate({ seed, w: W, h: H });
const total = s => { let v = 0; for (const m of s.mass) v += m; return v; };
// letters as the word field would give them: two bars and a ring, sampled into drip points
function letters(s) {
  const inside = (x, y) => (y >= 60 && y < 66 && x >= 30 && x < 210) || (y >= 100 && y < 106 && x >= 50 && x < 190) || (Math.abs(Math.hypot(x - 120, y - 150) - 20) < 3);
  const pts = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (inside(x, y)) pts.push({ x: x + 0.5, y: y + 0.5 });
  L.stalagmiteLetters(s, pts, inside);
  return inside;
}

test("each drop leaves a ring of mineral and takes none away", () => {
  const s = make(1);
  let prev = Float32Array.from(s.mass), t0 = total(s);
  for (let k = 0; k < 50; k++) {
    L.stalagmiteDrop(s, 30 + k * 3.7, 40 + (k % 7) * 15);
    const t1 = total(s);
    assert.ok(t1 > t0, "a drop adds mineral");
    for (let i = 0; i < s.mass.length; i++) assert.ok(s.mass[i] >= prev[i], "nothing taken away");
    prev = Float32Array.from(s.mass); t0 = t1;
  }
  // a ring: more mineral at the rim of the splash than right under the drop
  const r = make(2), x = 120, y = 100;
  L.stalagmiteDrop(r, x, y, 2.5);
  const at = (dx, dy) => r.mass[Math.floor((y + dy) / r.cell) * r.gw + Math.floor((x + dx) / r.cell)];
  assert.ok(at(2.5, 0) > at(0, 0) && at(-2.5, 0) > at(0, 0) && at(0, 2.5) > at(0, 0), "a ring, not a dot");
});

test("the letters build up drop on drop: never whole after one, never all at once", () => {
  const s = make(3);
  letters(s);
  const c0 = L.stalagmiteCoverage(s);
  L.stalagmiteDrop(s, s.drips[0].x, s.drips[0].y);
  assert.ok(L.stalagmiteCoverage(s) < 0.05 && L.stalagmiteCoverage(s) >= c0, "not whole after one");
  let prev = L.stalagmiteCoverage(s), t10 = null, t90 = null;
  for (let k = 0; k < 30 * 90; k++) {
    L.stalagmiteStep(s, 1 / 30);
    const c = L.stalagmiteCoverage(s);
    assert.ok(c >= prev - 1e-12, "coverage never falls");
    if (t10 === null && c > 0.1) t10 = k / 30;
    if (t90 === null && c > 0.9) t90 = k / 30;
    prev = c;
  }
  assert.ok(t10 !== null && t90 !== null, "it builds the whole line in a minute and a half: " + prev);
  assert.ok(t90 - t10 >= 8, "gradually: 10% at " + t10 + " s, 90% at " + t90 + " s");
});

test("the mineral stays where the letters are", () => {
  const s = make(4), inside = letters(s);
  for (let k = 0; k < 30 * 40; k++) L.stalagmiteStep(s, 1 / 30);
  let near = 0, far = 0;
  for (let i = 0; i < s.mass.length; i++) {
    if (s.mass[i] < 0.05) continue;
    const x = (i % s.gw + 0.5) * s.cell, y = (Math.floor(i / s.gw) + 0.5) * s.cell;
    let close = false;
    for (let dy = -5; dy <= 5 && !close; dy++) for (let dx = -5; dx <= 5; dx++) if (inside(x + dx, y + dy)) { close = true; break; }
    if (close) near++; else far++;
  }
  assert.ok(far === 0, "mineral away from the letters: " + far);
});

test("a touch lets a drop fall there now", () => {
  const s = make(5), at = () => s.mass[Math.floor(150 / s.cell) * s.gw + Math.floor((60 + 2.2) / s.cell)];
  const before = at();
  L.stalagmiteTouch(s, 60, 150);
  assert.ok(at() > before, "mineral where the finger is, at once");
  assert.ok(s.splashes.some(p => Math.hypot(p.x - 60, p.y - 150) < 2), "and the splash shows");
});

test("the same seed is the same cave; another is another", () => {
  const a = make(6), b = make(6), c = make(7);
  letters(a); letters(b); letters(c);
  for (let k = 0; k < 60; k++) { L.stalagmiteStep(a, 1 / 30); L.stalagmiteStep(b, 1 / 30); L.stalagmiteStep(c, 1 / 30); }
  assert.deepStrictEqual(Array.from(a.mass.slice(4000, 4400)), Array.from(b.mass.slice(4000, 4400)));
  assert.notDeepStrictEqual(a.drips.map(d => d.next), c.drips.map(d => d.next));
});
