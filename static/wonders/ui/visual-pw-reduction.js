(function () {
  "use strict";
  // Reduction (tip #86): a shallow pan from above, filling the frame, at a rolling boil
  // (lib/visual-pw-reduction.js). Machined steel under amber stock, the stock's colour worked out from
  // its depth (it absorbs blue first, so deep is brown and shallow is gold, and it thins to nothing
  // without an edge); bubbles of every size, drawn light, with no dark middles (from above, a dark-
  // centred bubble is an eye, and two are a face); steam lifting off where it boils hardest. As the
  // stock boils away the line shows on the base, a dark glossy reduction catching the light along its
  // edges. Press and the heat comes up under your finger: the boil quickens there and it dries first.
  // Each visit: where the flame sits, the stock's colour, and the side the next ladle comes from.
  const ID = "pw-reduction";
  const CSS = "";
  const LUT_N = 512, LUT_MAX = 1.3;

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

  // the pan's base: steel machined in fine rings round the pan's middle, under one broad soft light.
  // The pan is bigger than the frame and its middle is off it, so the rings cross the frame as arcs:
  // rings round a middle in view, under a light in view, are a target, and a target is an eye.
  function baseFor(s, W, H, rand) {
    const cv = canvas(W, H), g = cv.getContext("2d"), img = g.createImageData(W, H), px = img.data;
    const pa = rand() * 2 * Math.PI, pd = 0.75 * Math.max(W, H);
    const cx = W / 2 + Math.cos(pa) * pd, cy = H / 2 + Math.sin(pa) * pd;
    const rings = new Float32Array(2048), slow = new Float32Array(2048);
    for (let k = 0; k < rings.length; k++) { rings[k] = rand(); slow[k] = rand(); }
    const lx = W * (rand() < 0.5 ? -0.1 : 1.1), ly = H * (0.05 + 0.35 * rand()), lr = Math.sqrt(W * H) * 0.6;
    const lerp = (a, r) => { const k = Math.floor(r), f = r - k, i = k % 2047; return a[i] + (a[i + 1] - a[i]) * f * f * (3 - 2 * f); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - cx, y - cy);
      const ring = 0.6 * lerp(rings, r / 1.3) + 0.4 * lerp(slow, r / 7);
      const light = Math.exp(-((x - lx) * (x - lx) + (y - ly) * (y - ly)) / (2 * lr * lr));
      const v = 58 + 26 * ring + 70 * light, o = (y * W + x) * 4;
      px[o] = v; px[o + 1] = v + 2; px[o + 2] = v + 5; px[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  function create(ctx) {
    const T = globalThis.TH, s = T.reductionCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H });
    const rand = T.wonderRand(ctx.seed ^ 0x27d4eb2f);
    // the stock: golden broth to dark brown; how hard it takes out each colour, deep to shallow
    const st = s.stock, k = [0.45, 1.0, 2.3].map(v => v * (0.75 + 0.6 * st) * 1.7);
    const glow = [118 - 30 * st, 66 - 22 * st, 22 - 8 * st];
    const trans = new Uint8ClampedArray(LUT_N * 3), scat = new Uint8ClampedArray(LUT_N * 3);
    for (let j = 0; j < LUT_N; j++) {
      const d = j / (LUT_N - 1) * LUT_MAX, haze = 1 - Math.exp(-2.4 * d);
      for (let c = 0; c < 3; c++) { trans[j * 3 + c] = 255 * Math.exp(-k[c] * d); scat[j * 3 + c] = glow[c] * haze * 0.55; }
    }
    const L = { trans: canvas(s.gw, s.gh), scat: canvas(s.gw, s.gh), dry: canvas(s.gw, s.gh) };
    for (const key in L) L[key + "G"] = L[key].getContext("2d"), L[key + "I"] = L[key + "G"].createImageData(s.gw, s.gh);
    const vg = null;
    return { s, base: baseFor(s, Math.round(ctx.W), Math.round(ctx.H), rand), lut: { trans, scat }, L, vg, rand,
      letters: null, lettersNow: null, field: null, steam: [], holding: null };
  }

  // the line as the reduction: dark syrup, a rounded bead along every stroke, lit from above-left
  function words(st, field) {
    const T = globalThis.TH, s = st.s, gw = field.gw, gh = field.gh;
    T.reductionLetters(s, field);
    st.field = field;
    // a soft height for the syrup: the mask blurred twice, so the edges round over like a meniscus;
    // its outline from the first pass only, so the serifs stay crisp
    let hgt = Float32Array.from(field.mask), edge = null;
    for (let pass = 0; pass < 2; pass++) {
      const out = new Float32Array(hgt.length);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        let a = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
          a += hgt[yy * gw + xx]; n++;
        }
        out[y * gw + x] = a / n;
      }
      hgt = out;
      if (!edge) edge = out;
    }
    const cv = canvas(gw, gh), g = cv.getContext("2d"), img = g.createImageData(gw, gh), px = img.data;
    const lx = -0.55, ly = -0.65, lz = 0.52;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x, a = edge[i];
      if (a < 0.1) continue;
      const hx = (hgt[y * gw + Math.min(gw - 1, x + 1)] - hgt[y * gw + Math.max(0, x - 1)]) * 2.2;
      const hy = (hgt[Math.min(gh - 1, y + 1) * gw + x] - hgt[Math.max(0, y - 1) * gw + x]) * 2.2;
      const nl = Math.hypot(hx, hy, 1), nd = (-hx * lx - hy * ly + lz) / nl;
      const spec = Math.pow(Math.max(0, nd), 14) * 0.9;
      const s2 = s.stock;
      px[i * 4] = 62 - 18 * s2 + 205 * spec; px[i * 4 + 1] = 27 - 8 * s2 + 175 * spec; px[i * 4 + 2] = 10 + 140 * spec;
      px[i * 4 + 3] = 255 * Math.min(1, Math.max(0, (a - 0.1) / 0.5));
    }
    g.putImageData(img, 0, 0);
    st.letters = cv;
    st.lettersNow = canvas(gw, gh);
  }

  function step(st, dt, ctx) {
    const T = globalThis.TH, s = st.s;
    if (st.holding) T.reductionHeat(s, st.holding[0], st.holding[1]);   // a held finger keeps the heat up
    T.reductionStep(s, dt);
    // steam: lifting where it boils hardest, as much as is boiling off
    const e = Math.min(1, s.evap / (T.REDUCTION.EVAP * 0.8));
    if (st.steam.length < 16 && st.rand() < e * dt * 3) {
      for (let tries = 0; tries < 6; tries++) {
        const i = Math.floor(st.rand() * s.heat.length);
        if (st.rand() < s.heat[i] - 0.4 && s.depth[i] > 0.05) {
          st.steam.push({ x: (i % s.gw) * s.cell, y: Math.floor(i / s.gw) * s.cell, r: 50 + 70 * st.rand(), a: 0.05 + 0.04 * e, age: 0, life: 4 + 2 * st.rand(), vx: (st.rand() - 0.5) * 6 });
          break;
        }
      }
    }
    for (const w of st.steam) { w.age += dt; w.y -= 11 * dt; w.x += w.vx * dt; w.r += 6 * dt; }
    st.steam = st.steam.filter(w => w.age < w.life);
  }

  function paintLiquid(st) {
    const s = st.s, L = st.L, tr = L.transI.data, sc = L.scatI.data, dr = L.dryI.data, lut = st.lut, F = globalThis.TH.REDUCTION.FILM;
    for (let i = 0; i < s.depth.length; i++) {
      const d = s.depth[i], j = Math.min(LUT_N - 1, Math.round(d / LUT_MAX * (LUT_N - 1))) * 3, o = i * 4;
      const dry = Math.max(0, 1 - d / F);
      // a dried film of fond where the stock has gone, a shade warmer than the steel
      tr[o] = lut.trans[j] - 14 * dry; tr[o + 1] = lut.trans[j + 1] - 30 * dry; tr[o + 2] = lut.trans[j + 2] - 46 * dry; tr[o + 3] = 255;
      sc[o] = lut.scat[j]; sc[o + 1] = lut.scat[j + 1]; sc[o + 2] = lut.scat[j + 2]; sc[o + 3] = 255;
      dr[o] = dr[o + 1] = dr[o + 2] = 255; dr[o + 3] = 255 * dry;
    }
    L.transG.putImageData(L.transI, 0, 0); L.scatG.putImageData(L.scatI, 0, 0); L.dryG.putImageData(L.dryI, 0, 0);
  }

  function draw(g, st, ctx) {
    const s = st.s, W = ctx.W, H = ctx.H, gwW = s.gw * s.cell, ghH = s.gh * s.cell, L = st.L;
    paintLiquid(st);
    g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = "source-over";
    g.drawImage(st.base, 0, 0, W, H);
    g.globalCompositeOperation = "multiply"; g.drawImage(L.trans, 0, 0, gwW, ghH);
    g.globalCompositeOperation = "lighter"; g.drawImage(L.scat, 0, 0, gwW, ghH);
    g.globalCompositeOperation = "source-over";
    // the reduction, only where the stock has gone
    if (st.letters) {
      const f = st.field, ln = st.lettersNow, lg = ln.getContext("2d");
      lg.globalCompositeOperation = "copy";
      lg.drawImage(L.dry, f.rect.x / s.cell, f.rect.y / s.cell, f.rect.w / s.cell, f.rect.h / s.cell, 0, 0, ln.width, ln.height);
      lg.globalCompositeOperation = "source-in";
      lg.drawImage(st.letters, 0, 0);
      g.drawImage(ln, f.rect.x, f.rect.y, f.gw * f.cell, f.gh * f.cell);
    }
    // bubbles: a pale dome with the light caught on its upper-left shoulder; a burst leaves a faint ring
    for (const b of s.bubbles) {
      if (b.r < 0.4) continue;
      const fade = 1 - b.age / b.life;
      g.fillStyle = "rgba(255,232,196," + (0.08 + 0.12 * fade).toFixed(3) + ")";
      g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.2832); g.fill();
      g.strokeStyle = "rgba(255,246,228," + (0.25 + 0.35 * fade).toFixed(3) + ")";
      g.lineWidth = Math.min(1.1, 0.35 + b.r * 0.15);
      g.beginPath(); g.arc(b.x, b.y, b.r * 0.78, 3.4, 4.9); g.stroke();
    }
    for (const r of s.ripples) {
      const u = r.age / 0.35;
      g.strokeStyle = "rgba(255,238,210," + (0.18 * (1 - u)).toFixed(3) + ")";
      g.lineWidth = 0.7;
      g.beginPath(); g.arc(r.x, r.y, r.r + u * (4 + r.r * 1.5), 0, 6.2832); g.stroke();
    }
    // steam, lit warm from the pan below
    g.globalCompositeOperation = "screen";
    for (const w of st.steam) {
      const a = w.a * Math.sin(Math.PI * w.age / w.life);
      const gr = g.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r);
      gr.addColorStop(0, "rgba(236,226,212," + a.toFixed(3) + ")"); gr.addColorStop(1, "rgba(236,226,212,0)");
      g.fillStyle = gr; g.fillRect(w.x - w.r, w.y - w.r, 2 * w.r, 2 * w.r);
    }
    g.globalCompositeOperation = "source-over";
    if (!st.vg || st.vgW !== W || st.vgH !== H) {
      st.vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.45, Math.hypot(W, H) * 0.62);
      st.vg.addColorStop(0, "rgba(4,5,10,0)"); st.vg.addColorStop(1, "rgba(4,5,10,0.62)");
      st.vgW = W; st.vgH = H;
    }
    g.fillStyle = st.vg; g.fillRect(0, 0, W, H);
  }

  function touch(st, kind, x, y) {
    if (kind === "up") { st.holding = null; return; }
    st.holding = [x, y];
    globalThis.TH.reductionHeat(st.s, x, y);
  }
  // a new size is a new pan
  function resize(st, ctx) {
    const field = st.field;
    Object.assign(st, create(ctx));
    if (field) words(st, field);
  }
  function info(st) {
    const T = globalThis.TH, s = st.s;
    let v = 0; for (const d of s.depth) v += d;
    return { phase: s.phase, cycle: s.cycle, stock: +(v / s.depth.length).toFixed(3), lettersShown: +T.reductionLettersShown(s).toFixed(2),
      bubbles: s.bubbles.length, steam: st.steam.length, cells: [s.gw, s.gh], flame: [Math.round(s.flame.x), Math.round(s.flame.y)] };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-reduction-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Reduction", phrase: "Boil things down to their essence.", mount,
      // the line lies on the pan's base, under the stock, a little above the middle
      wordsMode: "revealed",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(40, W / 20) : Math.min(40, W / 9);
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.44 : 0.42) }, maxWidth: W * (wide ? 0.7 : 0.84) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
