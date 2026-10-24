(function () {
  "use strict";
  // Kerf (tip #20): a board in raking light, its growth rings running across it, under a coat of
  // sanding dust that hides the line pencilled on it (lib/visual-pw-kerf.js). Touch to mark it, touch
  // again to mark it again beside the first, and the third touch cuts along the mean of the two: the
  // kerf opens edge to edge, sawdust spills from it, and the shaking board sheds its dust downhill
  // until the line shows. No saw is ever shown: only wood, marks and dust. Each visit: the timber
  // (pine, oak or walnut), its rings, the drifts of dust.
  const ID = "pw-kerf";
  const CSS = "";
  const WOOD = [
    { early: [204, 168, 118], late: [158, 112, 64] },     // pine
    { early: [170, 132, 90], late: [112, 80, 48] },       // oak
    { early: [118, 84, 58], late: [64, 42, 28] },         // walnut
  ];
  const BENCH = [20, 17, 15];

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

  // the board, worked out once per size: grain, raking light from the top, a bevel at each long edge
  function boardFor(s, W, H) {
    const T = globalThis.TH, cv = canvas(W, H), g = cv.getContext("2d"), img = g.createImageData(cv.width, cv.height), px = img.data;
    const wood = WOOD[s.species], b = s.board;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const o = (y * cv.width + x) * 4;
      let c;
      if (y < b.y0 || y >= b.y1) {
        c = BENCH.map(v => v * (0.8 + 0.4 * Math.min(1, Math.abs(y < b.y0 ? b.y0 - y : y - b.y1) / 40 < 1 ? 0.3 : 0)));
      } else {
        const gr = T.kerfGrain(s, x, y), up = T.kerfGrain(s, x, y - 1.5), dn = T.kerfGrain(s, x, y + 1.5);
        const shade = (1 + 0.22 * (up - dn)) * (y - b.y0 < 2 ? 1.25 : 1) * (b.y1 - y < 3 ? 0.6 : 1);
        c = [0, 1, 2].map(k => (wood.early[k] + (wood.late[k] - wood.early[k]) * gr) * shade);
      }
      const u = x / cv.width - 0.5, v = y / cv.height - 0.5, vig = 1 - 0.55 * Math.min(1, Math.max(0, (Math.sqrt(u * u + v * v) - 0.25) / 0.45));
      px[o] = c[0] * vig; px[o + 1] = c[1] * vig; px[o + 2] = c[2] * vig; px[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
  // fine pale sanding dust, as grains, for the dust layer to be cut from
  function specklesFor(W, H, rand) {
    const cv = canvas(W, H), g = cv.getContext("2d"), img = g.createImageData(cv.width, cv.height), px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const v = rand();
      px[i] = 226 - 30 * v; px[i + 1] = 210 - 34 * v; px[i + 2] = 180 - 40 * v; px[i + 3] = 150 + 105 * rand();
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  function create(ctx) {
    const T = globalThis.TH, s = T.kerfCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H });
    const rand = T.wonderRand(ctx.seed ^ 0x7feb352d);
    const grid = canvas(s.cols, s.rows);
    return { s, board: boardFor(s, ctx.W, ctx.H), speck: specklesFor(ctx.W, ctx.H, rand), grid, gridG: grid.getContext("2d"),
      gridI: grid.getContext("2d").createImageData(s.cols, s.rows), dustNow: canvas(ctx.W, ctx.H), stale: true, pencil: null, field: null };
  }

  // the pencilled line: soft graphite, a little uneven
  function words(st, field) {
    const T = globalThis.TH;
    T.kerfLetters(st.s, field.inside);
    st.field = field;
    const cv = canvas(field.gw, field.gh), g = cv.getContext("2d"), img = g.createImageData(field.gw, field.gh), px = img.data;
    const rand = T.wonderRand(st.s.seed ^ 0x51ed270b);
    for (let i = 0; i < field.mask.length; i++) {
      if (!field.mask[i]) continue;
      px[i * 4] = 52; px[i * 4 + 1] = 50; px[i * 4 + 2] = 50; px[i * 4 + 3] = 150 + 70 * rand();
    }
    g.putImageData(img, 0, 0);
    st.pencil = cv;
  }

  function step(st, dt) {
    const s = st.s;
    globalThis.TH.kerfStep(s, dt);
    if (s.shake > 0) st.stale = true;
  }

  function paintDust(st, ctx) {
    const s = st.s, px = st.gridI.data;
    for (let i = 0; i < s.dust.length; i++) {
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 255;
      px[i * 4 + 3] = 255 * Math.min(0.96, s.dust[i] / 0.45);
    }
    st.gridG.putImageData(st.gridI, 0, 0);
    const dg = st.dustNow.getContext("2d");
    dg.globalCompositeOperation = "copy";
    dg.drawImage(st.speck, 0, 0);
    dg.globalCompositeOperation = "destination-in";
    dg.imageSmoothingEnabled = true;
    dg.clearRect(0, 0, ctx.W, s.board.y0);
    dg.drawImage(st.grid, 0, s.board.y0, s.cols * s.cell, s.rows * s.cell);
    dg.globalCompositeOperation = "source-over";
    st.stale = false;
  }

  function slot(g, s, x, front) {
    const b = s.board, y1 = b.y0 + front * (b.y1 - b.y0);
    g.fillStyle = "rgb(" + BENCH.join(",") + ")";
    g.fillRect(x - 1.4, b.y0, 2.8, y1 - b.y0);
    g.fillStyle = "rgba(255,236,200,0.18)";                      // the freshly sawn edge, catching the light
    g.fillRect(x + 1.4, b.y0, 0.8, y1 - b.y0);
  }

  function draw(g, st, ctx) {
    const s = st.s, b = s.board;
    if (st.stale) paintDust(st, ctx);
    g.globalCompositeOperation = "source-over";
    g.drawImage(st.board, 0, 0, ctx.W, ctx.H);
    if (st.pencil) g.drawImage(st.pencil, st.field.rect.x, st.field.rect.y, st.field.gw * st.field.cell, st.field.gh * st.field.cell);
    g.drawImage(st.dustNow, 0, 0, ctx.W, ctx.H);
    // the marks: a crow's foot at the board's top edge, struck in a quarter of a second
    g.strokeStyle = "rgba(40,38,38,0.92)"; g.lineWidth = 1.5; g.lineCap = "round";
    for (const m of s.marks) {
      const u = Math.min(1, m.age / 0.25);
      g.beginPath();
      g.moveTo(m.x, b.y0 + 3); g.lineTo(m.x, b.y0 + 3 + 30 * u);
      g.moveTo(m.x - 6 * u, b.y0 + 3 + 9 * u); g.lineTo(m.x, b.y0 + 12); g.lineTo(m.x + 6 * u, b.y0 + 3 + 9 * u);
      g.stroke();
    }
    for (const c of s.cuts) slot(g, s, c.x, 1);
    if (s.cut) slot(g, s, s.cut.x, s.cut.front);
    // sawdust, fresh from the kerf
    g.fillStyle = "rgba(232,212,176,0.9)";
    for (const gr of s.grains) g.fillRect(gr.x - gr.r / 2, gr.y - gr.r / 2, gr.r, gr.r);
  }

  function touch(st, kind, x, y) {
    if (kind === "down") globalThis.TH.kerfTouch(st.s, x, y);
  }
  // a new size is a new board
  function resize(st, ctx) {
    const field = st.field;
    Object.assign(st, create(ctx));
    if (field) words(st, field);
  }
  function info(st) {
    const T = globalThis.TH, s = st.s;
    let d = 0; for (const v of s.dust) d += v;
    return { species: ["pine", "oak", "walnut"][s.species], marks: s.marks.map(m => Math.round(m.x)), cut: s.cut ? [Math.round(s.cut.x), +s.cut.front.toFixed(2)] : null,
      cuts: s.cuts.length, shake: +s.shake.toFixed(2), dust: +(d / s.dust.length).toFixed(3), lettersShown: +T.kerfLettersShown(s).toFixed(2), grains: s.grains.length };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-kerf-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Kerf", phrase: "Measure twice, cut once.", mount,
      // pencilled across the middle of the board (which spans 10-90% of the height)
      wordsMode: "revealed",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(40, W / 20) : Math.min(40, W / 9);
        return { size, cell: 1.5, at: { x: W / 2, y: H * 0.5 }, maxWidth: W * (wide ? 0.7 : 0.82) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
