(function () {
  "use strict";
  // Bloom (tip #3: "Help others to flourish."): a bed of seedlings from above in soft light. A touch helps
  // the plants in a ring round it to open, and not the one under the finger: you help, and others
  // flourish. A plant that has opened helps its own neighbours in turn, a little later, so one touch
  // spreads through the bed the way the tip's anecdote says help does, multifold, and in time reaches
  // even the plant that was under the finger. The line was planted in among them as carpet bedding, in
  // seedlings of another colour; a seedling shows no colour, so the line appears only as its plants
  // bloom. Nothing closes again. Left alone a while, someone else helps somewhere. Pure; node-tested.
  const BLOOM = {
    MAX_RATE: 0.8,
    SPACING: 5,          // px between plants (a little jittered)
    INNER: 14, OUTER: 58, // px: the ring a touch helps, and the finger's own patch inside it
    OPEN: 1.3,           // s for a helped plant to open fully
    PASS: 12,            // px: how far an open plant's help reaches
    LAG: [0.2, 2.6],     // s before that help arrives: mostly soon, now and then late (a slow plant),
                         // so the bloom spreads in a ragged patch, not a widening circle (a disc is an eye)
    WAIT: 5,             // s left alone before someone else helps
  };

  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s.rs ^ (s.rs >>> 15), s.rs | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  function bloomCreate(o) {
    const seed = o.seed >>> 0, w = o.w, h = o.h, sp = BLOOM.SPACING;
    const s = { seed, rs: seed ^ 0x3243f6a8, w, h };
    const xs = [], ys = [];
    for (let y = sp / 2; y < h; y += sp) for (let x = sp / 2; x < w; x += sp) {
      xs.push(x + (rnd(s) - 0.5) * sp * 0.8); ys.push(y + (rnd(s) - 0.5) * sp * 0.8);
    }
    s.n = xs.length;
    s.x = Float32Array.from(xs); s.y = Float32Array.from(ys);
    s.open = new Float32Array(s.n); s.helped = new Uint8Array(s.n); s.at = new Float32Array(s.n).fill(Infinity);
    s.passed = new Uint8Array(s.n); s.letter = new Uint8Array(s.n); s.letterPlants = [];
    s.turn = new Float32Array(s.n); for (let i = 0; i < s.n; i++) s.turn[i] = rnd(s);
    // where the bed is thick help passes quickly, where it is thin slowly: a smooth field over the bed,
    // so the bloom spreads in lobes
    const sp2 = 70, lw = Math.ceil(w / sp2) + 2, lat = new Float32Array(lw * (Math.ceil(h / sp2) + 2));
    for (let i = 0; i < lat.length; i++) lat[i] = rnd(s);
    s.slowAt = (x, y) => {
      const fx = x / sp2, fy = y / sp2, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
      const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), a = lat[iy * lw + ix], b = lat[iy * lw + ix + 1], c = lat[(iy + 1) * lw + ix], d = lat[(iy + 1) * lw + ix + 1];
      const n = a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
      return 0.35 + 2.4 * n * n;
    };
    // buckets, for finding a plant's neighbours
    s.bs = BLOOM.PASS; s.bw = Math.ceil(w / s.bs) + 1; s.bh = Math.ceil(h / s.bs) + 1;
    s.buckets = Array.from({ length: s.bw * s.bh }, () => []);
    for (let i = 0; i < s.n; i++) s.buckets[Math.floor(s.y[i] / s.bs) * s.bw + Math.floor(s.x[i] / s.bs)].push(i);
    s.t = 0; s.started = false; s.hue = rnd(s);
    return s;
  }

  function near(s, x, y, r, fn) {
    const bx0 = Math.max(0, Math.floor((x - r) / s.bs)), bx1 = Math.min(s.bw - 1, Math.floor((x + r) / s.bs));
    const by0 = Math.max(0, Math.floor((y - r) / s.bs)), by1 = Math.min(s.bh - 1, Math.floor((y + r) / s.bs));
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) for (const i of s.buckets[by * s.bw + bx]) {
      const d = Math.hypot(s.x[i] - x, s.y[i] - y);
      if (d <= r) fn(i, d);
    }
  }
  function help(s, i, when) { if (!s.helped[i] || when < s.at[i]) { s.helped[i] = 1; s.at[i] = Math.min(s.at[i], when); } }

  // A touch at (x, y): the plants in the ring round it are helped now; the finger's own patch is not
  function bloomTouch(s, x, y) {
    s.started = true;
    near(s, x, y, BLOOM.OUTER, (i, d) => { if (d > BLOOM.INNER) help(s, i, s.t); });
  }

  // The line: plants whose place is inside a letter were planted in the other colour, and, the way a
  // bedding scheme plants its lettering tighter than its ground, more of them along the strokes (pts)
  function bloomLetters(s, inside, pts) {
    const extra = pts || [], n0 = s.base == null ? (s.base = s.n) : s.base, n = n0 + extra.length;
    const grow = (a, T) => { const b = new T(n); b.set(a.subarray(0, n0)); return b; };
    s.x = grow(s.x, Float32Array); s.y = grow(s.y, Float32Array); s.open = grow(s.open, Float32Array); s.helped = grow(s.helped, Uint8Array);
    s.at = grow(s.at, Float32Array); s.passed = grow(s.passed, Uint8Array); s.turn = grow(s.turn, Float32Array);
    s.letter = new Uint8Array(n); s.small = new Uint8Array(n);
    for (let k = 0; k < extra.length; k++) {
      const i = n0 + k;
      s.x[i] = extra[k].x; s.y[i] = extra[k].y; s.at[i] = Infinity; s.turn[i] = rnd(s); s.small[i] = 1;
    }
    for (const b of s.buckets) b.length = 0;
    s.n = n;
    for (let i = 0; i < n; i++) s.buckets[Math.min(s.bh - 1, Math.max(0, Math.floor(s.y[i] / s.bs))) * s.bw + Math.min(s.bw - 1, Math.max(0, Math.floor(s.x[i] / s.bs)))].push(i);
    s.letterPlants = [];
    for (let i = 0; i < n; i++) { s.letter[i] = s.small[i] || inside(s.x[i], s.y[i]) ? 1 : 0; if (s.letter[i]) s.letterPlants.push(i); }
  }
  // how much of the line shows: how far open its plants are, on average
  function bloomShown(s) {
    if (!s.letterPlants.length) return 0;
    let v = 0;
    for (const i of s.letterPlants) v += s.open[i];
    return v / s.letterPlants.length;
  }

  function bloomStep(s, dt) {
    s.t += dt;
    // left alone, someone else helps once; after that, the help spreads by itself
    if (!s.started && s.t >= BLOOM.WAIT) bloomTouch(s, s.w * (0.25 + 0.5 * rnd(s)), s.h * (0.25 + 0.5 * rnd(s)));
    const [l0, l1] = BLOOM.LAG;
    for (let i = 0; i < s.n; i++) {
      if (!s.helped[i] || s.t < s.at[i] || s.open[i] >= 1) continue;
      s.open[i] = Math.min(1, s.open[i] + dt / BLOOM.OPEN);
      // well open, it passes the help on to its neighbours, each a little later
      if (!s.passed[i] && s.open[i] > 0.6) {
        s.passed[i] = 1;
        near(s, s.x[i], s.y[i], BLOOM.PASS, j => { if (!s.helped[j]) { const u = rnd(s); help(s, j, s.t + (l0 + (l1 - l0) * u * u * u) * s.slowAt(s.x[j], s.y[j])); } });
      }
    }
  }

  const api = { BLOOM, bloomCreate, bloomTouch, bloomLetters, bloomShown, bloomStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
