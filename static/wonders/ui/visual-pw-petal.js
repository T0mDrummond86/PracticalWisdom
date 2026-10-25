(function () {
  "use strict";
  // Petal (tip #107): a dark still pool from above at night, the moon's reflection lying down it as a long
  // glade of broken light, one petal floating (lib/visual-pw-petal.js). Its home, the top of the water's
  // dome, is in the glade: at home it floats in the light. Wandering, on a breath of wind or pushed by a
  // ripple, it drifts out into the dark, its wake behind it, and comes back into the light by itself.
  // A reflection on water is drawn out along the line to the light, never a disc (a pale disc round a
  // pale petal is an eye). The line floats pale on the water above. Touch the water and a ripple spreads from your finger; where it passes the
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
    // the moon's glade: its reflection broken into short bright ripples, down the water through home,
    // brightest there and fading up and down the pool
    const rand = T.wonderRand(ctx.seed ^ 0x5be0cd19), hx = s.home.x, hy = s.home.y, span = ctx.H * 0.62;
    g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 520; k++) {
      const v = (rand() - 0.5) * 2, y = hy + v * span, fall = Math.exp(-v * v * 3.2);
      const half = (6 + 26 * rand()) * (0.35 + 0.65 * fall), x = hx + (rand() - 0.5) * ctx.W * 0.2 * (0.5 + 0.8 * fall);
      g.strokeStyle = "rgba(206,222,242," + (0.04 + 0.22 * fall * rand()).toFixed(3) + ")";
      g.lineWidth = 0.8 + 1.4 * rand();
      g.beginPath(); g.moveTo(x - half, y); g.lineTo(x + half, y); g.stroke();
    }
    const glow = g.createRadialGradient(hx, hy, 0, hx, hy, ctx.W * 0.35);
    glow.addColorStop(0, "rgba(160,180,210,0.12)"); glow.addColorStop(1, "rgba(160,180,210,0)");
    g.save(); g.translate(hx, hy); g.scale(0.55, 1.6); g.translate(-hx, -hy);
    g.fillStyle = glow; g.fillRect(hx - ctx.W, hy - ctx.H, 2 * ctx.W, 2 * ctx.H); g.restore();
    g.globalCompositeOperation = "source-over";
    return { s, bg, col: PETALS[Math.floor(s.hue * PETALS.length) % PETALS.length], field: null };
  }
  function words(st, field) { st.field = field; }
  function step(st, dt) { globalThis.TH.petalStep(st.s, dt); }

  function petal(g, s, colIn) {
    // in the glade it is moonlit; out in the dark, dim
    const off = Math.hypot(s.x - s.home.x, s.y - s.home.y), lit = 0.42 + 0.58 * Math.exp(-off * off / (2 * 45 * 45));
    const col = colIn.map(v => Math.round(v * lit));
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
    // its wake: where it has been these last seconds, fading with age
    if (s.wake.length > 1) {
      for (let k = 1; k < s.wake.length; k++) {
        const a = s.wake[k - 1], b = s.wake[k], age = (s.t - b.t) / globalThis.TH.PETAL.WAKE;
        g.strokeStyle = "rgba(196,214,236," + (0.38 * (1 - age)).toFixed(3) + ")"; g.lineWidth = 3 * (1 - age) + 0.5;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
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
