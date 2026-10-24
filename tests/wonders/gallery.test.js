"use strict";
// The ten tip Wonders as a set (static/wonders/catalogue.js) and the gallery's pure pieces
// (static/wonders/gallery.js): the order is the build order of docs/wonders-plan.md, each Wonder
// has its own voice, each finds its own tip by id and phrase, and the gallery moves and opens
// the way it says.
const test = require("node:test");
const assert = require("node:assert");
const C = require("../../static/wonders/catalogue.js");
globalThis.TH = Object.assign(globalThis.TH || {}, C);
const G = require("../../static/wonders/gallery.js");

const ORDER = ["pw-pencil", "pw-reduction", "pw-filings", "pw-kerf", "pw-swing", "pw-threshold", "pw-stalagmite", "pw-shoot", "pw-bloom", "pw-petal"];
const FONTS = ["fraunces", "cormorant", "fell", "instrument", "playfair", "caveat", "josefin", "outfit", "syne", "shippori"];

test("the ten, in the plan's build order", () => {
  assert.deepStrictEqual(C.WONDER_ORDER, ORDER);
});

test("every Wonder speaks in a house font, and no two share one", () => {
  const used = ORDER.map(id => C.wonderFont(id).font);
  assert.ok(used.every(f => FONTS.includes(f)), used.join(","));
  assert.strictEqual(new Set(used).size, 10);
  // italic only where the font has its own
  for (const id of ORDER) assert.strictEqual(C.wonderFont(id).italic, ["fraunces", "instrument"].includes(C.wonderFont(id).font), id);
});

const tips = [
  { id: 39, content: "Write it down. The bluntest pencil is sharper than the sharpest memory", anecdote: "" },
  { id: 86, content: "Boil things down to their essence.", anecdote: "Keep drilling down." },
  { id: 5, content: "Something else entirely.", anecdote: "" },
  { id: 300, content: "Measure twice, cut once.", anecdote: "Double-check." },
];

test("a Wonder finds its tip by id when the id holds the right words", () => {
  assert.strictEqual(C.tipForWonder(tips, "pw-pencil").id, 39);
  assert.strictEqual(C.tipForWonder(tips, "pw-reduction").id, 86);
});

test("where the ids differ (a local copy, a re-import) it finds the tip by its words, and never a wrong one", () => {
  assert.strictEqual(C.tipForWonder(tips, "pw-kerf").id, 300);      // live id 20, here 300
  const moved = [{ id: 20, content: "A different tip now", anecdote: "" }];
  assert.strictEqual(C.tipForWonder(moved, "pw-kerf"), null);       // id 20 is not "measure twice"
  assert.strictEqual(C.tipForWonder(tips, "pw-swing"), null);
  assert.strictEqual(C.tipForWonder(tips, "no-such"), null);
});

test("a tip knows its Wonder; most tips have none", () => {
  assert.strictEqual(C.wonderForTip(tips[0]), "pw-pencil");
  assert.strictEqual(C.wonderForTip(tips[3]), "pw-kerf");
  assert.strictEqual(C.wonderForTip(tips[2]), null);
  assert.strictEqual(C.wonderForTip({ id: 1 }), null);
});

test("the arrows wrap both ways", () => {
  assert.strictEqual(G.wonderNeighbour(ORDER, "pw-petal", 1), "pw-pencil");
  assert.strictEqual(G.wonderNeighbour(ORDER, "pw-pencil", -1), "pw-petal");
  assert.strictEqual(G.wonderNeighbour(ORDER, "pw-reduction", 1), "pw-filings");
});

test("it opens on the Wonder asked for, else the last one seen, else the first", () => {
  const avail = ORDER.slice(0, 3);
  assert.strictEqual(G.wonderStart(avail, "pw-reduction", "pw-filings"), "pw-filings");
  assert.strictEqual(G.wonderStart(avail, "pw-reduction", null), "pw-reduction");
  assert.strictEqual(G.wonderStart(avail, "pw-petal", "pw-kerf"), "pw-pencil");   // neither built yet
});
