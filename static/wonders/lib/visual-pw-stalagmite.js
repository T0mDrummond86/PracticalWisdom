(function () {
  "use strict";
  // Stalagmite (tip #12: "Big success is tiny successes building on each other."): a cave floor seen from
  // above in close lamplight, under a ceiling that drips. Water seeping through limestone carries calcite;
  // where a drop lands it splashes into a crown, and as the film it leaves gives up its carbon dioxide the
  // calcite comes out of it as a thin ring at the crown's rim, a little at the middle. One drop leaves
  // almost nothing. The same drip, every few seconds, for long enough, builds a stalagmite. Here the
  // ceiling drips along the line, so the line is a row of stalagmites too small to see, built ring on ring,
  // and it comes up the way they do: a little more with every drop, never all at once. A touch lets a
  // drop fall there now. Mineral is only ever added. Pure; node-tested.
  const STALAGMITE = {
    MAX_RATE: 0.8, CELL: 1.5,
    RIM: 0.03, MIDDLE: 0.013,     // calcite a drop leaves at the rim of its splash, and under it
    COVER: 0.2,                   // this much and a cell reads as built
    PERIOD: [3, 9],               // s between drops from one drip point
    MAX: 1.5,
  };

  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s.rs ^ (s.rs >>> 15), s.rs | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  function stalagmiteCreate(o) {
    const seed = o.seed >>> 0, cell = o.cell || STALAGMITE.CELL;
    const s = { seed, rs: seed ^ 0xb5297a4d, w: o.w, h: o.h, cell, gw: Math.ceil(o.w / cell), gh: Math.ceil(o.h / cell) };
    s.mass = new Float32Array(s.gw * s.gh);
    s.drips = []; s.letterCells = []; s.splashes = []; s.drops = 0; s.dirty = null; s.t = 0;
    // the visit: the mineral's colour (cream to ochre), the lamp's side and warmth, the drip's pace
    s.ochre = rnd(s); s.lampSide = rnd(s) < 0.5 ? -1 : 1; s.lampWarm = rnd(s); s.pace = 0.85 + 0.3 * rnd(s);
    return s;
  }

  function mark(s, x0, y0, x1, y1) {
    const d = s.dirty;
    if (!d) s.dirty = { x0, y0, x1, y1 };
    else { d.x0 = Math.min(d.x0, x0); d.y0 = Math.min(d.y0, y0); d.x1 = Math.max(d.x1, x1); d.y1 = Math.max(d.y1, y1); }
  }

  // One drop at (x, y) px: a ring of calcite at the rim of its splash (radius r), a little under it.
  // Where mineral already stands the film runs off it faster, so each drop adds a little less there.
  function stalagmiteDrop(s, x, y, r, quiet) {
    const R = r == null ? 1.5 + 1.7 * rnd(s) : r, c = s.cell, reach = R + 2.2;
    const cx0 = Math.max(0, Math.floor((x - reach) / c)), cx1 = Math.min(s.gw - 1, Math.floor((x + reach) / c));
    const cy0 = Math.max(0, Math.floor((y - reach) / c)), cy1 = Math.min(s.gh - 1, Math.floor((y + reach) / c));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const dx = (cx + 0.5) * c - x, dy = (cy + 0.5) * c - y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > reach) continue;
      const rim = (d - R) / 0.8, add = STALAGMITE.RIM * Math.exp(-rim * rim) + STALAGMITE.MIDDLE * Math.exp(-(d * d) / 1.4);
      const i = cy * s.gw + cx;
      s.mass[i] = Math.min(STALAGMITE.MAX, s.mass[i] + add / (1 + 1.5 * s.mass[i]));
    }
    mark(s, cx0, cy0, cx1, cy1);
    if (!quiet) s.splashes.push({ x, y, r: R, age: 0 });
    s.drops++;
  }

  // The line's drip points (px points along its strokes) and, to measure it by, which cells are letter
  function stalagmiteLetters(s, pts, inside) {
    const [p0, p1] = STALAGMITE.PERIOD;
    s.drips = pts.map(p => { const period = (p0 + (p1 - p0) * rnd(s)) / s.pace; return { x: p.x, y: p.y, period, next: rnd(s) * period }; });
    s.letterCells = [];
    for (let cy = 0; cy < s.gh; cy++) for (let cx = 0; cx < s.gw; cx++) if (inside((cx + 0.5) * s.cell, (cy + 0.5) * s.cell)) s.letterCells.push(cy * s.gw + cx);
  }
  // how much of the line is built: the share of its cells with enough mineral to read
  function stalagmiteCoverage(s) {
    if (!s.letterCells.length) return 0;
    let n = 0;
    for (const i of s.letterCells) if (s.mass[i] >= STALAGMITE.COVER) n++;
    return n / s.letterCells.length;
  }

  function stalagmiteTouch(s, x, y) { stalagmiteDrop(s, x, y); }

  function stalagmiteStep(s, dt) {
    s.t += dt;
    for (const d of s.drips) {
      d.next -= dt;
      while (d.next <= 0) {
        // a drop wanders a little as it falls, so the rings never sit one inside the other; one splash in
        // four is shown (hundreds a second, all shown, is a shimmer)
        stalagmiteDrop(s, d.x + (rnd(s) - 0.5) * 1.2, d.y + (rnd(s) - 0.5) * 1.2, undefined, rnd(s) > 0.25);
        d.next += d.period * (0.85 + 0.3 * rnd(s));
      }
    }
    for (const p of s.splashes) p.age += dt;
    let k = 0;
    for (const p of s.splashes) if (p.age < 0.35) s.splashes[k++] = p;
    s.splashes.length = k;
  }

  const api = { STALAGMITE, stalagmiteCreate, stalagmiteDrop, stalagmiteLetters, stalagmiteCoverage, stalagmiteTouch, stalagmiteStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
