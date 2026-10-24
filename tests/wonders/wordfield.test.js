"use strict";
// The word field (lib/wordfield.js): a Wonder's line as a field its own material can make, avoid or
// reveal. The distance is a true distance, the points sit on letters, spread, ordered left to right,
// and lines wrap to the width.
const test = require("node:test");
const assert = require("node:assert");
const WF = require("../../static/wonders/wordfield.js");

test("distance: 0 on a letter, growing about one per cell away from it", () => {
  const gw = 9, gh = 5, m = new Uint8Array(gw * gh); m[2 * gw + 4] = 1;
  const d = WF.wordDistance(m, gw, gh);
  assert.strictEqual(d[2 * gw + 4], 0);
  assert.ok(Math.abs(d[2 * gw + 7] - 3) < 0.01, "three cells along");
  assert.ok(Math.abs(d[0] - Math.hypot(4, 2)) < 0.5, "diagonal near the true distance " + d[0]);
});

test("points sit on letters, spread across them, left to right, and vary with the seed", () => {
  const gw = 40, gh = 6, m = new Uint8Array(gw * gh);
  for (let x = 2; x < 38; x++) m[3 * gw + x] = 1;
  let s = 3; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const p = WF.wordPoints(m, gw, gh, 30, rand);
  assert.strictEqual(p.length, 30);
  for (const q of p) assert.ok(m[Math.floor(q.gy) * gw + Math.floor(q.gx)], "on a letter");
  for (let i = 1; i < p.length; i++) assert.ok(p[i].gx >= p[i - 1].gx, "left to right");
  assert.ok(p[0].gx < 6 && p[29].gx > 34, "spread from end to end");
  let s2 = 9; const r2 = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647;
  assert.notDeepStrictEqual(WF.wordPoints(m, gw, gh, 30, r2), p, "a new visit, new places within the letters");
});

test("a line wraps to the width it is given", () => {
  const lines = WF.wordWrap("No one leads. Everyone listens.", s => s.length * 10, 140);
  assert.ok(lines.length >= 2 && lines.every(l => l.length * 10 <= 140 || !l.includes(" ")), JSON.stringify(lines));
  assert.strictEqual(lines.join(" "), "No one leads. Everyone listens.");
});

