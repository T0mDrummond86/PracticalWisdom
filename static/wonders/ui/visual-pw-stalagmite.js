(function () {
  "use strict";
  // Stalagmite (tip #12): a cave floor from above in close lamplight, wet dark limestone, and the line
  // coming up out of it in calcite, ring on ring, a drop at a time (lib/visual-pw-stalagmite.js). The
  // mineral is lit as relief, its edges catching the lamp, so the letters stand up off the floor as they
  // build. Each drop shows as a faint splash. Touch to let a drop fall there. A dark cave is a small
  // subject in an empty field, so the lamp is close and its light fills the frame. Each visit: the
  // mineral's colour, the lamp's side and warmth, the drips' pace.
  const ID = "pw-stalagmite";
  const CSS = "";

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

  function create(ctx) {
    const T = globalThis.TH, s = T.stalagmiteCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H }), rand = T.wonderRand(ctx.seed ^ 0x6a09e667);
    const gw = s.gw, gh = s.gh, n = gw * gh;
    // the floor: wet limestone, mottled at two scales, in a pool of lamplight from just above one side
    const lat = (sp) => { const lw = Math.ceil(gw / sp) + 2, t = new Float32Array(lw * (Math.ceil(gh / sp) + 2)); for (let i = 0; i < t.length; i++) t[i] = rand(); return { sp, lw, t }; };
    const big = lat(26), small = lat(5);
    const vn = (L, x, y) => { const fx = x / L.sp, fy = y / L.sp, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy, a = L.t[iy * L.lw + ix], b = L.t[iy * L.lw + ix + 1], c = L.t[(iy + 1) * L.lw + ix], d = L.t[(iy + 1) * L.lw + ix + 1], su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; };
    const lampX = gw * (0.5 + 0.28 * s.lampSide), lampY = gh * 0.12, sig = Math.sqrt(gw * gh) * 0.78;
    const rock = new Float32Array(n * 3), lamp = new Float32Array(n);
    const warm = [255, 214 - 30 * s.lampWarm, 168 - 60 * s.lampWarm].map(v => v / 255);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x, m = 0.6 * vn(big, x, y) + 0.4 * vn(small, x, y);
      const l = 0.16 + 1.0 * Math.exp(-((x - lampX) ** 2 + (y - lampY) ** 2) / (2 * sig * sig));
      lamp[i] = l;
      const base = 40 + 34 * m;
      rock[i * 3] = base * 1.05 * l * warm[0]; rock[i * 3 + 1] = base * 0.95 * l * warm[1]; rock[i * 3 + 2] = base * 0.88 * l * warm[2];
    }
    const cv = canvas(gw, gh), g = cv.getContext("2d"), img = g.createImageData(gw, gh);
    for (let i = 0; i < n; i++) { img.data[i * 4] = rock[i * 3]; img.data[i * 4 + 1] = rock[i * 3 + 1]; img.data[i * 4 + 2] = rock[i * 3 + 2]; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    const o = s.ochre, mineral = [228 - 20 * o, 214 - 46 * o, 190 - 74 * o];
    // the lamp's direction, for the relief: from its side, from above
    const lx = s.lampSide * 0.5, ly = -0.6, lz = 0.62;
    return { s, cv, g, img, rock, lamp, warm, mineral, light: [lx, ly, lz], field: null };
  }

  // the mineral, repainted where drops have fallen: calcite over the rock, its relief lit by the lamp
  function paint(st) {
    const s = st.s, d = s.dirty;
    if (!d) return;
    s.dirty = null;
    const gw = s.gw, gh = s.gh, M = s.mass, px = st.img.data, [lx, ly, lz] = st.light, mc = st.mineral, w = st.warm;
    const x0 = Math.max(0, d.x0 - 1), x1 = Math.min(gw - 1, d.x1 + 1), y0 = Math.max(0, d.y0 - 1), y1 = Math.min(gh - 1, d.y1 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * gw + x, m = M[i];
      let r = st.rock[i * 3], g2 = st.rock[i * 3 + 1], b = st.rock[i * 3 + 2];
      if (m > 0.004) {
        const hx = (M[y * gw + Math.min(gw - 1, x + 1)] - M[y * gw + Math.max(0, x - 1)]) * 6;
        const hy = (M[Math.min(gh - 1, y + 1) * gw + x] - M[Math.max(0, y - 1) * gw + x]) * 6;
        const nl = Math.sqrt(hx * hx + hy * hy + 1), shade = Math.max(0.25, (-hx * lx - hy * ly + lz) / nl / lz);
        const a = Math.min(1, m / 0.22), l = st.lamp[i] * shade;
        r += (mc[0] * l * w[0] - r) * a; g2 += (mc[1] * l * w[1] - g2) * a; b += (mc[2] * l * w[2] - b) * a;
      }
      px[i * 4] = r; px[i * 4 + 1] = g2; px[i * 4 + 2] = b;
    }
    st.g.putImageData(st.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }

  function words(st, field) {
    let cells = 0; for (let i = 0; i < field.mask.length; i++) cells += field.mask[i];
    const pts = field.points(Math.max(300, Math.min(2600, Math.round(cells * 0.5))));
    globalThis.TH.stalagmiteLetters(st.s, pts, field.inside);
    st.field = field;
  }
  function step(st, dt) { globalThis.TH.stalagmiteStep(st.s, dt); }
  function draw(g, st, ctx) {
    const s = st.s;
    paint(st);
    g.imageSmoothingEnabled = true;
    g.drawImage(st.cv, 0, 0, s.gw * s.cell, s.gh * s.cell);
    // each drop's splash: a faint ring spreading on the wet floor
    g.lineWidth = 0.7;
    for (const p of s.splashes) {
      const u = p.age / 0.35;
      g.strokeStyle = "rgba(255,240,214," + (0.22 * (1 - u)).toFixed(3) + ")";
      g.beginPath(); g.arc(p.x, p.y, p.r + 3.5 * u, 0, 6.2832); g.stroke();
    }
    if (!st.vg) {
      st.vg = g.createRadialGradient(ctx.W / 2, ctx.H * 0.42, Math.min(ctx.W, ctx.H) * 0.3, ctx.W / 2, ctx.H * 0.42, Math.hypot(ctx.W, ctx.H) * 0.62);
      st.vg.addColorStop(0, "rgba(4,5,10,0)"); st.vg.addColorStop(1, "rgba(4,5,10,0.6)");
    }
    g.fillStyle = st.vg; g.fillRect(0, 0, ctx.W, ctx.H);
  }
  function touch(st, kind, x, y) { if (kind === "down") globalThis.TH.stalagmiteTouch(st.s, x, y); }
  // a new size is a new floor; the drips start again over the line
  function resize(st, ctx) {
    const field = st.field;
    Object.assign(st, create(ctx), { vg: null });
    if (field) words(st, field);
  }
  function info(st) {
    const T = globalThis.TH, s = st.s;
    return { drips: s.drips.length, drops: s.drops, built: +T.stalagmiteCoverage(s).toFixed(2), splashes: s.splashes.length, cells: [s.gw, s.gh] };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-stalagmite-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Stalagmite", phrase: "Big success is tiny successes building on each other.", mount,
      // on the floor in the middle of the lamp's pool
      wordsMode: "become",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(40, W / 21) : Math.min(40, W / 9.5);
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.46 : 0.44) }, maxWidth: W * (wide ? 0.7 : 0.84) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
