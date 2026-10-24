(function () {
  "use strict";
  // Bloom (tip #3): a bed of seedlings from above in soft light, each a pair of green seed leaves
  // (lib/visual-pw-bloom.js). Touch, and the plants in a ring round your finger open into flower, then
  // their neighbours, then theirs; the one under your finger opens last of all. The line was planted
  // among them in another colour and shows as its plants bloom. Every flower's middle is pale: a
  // dark-centred flower is an eye, and a bed of them is a crowd of eyes. Plants only ever open, so each
  // is painted once more onto a kept layer whenever it reaches a new stage, bigger over smaller. Each
  // visit: the two colours, and where the bed is thick.
  const ID = "pw-bloom";
  const CSS = "";
  const PAIRS = [
    { line: [250, 238, 206], bed: [128, 100, 178] },   // cream on violet
    { line: [244, 196, 84], bed: [86, 118, 196] },     // gold on blue
    { line: [242, 132, 108], bed: [226, 230, 240] },   // coral on white
  ];
  const STAGES = 6, R = 4.4;

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

  // one sprite per colour, stage and turn: stage 0 the seed leaves, 1 a bud, then the petals opening
  function sprites(dpr, pair) {
    const size = Math.ceil(2 * R * dpr) + 2, out = [];
    for (const col of [pair.bed, pair.line]) {
      const byStage = [];
      for (let k = 0; k < STAGES; k++) {
        const turns = [];
        for (let t = 0; t < 8; t++) {
          const cv = canvas(size, size), g = cv.getContext("2d");
          g.translate(size / 2, size / 2); g.scale(dpr, dpr); g.rotate(t * 0.785 + 0.31 * (t % 3));
          if (k === 0) {
            g.fillStyle = "rgb(86,146,70)";
            for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * 1.3, 0, 1.4, 0.75, 0, 0, 6.2832); g.fill(); }
          } else if (k === 1) {
            g.fillStyle = "rgb(86,146,70)"; g.beginPath(); g.arc(0, 0, 1.6, 0, 6.2832); g.fill();
            g.fillStyle = "rgb(" + col + ")"; g.beginPath(); g.arc(0, 0, 0.9, 0, 6.2832); g.fill();
          } else {
            const u = (k - 1) / (STAGES - 2), pr = 1.1 + 1.3 * u, rr = 0.8 + 1.7 * u;
            for (let p = 0; p < 5; p++) {
              const a = p * 2 * Math.PI / 5, px = Math.cos(a) * rr, py = Math.sin(a) * rr;
              const gr = g.createRadialGradient(px, py, 0, px, py, pr);
              gr.addColorStop(0, "rgb(" + col.map(v => Math.min(255, v + 18)) + ")"); gr.addColorStop(1, "rgb(" + col.map(v => v * 0.82) + ")");
              g.fillStyle = gr; g.beginPath(); g.arc(px, py, pr, 0, 6.2832); g.fill();
            }
            g.fillStyle = "rgb(250,238,176)"; g.beginPath(); g.arc(0, 0, 0.7 + 0.4 * u, 0, 6.2832); g.fill();
          }
          turns.push(cv);
        }
        byStage.push(turns);
      }
      out.push(byStage);
    }
    return { size, set: out };
  }

  function create(ctx) {
    const T = globalThis.TH, s = T.bloomCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H }), rand = T.wonderRand(ctx.seed ^ 0x13198a2e);
    const pair = PAIRS[Math.floor(s.hue * PAIRS.length) % PAIRS.length], dpr = ctx.dpr;
    const layer = canvas(ctx.W * dpr, ctx.H * dpr), g = layer.getContext("2d");
    g.scale(dpr, dpr);
    // the soil: dark, crumbly, a little lighter in drifts
    g.fillStyle = "rgb(34,26,20)"; g.fillRect(0, 0, ctx.W, ctx.H);
    for (let k = 0; k < ctx.W * ctx.H / 18; k++) {
      const v = rand();
      g.fillStyle = "rgba(" + (60 + 30 * v) + "," + (44 + 22 * v) + "," + (32 + 14 * v) + ",0.5)";
      g.fillRect(rand() * ctx.W, rand() * ctx.H, 1 + rand(), 1 + rand());
    }
    const sp = sprites(dpr, pair), stage = new Int8Array(s.n).fill(-1);
    const st = { s, layer, lg: g, sp, stage, dpr };
    stamp(st, true);
    return st;
  }

  // paint every plant that has reached a new stage since it was last painted
  function stamp(st, all) {
    const s = st.s, g = st.lg, sp = st.sp, full = sp.size / st.dpr;
    for (let i = 0; i < s.n; i++) {
      const k = Math.min(STAGES - 1, Math.floor(s.open[i] * (STAGES - 1) + (s.open[i] > 0 ? 1 : 0)));
      if (!all && k <= st.stage[i]) continue;
      st.stage[i] = k;
      // the line's own plants, set tight along its strokes, are smaller
      const img = sp.set[s.letter[i]][k][Math.floor(s.turn[i] * 8)], d = s.small && s.small[i] ? full * 0.62 : full;
      g.drawImage(img, s.x[i] - d / 2, s.y[i] - d / 2, d, d);
    }
  }

  function words(st, field) {
    let cells = 0; for (let i = 0; i < field.mask.length; i++) cells += field.mask[i];
    const pts = field.points(Math.max(300, Math.min(2400, Math.round(cells * 0.35))));
    globalThis.TH.bloomLetters(st.s, field.inside, pts);
    st.stage = new Int8Array(st.s.n).fill(-1);      // the bed has more plants now; paint them all once
    st.field = field;
    stamp(st, false);
  }
  function step(st, dt) { globalThis.TH.bloomStep(st.s, dt); }
  function draw(g, st, ctx) {
    stamp(st, false);
    g.drawImage(st.layer, 0, 0, ctx.W, ctx.H);
    // soft light: brighter in the middle of the bed, falling away to its edges
    if (!st.vg) {
      st.vg = g.createRadialGradient(ctx.W * 0.45, ctx.H * 0.4, Math.min(ctx.W, ctx.H) * 0.25, ctx.W * 0.45, ctx.H * 0.4, Math.hypot(ctx.W, ctx.H) * 0.6);
      st.vg.addColorStop(0, "rgba(4,5,10,0)"); st.vg.addColorStop(1, "rgba(4,5,10,0.55)");
    }
    g.fillStyle = st.vg; g.fillRect(0, 0, ctx.W, ctx.H);
  }
  function touch(st, kind, x, y) { if (kind === "down") globalThis.TH.bloomTouch(st.s, x, y); }
  function resize(st, ctx) {
    const field = st.field;
    Object.assign(st, create(ctx), { vg: null });
    if (field) { words(st, field); stamp(st, true); }
  }
  function info(st) {
    const T = globalThis.TH, s = st.s;
    let open = 0; for (let i = 0; i < s.n; i++) if (s.open[i] > 0.5) open++;
    return { plants: s.n, open: +(open / s.n).toFixed(2), line: +T.bloomShown(s).toFixed(2), letterPlants: s.letterPlants.length };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-bloom-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Bloom", phrase: "Help others to flourish.", mount,
      // planted across the middle of the bed
      wordsMode: "revealed",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(40, W / 20) : Math.min(40, W / 8.5);
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.46 : 0.44) }, maxWidth: W * (wide ? 0.62 : 0.84) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
