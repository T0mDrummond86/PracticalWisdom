(function () {
  "use strict";
  // Filings (tip #67): a few thousand iron filings on a sheet of cool toned paper in low side light,
  // lying along the field of two opposite poles hidden just off the left and right edges
  // (lib/visual-pw-filings.js). Neither pole is ever shown: two round poles side by side are two eyes,
  // and the point is the field between them, true to both. The line is made of filings drawn into its
  // letters. Drag on either half of the sheet to move that side's pole, and watch every line swing.
  // Each filing is a short dark stroke with a hairline shadow away from the light, and a dull sheen
  // that depends only on how it lies to the light, so it never flickers. Each visit: the scatter, the
  // poles' strengths and heights, the paper.
  const ID = "pw-filings";
  const CSS = "";
  const SHADES = ["rgb(28,29,33)", "rgb(48,50,56)", "rgb(76,79,87)", "rgb(108,112,120)"];

  function paperFor(ctx, rand) {
    const W = Math.round(ctx.W / 2), H = Math.round(ctx.H / 2);
    const cv = document.createElement("canvas"); cv.width = Math.max(1, W); cv.height = Math.max(1, H);
    const g = cv.getContext("2d"), img = g.createImageData(cv.width, cv.height), px = img.data;
    const tone = rand(), base = [112 + 10 * tone, 116 + 6 * tone, 122 - 4 * tone];
    const la = Math.PI * (0.9 + 0.35 * rand()), lx = Math.cos(la), ly = Math.sin(la);
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const u = x / cv.width - 0.5, v = y / cv.height - 0.5;
      const near = 1 + 0.4 * (u * lx + v * ly), rr = Math.sqrt(u * u + v * v);
      const vig = 1 - 0.6 * Math.min(1, Math.max(0, (rr - 0.25) / 0.45));
      const k = 0.8 * near * vig, n = (rand() - 0.5) * 6, o = (y * cv.width + x) * 4;
      px[o] = base[0] * k + n; px[o + 1] = base[1] * k + n; px[o + 2] = base[2] * k + n; px[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return { cv, light: la };
  }

  function create(ctx) {
    const T = globalThis.TH, rand = T.wonderRand(ctx.seed ^ 0x1b873593);
    return { s: T.filingsCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H }), paper: paperFor(ctx, rand), pts: null, holding: -1 };
  }
  function words(st, field) {
    let cells = 0; for (let i = 0; i < field.mask.length; i++) cells += field.mask[i];
    st.pts = field.points(Math.max(400, Math.min(1800, Math.round(cells * 0.55))));
    globalThis.TH.filingsLetters(st.s, st.pts);
  }
  function step(st, dt) { globalThis.TH.filingsStep(st.s, dt); }

  function draw(g, st, ctx) {
    const s = st.s, la = st.paper.light, sx = -Math.cos(la) * 0.9, sy = -Math.sin(la) * 0.9;
    g.globalCompositeOperation = "source-over";
    g.imageSmoothingEnabled = true;
    g.drawImage(st.paper.cv, 0, 0, ctx.W, ctx.H);
    g.lineCap = "round";
    // shadows first, all in one path, cast away from the light
    g.lineWidth = 1.3; g.strokeStyle = "rgba(10,12,18,0.28)";
    g.beginPath();
    for (let i = 0; i < s.n; i++) {
      const hx = Math.cos(s.a[i]) * s.len[i] * 0.5, hy = Math.sin(s.a[i]) * s.len[i] * 0.5;
      g.moveTo(s.x[i] - hx + sx, s.y[i] - hy + sy); g.lineTo(s.x[i] + hx + sx, s.y[i] + hy + sy);
    }
    g.stroke();
    // the filings, in four shades by how squarely they face the light: each sorted into its shade once
    if (!st.shade || st.shade.length !== s.n) st.shade = new Uint8Array(s.n);
    for (let i = 0; i < s.n; i++) {
      const c = Math.abs(Math.sin(s.a[i] - la)), sheen = c * c * c * c;
      st.shade[i] = Math.min(SHADES.length - 1, Math.floor(sheen * SHADES.length * 0.999));
    }
    g.lineWidth = 1.15;
    for (let b = 0; b < SHADES.length; b++) {
      g.strokeStyle = SHADES[b];
      g.beginPath();
      for (let i = 0; i < s.n; i++) {
        if (st.shade[i] !== b) continue;
        const hx = Math.cos(s.a[i]) * s.len[i] * 0.5, hy = Math.sin(s.a[i]) * s.len[i] * 0.5;
        g.moveTo(s.x[i] - hx, s.y[i] - hy); g.lineTo(s.x[i] + hx, s.y[i] + hy);
      }
      g.stroke();
    }
  }

  // a finger on either half takes that side's pole, and carries it up or down
  function touch(st, kind, x, y, ctx) {
    if (kind === "down") st.holding = x < ctx.W / 2 ? 0 : 1;
    if (st.holding < 0) return;
    globalThis.TH.filingsMovePole(st.s, st.holding, y);
    if (kind === "up") st.holding = -1;
  }
  // a new size is a new sheet; the line is laid out again on it
  function resize(st, ctx) {
    const fresh = create(ctx);
    st.s = fresh.s; st.paper = fresh.paper;
    if (st.pts) globalThis.TH.filingsLetters(st.s, st.pts);
  }
  function info(st) {
    const T = globalThis.TH, s = st.s;
    let home = 0; for (const [i, p] of s.targets) if (Math.hypot(s.x[i] - p.x, s.y[i] - p.y) < 1.5) home++;
    return { filings: s.n, letters: s.targets.size, home, error: +T.filingsError(s).toFixed(3),
      poles: s.poles.map(p => [Math.round(p.x), Math.round(p.y), +p.q.toFixed(2)]) };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-filings-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Filings", phrase: "Polar opposite views can both be true.", mount,
      // the filings gather into the line across the middle of the sheet, between the poles
      wordsMode: "become",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(40, W / 20) : Math.min(40, W / 9);
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.44 : 0.44) }, maxWidth: W * (wide ? 0.72 : 0.84) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
