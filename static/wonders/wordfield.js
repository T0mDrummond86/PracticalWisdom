(function () {
  "use strict";
  // Words as a field any visual can read (docs/superpowers/plans/2026-10-17-wonders-phrases-convergence.md).
  // A Wonder's line used to be a paragraph laid over the picture; now the visual's own material makes
  // it: starlings flock into the letters, the fog is written in, water parts round them. This file
  // lays a line out once, in a house font, into a coarse mask, and answers three questions about it:
  //   inside(x, y)  is this point on a letter?          (screen px)
  //   dist(x, y)    how far to the nearest letter, px  (0 on a letter)
  //   points(n)     n points spread along the strokes, left to right (where to put birds, grains, light)
  // Pure parts (mask -> distance, points) are node-tested; build() needs a canvas.

  // ---- pure ----------------------------------------------------------------------------------
  // chamfer distance (3-4), in cells, of a gw x gh mask (1 = letter)
  function distance(mask, gw, gh) {
    const FAR = 1e6, d = new Float32Array(gw * gh);
    for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : FAR;
    const at = (x, y) => d[y * gw + x];
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      let v = d[y * gw + x];
      if (x > 0) v = Math.min(v, at(x - 1, y) + 3);
      if (y > 0) { v = Math.min(v, at(x, y - 1) + 3); if (x > 0) v = Math.min(v, at(x - 1, y - 1) + 4); if (x < gw - 1) v = Math.min(v, at(x + 1, y - 1) + 4); }
      d[y * gw + x] = v;
    }
    for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) {
      let v = d[y * gw + x];
      if (x < gw - 1) v = Math.min(v, at(x + 1, y) + 3);
      if (y < gh - 1) { v = Math.min(v, at(x, y + 1) + 3); if (x < gw - 1) v = Math.min(v, at(x + 1, y + 1) + 4); if (x > 0) v = Math.min(v, at(x - 1, y + 1) + 4); }
      d[y * gw + x] = v;
    }
    for (let i = 0; i < d.length; i++) d[i] /= 3;
    return d;
  }
  // n points on letter cells, spread evenly (stratified), ordered left to right then top to bottom.
  // rand: () => 0..1, so where each one sits within its cell differs per visit.
  function samplePoints(mask, gw, gh, n, rand) {
    const cells = [];
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (mask[y * gw + x]) cells.push(x, y);
    const m = cells.length / 2, out = [];
    if (!m || n <= 0) return out;
    for (let i = 0; i < n; i++) {
      const k = Math.min(m - 1, Math.floor((i + rand()) * m / n));
      out.push({ gx: cells[k * 2] + rand(), gy: cells[k * 2 + 1] + rand() });
    }
    out.sort((a, b) => a.gx - b.gx || a.gy - b.gy);
    return out;
  }
  // wrap words into lines no wider than maxW, given a measure(text) -> px
  function wrap(text, measure, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean), lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (line && measure(t) > maxW) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  // ---- browser -------------------------------------------------------------------------------
  // o: { W, H, at: { x, y } (centre, px), size (px), font ("fraunces"), italic (true), maxWidth (px),
  //      cell (px per grid cell, 3), rand }
  // Returns { text, lines, rect, cell, gw, gh, mask, inside, dist, points(n), ready } synchronously;
  // ready resolves once the house font has loaded and the mask is rebuilt with it.
  function build(text, o) {
    o = o || {};
    const W = o.W || innerWidth, H = o.H || innerHeight, cell = o.cell || 3;
    const size = o.size || Math.max(22, Math.min(36, W / 11));
    const at = o.at || { x: W / 2, y: H * 0.42 };
    const maxW = o.maxWidth || W * 0.78, rand = o.rand || Math.random;
    const field = { text, cell, size, gw: 0, gh: 0, mask: null, d: null, lines: [], rect: null };
    const T = globalThis.TH || {};
    function rasterise() {
      const fontCss = T.fontString ? T.fontString(o.font || "fraunces", size, { italic: o.italic !== false }) : (o.italic !== false ? "italic " : "") + size + "px Georgia, serif";
      const c = document.createElement("canvas"), g = c.getContext("2d");
      g.font = fontCss;
      const lines = wrap(text, s => g.measureText(s).width, maxW), lh = size * 1.22;
      const w = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width)) + size * 0.6), h = Math.ceil(lines.length * lh + size * 0.5);
      const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
      c.width = gw; c.height = gh;
      g.setTransform(1 / cell, 0, 0, 1 / cell, 0, 0);
      g.font = fontCss; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff";
      lines.forEach((l, i) => g.fillText(l, w / 2, size * 0.25 + lh * (i + 0.5)));
      const px = g.getImageData(0, 0, gw, gh).data, mask = new Uint8Array(gw * gh);
      for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] > 90 ? 1 : 0;
      Object.assign(field, { lines, gw, gh, mask, d: distance(mask, gw, gh), rect: { x: at.x - w / 2, y: at.y - h / 2, w, h }, fontCss });
    }
    rasterise();
    const toCell = (x, y) => [Math.floor((x - field.rect.x) / cell), Math.floor((y - field.rect.y) / cell)];
    field.inside = (x, y) => { const [cx, cy] = toCell(x, y); return cx >= 0 && cy >= 0 && cx < field.gw && cy < field.gh && !!field.mask[cy * field.gw + cx]; };
    field.dist = (x, y) => {
      const [cx, cy] = toCell(x, y);
      const ccx = Math.max(0, Math.min(field.gw - 1, cx)), ccy = Math.max(0, Math.min(field.gh - 1, cy));
      const out = Math.hypot((cx - ccx) * cell, (cy - ccy) * cell);
      return field.d[ccy * field.gw + ccx] * cell + out;
    };
    field.points = n => samplePoints(field.mask, field.gw, field.gh, n, rand).map(p => ({ x: field.rect.x + p.gx * cell, y: field.rect.y + p.gy * cell }));
    field.ready = (T.loadFont ? T.loadFont(o.font || "fraunces").catch(() => null) : Promise.resolve()).then(() => { rasterise(); return field; });
    return field;
  }

  const api = { wordDistance: distance, wordPoints: samplePoints, wordWrap: wrap, buildWordField: build };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
