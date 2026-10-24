(function () {
  "use strict";
  // Petal (tip #107): a dark still pool from above, the sky's light lying soft on it, one petal floating
  // (lib/visual-pw-petal.js). It rests at the top of the water's dome, just below the line, which floats
  // pale on the water above it. Touch the water and a ripple spreads from your finger; where it passes the
  // petal it pushes it away, and the petal drifts off, turning, and finds its own way back. Ripples are
  // drawn faint and few: a ring is a ripple only while it is moving. Each visit: the petal's colour and
  // shape, the light on the water, where the petal starts.
  const ID = "pw-petal";
  const CSS = "";
  const PETALS = [[246, 208, 216], [242, 238, 228], [246, 226, 168]];   // blossom pink, white, primrose

  function create(ctx) {
    const T = globalThis.TH, s = T.petalCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H });
    const bg = document.createElement("canvas"); bg.width = Math.max(1, Math.round(ctx.W)); bg.height = Math.max(1, Math.round(ctx.H));
    const g = bg.getContext("2d");
    const deep = g.createLinearGradient(0, 0, 0, ctx.H);
    deep.addColorStop(0, "rgb(10,18,30)"); deep.addColorStop(1, "rgb(6,12,20)");
    g.fillStyle = deep; g.fillRect(0, 0, ctx.W, ctx.H);
    // the sky's light on the water, broad and soft, off to one side
    const lx = ctx.W * (0.2 + 0.6 * s.light), ly = ctx.H * (0.15 + 0.25 * s.light), lr = Math.hypot(ctx.W, ctx.H) * 0.45;
    const sky = g.createRadialGradient(lx, ly, 0, lx, ly, lr);
    sky.addColorStop(0, "rgba(120,146,176,0.32)"); sky.addColorStop(1, "rgba(120,146,176,0)");
    g.fillStyle = sky; g.fillRect(0, 0, ctx.W, ctx.H);
    return { s, bg, col: PETALS[Math.floor(s.hue * PETALS.length) % PETALS.length], field: null };
  }
  function words(st, field) { st.field = field; }
  function step(st, dt) { globalThis.TH.petalStep(st.s, dt); }

  function petal(g, s, col) {
    const L = globalThis.TH.PETAL.SIZE, wid = L * (0.55 + 0.2 * s.shape);
    // its shadow on the water, soft, a little away from the light
    g.save(); g.translate(s.x + 3, s.y + 4); g.rotate(s.angle);
    g.fillStyle = "rgba(0,0,0,0.28)"; g.beginPath(); g.ellipse(0, 0, L * 1.05, wid * 1.05, 0, 0, 6.2832); g.fill();
    g.restore();
    // the petal: rounded at one end, narrowing to its base, a small notch at its tip
    g.save(); g.translate(s.x, s.y); g.rotate(s.angle);
    const gr = g.createLinearGradient(-L, 0, L, 0);
    gr.addColorStop(0, "rgb(" + col.map(v => v * 0.86) + ")"); gr.addColorStop(0.6, "rgb(" + col + ")"); gr.addColorStop(1, "rgb(" + col.map(v => Math.min(255, v + 8)) + ")");
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-L, 0);
    g.bezierCurveTo(-L * 0.4, -wid * 1.1, L * 0.7, -wid * 1.15, L, -wid * 0.18);
    g.lineTo(L * 0.72, 0);                        // the notch at its tip: a petal, not an almond
    g.lineTo(L, wid * 0.18);
    g.bezierCurveTo(L * 0.7, wid * 1.15, -L * 0.4, wid * 1.1, -L, 0);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-L * 0.8, 0); g.lineTo(L * 0.7, 0); g.stroke();
    g.restore();
  }

  function draw(g, st, ctx) {
    const s = st.s;
    g.drawImage(st.bg, 0, 0, ctx.W, ctx.H);
    if (st.field) globalThis.TH.wonderLine(g, st.field, "rgba(214,224,236,0.78)");
    // ripples: a light crest and a dark trough just behind it, fading as they spread
    for (const rp of s.ripples) {
      const a = Math.exp(-rp.age / globalThis.TH.PETAL.FADE);
      for (let k = 0; k < 2; k++) {
        const r = rp.r - k * 9;
        if (r <= 0) continue;
        g.lineWidth = 1.4;
        g.strokeStyle = "rgba(190,210,232," + (0.13 * a * (1 - k / 2)).toFixed(3) + ")";
        g.beginPath(); g.arc(rp.x, rp.y, r, 0, 6.2832); g.stroke();
        if (r > 4) { g.strokeStyle = "rgba(0,0,0," + (0.1 * a * (1 - k / 2)).toFixed(3) + ")"; g.beginPath(); g.arc(rp.x, rp.y, r - 3, 0, 6.2832); g.stroke(); }
      }
    }
    petal(g, s, st.col);
    if (!st.vg) {
      st.vg = g.createRadialGradient(ctx.W / 2, ctx.H / 2, Math.min(ctx.W, ctx.H) * 0.35, ctx.W / 2, ctx.H / 2, Math.hypot(ctx.W, ctx.H) * 0.62);
      st.vg.addColorStop(0, "rgba(4,5,10,0)"); st.vg.addColorStop(1, "rgba(4,5,10,0.5)");
    }
    g.fillStyle = st.vg; g.fillRect(0, 0, ctx.W, ctx.H);
  }
  function touch(st, kind, x, y) { if (kind === "down") globalThis.TH.petalRipple(st.s, x, y); }
  // a new size: the same petal, the dome's top moved to the new middle
  function resize(st, ctx) {
    const old = st.s, fresh = create(ctx);
    Object.assign(fresh.s, { x: old.x * ctx.W / old.w, y: old.y * ctx.H / old.h, vx: old.vx, vy: old.vy, angle: old.angle, spin: old.spin });
    Object.assign(st, { s: fresh.s, bg: fresh.bg, vg: null });
  }
  function info(st) {
    const s = st.s;
    return { off: +Math.hypot(s.x - s.home.x, s.y - s.home.y).toFixed(1), speed: +Math.hypot(s.vx, s.vy).toFixed(1), ripples: s.ripples.length, angle: +s.angle.toFixed(2) };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-petal-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Petal", phrase: "Whenever my mind wanders off, bring it back.", mount,
      // floating on the water above where the petal rests (lib petalHome: 64% of the height, 72% sideways)
      wordsMode: "around",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(40, W / 20) : Math.min(40, W / 10);
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.36 : 0.36) }, maxWidth: W * (wide ? 0.62 : 0.84) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
