(function () {
  "use strict";
  // Shoot (tip #65: "Keep going. Push through."): a green shoot coming up through soft snow, seen side-on
  // in section. Snow is a pile of grains, not a sheet: pushed from below it heaps into a dome, and a heap
  // steeper than snow's angle of repose slides down its sides until it is not. So the shoot shoulders the
  // snow up and aside, the dome slumps away round it, and every grain of it is still there, heaped beside
  // the stem; nothing cracks, because snow held as a height field can heap and slide but has no way to
  // break. Under snow the shoot climbs slowly (it is lifting what is on it); through, it climbs faster,
  // up into the line, and the green rises into the letters from below. A push helps it on. Heights are
  // px above the ground line; the ground is at ground px from the top. Pure; node-tested.
  const SHOOT = {
    MAX_RATE: 0.8, CELL: 2,
    REPOSE: 0.9,         // snow's angle of repose, as a slope (about 42 degrees)
    GROW: 20,            // px/s, under the snow but unburdened
    AIR: 40,             // px/s, through and in the open
    LOAD: 0.015,         // how much each px of snow on it slows it
    PUSH: 42, PUSH_TAU: 0.6,
    RISE: 11,            // px/s the green climbs through the letters
    HALF: 3,             // px: half the stem's width
    CREEP: 60,           // px^2/s: how fast snow creeps level
  };

  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s.rs ^ (s.rs >>> 15), s.rs | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  // the ground line and the snow's depth for a pane w x h (shared with the drawing)
  function shootGround(w, h) { return h * (w > h ? 0.86 : 0.84); }

  function shootCreate(o) {
    const seed = o.seed >>> 0, w = o.w, h = o.h, cell = SHOOT.CELL;
    const s = { seed, rs: seed ^ 0x27bb2ee6, w, h, cell, cols: Math.ceil(w / cell) };
    s.ground = shootGround(w, h);
    // the visit: how deep the snow lies, how it drifted, where the shoot comes up, the light on it
    s.depth0 = h * (0.11 + 0.07 * rnd(s));
    s.x0 = w * (0.38 + 0.24 * rnd(s));
    s.light = rnd(s);
    s.snow = new Float32Array(s.cols); s.base = new Float32Array(s.cols); s.isShoot = new Uint8Array(s.cols);
    const drift = Array.from({ length: 9 }, () => rnd(s));
    for (let i = 0; i < s.cols; i++) {
      const u = i / s.cols * 8, k = Math.floor(u), f = u - k, sm = f * f * (3 - 2 * f);
      s.snow[i] = s.depth0 + 10 * (drift[k] + (drift[k + 1] - drift[k]) * sm - 0.5);
      const x = (i + 0.5) * cell;
      s.isShoot[i] = Math.abs(x - s.x0) <= SHOOT.HALF ? 1 : 0;
    }
    s.tip = 0; s.boost = 0; s.through = false; s.t = 0;
    s.green = null; s.letterCells = []; s.front = null; s.top = null; s.bottom = null;
    settle(s, 400);
    return s;
  }

  function shootSurface(s, i) { return s.base[i] + s.snow[i]; }

  // Let the snow slide until no slope between neighbours is steeper than its angle of repose. Only snow
  // moves, from the higher column to the lower, so the total never changes.
  function settle(s, passes) {
    const limit = SHOOT.REPOSE * s.cell, n = s.cols;
    for (let p = 0; p < passes; p++) {
      let worst = 0;
      for (let dir = 0; dir < 2; dir++) {
        for (let k = 0; k + 1 < n; k++) {
          const i = dir ? n - 2 - k : k, j = i + 1;
          const d = (s.base[i] + s.snow[i]) - (s.base[j] + s.snow[j]);
          const ex = Math.abs(d) - limit;
          if (ex <= 0) continue;
          const hi = d > 0 ? i : j, lo = d > 0 ? j : i;
          const m = Math.min(s.snow[hi], ex / 2 + 1e-9);
          s.snow[hi] -= m; s.snow[lo] += m;
          if (ex > worst) worst = ex;
        }
      }
      if (worst < 1e-7) break;
    }
  }

  // Snow also creeps: grains settle toward their neighbours' level, so a heap at its angle of repose
  // rounds over instead of standing in a sharp ridge. Snow moves between snow columns only, high to low.
  function creep(s, dt) {
    const k = Math.min(0.24, SHOOT.CREEP * dt / (s.cell * s.cell));
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i + 1 < s.cols; i++) {
      if (s.isShoot[i] || s.isShoot[i + 1]) continue;
      const d = (s.base[i] + s.snow[i]) - (s.base[i + 1] + s.snow[i + 1]);
      const hi = d > 0 ? i : i + 1, lo = d > 0 ? i + 1 : i, m = Math.min(s.snow[hi], k * Math.abs(d));
      s.snow[hi] -= m; s.snow[lo] += m;
    }
  }

  // The line: which cells are letter (from inside(x, y)) and the box it sits in (px, from the top)
  function shootLetters(s, inside, rect) {
    s.letterCells = [];
    const c = 1.5;
    for (let y = rect.y; y < rect.y + rect.h; y += c) for (let x = rect.x; x < rect.x + rect.w; x += c) {
      if (inside(x + c / 2, y + c / 2)) s.letterCells.push({ x: x + c / 2, y: y + c / 2, i: s.letterCells.length });
    }
    s.green = new Uint8Array(s.letterCells.length);
    let top = Infinity, bottom = -Infinity;
    for (const p of s.letterCells) { top = Math.min(top, p.y); bottom = Math.max(bottom, p.y); }
    s.top = top; s.bottom = bottom;
  }
  function shootGreen(s) {
    if (!s.green || !s.green.length) return 0;
    let n = 0;
    for (let i = 0; i < s.green.length; i++) n += s.green[i];
    return n / s.green.length;
  }

  function shootPush(s) { s.boost += 1; }

  function shootStep(s, dt) {
    s.t += dt;
    s.boost *= Math.exp(-dt / SHOOT.PUSH_TAU);
    // the stem stops under the line, and the green carries on up into it
    const stemTop = s.bottom != null ? s.ground - s.bottom : s.ground * 0.55;
    let load = 0;
    for (let i = 0; i < s.cols; i++) if (s.isShoot[i]) load = Math.max(load, s.snow[i]);
    const v = (s.through ? SHOOT.AIR : SHOOT.GROW / (1 + SHOOT.LOAD * load)) + SHOOT.PUSH * s.boost;
    if (s.tip < stemTop) s.tip = Math.min(stemTop, s.tip + v * dt);
    else if (s.green) {
      if (s.front == null) s.front = s.bottom + 1;
      s.front -= (SHOOT.RISE + SHOOT.PUSH * 0.4 * s.boost) * dt;
      for (const p of s.letterCells) if (!s.green[p.i] && p.y >= s.front) s.green[p.i] = 1;
    }
    // the stem lifts the snow on it, and the heap slides away
    for (let i = 0; i < s.cols; i++) if (s.isShoot[i]) s.base[i] = Math.max(s.base[i], s.tip);
    settle(s, 300);
    creep(s, dt);
    // through, once the tip stands above the snow heaped beside the stem (a little cap may ride on it)
    if (!s.through) {
      let beside = 0;
      for (let i = 0; i < s.cols; i++) if (!s.isShoot[i] && (s.isShoot[i - 1] || s.isShoot[i + 1])) beside = Math.max(beside, shootSurface(s, i));
      if (s.tip > beside) s.through = true;
    }
  }

  const api = { SHOOT, shootGround, shootCreate, shootSurface, shootLetters, shootGreen, shootPush, shootStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
