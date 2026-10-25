(function () {
  "use strict";
  // Stalagmite (tip #12): a cave wall side-on in close lamplight (lib/visual-pw-stalagmite.js). The line
  // stands on rock ledges; above each line hang stalactites, from the ceiling or from the underside of
  // the ledge above. At every tip a drop gathers, swells, lets go and falls, glinting, onto the letters
  // below, splashes, and leaves a layer of calcite; the letters rise off their ledges a layer at a time,
  // banded the way a stalagmite is, the freshest layer wet and shining. Touch to let the nearest drop
  // fall now. Each visit: the mineral's colour, the lamp's side and warmth, the water's pace.
  const ID = "pw-stalagmite";
  const CSS = "";

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

  function create(ctx) {
    const T = globalThis.TH, s = T.stalagmiteCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H }), rand = T.wonderRand(ctx.seed ^ 0x6a09e667);
    const lampX = ctx.W * (0.5 + 0.42 * s.lampSide), lampY = ctx.H * 0.3, warm = [255, 214 - 30 * s.lampWarm, 168 - 60 * s.lampWarm];
    // the wall: dark limestone, mottled, in a pool of lamplight
    const wall = canvas(ctx.W / 2, ctx.H / 2), g = wall.getContext("2d"), img = g.createImageData(wall.width, wall.height), px = img.data;
    const lat = Array.from({ length: 40 * 40 }, () => rand()), vn = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy, at = (a, b) => lat[((b % 40) + 40) % 40 * 40 + ((a % 40) + 40) % 40];
      const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      return at(ix, iy) * (1 - su) * (1 - sv) + at(ix + 1, iy) * su * (1 - sv) + at(ix, iy + 1) * (1 - su) * sv + at(ix + 1, iy + 1) * su * sv;
    };
    const sig = Math.hypot(ctx.W, ctx.H) * 0.5;
    for (let y = 0; y < wall.height; y++) for (let x = 0; x < wall.width; x++) {
      const X = x * 2, Y = y * 2, m = 0.55 * vn(X / 60, Y / 60) + 0.3 * vn(X / 14, Y / 14) + 0.15 * vn(X / 4, Y / 4);
      const l = 0.18 + 0.95 * Math.exp(-((X - lampX) ** 2 + (Y - lampY) ** 2) / (2 * sig * sig)), base = 30 + 40 * m, o = (y * wall.width + x) * 4;
      px[o] = base * l * warm[0] / 255 * 1.08; px[o + 1] = base * l * warm[1] / 255; px[o + 2] = base * l * warm[2] / 255 * 0.9; px[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const o = s.ochre;
    return { s, wall, lamp: { x: lampX, y: lampY, sig, warm }, tones: [[236 - 16 * o, 222 - 40 * o, 192 - 66 * o], [212 - 20 * o, 190 - 46 * o, 150 - 60 * o]], letters: [], rand, field: null };
  }
  const lit = (st, x, y) => 0.35 + 0.8 * Math.exp(-((x - st.lamp.x) ** 2 + (y - st.lamp.y) ** 2) / (2 * st.lamp.sig * st.lamp.sig));

  // The line, laid out a line at a time with room between for ledges and stalactites; each line
  // stands on the row of its baseline (where most letters end)
  function words(st, field, ctx) {
    const T = globalThis.TH, size = field.size, wf = T.wonderFont(ID), n = field.lines.length;
    // room between the lines for a ledge and the straws under it, spreading down the wall
    const pitch = Math.max(size * 2.15, Math.min(size * 3, ctx.H * 0.6 / Math.max(1, n)));
    const mid = ctx.H * 0.53;
    const built = field.lines.map((line, i) => T.buildWordField(line, { W: ctx.W, H: ctx.H, size, font: wf.font, italic: wf.italic, cell: 1,
      maxWidth: ctx.W * 4, rand: st.rand, at: { x: ctx.W / 2, y: mid + (i - (n - 1) / 2) * pitch } }));
    Promise.all(built.map(f => f.ready)).then(fs => {
      const rows = fs.map(f => {
        const counts = [];
        for (let gy = 0; gy < f.gh; gy++) { let c = 0; for (let gx = 0; gx < f.gw; gx++) c += f.mask[gy * f.gw + gx]; counts.push(c); }
        const most = Math.max(...counts);
        let base = f.gh - 1;
        while (base > 0 && counts[base] < 0.35 * most) base--;
        return { cell: f.cell, gw: f.gw, gh: f.gh, mask: f.mask, rect: f.rect, ledge: f.rect.y + (base + 1) * f.cell };
      });
      T.stalagmiteLetters(st.s, rows, Math.max(4, rows[0].rect.y - size * 0.9));
      st.letters = st.s.rows.map(r => { const c = canvas(r.gw, r.gh); return { c, g: c.getContext("2d"), img: c.getContext("2d").createImageData(r.gw, r.gh) }; });
      st.field = field;
    });
  }

  function step(st, dt) { globalThis.TH.stalagmiteStep(st.s, dt); }

  // the built letter cells not yet painted: calcite, banded layer by layer, lit by the lamp
  function paint(st) {
    st.s.rows.forEach((r, i) => {
      const L = st.letters[i];
      if (!L) return;
      let any = false;
      for (const c of r.cells) {
        if (!c.built || c.painted) continue;
        c.painted = true; any = true;
        const t = st.tones[c.band % 2], l = lit(st, c.x, c.y), v = 0.92 + 0.16 * st.rand(), o = (c.gy * r.gw + c.gx) * 4;
        L.img.data[o] = t[0] * l * v; L.img.data[o + 1] = t[1] * l * v; L.img.data[o + 2] = t[2] * l * v; L.img.data[o + 3] = 255;
      }
      if (any) L.g.putImageData(L.img, 0, 0);
    });
  }

  function rock(st, g, x0, x1, y0, y1, ragged) {
    g.beginPath(); g.moveTo(x0, y0);
    for (let x = x0; x <= x1; x += 6) g.lineTo(x, y1 + ragged * Math.sin(x * 0.11 + y0) * Math.sin(x * 0.037));
    g.lineTo(x1, y0); g.closePath();
  }

  function draw(g, st, ctx) {
    const s = st.s, W = ctx.W;
    g.imageSmoothingEnabled = true;
    g.drawImage(st.wall, 0, 0, W, ctx.H);
    if (!s.rows.length) return;
    paint(st);
    const warm = st.lamp.warm.join(",");
    // the ceiling the top line's stalactites hang from: the same rock, overhanging, in its own shadow
    const ceil = s.drips.length ? s.drips[0].hang : 0;
    const over = g.createLinearGradient(0, 0, 0, ceil + 4);
    over.addColorStop(0, "rgba(6,5,4,0.1)"); over.addColorStop(0.8, "rgba(6,5,4,0.3)"); over.addColorStop(1, "rgba(6,5,4,0.6)");
    g.fillStyle = over; rock(st, g, 0, W, 0, ceil, 4); g.fill();
    g.strokeStyle = "rgba(" + warm + ",0.18)"; g.lineWidth = 1; rock(st, g, 0, W, 0, ceil, 4); g.stroke();
    // ledges, each under its line, the lamp catching their top edges
    for (const r of s.rows) {
      const x0 = r.rect.x - 22, x1 = r.rect.x + r.rect.w + 22;
      g.fillStyle = "rgb(" + [46, 38, 32].map(v => Math.round(v * lit(st, (x0 + x1) / 2, r.ledge))).join(",") + ")";
      g.beginPath(); g.moveTo(x0, r.ledge + 3); g.quadraticCurveTo(x0 - 6, r.ledge + 7, x0 + 4, r.ledge + 9); g.lineTo(x1 - 4, r.ledge + 9);
      g.quadraticCurveTo(x1 + 6, r.ledge + 7, x1, r.ledge + 3); g.lineTo(x1, r.ledge); g.lineTo(x0, r.ledge); g.closePath(); g.fill();
      g.strokeStyle = "rgba(" + warm + ",0.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, r.ledge + 0.5); g.lineTo(x1, r.ledge + 0.5); g.stroke();
    }
    // the letters, growing
    s.rows.forEach((r, i) => { const L = st.letters[i]; if (L) g.drawImage(L.c, r.rect.x, r.rect.y, r.gw * r.cell, r.gh * r.cell); });
    // the freshest layers, still wet
    g.globalCompositeOperation = "lighter";
    for (const f of s.fresh) {
      const r = s.rows[f.row], a = 0.5 * (1 - f.age / 1.4);
      g.fillStyle = "rgba(" + warm + "," + a.toFixed(3) + ")";
      g.fillRect(f.cell.x - r.cell / 2, f.cell.y - r.cell / 2, r.cell, r.cell);
    }
    g.globalCompositeOperation = "source-over";
    // stalactites: soda straws, thin tubes of the same mineral, dimmer than the letters and of every
    // length (a row of even pale cones is a row of teeth); the drop gathering at each tip
    for (const d of s.drips) {
      const l = lit(st, d.x, d.tip) * 0.6, len = d.tip - d.hang, wdt = 0.9 + Math.min(1.6, len * 0.05);
      g.fillStyle = "rgba(" + st.tones[1].map(v => Math.round(v * l)).join(",") + ",0.85)";
      g.beginPath(); g.moveTo(d.x - wdt, d.hang); g.lineTo(d.x + wdt, d.hang); g.lineTo(d.x + 0.7, d.tip); g.lineTo(d.x - 0.7, d.tip); g.closePath(); g.fill();
      if (d.size > 0.3) {
        g.fillStyle = "rgba(220,232,240,0.55)"; g.beginPath(); g.arc(d.x, d.tip + d.size * 0.8, d.size, 0, 6.2832); g.fill();
        g.fillStyle = "rgba(" + warm + ",0.9)"; g.beginPath(); g.arc(d.x - d.size * 0.35 * s.lampSide * -1, d.tip + d.size * 0.5, d.size * 0.32, 0, 6.2832); g.fill();
      }
    }
    // drops in the air, drawn out by their speed
    g.globalCompositeOperation = "lighter";
    for (const f of s.falling) {
      const len = Math.min(14, 1.5 + f.vy * 0.018);
      g.fillStyle = "rgba(" + warm + ",0.7)";
      g.beginPath(); g.ellipse(f.x, f.y - len / 2, f.size * 0.7, len / 2 + f.size * 0.6, 0, 0, 6.2832); g.fill();
    }
    // splashes: a few droplets thrown up and out, falling back
    for (const p of s.splashes) {
      const a = p.age;
      g.fillStyle = "rgba(" + warm + "," + (0.6 * (1 - a / 0.4)).toFixed(3) + ")";
      for (const k of [-1.4, -0.6, 0.5, 1.3]) g.fillRect(p.x + k * 22 * a - 0.6, p.y - 40 * a + 220 * a * a - 0.6, 1.2, 1.2);
    }
    g.globalCompositeOperation = "source-over";
    if (!st.vg) {
      st.vg = g.createRadialGradient(W / 2, ctx.H * 0.45, Math.min(W, ctx.H) * 0.3, W / 2, ctx.H * 0.45, Math.hypot(W, ctx.H) * 0.62);
      st.vg.addColorStop(0, "rgba(4,5,10,0)"); st.vg.addColorStop(1, "rgba(4,5,10,0.6)");
    }
    g.fillStyle = st.vg; g.fillRect(0, 0, W, ctx.H);
  }
  function touch(st, kind, x, y) { if (kind === "down") globalThis.TH.stalagmiteTouch(st.s, x, y); }
  // a new size is a new wall; the line is laid out on it again
  function resize(st, ctx) {
    const field = st.field;
    Object.assign(st, create(ctx), { vg: null });
    if (field) words(st, field, ctx);
  }
  function info(st) {
    const T = globalThis.TH, s = st.s;
    return { rows: s.rows.length, drips: s.drips.length, drops: s.drops, falling: s.falling.length, built: +T.stalagmiteCoverage(s).toFixed(2) };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-stalagmite-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Stalagmite", phrase: "Big success is tiny successes building on each other.", mount,
      // on ledges down the middle of the wall (laid out again with room between the lines)
      wordsMode: "become",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(40, W / 21, H / 9) : Math.min(40, W / 9.5);
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.5 : 0.48) }, maxWidth: W * (wide ? 0.8 : 0.84) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
