(function () {
  "use strict";
  // Bloom (tip #3: "Help others to flourish."): a meadow seen side-on in morning light, rows of plants
  // going back to a low horizon, most still in bud, a few in flower. A flower cannot open a bud by
  // looking at it: help has to travel. A touch sends pollen from the nearest open flower, drifting on the
  // air, to the buds round the finger (never the one under it: you help, and others flourish). A bud
  // opens only once the pollen reaches it; once open, it sends pollen on to its own nearest buds, so one
  // act of help multiplies through the meadow, as the tip's anecdote says it does. Nothing closes again.
  // The line comes into its colour as the meadow flourishes. Left alone, a breeze carries the first
  // pollen. Pure; node-tested.
  const BLOOM = {
    MAX_RATE: 0.8,
    RING: 120,           // px round the finger whose buds a touch helps
    OPEN: 1.4,           // s for a reached bud to open fully
    PASS: 3,             // buds an opened flower helps in turn
    REACH: 95,           // px it can reach them over (further, if none is nearer)
    TRAVEL: [0.9, 1.8],  // s for pollen to cross
    WAIT: 4,             // s left alone before the breeze
  };

  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s.rs ^ (s.rs >>> 15), s.rs | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  // the horizon the meadow runs back to (shared with the drawing and the line's place)
  function bloomHorizon(w, h) { return h * (w > h ? 0.5 : 0.56); }

  function bloomCreate(o) {
    const seed = o.seed >>> 0, w = o.w, h = o.h;
    const s = { seed, rs: seed ^ 0x3243f6a8, w, h, plants: [], motes: [], t: 0, started: false };
    s.horizon = bloomHorizon(w, h); s.hue = rnd(s);
    const R = 7;
    for (let j = 0; j < R; j++) {
      const u = j / (R - 1), base = s.horizon + (h - s.horizon) * (0.06 + 0.88 * Math.pow(u, 1.25)), scale = 0.5 + 0.9 * u, gap = 26 * scale;
      for (let x = gap * rnd(s) * 0.5; x < w; x += gap * (0.8 + 0.4 * rnd(s))) {
        const stem = (30 + 16 * rnd(s)) * scale, lean = (rnd(s) - 0.5) * 10 * scale;
        s.plants.push({ x, y: base, hx: x + lean, hy: base - stem, scale, open: 0, helped: false, at: Infinity, passed: false, tint: rnd(s), phase: rnd(s) * 6.2832 });
      }
    }
    // a few already in flower, in the nearer half
    const near = s.plants.filter(p => p.scale > 0.9);
    for (let k = 0; k < 2; k++) { const p = near[Math.floor(rnd(s) * near.length)]; p.open = 1; p.passed = true; p.helped = true; p.at = 0; }
    return s;
  }

  function send(s, from, to, delay) {
    const a = s.plants[from], b = s.plants[to], d = Math.hypot(b.hx - a.hx, b.hy - a.hy);
    const [t0, t1] = BLOOM.TRAVEL, dur = Math.min(t1, t0 + d / 160) * (0.85 + 0.3 * rnd(s));
    b.helped = true; b.at = s.t + delay + dur;
    s.motes.push({ from, to, t: -delay, dur, lift: 20 + 30 * rnd(s), drift: (rnd(s) - 0.5) * 30 });
  }
  const dist = (p, x, y) => Math.hypot(p.hx - x, p.hy - y);

  // A touch at (x, y): the nearest open flower sends pollen to the buds round the finger
  function bloomTouch(s, x, y) {
    s.started = true;
    let src = -1, under = -1, bs = Infinity, bu = Infinity;
    s.plants.forEach((p, i) => {
      const d = dist(p, x, y);
      if (p.open >= 1 && d < bs) { bs = d; src = i; }
      if (d < bu) { bu = d; under = i; }
    });
    if (src < 0) return;
    const ring = s.plants.map((p, i) => [i, dist(p, x, y)]).filter(([i, d]) => i !== under && d <= BLOOM.RING && !s.plants[i].helped)
      .sort((a, b) => a[1] - b[1]).slice(0, 6);
    ring.forEach(([i], k) => send(s, src, i, k * 0.12));
  }

  // how far the line has come into its colour: how much of the meadow is open
  function bloomColour(s) { let v = 0; for (const p of s.plants) v += p.open; return v / s.plants.length; }

  function bloomStep(s, dt) {
    s.t += dt;
    if (!s.started && s.t >= BLOOM.WAIT) {
      const buds = s.plants.filter(p => p.open === 0 && p.scale > 0.8);
      if (buds.length) { const b = buds[Math.floor(rnd(s) * buds.length)]; bloomTouch(s, b.hx, b.hy); }
      s.started = true;
    }
    for (const m of s.motes) m.t += dt;
    s.motes = s.motes.filter(m => m.t < m.dur);
    s.plants.forEach((p, i) => {
      if (!p.helped || s.t < p.at || p.open >= 1) return;
      p.open = Math.min(1, p.open + dt / BLOOM.OPEN);
      if (p.open >= 1 && !p.passed) {
        p.passed = true;
        // open, it helps its own nearest buds, one after another
        let cand = s.plants.map((q, j) => [j, dist(q, p.hx, p.hy)]).filter(([j]) => !s.plants[j].helped).sort((a, b) => a[1] - b[1]);
        const near = cand.filter(c => c[1] <= BLOOM.REACH);
        cand = (near.length ? near : cand).slice(0, BLOOM.PASS);
        cand.forEach(([j], k) => send(s, i, j, 0.15 + k * 0.35 + 0.4 * rnd(s)));
      }
    });
  }

  const api = { BLOOM, bloomHorizon, bloomCreate, bloomTouch, bloomColour, bloomStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
