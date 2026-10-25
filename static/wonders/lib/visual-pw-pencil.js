(function () {
  "use strict";
  // Pencil (tip #39: "The bluntest pencil is sharper than the sharpest memory."): graphite on paper.
  // Paper is not flat. Its tooth is a field of tiny hills, and a pencil does not paint: it is a soft
  // rock dragged over the hills, and it sheds on the tops it scrapes. Press lightly and only the
  // highest points catch lead, which is why a light line looks grainy; press harder and it reaches
  // further down; the valleys between stay bare until the tooth is worn flat. Nothing lifts it again:
  // what is written stays. The tooth here is rank-even (every height equally common), so a pressure p
  // catches exactly the top p of the grain, and the line's own letters are thinned to their strokes
  // and written along them, one after the other, the way a hand would. Pure; node-tested.
  const PENCIL = { MAX_RATE: 0.8, CELL: 1.5 };

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let x = Math.imul(a ^ (a >>> 15), a | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  // smooth value noise on a lattice of spacing sp cells
  function valueNoise(gw, gh, sp, rand) {
    const lw = Math.ceil(gw / sp) + 2, lh = Math.ceil(gh / sp) + 2, lat = new Float32Array(lw * lh), out = new Float32Array(gw * gh);
    for (let i = 0; i < lat.length; i++) lat[i] = rand();
    const sm = u => u * u * (3 - 2 * u);
    for (let y = 0; y < gh; y++) {
      const fy = y / sp, iy = Math.floor(fy), vy = sm(fy - iy);
      for (let x = 0; x < gw; x++) {
        const fx = x / sp, ix = Math.floor(fx), vx = sm(fx - ix), o = iy * lw + ix;
        const a = lat[o] + (lat[o + 1] - lat[o]) * vx, b = lat[o + lw] + (lat[o + lw + 1] - lat[o + lw]) * vx;
        out[y * gw + x] = a + (b - a) * vy;
      }
    }
    return out;
  }

  // The visit's paper and light: a toned sheet (never white: a white field is empty), how coarse its
  // tooth, and where the low light comes from.
  function pencilLook(seed) {
    const r = rng(seed ^ 0x5bd1e995);
    const warm = r();
    return {
      paper: [128 + 22 * warm, 122 + 10 * warm, 112 - 6 * warm].map(Math.round),
      grain: 0.8 + 0.45 * r(),
      light: Math.PI * (0.95 + 0.3 * r()),       // from the left, a little above or below
    };
  }

  function pencilCreate(o) {
    const cell = o.cell || PENCIL.CELL, seed = o.seed >>> 0;
    const gw = Math.max(2, Math.ceil(o.w / cell)), gh = Math.max(2, Math.ceil(o.h / cell));
    const look = pencilLook(seed), rand = rng(seed);
    const big = valueNoise(gw, gh, 2.4 * look.grain, rand), fine = valueNoise(gw, gh, 1.1 * look.grain, rand);
    const raw = new Float32Array(gw * gh);
    for (let i = 0; i < raw.length; i++) raw[i] = 0.45 * big[i] + 0.35 * fine[i] + 0.2 * rand();
    // rank-even: the k-th lowest of n cells has height k / (n - 1)
    const order = new Uint32Array(raw.length);
    for (let i = 0; i < order.length; i++) order[i] = i;
    order.sort((a, b) => raw[a] - raw[b]);
    const tooth = new Float32Array(raw.length);
    for (let k = 0; k < order.length; k++) tooth[order[k]] = k / (order.length - 1);
    return { seed, w: o.w, h: o.h, cell, gw, gh, tooth, g: new Float32Array(gw * gh), look, dirty: null, strokes: 0 };
  }

  const cellAt = (s, x, y) => {
    const cx = Math.min(s.gw - 1, Math.max(0, Math.floor(x / s.cell))), cy = Math.min(s.gh - 1, Math.max(0, Math.floor(y / s.cell)));
    return cy * s.gw + cx;
  };
  function pencilTooth(s, x, y) { return s.tooth[cellAt(s, x, y)]; }

  function markDirty(s, x0, y0, x1, y1) {
    const d = s.dirty;
    if (!d) s.dirty = { x0, y0, x1, y1 };
    else { d.x0 = Math.min(d.x0, x0); d.y0 = Math.min(d.y0, y0); d.x1 = Math.max(d.x1, x1); d.y1 = Math.max(d.y1, y1); }
  }

  // The nib at (x, y) px, pressing at pressure (0..1), radius px: lead on every high point under it.
  // keep(x, y), if given, is where the hand means the lead to go (the letter's own shape): none elsewhere.
  function pencilDeposit(s, x, y, pressure, radius, keep) {
    const thr = 1 - pressure, r = Math.max(radius, s.cell * 0.75), c = s.cell;
    const x0 = Math.max(0, Math.floor((x - r) / c)), x1 = Math.min(s.gw - 1, Math.floor((x + r) / c));
    const y0 = Math.max(0, Math.floor((y - r) / c)), y1 = Math.min(s.gh - 1, Math.floor((y + r) / c));
    if (x0 > x1 || y0 > y1) return;
    for (let cy = y0; cy <= y1; cy++) {
      const dy = (cy + 0.5) * c - y;
      for (let cx = x0; cx <= x1; cx++) {
        const dx = (cx + 0.5) * c - x, d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const i = cy * s.gw + cx, t = s.tooth[i];
        if (t <= thr) continue;                      // a valley: the nib passes over it
        if (keep && !keep((cx + 0.5) * c, (cy + 0.5) * c)) continue;
        const add = 0.5 * (1 - 0.6 * d / r) * Math.min(1, (t - thr) / 0.25);
        s.g[i] = Math.min(1, s.g[i] + add);
      }
    }
    markDirty(s, x0, y0, x1, y1);
  }

  // A drawn line through pts ([x, y] px): the nib set down every half cell, so it leaves no gaps
  function pencilStroke(s, pts, pressure, radius) {
    if (pts.length === 1) { pencilDeposit(s, pts[0][0], pts[0][1], pressure, radius); return; }
    const step = s.cell * 0.5;
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len / step));
      for (let j = k === 1 ? 0 : 1; j <= n; j++) pencilDeposit(s, ax + (bx - ax) * j / n, ay + (by - ay) * j / n, pressure, radius);
    }
    s.strokes++;
  }

  // ---- the letters' strokes ----------------------------------------------------------------------
  // Zhang-Suen thinning: the mask worn down to one-cell-wide strokes through its middle
  function pencilThin(mask, gw, gh) {
    const m = Uint8Array.from(mask), del = [];
    const at = (x, y) => (x < 0 || y < 0 || x >= gw || y >= gh) ? 0 : m[y * gw + x];
    let changed = true;
    while (changed) {
      changed = false;
      for (let pass = 0; pass < 2; pass++) {
        del.length = 0;
        for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
          if (!m[y * gw + x]) continue;
          const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
          let b = 0, a = 0;
          for (let k = 0; k < 8; k++) { b += p[k]; if (!p[k] && p[(k + 1) % 8]) a++; }
          if (b < 2 || b > 6 || a !== 1) continue;
          if (pass === 0 ? (p[0] * p[2] * p[4] || p[2] * p[4] * p[6]) : (p[0] * p[2] * p[6] || p[0] * p[4] * p[6])) continue;
          del.push(y * gw + x);
        }
        for (const i of del) m[i] = 0;
        if (del.length) changed = true;
      }
    }
    return m;
  }

  // The thinned strokes as paths of [gx, gy], each traced once, in writing order: line by line, and
  // in each line from the leftmost unwritten point, following the stroke where it goes straightest
  function pencilTrace(skel, gw, gh, rows) {
    const left = Uint8Array.from(skel), paths = [];
    const lineOf = y => Math.min(rows - 1, Math.floor(y * rows / gh));
    const N8 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    for (;;) {
      let best = -1, bl = Infinity, bx = Infinity;
      for (let i = 0; i < left.length; i++) {
        if (!left[i]) continue;
        const x = i % gw, l = lineOf(Math.floor(i / gw));
        if (l < bl || (l === bl && x < bx)) { best = i; bl = l; bx = x; }
      }
      if (best < 0) return paths;
      let x = best % gw, y = Math.floor(best / gw), dx = 1, dy = 0;
      left[best] = 0;
      const path = [[x, y]];
      for (;;) {
        let nx = -1, ny = -1, score = -Infinity;
        for (let k = 0; k < 8; k++) {
          const ax = x + N8[k][0], ay = y + N8[k][1];
          if (ax < 0 || ay < 0 || ax >= gw || ay >= gh || !left[ay * gw + ax]) continue;
          const sc = (N8[k][0] * dx + N8[k][1] * dy) / Math.hypot(N8[k][0], N8[k][1]) + (k < 4 ? 0.01 : 0);
          if (sc > score) { score = sc; nx = ax; ny = ay; }
        }
        if (nx < 0) break;
        dx = nx - x; dy = ny - y; x = nx; y = ny;
        left[y * gw + x] = 0;
        path.push([x, y]);
      }
      paths.push(path);
    }
  }

  // The hand that writes the line: the field's strokes, in px, with a pace that writes it in about four
  // seconds, pen lifts between strokes, and a pressure that wanders the way a hand's does
  function pencilWriter(s, field, seed) {
    const skel = pencilThin(field.mask, field.gw, field.gh);
    let area = 0, length = 0;
    for (let i = 0; i < field.mask.length; i++) { area += field.mask[i]; length += skel[i]; }
    const c = field.cell, px = q => [field.rect.x + (q[0] + 0.5) * c, field.rect.y + (q[1] + 0.5) * c];
    const paths = pencilTrace(skel, field.gw, field.gh, Math.max(1, (field.lines || []).length)).map(p => {
      const pts = p.map(px);
      // ease the cell steps out of the stroke: a three-point average, ends kept
      const sm = pts.map((q, k) => k === 0 || k === pts.length - 1 ? q
        : [(pts[k - 1][0] + 2 * q[0] + pts[k + 1][0]) / 4, (pts[k - 1][1] + 2 * q[1] + pts[k + 1][1]) / 4]);
      const cum = [0];
      for (let k = 1; k < sm.length; k++) cum.push(cum[k - 1] + Math.hypot(sm[k][0] - sm[k - 1][0], sm[k][1] - sm[k - 1][1]));
      return { pts: sm, cum, len: cum[cum.length - 1] };
    });
    const total = paths.reduce((a, p) => a + p.len, 0);
    const speed = Math.min(1100, Math.max(100, total / 4));
    // a pencil's nib, as wide as the letters' strokes: half their width is their area over twice their length
    // the nib reaches across the whole stroke; where the lead lands is held to the letter's own shape
    // (to within a cell), so the words are the font's, written in the order a hand would write them
    const radius = Math.min(5, Math.max(1.8, length ? area * c / (2 * length) * 1.6 + 1 : 2.5));
    const keep = field.dist ? (x, y) => field.dist(x, y) <= c : null;
    const lifts = paths.map((p, k) => k === 0 ? 0 : Math.min(0.04, 0.01 + Math.hypot(p.pts[0][0] - paths[k - 1].pts[paths[k - 1].pts.length - 1][0], p.pts[0][1] - paths[k - 1].pts[paths[k - 1].pts.length - 1][1]) / (speed * 4)));
    const duration = total / speed + lifts.reduce((a, b) => a + b, 0);
    const r = rng(seed ^ 0x2545f491), wobble = Array.from({ length: 64 }, () => r());
    return { paths, speed, radius, keep, lifts, duration, wobble, i: 0, d: 0, next: 0, lift: 0, arc: 0, t: 0, done: !paths.length };
  }
  // the hand's pressure, 0.84..0.96, drifting smoothly along the line: firm enough that the words read
  function pressureAt(wr, arc) {
    const u = arc / 45, k = Math.floor(u), f = u - k, sm = f * f * (3 - 2 * f), w = wr.wobble;
    return 0.84 + 0.12 * (w[k % 64] + (w[(k + 1) % 64] - w[k % 64]) * sm);
  }
  function pointAt(p, d) {
    if (p.pts.length === 1) return p.pts[0];       // a dot: the i's and the full stop
    let k = 1;
    while (k < p.cum.length - 1 && p.cum[k] < d) k++;
    const a = p.pts[k - 1], b = p.pts[k], seg = p.cum[k] - p.cum[k - 1] || 1, u = Math.min(1, Math.max(0, (d - p.cum[k - 1]) / seg));
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }
  function pencilWrite(s, wr, dt) {
    let tl = dt;
    const step = s.cell * 0.5;
    while (tl > 1e-9 && !wr.done) {
      if (wr.lift > 0) { const u = Math.min(wr.lift, tl); wr.lift -= u; tl -= u; wr.t += u; continue; }
      const p = wr.paths[wr.i];
      const d1 = Math.min(p.len, wr.d + tl * wr.speed);
      for (; wr.next <= d1 + 1e-9; wr.next += step) {
        const q = pointAt(p, wr.next);
        pencilDeposit(s, q[0], q[1], pressureAt(wr, wr.arc + wr.next), wr.radius, wr.keep);
      }
      const used = (d1 - wr.d) / wr.speed;
      tl -= used; wr.t += used; wr.d = d1;
      if (d1 >= p.len) {
        wr.arc += p.len; wr.i++; wr.d = 0; wr.next = 0; s.strokes++;
        if (wr.i >= wr.paths.length) wr.done = true; else wr.lift = wr.lifts[wr.i];
      }
    }
  }

  // How much of the letters is written: the share of the field's letter cells with lead on them
  function pencilWriteCoverage(s, field) {
    let n = 0, hit = 0;
    for (let gy = 0; gy < field.gh; gy++) for (let gx = 0; gx < field.gw; gx++) {
      if (!field.mask[gy * field.gw + gx]) continue;
      n++;
      const x0 = field.rect.x + gx * field.cell, y0 = field.rect.y + gy * field.cell;
      let lead = 0;
      for (let y = y0 + s.cell * 0.5; y < y0 + field.cell; y += s.cell)
        for (let x = x0 + s.cell * 0.5; x < x0 + field.cell; x += s.cell) lead = Math.max(lead, s.g[cellAt(s, x, y)]);
      if (lead > 0.15) hit++;
    }
    return n ? hit / n : 0;
  }

  const api = { PENCIL, pencilLook, pencilCreate, pencilTooth, pencilDeposit, pencilStroke, pencilThin, pencilTrace, pencilWriter, pencilWrite, pencilWriteCoverage };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
