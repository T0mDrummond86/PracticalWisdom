"use strict";
// Pencil (tip #39, static/wonders/lib/visual-pw-pencil.js + ui/visual-pw-pencil.js) against the
// visuals contract and docs/wonders-plan.md: registration, house rules, and the physics of graphite
// on paper: the tooth is the paper's own (fixed per seed, different per seed); lead catches the high
// points and skips the valleys, more of them the harder you press; what is written stays; a stroke
// leaves no gaps; and the line, written stroke by stroke, ends up legible and inside its letters.
const test = require("node:test");
const assert = require("node:assert");
const { houseRules } = require("./house.js");
const ID = "pw-pencil", NAME = "Pencil", PHRASE = "The bluntest pencil is sharper than the sharpest memory.";
const L = require("../../static/wonders/lib/visual-" + ID + ".js");
const C = L.PENCIL;
const FILES = ["static/wonders/lib/visual-" + ID + ".js", "static/wonders/ui/visual-" + ID + ".js"];
const VIEWPORTS = [[390, 844], [375, 812], [411, 777], [844, 390], [777, 411]];

test("registers on TH.VISUALS: id, name, the tip's line, written in, and placed clear of the edges", () => {
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

const make = (seed, w = 200, h = 120) => L.pencilCreate({ seed, w, h });

test("the tooth is the paper's own: in [0, 1], fixed per seed, different per seed", () => {
  const a = make(1), b = make(1), c = make(2);
  let same = 0, diff = 0;
  for (let y = 2; y < 118; y += 7) for (let x = 2; x < 198; x += 5) {
    const t = L.pencilTooth(a, x, y);
    assert.ok(t >= 0 && t <= 1, String(t));
    if (t === L.pencilTooth(b, x, y)) same++;
    if (t !== L.pencilTooth(c, x, y)) diff++;
  }
  const n = Math.ceil(116 / 7) * Math.ceil(196 / 5);
  assert.strictEqual(same, n);
  assert.ok(diff > n * 0.9, diff + "/" + n);
});

test("lead catches the high points and skips the valleys", () => {
  const s = make(3);
  L.pencilDeposit(s, 100, 60, 0.6, 12);
  let hit = 0, inDisc = 0;
  for (let i = 0; i < s.g.length; i++) {
    const cx = (i % s.gw + 0.5) * s.cell, cy = (Math.floor(i / s.gw) + 0.5) * s.cell;
    if (Math.hypot(cx - 100, cy - 60) > 12) { assert.strictEqual(s.g[i], 0, "nothing outside the nib"); continue; }
    inDisc++;
    if (s.tooth[i] <= 1 - 0.6) assert.strictEqual(s.g[i], 0, "a valley stays bare");
    else if (s.g[i] > 0) hit++;
  }
  // pressing at 0.6 reaches about 60% of the paper under the nib (the tooth is rank-even)
  assert.ok(hit / inDisc > 0.45 && hit / inDisc < 0.7, hit + "/" + inDisc);
});

test("pressing harder reaches further into the grain", () => {
  const cover = p => { const s = make(4); L.pencilDeposit(s, 100, 60, p, 14); let n = 0; for (const v of s.g) if (v > 0) n++; return n; };
  assert.ok(cover(0.3) < cover(0.6) && cover(0.6) < cover(0.9));
});

test("what is written stays: graphite accumulates and never decreases", () => {
  const s = make(5);
  let prev = Float32Array.from(s.g);
  for (let k = 0; k < 40; k++) {
    L.pencilStroke(s, [[30 + k * 3, 20], [60 + k * 2, 100]], 0.4 + (k % 5) * 0.1, 2.5);
    for (let i = 0; i < s.g.length; i++) assert.ok(s.g[i] >= prev[i] && s.g[i] <= 1);
    prev = Float32Array.from(s.g);
  }
});

test("a stroke leaves no gap wider than one tooth cell", () => {
  const s = make(6);
  L.pencilStroke(s, [[10, 61], [190, 61]], 1, 2);
  const row = Math.floor(61 / s.cell);
  let gap = 0, worst = 0;
  for (let cx = Math.ceil(12 / s.cell); cx < Math.floor(188 / s.cell); cx++) {
    let any = false;
    for (let dy = -1; dy <= 1; dy++) if (s.g[(row + dy) * s.gw + cx] > 0) any = true;
    gap = any ? 0 : gap + 1; worst = Math.max(worst, gap);
  }
  assert.ok(worst <= 1, "longest gap " + worst + " cells");
});

// a word field as wordfield.js would hand it: two bars of "letters" on two lines
function fakeField() {
  const cell = 3, gw = 60, gh = 24, mask = new Uint8Array(gw * gh);
  // strokes two cells thick, as type is at this size: line 1, four rings (an "o" each); line 2, a bar and a stem
  for (let y = 2; y < 10; y++) for (let x = 4; x < 52; x++) {
    const u = x % 12, ring = u < 9 && (u < 2 || u > 6 || y < 4 || y > 7);
    if (ring) mask[y * gw + x] = 1;
  }
  for (let y = 16; y < 18; y++) for (let x = 6; x < 50; x++) mask[y * gw + x] = 1;
  for (let y = 12; y < 23; y++) for (let x = 30; x < 32; x++) mask[y * gw + x] = 1;
  return { cell, gw, gh, mask, lines: ["a", "b"], rect: { x: 10, y: 20, w: gw * cell, h: gh * cell } };
}

test("the letters thin to strokes that keep their shape and their order: one line, then the next, left to right", () => {
  const f = fakeField();
  const skel = L.pencilThin(f.mask, f.gw, f.gh);
  let n = 0;
  for (let i = 0; i < skel.length; i++) if (skel[i]) { n++; assert.ok(f.mask[i], "skeleton inside the letters"); }
  assert.ok(n > 40, "skeleton " + n);
  const paths = L.pencilTrace(skel, f.gw, f.gh, f.lines.length);
  let covered = 0; for (const p of paths) covered += p.length;
  assert.strictEqual(covered, n, "every skeleton cell traced exactly once");
  const firstLine2 = paths.findIndex(p => p[0][1] >= 12);
  assert.ok(firstLine2 > 0 && paths.slice(firstLine2).every(p => p[0][1] >= 12), "line 1 before line 2");
  const line1 = paths.slice(0, firstLine2).map(p => Math.min(...p.map(q => q[0])));
  assert.deepStrictEqual(line1, line1.slice().sort((a, b) => a - b), "left to right");
});

test("the line is written over a few seconds, stroke by stroke, and ends legible and inside its letters", () => {
  const f = fakeField();
  const s = L.pencilCreate({ seed: 9, w: 220, h: 120 });
  const wr = L.pencilWriter(s, f, 9);
  assert.ok(wr.duration >= 2 && wr.duration <= 6, "duration " + wr.duration);
  L.pencilWrite(s, wr, wr.duration * 0.4);
  const mid = L.pencilWriteCoverage(s, f);
  assert.ok(!wr.done && mid > 0.05 && mid < 0.8, "part-written " + mid);
  for (let k = 0; k < 200 && !wr.done; k++) L.pencilWrite(s, wr, 1 / 30);
  assert.ok(wr.done);
  const cov = L.pencilWriteCoverage(s, f);
  assert.ok(cov > 0.5, "letters covered " + cov);
  // nothing strays: graphite only within a nib's width of the letters
  const reach = wr.radius + 2 * f.cell;
  for (let i = 0; i < s.g.length; i++) {
    if (!s.g[i]) continue;
    const x = (i % s.gw + 0.5) * s.cell - f.rect.x, y = (Math.floor(i / s.gw) + 0.5) * s.cell - f.rect.y;
    let near = false;
    for (let gy = Math.max(0, Math.floor((y - reach) / f.cell)); gy <= Math.min(f.gh - 1, Math.floor((y + reach) / f.cell)) && !near; gy++)
      for (let gx = Math.max(0, Math.floor((x - reach) / f.cell)); gx <= Math.min(f.gw - 1, Math.floor((x + reach) / f.cell)); gx++)
        if (f.mask[gy * f.gw + gx]) { near = true; break; }
    assert.ok(near, "graphite at " + x.toFixed(1) + "," + y.toFixed(1) + " is not near a letter");
  }
});
