(function () {
  "use strict";
  // Shoot (tip #65): early morning in late winter, snow lying in section over dark soil, and one green
  // shoot pushing up through it (lib/visual-pw-shoot.js). Low light comes in warm along the horizon over
  // a far ridge; the snow is grained and catches it on its crest, blue in its hollows. The snow heaps and
  // slumps aside round the stem and never cracks; once through, the shoot opens two seed leaves and
  // climbs on, leaning a little, stirring a little, and the green rises into the line from below, young
  // and pale at its growing edge. Touch to give it another push. Each visit: how deep the snow lies, its
  // light, where the shoot comes up, which way it leans.
  const ID = "pw-shoot";
  const CSS = "";
  const SWAY = 0.6;                       // rad/s: the stem's slow stir in the air (calm: under 0.8)

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

  function create(ctx) {
    const T = globalThis.TH, s = T.shootCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H }), rand = T.wonderRand(ctx.seed ^ 0x2545f491);
    const W = ctx.W, H = ctx.H, gy = s.ground, cool = s.light;
    const bg = canvas(W, H), g = bg.getContext("2d");
    // the sky: night blue overhead, warming to a pale gold at the horizon where the sun is coming
    const sky = g.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, "rgb(14,20,38)"); sky.addColorStop(0.55, "rgb(" + [52 + 16 * cool, 64 + 10 * cool, 96].join(",") + ")");
    sky.addColorStop(0.9, "rgb(" + [196 - 30 * cool, 160 - 20 * cool, 132].join(",") + ")"); sky.addColorStop(1, "rgb(222,186,150)");
    g.fillStyle = sky; g.fillRect(0, 0, W, gy);
    // a far ridge, soft blue, low across the horizon
    const ridgeY = gy - s.depth0 - H * 0.02, bumps = Array.from({ length: 9 }, () => rand());
    g.fillStyle = "rgba(60,72,100,0.75)";
    g.beginPath(); g.moveTo(0, gy);
    for (let x = 0; x <= W; x += 4) {
      const u = x / W * 8, k = Math.floor(u), f = u - k, sm = f * f * (3 - 2 * f);
      g.lineTo(x, ridgeY - H * (0.03 + 0.05 * (bumps[k] + (bumps[k + 1] - bumps[k]) * sm)));
    }
    g.lineTo(W, gy); g.closePath(); g.fill();
    // the soil: dark, with grit and the odd stone in it
    const soil = g.createLinearGradient(0, gy, 0, H);
    soil.addColorStop(0, "rgb(52,38,28)"); soil.addColorStop(1, "rgb(16,12,10)");
    g.fillStyle = soil; g.fillRect(0, gy, W, H - gy);
    for (let k = 0; k < W * (H - gy) / 30; k++) {
      const v = rand();
      g.fillStyle = "rgba(" + (64 + 30 * v) + "," + (48 + 22 * v) + "," + (36 + 14 * v) + "," + (0.2 + 0.25 * rand()).toFixed(2) + ")";
      const r = rand() < 0.04 ? 1.5 + 2 * rand() : 0.6 + 0.6 * rand();
      g.beginPath(); g.arc(rand() * W, gy + rand() * (H - gy), r, 0, 6.2832); g.fill();
    }
    // snow grain, cut to the snow's shape each frame
    const grain = canvas(W, H), gg = grain.getContext("2d"), img = gg.createImageData(grain.width, grain.height), px = img.data;
    for (let i = 0; i < px.length; i += 4) { const v = rand(); px[i] = px[i + 1] = px[i + 2] = v < 0.75 ? 255 : 90; px[i + 3] = v < 0.4 ? 0 : 70 * Math.abs(v - 0.6); }
    gg.putImageData(img, 0, 0);
    // the snowpack's layers, one per fall, faint lines across the section (wavering a little)
    const falls = 4 + Math.floor(rand() * 4);
    for (let k = 1; k <= falls; k++) {
      const y = gy - s.depth0 * k / (falls + 1), a = rand();
      gg.strokeStyle = "rgba(" + (a < 0.5 ? "255,255,255" : "90,110,150") + "," + (0.12 + 0.12 * rand()).toFixed(2) + ")";
      gg.lineWidth = 1 + 2 * rand();
      gg.beginPath();
      for (let x = 0; x <= W; x += 8) gg.lineTo(x, y + 2.5 * Math.sin(x * 0.013 + k) + 1.5 * Math.sin(x * 0.041 + 2 * k));
      gg.stroke();
    }
    return { s, bg, grain, lean: (rand() - 0.5) * 0.35, letters: null, field: null };
  }

  function words(st, field) {
    globalThis.TH.shootLetters(st.s, field.inside, field.rect);
    st.field = field;
    const cw = Math.ceil(field.rect.w / 1.5), ch = Math.ceil(field.rect.h / 1.5);
    const c = canvas(cw, ch);
    st.letters = { c, g: c.getContext("2d"), img: c.getContext("2d").createImageData(cw, ch) };
  }
  function step(st, dt) { globalThis.TH.shootStep(st.s, dt); }

  // the letters, greened where the green has reached: deep leaf green, paler toward their tops (younger)
  function paintGreen(st) {
    const s = st.s, f = st.field, L = st.letters;
    if (!s.green || !L) return;
    let any = false;
    const px = L.img.data, cw = L.img.width, span = Math.max(1, s.bottom - s.top);
    for (const p of s.letterCells) {
      if (!s.green[p.i] || p.done) continue;
      p.done = true; any = true;
      const cx = Math.floor((p.x - f.rect.x) / 1.5), cy = Math.floor((p.y - f.rect.y) / 1.5), o = (cy * cw + cx) * 4;
      const young = 1 - (p.y - s.top) / span, v = ((p.i * 2654435761) >>> 0) / 4294967296;
      px[o] = 58 + 50 * young + 14 * v; px[o + 1] = 120 + 60 * young + 18 * v; px[o + 2] = 46 + 24 * young; px[o + 3] = 255;
    }
    if (any) L.g.putImageData(L.img, 0, 0);
  }

  // a leaf: pointed at both ends, fuller toward its base, a paler midrib
  function leaf(g, x, y, len, wid, ang, tone) {
    g.save(); g.translate(x, y); g.rotate(ang);
    const gr = g.createLinearGradient(0, -wid, 0, wid);
    gr.addColorStop(0, "rgb(" + tone.map(v => Math.min(255, v + 30)) + ")"); gr.addColorStop(1, "rgb(" + tone.map(v => v * 0.7) + ")");
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.3, -wid * 1.2, len * 0.75, -wid * 0.9, len, 0);
    g.bezierCurveTo(len * 0.75, wid * 0.9, len * 0.3, wid * 1.1, 0, 0); g.fill();
    g.strokeStyle = "rgba(214,236,170,0.5)"; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(len * 0.05, 0); g.quadraticCurveTo(len * 0.5, -wid * 0.15, len * 0.92, 0); g.stroke();
    g.restore();
  }

  function draw(g, st, ctx) {
    const T = globalThis.TH, s = st.s, gy = s.ground, c = s.cell, W = ctx.W;
    g.drawImage(st.bg, 0, 0, W, ctx.H);
    // the snow in section: grained, lit along its crest, blue where it dips
    const surf = i => {
      if (!s.isShoot[i]) return T.shootSurface(s, i);
      let a = i, b = i;
      while (a > 0 && s.isShoot[a]) a--;
      while (b < s.cols - 1 && s.isShoot[b]) b++;
      return Math.max(T.shootSurface(s, a), T.shootSurface(s, b));
    };
    const path = () => { g.beginPath(); g.moveTo(0, gy); for (let i = 0; i < s.cols; i++) g.lineTo((i + 0.5) * c, gy - surf(i)); g.lineTo(W, gy); g.closePath(); };
    let top = Infinity; for (let i = 0; i < s.cols; i++) top = Math.min(top, gy - surf(i));
    const snow = g.createLinearGradient(0, top, 0, gy);
    snow.addColorStop(0, "rgb(" + [236 + 12 * s.light, 236 + 4 * s.light, 240].join(",") + ")"); snow.addColorStop(0.35, "rgb(200,212,232)"); snow.addColorStop(1, "rgb(126,146,184)");
    path(); g.fillStyle = snow; g.fill();
    g.save(); path(); g.clip(); g.drawImage(st.grain, 0, 0, W, ctx.H);
    // the hollow round the stem lies in its own blue shade
    const sh = g.createRadialGradient(s.x0, gy - s.depth0, 0, s.x0, gy - s.depth0, s.depth0 * 1.1);
    sh.addColorStop(0, "rgba(70,96,150,0.32)"); sh.addColorStop(1, "rgba(70,96,150,0)");
    g.fillStyle = sh; g.fillRect(0, top, W, gy - top);
    g.restore();
    g.strokeStyle = "rgba(255,240,220,0.7)"; g.lineWidth = 1.3;
    g.beginPath(); for (let i = 0; i < s.cols; i++) { const y = gy - surf(i); if (i) g.lineTo((i + 0.5) * c, y); else g.moveTo((i + 0.5) * c, y); } g.stroke();
    // the stem: tapering, leaning a little, stirring once it is in the air
    if (s.tip > 0) {
      const hw = T.SHOOT.HALF, ty = gy - s.tip, lift = Math.max(0, s.tip - s.depth0);
      const stir = s.through ? 0.04 * Math.sin(ctx.t * SWAY) * Math.min(1, lift / 80) : 0;
      const bend = (st.lean + stir) * lift;                         // how far the top has moved sideways
      const tx = s.x0 + bend, mx = s.x0 + bend * 0.35, my = gy - s.depth0 - lift * 0.5;
      const stem = g.createLinearGradient(s.x0 - hw, 0, s.x0 + hw, 0);
      stem.addColorStop(0, "rgb(48,104,46)"); stem.addColorStop(0.45, "rgb(118,178,88)"); stem.addColorStop(1, "rgb(40,88,38)");
      g.fillStyle = stem;
      g.beginPath();
      g.moveTo(s.x0 - hw * 1.15, gy + 6);
      g.lineTo(s.x0 - hw * 1.1, gy - Math.min(s.tip, s.depth0));
      g.quadraticCurveTo(mx - hw * 0.9, my, tx - hw * 0.7, ty + hw);
      g.quadraticCurveTo(tx, ty - hw * 0.8, tx + hw * 0.7, ty + hw);
      g.quadraticCurveTo(mx + hw * 0.9, my, s.x0 + hw * 1.1, gy - Math.min(s.tip, s.depth0));
      g.lineTo(s.x0 + hw * 1.15, gy + 6); g.closePath(); g.fill();
      if (s.through) {
        const open = Math.min(1, lift / 60);
        leaf(g, tx - hw * 0.4, ty + 30, 26 * open, 7 * open, Math.PI + 0.45 + stir * 3, [86, 152, 66]);
        leaf(g, tx + hw * 0.4, ty + 44, 30 * open, 8 * open, -0.4 + stir * 3, [78, 144, 60]);
      }
      let cap = 0;
      for (let i = 0; i < s.cols; i++) if (s.isShoot[i]) cap = Math.max(cap, s.snow[i]);
      if (s.through && cap > 0.2) { g.fillStyle = "rgb(236,240,248)"; g.beginPath(); g.ellipse(tx, ty - cap / 2, hw + 1, cap / 2 + 0.8, 0, 0, 6.2832); g.fill(); }
    }
    if (st.letters) {
      paintGreen(st);
      g.imageSmoothingEnabled = true;
      g.drawImage(st.letters.c, st.field.rect.x, st.field.rect.y, st.letters.c.width * 1.5, st.letters.c.height * 1.5);
    }
    if (!st.vg) {
      st.vg = g.createRadialGradient(W / 2, ctx.H * 0.45, Math.min(W, ctx.H) * 0.35, W / 2, ctx.H * 0.45, Math.hypot(W, ctx.H) * 0.62);
      st.vg.addColorStop(0, "rgba(4,5,10,0)"); st.vg.addColorStop(1, "rgba(4,5,10,0.45)");
    }
    g.fillStyle = st.vg; g.fillRect(0, 0, W, ctx.H);
  }
  function touch(st, kind) { if (kind === "down") globalThis.TH.shootPush(st.s); }
  function resize(st, ctx) {
    const field = st.field;
    Object.assign(st, create(ctx), { vg: null });
    if (field) words(st, field);
  }
  function info(st) {
    const T = globalThis.TH, s = st.s;
    return { tip: Math.round(s.tip), through: s.through, depth: Math.round(s.depth0), green: +T.shootGreen(s).toFixed(2), x0: Math.round(s.x0), lean: +st.lean.toFixed(2) };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-shoot-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Shoot", phrase: "Keep going. Push through.", mount,
      // above the snow, where the shoot climbs to; larger on a wide pane, within 40 px on a phone
      wordsMode: "become",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(W / 20, H / 10) : Math.min(40, W / 8);
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.36 : 0.36) }, maxWidth: W * (wide ? 0.6 : 0.84) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
