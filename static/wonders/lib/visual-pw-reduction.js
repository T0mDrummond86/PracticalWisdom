(function () {
  "use strict";
  // Reduction (tip #86: "Boil things down to their essence."): a shallow pan at a rolling boil, seen
  // from above. The burner heats the middle of the base most; stock boils off in proportion to the heat
  // under it, and as a thin film it levels out only slowly (the flow between two places goes as the
  // square of how deep they are, so a dry patch stays dry and widens rather than filling back in).
  // Bubbles are born on the base where it is hottest, thicker the hotter, and burst at the top. What is
  // left when the water is gone is the reduction, a glossy syrup on the base, and that is the line: it
  // was there under the stock all along, and shows only where the stock has boiled down to nothing.
  // Then the pan rests, is topped up from one side, and boils down again. Pure; node-tested.
  const REDUCTION = {
    MAX_RATE: 0.8, CELL: 3,
    FILM: 0.03,          // stock thinner than this is boiled down: the base (and the line) shows through
    EVAP: 0.075,         // depth boiled off per second at full heat (a full pan, depth 1)
    FLOW: 5,             // px^2/s: how fast a deep film levels out (slowly: a hot place dries first)
    PRESS: 0.6, PRESS_R: 40, PRESS_TAU: 1.6, PRESS_MAX: 1.2,   // a press: heat added, its reach (px), fade (s), cap
    REST: 10, FILL: 4,   // s resting dry, s pouring the next ladle in
    BLOCK: 8,            // cells per side of a bubble-birth block
  };

  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s.rs ^ (s.rs >>> 15), s.rs | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  function reductionCreate(o) {
    const cell = o.cell || REDUCTION.CELL, seed = o.seed >>> 0;
    const gw = Math.max(4, Math.ceil(o.w / cell)), gh = Math.max(4, Math.ceil(o.h / cell)), n = gw * gh;
    const s = { seed, rs: seed ^ 0x85ebca6b, w: o.w, h: o.h, cell, gw, gh, depth: new Float32Array(n), burner: new Float32Array(n),
      press: new Float32Array(n), heat: new Float32Array(n), mask: new Float32Array(n), letters: 0, bubbles: [], ripples: [],
      phase: "boil", clock: 0, cycle: 0, evap: 0, born: 0, pour: 0 };
    // the visit: where the flame sits under the pan, how wide it spreads, and the stock's colour
    const S = Math.sqrt(o.w * o.h);
    s.flame = { x: o.w * (0.38 + 0.24 * rnd(s)), y: o.h * (0.36 + 0.24 * rnd(s)), sigma: S * (0.18 + 0.08 * rnd(s)) };
    s.stock = rnd(s);
    s.pourFrom = rnd(s) * 2 * Math.PI;
    for (let i = 0; i < n; i++) {
      const x = (i % gw + 0.5) * cell - s.flame.x, y = (Math.floor(i / gw) + 0.5) * cell - s.flame.y;
      s.burner[i] = 0.4 + 0.6 * Math.exp(-(x * x + y * y) / (2 * s.flame.sigma * s.flame.sigma));
      s.depth[i] = 1;
    }
    refreshHeat(s);
    return s;
  }
  function refreshHeat(s) { for (let i = 0; i < s.heat.length; i++) s.heat[i] = s.burner[i] + s.press[i]; }

  const idx = (s, x, y) => Math.min(s.gh - 1, Math.max(0, Math.floor(y / s.cell))) * s.gw + Math.min(s.gw - 1, Math.max(0, Math.floor(x / s.cell)));
  function reductionHeatAt(s, x, y) { const i = idx(s, x, y); return s.burner[i] + s.press[i]; }

  // A press at (x, y) px turns the heat up under it, most at the middle of the fingertip
  function reductionHeat(s, x, y) {
    const R = REDUCTION.PRESS_R, c = s.cell, r2 = 2 * R * R;
    const x0 = Math.max(0, Math.floor((x - 2 * R) / c)), x1 = Math.min(s.gw - 1, Math.floor((x + 2 * R) / c));
    const y0 = Math.max(0, Math.floor((y - 2 * R) / c)), y1 = Math.min(s.gh - 1, Math.floor((y + 2 * R) / c));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const dx = (cx + 0.5) * c - x, dy = (cy + 0.5) * c - y, i = cy * s.gw + cx;
      s.press[i] = Math.min(REDUCTION.PRESS_MAX, s.press[i] + REDUCTION.PRESS * Math.exp(-(dx * dx + dy * dy) / r2));
    }
    refreshHeat(s);
  }

  // The line under the stock: how much of each cell is letter (0..1), from the word field
  function reductionLetters(s, field) {
    let total = 0;
    const c = s.cell;
    for (let cy = 0; cy < s.gh; cy++) for (let cx = 0; cx < s.gw; cx++) {
      let k = 0;
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) if (field.inside((cx + (sx + 0.5) / 3) * c, (cy + (sy + 0.5) / 3) * c)) k++;
      s.mask[cy * s.gw + cx] = k / 9; total += k / 9;
    }
    s.letters = total;
  }
  // how much of the reduction shows in cell i: none under any stock deeper than a film
  function reductionShown(s, i) { return s.mask[i] * Math.max(0, 1 - s.depth[i] / REDUCTION.FILM); }
  function reductionLettersShown(s) {
    if (!s.letters) return 0;
    let v = 0;
    for (let i = 0; i < s.mask.length; i++) if (s.mask[i]) v += reductionShown(s, i);
    return v / s.letters;
  }

  // the film levels out: flux between neighbours, weighted by the square of their mean depth (thin
  // films barely move), never taking more than a quarter of what a cell holds
  const flux = new Map();
  function level(s, dt) {
    const gw = s.gw, gh = s.gh, D = s.depth, nu = REDUCTION.FLOW / (s.cell * s.cell);
    const steps = Math.max(1, Math.ceil(nu * dt / 0.2)), k = nu * dt / steps;
    let F = flux.get(D.length);
    if (!F) { F = new Float32Array(D.length); flux.set(D.length, F); }
    for (let st = 0; st < steps; st++) {
      F.fill(0);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        for (let e = 0; e < 2; e++) {
          const j = e === 0 ? (x + 1 < gw ? i + 1 : -1) : (y + 1 < gh ? i + gw : -1);
          if (j < 0) continue;
          const m = (D[i] + D[j]) * 0.5, mob = Math.min(1, (m / 0.3) * (m / 0.3));
          let f = k * mob * (D[i] - D[j]);
          if (f > 0) f = Math.min(f, D[i] * 0.24); else f = Math.max(f, -D[j] * 0.24);
          F[i] -= f; F[j] += f;
        }
      }
      for (let i = 0; i < D.length; i++) D[i] = Math.max(0, D[i] + F[i]);
    }
  }

  function birth(s, dt) {
    const B = REDUCTION.BLOCK, c = s.cell, size = B * c;
    for (let by = 0; by < s.gh; by += B) for (let bx = 0; bx < s.gw; bx += B) {
      const i = Math.min(s.gh - 1, by + (B >> 1)) * s.gw + Math.min(s.gw - 1, bx + (B >> 1));
      if (s.depth[i] < 0.06) continue;
      const q = Math.max(0, s.heat[i] - 0.45);
      let expect = 22 * q * q * dt * (size * size) / 576;
      while (expect > 0) {
        if (expect < 1 && rnd(s) > expect) break;
        expect -= 1;
        if (s.bubbles.length >= 500) return;
        const u = rnd(s);
        s.bubbles.push({ x: (bx + rnd(s) * B) * c, y: (by + rnd(s) * B) * c, r: 0, rmax: 1.1 + 5.2 * u * u * Math.min(1, s.depth[i] * 3), age: 0, life: 0.25 + 0.55 * rnd(s) });
        s.born++;
      }
    }
  }

  function reductionStep(s, dt) {
    s.clock += dt;
    // the press fades back to the burner's own heat
    const fade = Math.exp(-dt / REDUCTION.PRESS_TAU);
    for (let i = 0; i < s.press.length; i++) s.press[i] *= fade;
    refreshHeat(s);
    // bubbles grow to their size and burst
    for (const b of s.bubbles) { b.age += dt; b.r = b.rmax * Math.min(1, b.age / (b.life * 0.7)); }
    for (let k = s.bubbles.length - 1; k >= 0; k--) {
      const b = s.bubbles[k];
      if (b.age >= b.life) { s.ripples.push({ x: b.x, y: b.y, r: b.r, age: 0 }); s.bubbles[k] = s.bubbles[s.bubbles.length - 1]; s.bubbles.pop(); }
    }
    for (let k = s.ripples.length - 1; k >= 0; k--) { const r = s.ripples[k]; r.age += dt; if (r.age > 0.35) { s.ripples[k] = s.ripples[s.ripples.length - 1]; s.ripples.pop(); } }
    if (s.phase === "boil") {
      let evap = 0, wet = 0;
      for (let i = 0; i < s.depth.length; i++) {
        const d = s.depth[i];
        if (!d) continue;
        const e = Math.min(d, REDUCTION.EVAP * s.heat[i] * dt);
        s.depth[i] = d - e; evap += e;
        if (s.depth[i] > REDUCTION.FILM * 0.5) wet++;
      }
      s.evap = evap / Math.max(dt, 1e-6) / s.depth.length;
      level(s, dt);
      birth(s, dt);
      if (!wet) { s.phase = "rest"; s.clock = 0; s.evap = 0; }
    } else if (s.phase === "rest") {
      if (s.clock >= REDUCTION.REST) { s.phase = "fill"; s.clock = 0; s.pourFrom = rnd(s) * 2 * Math.PI; }
    } else if (s.phase === "fill") {
      // the next ladle runs in from one side of the pan and spreads across it
      const u = Math.min(1, s.clock / REDUCTION.FILL), ax = Math.cos(s.pourFrom), ay = Math.sin(s.pourFrom), half = Math.hypot(s.w, s.h) / 2;
      for (let i = 0; i < s.depth.length; i++) {
        const x = (i % s.gw + 0.5) * s.cell - s.w / 2, y = (Math.floor(i / s.gw) + 0.5) * s.cell - s.h / 2;
        const reach = (ax * x + ay * y) / half;                // 1 at the pouring side, -1 across
        const arrived = Math.min(1, Math.max(0, (u * 2.6 - (1 - reach)) / 0.6));
        s.depth[i] = Math.max(s.depth[i], arrived);
      }
      if (u >= 1) { s.phase = "boil"; s.clock = 0; s.cycle++; }
    }
  }

  const api = { REDUCTION, reductionCreate, reductionStep, reductionHeat, reductionHeatAt, reductionLetters, reductionShown, reductionLettersShown };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
