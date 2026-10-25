(function () {
  "use strict";
  // Bloom (tip #3): a meadow side-on in morning light, rows of plants going back to a low treeline,
  // most in bud (lib/visual-pw-bloom.js). Touch, and pollen drifts from the nearest open flower to the
  // buds round your finger; each opens as it arrives and sends its own pollen on, so the help travels,
  // visibly, and multiplies until the whole meadow is in flower. The line hangs in the sky above it,
  // grey while the meadow waits, coming into the flowers' colour as they open. Every flower's middle is
  // pale (a dark-centred flower is an eye). Each visit: the meadow's colours, where the few early flowers
  // are, the light.
  const ID = "pw-bloom";
  const CSS = "";
  const STIR = 0.5;                       // rad/s: stems stirring in the morning air (calm: under 0.8)
  const MEADOWS = [
    [[232, 92, 72], [246, 196, 70], [250, 244, 232]],     // poppy, buttercup, daisy
    [[104, 132, 220], [246, 214, 92], [244, 240, 250]],   // cornflower, primrose, white
    [[214, 108, 160], [250, 236, 210], [240, 160, 80]],   // campion, cream, marigold
  ];

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

  function create(ctx) {
    const T = globalThis.TH, s = T.bloomCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H }), rand = T.wonderRand(ctx.seed ^ 0x13198a2e);
    const W = ctx.W, H = ctx.H, hz = s.horizon, bg = canvas(W, H), g = bg.getContext("2d");
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "rgb(70,104,150)"); sky.addColorStop(0.7, "rgb(176,190,200)"); sky.addColorStop(1, "rgb(240,226,196)");
    g.fillStyle = sky; g.fillRect(0, 0, W, hz);
    const sunX = W * (0.2 + 0.6 * rand()), haze = g.createRadialGradient(sunX, hz, 0, sunX, hz, Math.max(W, H) * 0.5);
    haze.addColorStop(0, "rgba(255,236,196,0.55)"); haze.addColorStop(1, "rgba(255,236,196,0)");
    g.fillStyle = haze; g.fillRect(0, 0, W, hz);
    // a soft far treeline
    g.fillStyle = "rgba(76,104,96,0.8)";
    g.beginPath(); g.moveTo(0, hz);
    for (let x = 0; x <= W; x += 3) g.lineTo(x, hz - 6 - 10 * Math.abs(Math.sin(x * 0.045 + rand() * 0.2)) - 6 * Math.abs(Math.sin(x * 0.013)));
    g.lineTo(W, hz); g.closePath(); g.fill();
    // the meadow: hazy green far off, deeper near, grass blades thickening toward you
    const field = g.createLinearGradient(0, hz, 0, H);
    field.addColorStop(0, "rgb(128,152,104)"); field.addColorStop(1, "rgb(44,74,40)");
    g.fillStyle = field; g.fillRect(0, hz, W, H - hz);
    for (let k = 0; k < W * (H - hz) / 14; k++) {
      const y = hz + (H - hz) * Math.pow(rand(), 0.8), u = (y - hz) / (H - hz), x = rand() * W, len = (3 + 9 * rand()) * (0.4 + u);
      g.strokeStyle = "rgba(" + [70 + 70 * rand(), 110 + 60 * rand(), 50 + 30 * rand()].map(Math.round).join(",") + ",0.5)";
      g.lineWidth = 0.6 + u; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() - 0.5) * 3, y - len); g.stroke();
    }
    return { s, bg, palette: MEADOWS[Math.floor(s.hue * MEADOWS.length) % MEADOWS.length], field: null };
  }
  function words(st, field) { st.field = field; }
  function step(st, dt) { globalThis.TH.bloomStep(st.s, dt); }

  const colourOf = (st, p) => st.palette[Math.floor(p.tint * st.palette.length) % st.palette.length];

  function plant(g, st, p, t) {
    const sway = Math.sin(t * STIR + p.phase) * 1.6 * p.scale, hx = p.hx + sway, hy = p.hy, sc = p.scale, o = p.open;
    // stem, and a leaf part way up
    g.strokeStyle = "rgb(58,104,50)"; g.lineWidth = Math.max(0.8, 1.3 * sc);
    g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x, (p.y + hy) / 2, hx, hy); g.stroke();
    g.fillStyle = "rgb(70,124,58)";
    g.beginPath(); g.ellipse(p.x + 3 * sc, p.y - (p.y - hy) * 0.35, 4 * sc, 1.4 * sc, -0.5, 0, 6.2832); g.fill();
    if (o <= 0) {                                             // a bud: a closed green teardrop
      g.fillStyle = "rgb(92,140,70)";
      g.beginPath(); g.ellipse(hx, hy - 2.5 * sc, 2.2 * sc, 3.6 * sc, 0, 0, 6.2832); g.fill();
      return;
    }
    // opening: petals spreading from the bud, greening into their colour, round a pale middle
    const col = colourOf(st, p), e = o * o * (3 - 2 * o), r = (2 + 4.5 * e) * sc, len = (3 + 3.5 * e) * sc;
    const c = col.map(v => Math.round(92 + (v - 92) * Math.min(1, o * 1.5)));
    g.fillStyle = "rgb(" + c + ")";
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * (0.25 + 0.75 * e) * 0.95;
      g.beginPath(); g.ellipse(hx + Math.cos(a) * r * 0.6, hy - 2 * sc + Math.sin(a) * r * 0.6, len * 0.62, len * 0.3, a, 0, 6.2832); g.fill();
    }
    g.fillStyle = "rgb(250,234,160)";
    g.beginPath(); g.arc(hx, hy - 2 * sc, (0.8 + 1.4 * e) * sc, 0, 6.2832); g.fill();
  }

  function draw(g, st, ctx) {
    const T = globalThis.TH, s = st.s;
    g.drawImage(st.bg, 0, 0, ctx.W, ctx.H);
    // the line in the sky: grey while the meadow waits, coming into the flowers' colour as it opens
    if (st.field) {
      const c = T.bloomColour(s), a = st.palette[0], grey = [96, 104, 112], mix = grey.map((v, k) => Math.round(v + (a[k] - v) * c));
      T.wonderLine(g, st.field, "rgba(" + mix + "," + (0.55 + 0.4 * c).toFixed(2) + ")");
    }
    for (const p of s.plants) plant(g, st, p, ctx.t);
    // pollen on its way, along a lifting curve, with a short fading trail
    g.globalCompositeOperation = "lighter";
    for (const m of s.motes) {
      if (m.t <= 0) continue;
      const A = s.plants[m.from], B = s.plants[m.to];
      for (let k = 0; k < 3; k++) {
        const u = Math.max(0, m.t / m.dur - k * 0.04), cx = (A.hx + B.hx) / 2 + m.drift, cy = Math.min(A.hy, B.hy) - m.lift;
        const x = (1 - u) * (1 - u) * A.hx + 2 * u * (1 - u) * cx + u * u * B.hx, y = (1 - u) * (1 - u) * A.hy + 2 * u * (1 - u) * cy + u * u * B.hy;
        g.fillStyle = "rgba(255,226,120," + (0.75 - 0.25 * k).toFixed(2) + ")";
        g.beginPath(); g.arc(x, y, 1.6 - 0.35 * k, 0, 6.2832); g.fill();
      }
    }
    g.globalCompositeOperation = "source-over";
  }
  function touch(st, kind, x, y) { if (kind === "down") globalThis.TH.bloomTouch(st.s, x, y); }
  function resize(st, ctx) { const f = st.field; Object.assign(st, create(ctx)); st.field = f; }
  function info(st) {
    const T = globalThis.TH, s = st.s;
    return { plants: s.plants.length, open: s.plants.filter(p => p.open >= 1).length, motes: s.motes.length, colour: +T.bloomColour(s).toFixed(2) };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-bloom-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Bloom", phrase: "Help others to flourish.", mount,
      // in the sky over the meadow (its horizon at 56% of the height, 50% sideways)
      wordsMode: "around",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(W / 20, H / 10) : Math.min(40, W / 9);
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.34 : 0.3) }, maxWidth: W * (wide ? 0.7 : 0.84) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
