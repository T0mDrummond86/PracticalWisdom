(function () {
  "use strict";
  // Pencil (tip #39): a toned sheet in low side light, close enough that its tooth shows, and the line
  // written across it in soft graphite, stroke by stroke, the lead catching on the grain's high points
  // and skipping its valleys (lib/visual-pw-pencil.js). No pencil is shown; only what it leaves. Your
  // finger writes in pencil too, and whatever you write stays. Each visit: the paper's tooth and warmth
  // and the angle of the light. Canvas 2D on the shared runtime (runtime.js): the paper's light is
  // worked out once per size into a small image, and only the cells the lead touched are repainted.
  const ID = "pw-pencil";
  const CSS = "";
  const ELEV = 0.36, RELIEF = 0.85;               // the light's height above the sheet (rad); the tooth's relief

  function paperFor(s) {
    const T = globalThis.TH, gw = s.gw, gh = s.gh, look = s.look;
    const lx = Math.cos(look.light), ly = Math.sin(look.light), ce = Math.cos(ELEV), se = Math.sin(ELEV);
    const lam = new Float32Array(gw * gh);
    const cv = document.createElement("canvas"); cv.width = gw; cv.height = gh;
    const g = cv.getContext("2d"), img = g.createImageData(gw, gh), px = img.data, t = s.tooth;
    const grain = T.wonderRand(s.seed ^ 0x9e3779b9);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const hx = (t[y * gw + Math.min(gw - 1, x + 1)] - t[y * gw + Math.max(0, x - 1)]) * 0.5 * RELIEF;
      const hy = (t[Math.min(gh - 1, y + 1) * gw + x] - t[Math.max(0, y - 1) * gw + x]) * 0.5 * RELIEF;
      const nl = Math.sqrt(hx * hx + hy * hy + 1);
      const l = Math.max(0, (-hx * lx * ce - hy * ly * ce + se) / nl);
      lam[i] = l;
      // nearer the light, brighter; the far corners fall away into the dark
      const u = x / gw - 0.5, v = y / gh - 0.5;
      const near = 1 + 0.42 * (u * lx + v * ly);
      const rr = Math.sqrt(u * u + v * v), vig = 1 - 0.55 * Math.min(1, Math.max(0, (rr - 0.28) / 0.45));
      const k = (0.78 + 0.9 * (l - se)) * near * vig, n = (grain() - 0.5) * 3;
      px[i * 4] = Math.min(255, look.paper[0] * k + n); px[i * 4 + 1] = Math.min(255, look.paper[1] * k + n);
      px[i * 4 + 2] = Math.min(255, look.paper[2] * k + n); px[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return { cv, lam };
  }

  function create(ctx) {
    const T = globalThis.TH;
    const s = T.pencilCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H });
    const paper = paperFor(s);
    const ink = document.createElement("canvas"); ink.width = s.gw; ink.height = s.gh;
    const ig = ink.getContext("2d");
    return { s, paper, ink, ig, img: ig.createImageData(s.gw, s.gh), field: null, wr: null, last: null, touches: [] };
  }

  // the lead, repainted where it changed: dark graphite, with a dull sheen where a slope faces the light
  function paintInk(st) {
    const s = st.s, d = s.dirty;
    if (!d) return;
    s.dirty = null;
    const px = st.img.data, lam = st.paper.lam;
    for (let y = d.y0; y <= d.y1; y++) for (let x = d.x0; x <= d.x1; x++) {
      const i = y * s.gw + x, v = s.g[i];
      if (!v) continue;
      const sheen = Math.max(0, lam[i] - 0.3) * 1.2 * v;
      px[i * 4] = 38 + 70 * sheen; px[i * 4 + 1] = 38 + 70 * sheen; px[i * 4 + 2] = 40 + 72 * sheen;
      px[i * 4 + 3] = 255 * Math.min(0.95, 0.4 + 0.7 * v);
    }
    st.ig.putImageData(st.img, 0, 0, d.x0, d.y0, d.x1 - d.x0 + 1, d.y1 - d.y0 + 1);
  }

  function words(st, field, ctx) {
    st.field = field;
    st.wr = globalThis.TH.pencilWriter(st.s, field, ctx.seed);
  }
  function step(st, dt) {
    if (st.wr && !st.wr.done) globalThis.TH.pencilWrite(st.s, st.wr, dt);
  }
  function draw(g, st, ctx) {
    paintInk(st);
    const w = st.s.gw * st.s.cell, h = st.s.gh * st.s.cell;
    g.imageSmoothingEnabled = true;
    g.drawImage(st.paper.cv, 0, 0, w, h);
    g.drawImage(st.ink, 0, 0, w, h);
  }
  // a finger writes as a pencil does: a little firmer than the hand that wrote the line
  const PRESS = 0.78, NIB = 1.8;
  function touch(st, kind, x, y) {
    const T = globalThis.TH;
    if (kind === "down") { st.last = [x, y]; st.touches.push([[x, y]]); T.pencilStroke(st.s, [[x, y]], PRESS, NIB); }
    else if (kind === "move" && st.last) {
      T.pencilStroke(st.s, [st.last, [x, y]], PRESS, NIB);
      st.last = [x, y]; st.touches[st.touches.length - 1].push([x, y]);
    } else if (kind === "up") st.last = null;
  }
  // a new size is a new sheet: lay the same paper out again and write everything back on it
  function resize(st, ctx) {
    const T = globalThis.TH, fresh = create(ctx), wr = st.wr;
    Object.assign(st, { s: fresh.s, paper: fresh.paper, ink: fresh.ink, ig: fresh.ig, img: fresh.img });
    if (st.field && wr) { st.wr = T.pencilWriter(st.s, st.field, ctx.seed); T.pencilWrite(st.s, st.wr, wr.t); }
    for (const pts of st.touches) T.pencilStroke(st.s, pts, PRESS, NIB);
  }
  function info(st) {
    const T = globalThis.TH, wr = st.wr;
    return { cells: [st.s.gw, st.s.gh], strokes: st.s.strokes, written: wr ? +(wr.i / Math.max(1, wr.paths.length)).toFixed(2) : 0,
      done: wr ? wr.done : false, duration: wr ? +wr.duration.toFixed(2) : null, nib: wr ? +wr.radius.toFixed(2) : null,
      coverage: st.field ? +T.pencilWriteCoverage(st.s, st.field).toFixed(2) : null, light: +st.s.look.light.toFixed(2), paper: st.s.look.paper };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-pencil-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Pencil", phrase: "The bluntest pencil is sharper than the sharpest memory.", mount,
      // the graphite writes the line, a little above the middle of the sheet
      wordsMode: "become",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(40, W / 21) : Math.min(40, W / 9.5);
        // a fine mask (1.5 px, not the usual 3): the strokes are thinned and written along, so they need the detail
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.44 : 0.4) }, maxWidth: W * (wide ? 0.72 : 0.84) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
