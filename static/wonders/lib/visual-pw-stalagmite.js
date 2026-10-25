(function () {
  "use strict";
  // Stalagmite (tip #12: "Big success is tiny successes building on each other."): a cave wall seen
  // side-on in lamplight, the line standing on rock ledges. Water seeping through the limestone above
  // gathers at the tip of each stalactite as a drop, swells until its weight beats its surface tension,
  // lets go, and falls, faster and faster, onto whatever stands below. There, as the film it leaves gives
  // up its carbon dioxide, a little calcite comes out of it: a layer a few hundredths of a millimetre in a
  // real cave, a few pixels here. One drop is almost nothing. Drop on drop, the letters grow up off their
  // ledge, bottom first, each layer laid on the last, the way a stalagmite does. Mineral is only ever
  // added. A touch lets the nearest drop fall now. Pure; node-tested.
  const STALAGMITE = {
    MAX_RATE: 0.8,
    GRAVITY: 900,        // px/s^2
    LAYER: 3.2,          // px of calcite a drop lays right under where it lands
    SPREAD: 3.5,         // px: how far its film runs either side
    PERIOD: [1.3, 2.8],  // s for a drop to gather at one tip
    PITCH: 13,           // px between stalactites
    BAND: 2.6,           // px of growth per band of colour (each band a few drops)
  };

  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s.rs ^ (s.rs >>> 15), s.rs | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  function stalagmiteCreate(o) {
    const seed = o.seed >>> 0;
    const s = { seed, rs: seed ^ 0xb5297a4d, w: o.w, h: o.h, rows: [], drips: [], falling: [], splashes: [], fresh: [], drops: 0, t: 0 };
    // the visit: the mineral's colour, the lamp's side and warmth, how fast the water comes
    s.ochre = rnd(s); s.lampSide = rnd(s) < 0.5 ? -1 : 1; s.lampWarm = rnd(s); s.pace = 0.85 + 0.3 * rnd(s);
    return s;
  }

  // The line, one row per line of it: { cell, gw, gh, mask, rect, ledge } (ledge: the y it stands on).
  // ceiling: the y the top row's stalactites hang from; each lower row's hang from the ledge above.
  function stalagmiteLetters(s, rows, ceiling) {
    s.rows = rows.map(r => {
      const cells = [], cols = [];
      let floor = -Infinity;
      for (let gy = 0; gy < r.gh; gy++) for (let gx = 0; gx < r.gw; gx++) if (r.mask[gy * r.gw + gx]) floor = Math.max(floor, r.rect.y + (gy + 1) * r.cell);
      // the letters stand on the ledge: growth starts there; a descender hangs below the ledge's edge,
      // already there, like the little stalactites under any shelf
      if (r.ledge != null) floor = r.ledge;
      for (let gx = 0; gx < r.gw; gx++) {
        const col = [];
        for (let gy = r.gh - 1; gy >= 0; gy--) if (r.mask[gy * r.gw + gx]) {
          const c = { gx, gy, x: r.rect.x + (gx + 0.5) * r.cell, y: r.rect.y + (gy + 0.5) * r.cell, built: false, band: 0 };
          cells.push(c); col.push(c);
        }
        let next = 0;
        while (next < col.length && col[next].y > floor) col[next++].built = true;
        cols.push({ cells: col, next });
      }
      return { rect: r.rect, cell: r.cell, gw: r.gw, gh: r.gh, mask: r.mask, ledge: r.ledge, floor, cells, cols, front: new Float32Array(r.gw) };
    });
    // stalactites over each row, a little irregularly spaced, hanging from the ceiling or the ledge above
    s.drips = [];
    const [p0, p1] = STALAGMITE.PERIOD;
    s.rows.forEach((r, i) => {
      const hang = i === 0 ? ceiling : s.rows[i - 1].ledge + 7;
      const room = Math.max(6, r.rect.y + 4 - hang);
      for (let x = r.rect.x + 4; x < r.rect.x + r.rect.w - 4; x += STALAGMITE.PITCH * (0.75 + 0.5 * rnd(s))) {
        const period = (p0 + (p1 - p0) * rnd(s)) / s.pace;
        const u = rnd(s);                               // mostly short, now and then a long one
        s.drips.push({ row: i, x, hang, tip: hang + Math.min(room * 0.8, 3 + 26 * u * u * u), period, t: rnd(s) * period, size: 0 });
      }
    });
  }

  // where the top of the growth is in row i at x (px): the floor, raised by what has been laid there
  function stalagmiteTop(s, i, x) {
    const r = s.rows[i], c = Math.min(r.gw - 1, Math.max(0, Math.floor((x - r.rect.x) / r.cell)));
    return r.floor - r.front[c];
  }

  // a drop lands in row i at x: a layer, thickest under it, thinning either side; the letter cells the
  // growth has now reached are built, each remembering which band of layers it belongs to
  function land(s, i, x, y) {
    const r = s.rows[i], sig = STALAGMITE.SPREAD, reach = Math.ceil(3 * sig / r.cell);
    const c0 = Math.floor((x - r.rect.x) / r.cell);
    for (let c = Math.max(0, c0 - reach); c <= Math.min(r.gw - 1, c0 + reach); c++) {
      const dx = r.rect.x + (c + 0.5) * r.cell - x;
      r.front[c] += STALAGMITE.LAYER * Math.exp(-dx * dx / (2 * sig * sig));
      const col = r.cols[c], top = r.floor - r.front[c];
      while (col.next < col.cells.length && col.cells[col.next].y >= top) {
        const cell = col.cells[col.next++];
        cell.built = true; cell.band = Math.floor((r.floor - cell.y) / STALAGMITE.BAND);
        s.fresh.push({ cell, row: i, age: 0 });
      }
    }
    s.splashes.push({ x, y, age: 0, row: i });
    s.drops++;
  }

  function stalagmiteCoverage(s) {
    let n = 0, b = 0;
    for (const r of s.rows) for (const c of r.cells) { n++; if (c.built) b++; }
    return n ? b / n : 0;
  }

  function release(s, k) {
    const d = s.drips[k];
    s.falling.push({ drip: k, x: d.x, y: d.tip, vy: 0, size: Math.max(1.4, d.size) });
    d.t = 0; d.size = 0;
  }
  // a touch: the drop at the stalactite nearest the finger lets go now, whatever its size
  function stalagmiteTouch(s, x, y) {
    let best = -1, bd = Infinity;
    s.drips.forEach((d, k) => { const dd = Math.hypot(d.x - x, d.tip - y); if (dd < bd) { bd = dd; best = k; } });
    if (best >= 0) release(s, best);
  }

  function stalagmiteStep(s, dt) {
    s.t += dt;
    s.drips.forEach((d, k) => {
      d.t += dt;
      d.size = 2.6 * Math.cbrt(Math.min(1, d.t / d.period));      // a drop's volume grows steadily; its size as the cube root
      if (d.t >= d.period) release(s, k);
    });
    for (let k = s.falling.length - 1; k >= 0; k--) {
      const f = s.falling[k], d = s.drips[f.drip];
      f.vy += STALAGMITE.GRAVITY * dt; f.y += f.vy * dt;
      const top = stalagmiteTop(s, d.row, f.x);
      if (f.y >= top) { land(s, d.row, f.x, top); s.falling[k] = s.falling[s.falling.length - 1]; s.falling.pop(); }
    }
    for (const p of s.splashes) p.age += dt;
    s.splashes = s.splashes.filter(p => p.age < 0.4);
    for (const f of s.fresh) f.age += dt;
    s.fresh = s.fresh.filter(f => f.age < 1.4);
  }

  const api = { STALAGMITE, stalagmiteCreate, stalagmiteLetters, stalagmiteTop, stalagmiteCoverage, stalagmiteTouch, stalagmiteStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
