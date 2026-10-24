(function () {
  "use strict";
  // Kerf (tip #20: "Measure twice, cut once."): a board propped at a slight lean on the bench, seen
  // from above in raking light, under a coat of fine sanding dust. Someone pencilled a note on it; the
  // dust hides it. A touch strikes a pencil mark; a second touch, a second mark beside the first (you
  // measured twice); only the third cuts, and it cuts along the mean of the two marks, wherever the
  // third touch fell. The saw opens the kerf from edge to edge and throws fresh sawdust out of it, and
  // while it runs, and for a while after, the board shakes: dust on a shaking slope runs downhill like
  // a liquid, off the lower edge. Where it has gone, the pencilled line shows. Left alone, a hand
  // measures twice and cuts once by itself, so the line always comes. Pure; node-tested.
  const KERF = {
    MAX_RATE: 0.8, CELL: 4,
    CLEAR: 0.12,         // dust thinner than this no longer hides the pencil
    SAW: 2.4,            // s to saw through, edge to edge
    SHAKE: 3.5,          // s for the shaking to die away after the cut
    SLIDE: 110,          // px/s: how fast dust runs downhill on the shaking board
    GRAVITY: 260,        // px/s^2 down the lean, for a loose grain
    THROW: 170,          // grains a second out of the kerf while the saw runs
    WAIT: 4.5, PAUSE: 1.4, // left alone: the hand's first mark after WAIT s, then a mark or the cut every PAUSE s
  };

  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s.rs ^ (s.rs >>> 15), s.rs | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }
  function table(s, n) { const t = new Float32Array(n); for (let i = 0; i < n; i++) t[i] = rnd(s); return t; }
  const smooth = (t, u) => { const k = Math.floor(u), f = u - k, n = t.length - 1, a = t[((k % n) + n) % n], b = t[(((k + 1) % n) + n) % n]; return a + (b - a) * f * f * (3 - 2 * f); };

  function kerfCreate(o) {
    const seed = o.seed >>> 0, w = o.w, h = o.h, wide = w > h, cell = KERF.CELL;
    const s = { seed, rs: seed ^ 0x9e3779b9, w, h, cell };
    s.board = { y0: h * 0.1, y1: h * 0.9 };
    // the wood: which timber, how wide its growth rings, how they wander
    s.species = Math.floor(rnd(s) * 3);
    s.rings = 7 + 6 * rnd(s);
    s.wander = table(s, 257); s.wander2 = table(s, 257); s.fleck = table(s, 1031);
    s.cols = Math.ceil(w / cell); s.rows = Math.max(1, Math.ceil((s.board.y1 - s.board.y0) / cell));
    s.dust = new Float32Array(s.cols * s.rows); s.mask = new Float32Array(s.cols * s.rows); s.letters = 0;
    const drift = table(s, 97);
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++)
      s.dust[r * s.cols + c] = 0.75 + 0.5 * smooth(drift, c / 9 + r / 13 + 3 * smooth(drift, r / 7));
    s.marks = []; s.cut = null; s.cuts = []; s.grains = []; s.shake = 0; s.touched = false; s.clock = 0; s.hand = 0;
    return s;
  }

  // The grain at (x, y), 0 (pale) to 1 (dark): growth rings running across the board, wandering along
  // it and closer or wider apart as the years were good or lean; each ring pale earlywood darkening into
  // latewood, then a sharp edge to the next year; and pores, short dark streaks along the grain
  function kerfGrain(s, x, y) {
    const v = y / s.rings + 3 * smooth(s.wander, x / 140) + 1.1 * smooth(s.wander2, x / 37 + y / 60) + 0.9 * smooth(s.wander2, y / 33 + 40);
    const f = v - Math.floor(v), ring = f < 0.7 ? 0.3 * f / 0.7 : 0.3 + 0.7 * (f - 0.7) / 0.3;
    const pores = smooth(s.fleck, x / 7 + Math.floor(y / 1.5) * 13.7);
    return 0.78 * ring * ring * (3 - 2 * ring) + 0.22 * pores * pores;
  }

  // How much of each dust cell is pencilled letter, from inside(x, y) (the word field)
  function kerfLetters(s, inside) {
    let total = 0;
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
      let k = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++)
        if (inside((c + (sx + 0.5) / 2) * s.cell, s.board.y0 + (r + (sy + 0.5) / 2) * s.cell)) k++;
      s.mask[r * s.cols + c] = k / 4; total += k / 4;
    }
    s.letters = total;
  }
  function kerfShown(s, i) { return s.mask[i] * Math.min(1, Math.max(0, 1 - s.dust[i] / KERF.CLEAR)); }
  function kerfLettersShown(s) {
    if (!s.letters) return 0;
    let v = 0;
    for (let i = 0; i < s.mask.length; i++) if (s.mask[i]) v += kerfShown(s, i);
    return v / s.letters;
  }

  function mark(s, x) { s.marks.push({ x, age: 0 }); return "mark"; }
  // A touch at (x, y): a mark, a second mark, then the cut along their mean. While the saw runs a touch
  // does nothing; after it, the next touch starts measuring again.
  function kerfTouch(s, x, y, byHand) {
    if (!byHand) s.touched = true;
    if (s.cut && !s.cut.done) return "busy";
    if (s.cut) { s.cuts.push(s.cut); s.cut = null; s.marks = []; }
    const cx = Math.min(s.w - 8, Math.max(8, x));
    if (s.marks.length < 2) return mark(s, cx);
    s.cut = { x: (s.marks[0].x + s.marks[1].x) / 2, front: 0, done: false };
    return "cut";
  }

  function kerfStep(s, dt) {
    s.clock += dt;
    // left alone, the hand: a mark, a second mark just beside it, then the cut
    if (!s.touched && !s.cut && s.clock >= KERF.WAIT + s.hand * KERF.PAUSE && s.hand < 3) {
      const x0 = s.marks.length ? s.marks[0].x : s.w * (0.3 + 0.4 * rnd(s));
      kerfTouch(s, s.hand === 1 ? x0 + (rnd(s) - 0.5) * 6 : x0, 0, true);
      s.hand++;
    }
    for (const m of s.marks) m.age += dt;
    const b = s.board;
    if (s.cut && !s.cut.done) {
      s.cut.front = Math.min(1, s.cut.front + dt / KERF.SAW);
      s.shake = 1;
      // sawdust thrown out of the kerf where the blade is
      let n = KERF.THROW * dt;
      while (n > 0 && s.grains.length < 700) {
        if (n < 1 && rnd(s) > n) break;
        n -= 1;
        const side = rnd(s) < 0.5 ? -1 : 1;
        s.grains.push({ x: s.cut.x + side * (1.5 + 2 * rnd(s)), y: b.y0 + s.cut.front * (b.y1 - b.y0) - 6 * rnd(s),
          vx: side * (15 + 45 * rnd(s)), vy: 10 + 40 * rnd(s), r: 0.6 + 0.9 * rnd(s), still: false });
      }
      if (s.cut.front >= 1) s.cut.done = true;
    } else if (s.shake > 0) {
      s.shake *= Math.exp(-dt / KERF.SHAKE);
      if (s.shake < 0.02) s.shake = 0;
    }
    // dust on a shaking slope runs downhill, row into the row below, and off the lower edge
    if (s.shake > 0) {
      const c = Math.min(0.45, s.shake * KERF.SLIDE * dt / s.cell);
      for (let col = 0; col < s.cols; col++) for (let r = s.rows - 1; r >= 0; r--) {
        const i = r * s.cols + col, m = s.dust[i] * c;
        s.dust[i] -= m;
        if (r + 1 < s.rows) s.dust[i + s.cols] += m;
      }
    }
    // loose grains: on a slight lean a grain only slides while the board shakes (still, friction holds
    // it), so on the board gravity pulls in proportion to the shaking; off the edge it simply falls
    const drag = Math.exp(-dt * (3 - 1.5 * s.shake));
    for (let k = s.grains.length - 1; k >= 0; k--) {
      const g = s.grains[k];
      if (g.still) continue;
      const onBoard = g.y < b.y1;
      g.vy = (g.vy + KERF.GRAVITY * (onBoard ? s.shake : 1) * dt) * (onBoard ? drag : 1);
      g.vx *= onBoard ? drag : 1;
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (onBoard && s.shake < 0.05 && Math.hypot(g.vx, g.vy) < 4) { g.still = true; g.vx = g.vy = 0; }
      if (g.y > s.h + 10) { s.grains[k] = s.grains[s.grains.length - 1]; s.grains.pop(); }
    }
  }

  const api = { KERF, kerfCreate, kerfGrain, kerfLetters, kerfShown, kerfLettersShown, kerfTouch, kerfStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
