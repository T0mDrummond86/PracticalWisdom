"use strict";
// The shared canvas-2D runtime (static/wonders/runtime.js): the contract's enforced strings, the
// seeded random, and its behaviour on a minimal fake DOM: the DPR cap, the pace under reduced
// motion, the edges touch ignores, the line handed over once its font is in, and a teardown that
// leaves nothing behind.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "..", "static", "wonders", "runtime.js");
const R = require(FILE);
const src = fs.readFileSync(FILE, "utf8");

test("carries the contract: edges, touch-action, teardown, verification hook, reduced pace, frame cap, DPR cap", () => {
  for (const s of ["EDGE_X = 56, EDGE_TOP = 64", "touch-action: none", 'removeEventListener("visibilitychange"',
    "_advance(seconds)", "const pace = reduced ? 0.3 : 1;", "reduced ? 100 : 1000 / 30", "Math.min(2,"]) {
    assert.ok(src.includes(s), "runtime.js contains " + s);
  }
});

test("wonderRand is deterministic per seed, differs across seeds, and stays in [0, 1)", () => {
  const five = seed => { const r = R.wonderRand(seed); return [r(), r(), r(), r(), r()]; };
  assert.deepStrictEqual(five(7), five(7));
  assert.notDeepStrictEqual(five(7), five(8));
  const r = R.wonderRand(123);
  for (let i = 0; i < 10000; i++) { const v = r(); assert.ok(v >= 0 && v < 1, String(v)); }
});

// ---- a minimal DOM, enough for the runtime to mount, run and leave -----------------------------
function fakeDom() {
  const on = (o) => {
    o.listeners = {};
    o.addEventListener = (k, f) => { (o.listeners[k] = o.listeners[k] || []).push(f); };
    o.removeEventListener = (k, f) => { o.listeners[k] = (o.listeners[k] || []).filter(x => x !== f); };
    return o;
  };
  const mk = tag => on({
    tagName: tag.toUpperCase(), children: [], style: {}, attrs: {}, className: "", id: "", parentNode: null,
    clientWidth: 390, clientHeight: 844,
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    remove() { const p = this.parentNode; if (p) { p.children = p.children.filter(x => x !== this); this.parentNode = null; } },
    setAttribute(k, v) { this.attrs[k] = v; },
    setPointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; },
    getContext() { return new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } }); },
  });
  const head = mk("head");
  const doc = on({ head, visibilityState: "visible", createElement: mk,
    getElementById: id => head.children.find(c => c.id === id) || null });
  const win = on({});
  Object.assign(globalThis, {
    document: doc, devicePixelRatio: 3, innerWidth: 390, innerHeight: 844,
    addEventListener: win.addEventListener, removeEventListener: win.removeEventListener,
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
  });
  return { doc, win, head, mk };
}

function spec(log) {
  return {
    id: "pw-test", styleId: "vis-pw-test-style", css: ".vis-pw-test { color: red; }",
    create: ctx => { log.create = { W: ctx.W, H: ctx.H, S: ctx.S }; return { dt: 0, touches: [] }; },
    step: (s, dt) => { s.dt += dt; },
    draw: () => { log.draws = (log.draws || 0) + 1; },
    touch: (s, kind, x, y) => { s.touches.push([kind, x, y]); },
    words: (s, f) => { s.field = f; },
    info: s => ({ dt: s.dt, touches: s.touches.length }),
  };
}

test("mounts a canvas at the pane's size, DPR capped at 2, with one style per Wonder", () => {
  const { head, mk } = fakeDom();
  const el = mk("div"), log = {};
  const hnd = R.wonder2d(el, { seed: 1 }, spec(log));
  const root = el.children[0], canvas = root.children[0];
  assert.strictEqual(root.className, "vis-pw-test");
  assert.strictEqual(canvas.className, "vis-pw-test-canvas");
  assert.deepStrictEqual([canvas.width, canvas.height], [780, 1688]);
  assert.deepStrictEqual(log.create, { W: 390, H: 844, S: Math.sqrt(390 * 844) });
  assert.strictEqual(head.children.filter(c => c.id === "vis-pw-test-style").length, 1);
  assert.match(head.children[0].textContent, /\.vis-pw-test-canvas[^}]*touch-action: none/);
  hnd.destroy();
});

test("a wrong style id is refused, so every Wonder's styles stay under its own name", () => {
  const { mk } = fakeDom();
  assert.throws(() => R.wonder2d(mk("div"), {}, Object.assign(spec({}), { styleId: "pw-test" })));
});

test("reduced motion runs the same world at 0.3 of its pace", () => {
  const { mk } = fakeDom();
  const full = R.wonder2d(mk("div"), { seed: 1 }, spec({}));
  const slow = R.wonder2d(mk("div"), { seed: 1, reduced: true }, spec({}));
  full._advance(2); slow._advance(2);
  assert.ok(Math.abs(full._state().dt - 2) < 1e-9, String(full._state().dt));
  assert.ok(Math.abs(slow._state().dt - 0.6) < 1e-9, String(slow._state().dt));
  full.destroy(); slow.destroy();
});

test("touch inside the edges is ignored; a held touch moves and lifts", () => {
  const { mk } = fakeDom();
  const hnd = R.wonder2d(mk("div"), { seed: 1 }, spec({}));
  hnd._touch("down", 20, 400);      // left edge
  hnd._touch("down", 370, 400);     // right edge
  hnd._touch("down", 200, 30);      // top
  assert.strictEqual(hnd._state().touches, 0);
  hnd._touch("down", 200, 400); hnd._touch("move", 210, 410); hnd._touch("up", 210, 410);
  assert.strictEqual(hnd._state().touches, 3);
  hnd._touch("move", 220, 420);     // not held: nothing
  assert.strictEqual(hnd._state().touches, 3);
  hnd.destroy();
});

test("the line is handed over once its font has loaded, and not after destroy", async () => {
  const { mk } = fakeDom();
  const field = { mask: new Uint8Array(4) };
  const s1 = spec({}), got = [];
  s1.words = (s, f) => got.push(f);
  const a = R.wonder2d(mk("div"), { seed: 1, words: { ready: Promise.resolve(field) } }, s1);
  await new Promise(r => setTimeout(r, 0));
  assert.deepStrictEqual(got, [field]);
  const s2 = spec({}), late = [];
  s2.words = (s, f) => late.push(f);
  const b = R.wonder2d(mk("div"), { seed: 1, words: { ready: Promise.resolve(field) } }, s2);
  b.destroy();
  await new Promise(r => setTimeout(r, 0));
  assert.deepStrictEqual(late, []);
  a.destroy();
});

test("destroy removes every listener, the root, and the style once its last user goes", () => {
  const { doc, win, head, mk } = fakeDom();
  const el1 = mk("div"), el2 = mk("div");
  const a = R.wonder2d(el1, { seed: 1 }, spec({}));
  const b = R.wonder2d(el2, { seed: 2 }, spec({}));
  assert.strictEqual(doc.listeners.visibilitychange.length, 2);
  a.destroy();
  assert.strictEqual(el1.children.length, 0);
  assert.ok(head.children.some(c => c.id === "vis-pw-test-style"), "still in use by the second");
  b.destroy(); b.destroy();         // twice is harmless
  assert.strictEqual(doc.listeners.visibilitychange.length, 0);
  assert.strictEqual((win.listeners.resize || []).length, 0);
  assert.strictEqual(head.children.length, 0);
});
