(function () {
  "use strict";
  // Filings (tip #67: "Polar opposite views can both be true."): iron filings scattered on a sheet of
  // paper, a north pole under the paper just off its left edge and a south pole just off its right.
  // Each pole's field falls off as the inverse square of the distance from it (a pole a little below
  // the paper, so the field in the sheet stays finite), and the field the filings feel is the sum of
  // the two: neither pole's alone. A filing is a tiny magnet with no head, so it turns until it lies
  // along the field line through it, whichever way the line runs; reverse both poles and not one
  // filing moves. Move a pole and every line swings to stay true to both. The line is written in
  // filings: the line holds loose filings of its own and pulls each to a place on it, and they lie
  // along the field like the rest. Pure; node-tested.
  const FILINGS = { MAX_RATE: 0.8, TURN: 1.5, DENSITY: 56, MAX: 6000, LETTER_LEN: 3.2, MARGIN: 10 };

  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s.rs ^ (s.rs >>> 15), s.rs | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  // the field in the sheet at (x, y) from poles a and b, each { x, y, q, d } (d: depth under the paper)
  function poleField(p, x, y) {
    const dx = x - p.x, dy = y - p.y, r2 = dx * dx + dy * dy + p.d * p.d, k = p.q / (r2 * Math.sqrt(r2));
    return [k * dx, k * dy];
  }
  function filingsField(a, b, x, y) {
    const f = poleField(a, x, y), g = poleField(b, x, y);
    return [f[0] + g[0], f[1] + g[1]];
  }

  function filingsCreate(o) {
    const seed = o.seed >>> 0, w = o.w, h = o.h, S = Math.sqrt(w * h);
    const s = { seed, rs: seed ^ 0x68e31da4, w, h, S };
    // the visit's poles: as strong as each other give or take a fifth, at their own heights, off the paper
    const q = 0.85 + 0.3 * rnd(s);
    s.poles = [
      { x: -(0.12 + 0.12 * rnd(s)) * w, y: h * (0.3 + 0.4 * rnd(s)), q, d: 0.14 * S },
      { x: w + (0.12 + 0.12 * rnd(s)) * w, y: h * (0.3 + 0.4 * rnd(s)), q: -(0.85 + 0.3 * rnd(s)), d: 0.14 * S },
    ];
    const n = Math.min(FILINGS.MAX, Math.round(w * h / FILINGS.DENSITY));
    s.n = n;
    s.x = new Float32Array(n); s.y = new Float32Array(n); s.a = new Float32Array(n); s.len = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      s.x[i] = rnd(s) * w; s.y[i] = rnd(s) * h; s.a[i] = rnd(s) * Math.PI;
      const u = rnd(s); s.len[i] = 3.5 + 5 * u * u;
    }
    // the field halfway between the poles: below a fifth of it a filing turns more slowly
    const mid = filingsField(s.poles[0], s.poles[1], w / 2, h / 2);
    s.ref = 0.2 * Math.hypot(mid[0], mid[1]);
    s.targets = new Map();     // filing index -> { x, y, from: { x, y }, delay, t }
    s.t = 0;
    return s;
  }

  // a pole dragged: it follows the finger up and down but never comes onto the paper
  function filingsMovePole(s, k, y) {
    s.poles[k].y = Math.min(s.h * 0.95, Math.max(s.h * 0.05, y));
  }

  // how far out of line the filings lie: the mean of |sin| of each one's angle to its field line
  function filingsError(s) {
    let e = 0;
    const [a, b] = s.poles;
    for (let i = 0; i < s.n; i++) {
      const f = filingsField(a, b, s.x[i], s.y[i]);
      e += Math.abs(Math.sin(s.a[i] - Math.atan2(f[1], f[0])));
    }
    return e / s.n;
  }

  // The line's places (px points along its strokes, from the word field): the line holds filings of
  // its own, lying loose within a few px of it, which it pulls in, each to a place of its own. Not
  // filings taken from the scatter: the line needs a thousand or so, and taking them, from however far,
  // strips a clearing the size of the words, an almond with a dark band through it, which is an eye.
  function filingsLetters(s, pts) {
    s.targets.clear();
    const n0 = s.base == null ? (s.base = s.n) : s.base, n = Math.min(n0 + pts.length, n0 + 4000);
    const grow = a => { const b = new Float32Array(n); b.set(a.subarray(0, Math.min(a.length, n0))); return b; };
    s.x = grow(s.x); s.y = grow(s.y); s.a = grow(s.a); s.len = grow(s.len); s.n = n;
    for (let i = n0; i < n; i++) {
      const p = pts[i - n0], r = 4 + 10 * rnd(s), t = rnd(s) * 2 * Math.PI;
      s.x[i] = p.x + r * Math.cos(t); s.y[i] = p.y + r * Math.sin(t);
      s.a[i] = rnd(s) * Math.PI; s.len[i] = FILINGS.LETTER_LEN * (0.8 + 0.4 * rnd(s));
      s.targets.set(i, { x: p.x, y: p.y, fx: s.x[i], fy: s.y[i], delay: 0.15 + 1.5 * rnd(s) });
    }
    // and the loose ones lying close beside a stroke are pulled onto it too, so each stroke has a thin
    // clean margin, the way filings leave the paper bare just round a magnet's edge
    const R2 = FILINGS.MARGIN * FILINGS.MARGIN;
    for (let i = 0; i < n0; i++) {
      let best = -1, bd = R2;
      for (let k = 0; k < pts.length; k++) {
        const dx = s.x[i] - pts[k].x, dy = s.y[i] - pts[k].y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = k; }
      }
      if (best < 0) continue;
      const p = pts[best], j = 1.2 * (rnd(s) - 0.5), jy = 1.2 * (rnd(s) - 0.5);
      s.targets.set(i, { x: p.x + j, y: p.y + jy, fx: s.x[i], fy: s.y[i], delay: 0.15 + 1.5 * rnd(s) });
      s.len[i] = Math.min(s.len[i], FILINGS.LETTER_LEN);
    }
  }

  function filingsStep(s, dt) {
    s.t += dt;
    const [a, b] = s.poles, turn = FILINGS.TURN * dt;
    // the drawn ones make their way to their places, easing in
    for (const [i, p] of s.targets) {
      const since = s.t - p.delay;
      if (since <= 0) continue;
      const u = 1 - Math.exp(-since / 0.5);
      s.x[i] = p.fx + (p.x - p.fx) * u; s.y[i] = p.fy + (p.y - p.fy) * u;
    }
    for (let i = 0; i < s.n; i++) {
      const f = filingsField(a, b, s.x[i], s.y[i]), m = Math.hypot(f[0], f[1]);
      const pull = m / (m + s.ref);
      // headless: the torque turns it to the nearer end of its line (sin of twice the angle)
      s.a[i] -= turn * pull * Math.sin(2 * (s.a[i] - Math.atan2(f[1], f[0])));
    }
  }

  const api = { FILINGS, filingsCreate, filingsField, filingsMovePole, filingsError, filingsLetters, filingsStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
