(function () {
  "use strict";
  // Shoot (tip #65): snow in section on dark soil at winter dusk, and one green shoot pushing up through
  // it (lib/visual-pw-shoot.js). The snow heaps and slumps aside round the stem and never cracks; once
  // through, the shoot puts out two leaves and climbs on, and the green rises into the line from below.
  // Touch to give it another push. Each visit: how deep the snow lies, its light, where the shoot comes up.
  const ID = "pw-shoot";
  const CSS = "";

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

  function create(ctx) {
    const T = globalThis.TH, s = T.shootCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H });
    const bg = canvas(ctx.W, ctx.H), g = bg.getContext("2d"), cool = s.light;
    const sky = g.createLinearGradient(0, 0, 0, s.ground);
    sky.addColorStop(0, "rgb(12,16,30)"); sky.addColorStop(1, "rgb(" + [46 + 20 * cool, 56 + 14 * cool, 82].join(",") + ")");
    g.fillStyle = sky; g.fillRect(0, 0, ctx.W, s.ground);
    const soil = g.createLinearGradient(0, s.ground, 0, ctx.H);
    soil.addColorStop(0, "rgb(40,30,24)"); soil.addColorStop(1, "rgb(14,11,10)");
    g.fillStyle = soil; g.fillRect(0, s.ground, ctx.W, ctx.H - s.ground);
    return { s, bg, letters: null, lg: null, img: null, field: null, painted: 0 };
  }

  function words(st, field) {
    globalThis.TH.shootLetters(st.s, field.inside, field.rect);
    st.field = field;
    const cw = Math.ceil(field.rect.w / 1.5), ch = Math.ceil(field.rect.h / 1.5);
    st.letters = canvas(cw, ch); st.lg = st.letters.getContext("2d"); st.img = st.lg.createImageData(cw, ch); st.painted = 0;
  }
  function step(st, dt) { globalThis.TH.shootStep(st.s, dt); }

  // the letters, greened where the green has reached (only the new cells are painted)
  function paintGreen(st) {
    const s = st.s, f = st.field;
    if (!s.green || !st.img) return;
    let any = false;
    const px = st.img.data, cw = st.img.width;
    for (const p of s.letterCells) {
      if (!s.green[p.i] || p.done) continue;
      p.done = true; any = true;
      const cx = Math.floor((p.x - f.rect.x) / 1.5), cy = Math.floor((p.y - f.rect.y) / 1.5), o = (cy * cw + cx) * 4;
      const v = ((p.i * 2654435761) >>> 0) / 4294967296;      // a little variation leaf to leaf
      px[o] = 74 + 30 * v; px[o + 1] = 150 + 40 * v; px[o + 2] = 64 + 20 * v; px[o + 3] = 255;
    }
    if (any) st.lg.putImageData(st.img, 0, 0);
  }

  function draw(g, st, ctx) {
    const s = st.s, gy = s.ground, c = s.cell;
    g.drawImage(st.bg, 0, 0, ctx.W, ctx.H);
    // the snow in section: its surface (round the stem, the height beside it), lit along its crest
    const surf = i => {
      if (!s.isShoot[i]) return globalThis.TH.shootSurface(s, i);
      let a = i, b = i;
      while (a > 0 && s.isShoot[a]) a--;
      while (b < s.cols - 1 && s.isShoot[b]) b++;
      return Math.max(globalThis.TH.shootSurface(s, a), globalThis.TH.shootSurface(s, b));
    };
    let top = Infinity;
    g.beginPath(); g.moveTo(0, gy);
    for (let i = 0; i < s.cols; i++) { const y = gy - surf(i); top = Math.min(top, y); g.lineTo((i + 0.5) * c, y); }
    g.lineTo(ctx.W, gy); g.closePath();
    const snow = g.createLinearGradient(0, top, 0, gy);
    snow.addColorStop(0, "rgb(" + [208 + 20 * s.light, 220 + 12 * s.light, 238].join(",") + ")"); snow.addColorStop(1, "rgb(118,138,172)");
    g.fillStyle = snow; g.fill();
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i < s.cols; i++) { const y = gy - surf(i); if (i) g.lineTo((i + 0.5) * c, y); else g.moveTo((i + 0.5) * c, y); }
    g.stroke();
    // the stem, cut away through the snow, from a little below the ground to its tip
    const x = s.x0, ty = gy - s.tip, hw = globalThis.TH.SHOOT.HALF;
    if (s.tip > 0) {
      const stem = g.createLinearGradient(x - hw, 0, x + hw, 0);
      stem.addColorStop(0, "rgb(52,112,48)"); stem.addColorStop(0.45, "rgb(110,176,86)"); stem.addColorStop(1, "rgb(44,94,40)");
      g.fillStyle = stem;
      g.beginPath(); g.moveTo(x - hw, gy + 6); g.lineTo(x - hw, ty + hw); g.quadraticCurveTo(x, ty - hw, x + hw, ty + hw); g.lineTo(x + hw, gy + 6); g.closePath(); g.fill();
      // through, it opens two leaves just under the tip, the second a little higher
      if (s.through) {
        const open = Math.min(1, (s.tip - s.depth0) / 60);
        g.fillStyle = "rgb(84,156,64)";
        for (const [side, at] of [[-1, 26], [1, 40]]) {
          const ly = ty + at, lw = 14 * open, lh = 5 * open;
          g.beginPath(); g.ellipse(x + side * (hw + lw * 0.9), ly - lh, lw, lh, side * -0.5, 0, 6.2832); g.fill();
        }
      }
      // the cap of snow it carries up once through, if any is left on it (under the snow, the snow above
      // the tip is simply the snowpack)
      let cap = 0;
      for (let i = 0; i < s.cols; i++) if (s.isShoot[i]) cap = Math.max(cap, s.snow[i]);
      if (s.through && cap > 0.2) { g.fillStyle = "rgb(226,234,246)"; g.beginPath(); g.ellipse(x, ty - cap / 2, hw + 1, cap / 2 + 0.8, 0, 0, 6.2832); g.fill(); }
    }
    if (st.letters) {
      paintGreen(st);
      g.imageSmoothingEnabled = true;
      g.drawImage(st.letters, st.field.rect.x, st.field.rect.y, st.letters.width * 1.5, st.letters.height * 1.5);
    }
  }
  function touch(st, kind) { if (kind === "down") globalThis.TH.shootPush(st.s); }
  function resize(st, ctx) {
    const field = st.field;
    Object.assign(st, create(ctx));
    if (field) words(st, field);
  }
  function info(st) {
    const T = globalThis.TH, s = st.s;
    return { tip: Math.round(s.tip), through: s.through, depth: Math.round(s.depth0), green: +T.shootGreen(s).toFixed(2), x0: Math.round(s.x0) };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-shoot-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Shoot", phrase: "Keep going. Push through.", mount,
      // above the snow, where the shoot climbs to
      wordsMode: "become",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(40, W / 20) : Math.min(40, W / 8.5);
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.38 : 0.36) }, maxWidth: W * (wide ? 0.6 : 0.82) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
