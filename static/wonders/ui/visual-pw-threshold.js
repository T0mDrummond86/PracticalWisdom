(function () {
  "use strict";
  // Threshold (tip #181): inside a dark room at dawn, looking at a door ajar (lib/visual-pw-threshold.js).
  // Through the gap the morning; across the floor the long low light, a wedge widening toward you; in the
  // air the beam, and the dust in it. The line hangs in the room, faint in the dark, and the light lies
  // across it where it passes. Touch and the door swings wider: more morning, a wider wedge. Drawn in
  // perspective from a viewer standing a few metres in. Each visit: the sun's height and warmth, how far
  // round to the side it is, how far the door stands open.
  const ID = "pw-threshold";
  const CSS = "";
  const CAM = { back: 2.9, eye: 1.55, near: 0.3 };

  function view(ctx, s) {
    const wide = ctx.W > ctx.H, f = 1.15 * Math.min(ctx.W, 0.8 * ctx.H);
    // standing a little to the latch side: the open door turns toward you, and the morning shows past its
    // edge, a sliver at first and the whole doorway once it is wide open
    const cx = (s.door.x0 + s.door.x1) / 2 + 0.3, horizon = ctx.H * (wide ? 0.28 : 0.3);
    return (x, y, z) => {
      const d = Math.max(CAM.near, CAM.back - y);
      return [ctx.W / 2 + f * (x - cx) / d, horizon + f * (CAM.eye - z) / d];
    };
  }
  function poly(g, pts) { g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); }
  // the convex hull of a few screen points (monotone chain), for the beam's outline in the air
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const q of p) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }

  function create(ctx) {
    const T = globalThis.TH, s = T.thresholdCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H });
    const w = s.sun.warmth, sunCol = [255, Math.round(196 + 30 * (1 - w)), Math.round(118 + 60 * (1 - w))];
    return { s, P: view(ctx, s), sunCol, field: null };
  }
  function words(st, field) { st.field = field; }
  function step(st, dt) { globalThis.TH.thresholdStep(st.s, dt); }

  function draw(g, st, ctx) {
    const T = globalThis.TH, s = st.s, P = st.P, D = s.door, W = ctx.W, H = ctx.H, sc = st.sunCol.join(",");
    const far = CAM.back - CAM.near;
    // the room: a dark wall, a darker floor, its boards running toward the door
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "rgb(17,15,19)"; g.fillRect(0, 0, W, H);
    const [, floorV] = P(0, 0, 0);
    g.fillStyle = "rgb(24,19,17)"; g.fillRect(0, floorV, W, H - floorV);
    g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 1;
    g.beginPath();
    for (let x = -3; x <= 4; x += 0.18) { const a = P(x, 0, 0), b = P(x, far, 0); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    g.stroke();
    // the morning through the doorway, then the door standing in front of part of it
    const aperture = [P(D.x0, 0, 0), P(D.x1, 0, 0), P(D.x1, 0, D.height), P(D.x0, 0, D.height)];
    const sky = g.createLinearGradient(0, aperture[2][1], 0, aperture[0][1]);
    sky.addColorStop(0, "rgb(150,168,196)"); sky.addColorStop(0.7, "rgb(" + sc + ")"); sky.addColorStop(1, "rgb(255,236,206)");
    g.fillStyle = sky; poly(g, aperture); g.fill();
    // the beam: where the sun comes through the gap, on the floor and in the air; drawn before the door,
    // which stands in front of where it starts
    const [xl, xr] = T.thresholdGap(s), dr = s.sun.drift, Lp = Math.min(D.height / s.sun.drop, far);
    const patch = xr - xl > 1e-4 ? [P(xl, 0, 0), P(xr, 0, 0), P(xr + dr * Lp, Lp, 0), P(xl + dr * Lp, Lp, 0)] : null;
    let shaft = null;
    if (patch) {
      const top = y => D.height - s.sun.drop * y, yt = Math.min(Lp, far);
      shaft = hull([P(xl, 0, 0), P(xr, 0, 0), P(xl, 0, D.height), P(xr, 0, D.height), patch[2], patch[3],
        P(xl + dr * yt, yt, Math.max(0, top(yt))), P(xr + dr * yt, yt, Math.max(0, top(yt)))]);
      g.globalCompositeOperation = "lighter";
      const fl = g.createLinearGradient(0, patch[0][1], 0, H);
      fl.addColorStop(0, "rgba(" + sc + ",0.62)"); fl.addColorStop(1, "rgba(" + sc + ",0.16)");
      g.fillStyle = fl; poly(g, patch); g.fill();
      // the beam in the air is not painted (any fill with an outline reads as a wall); the dust and the
      // line show where it runs
      g.globalCompositeOperation = "source-over";
    }
    // the door, its inner face in its own shadow, its free edge catching the sun
    const ex = D.x0 + D.width * Math.cos(s.phi), ey = D.width * Math.sin(s.phi);
    g.fillStyle = "rgb(38,29,24)"; poly(g, [P(D.x0, 0, 0), P(D.x0, 0, D.height), P(ex, ey, D.height), P(ex, ey, 0)]); g.fill();
    const e0 = P(ex, ey, 0), e1 = P(ex, ey, D.height);
    g.strokeStyle = "rgba(" + sc + ",0.55)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(e0[0], e0[1]); g.lineTo(e1[0], e1[1]); g.stroke();
    // the line: faint in the dark, and lit where the light lies across it
    if (st.field) {
      T.wonderLine(g, st.field, "rgba(214,196,170,0.13)");
      if (patch) {
        g.save(); poly(g, shaft); g.clip();
        T.wonderLine(g, st.field, "rgba(255,240,214,0.9)");
        g.restore();
      }
    }
    // dust, only where the beam finds it
    g.globalCompositeOperation = "lighter";
    for (const m of s.motes) {
      if (!m.lit) continue;
      // against the bright doorway a mote is lost (and a bright dot there reads as a star)
      const [u, v] = P(m.x, m.y, m.z), d = Math.max(CAM.near, CAM.back - m.y), r = Math.min(2.2, 0.5 + 1.4 / d);
      if (u > aperture[0][0] - 2 && u < aperture[1][0] + 2 && v > aperture[2][1] - 2 && v < aperture[0][1] + 2) continue;
      // soft, not a point: a sharp pale dot on the dark reads as a star
      const a = (0.1 + 0.16 * m.r) * Math.min(1, Math.max(0, (m.y - 0.3) / 0.4)), rr = 1.5 + 2.5 * r;
      if (a <= 0) continue;
      const gr = g.createRadialGradient(u, v, 0, u, v, rr);
      gr.addColorStop(0, "rgba(" + sc + "," + a.toFixed(3) + ")"); gr.addColorStop(1, "rgba(" + sc + ",0)");
      g.fillStyle = gr; g.fillRect(u - rr, v - rr, 2 * rr, 2 * rr);
    }
    g.globalCompositeOperation = "source-over";
    const vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, "rgba(4,5,10,0)"); vg.addColorStop(1, "rgba(4,5,10,0.55)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }
  function touch(st, kind) { if (kind === "down") globalThis.TH.thresholdOpen(st.s); }
  function resize(st, ctx) { st.P = view(ctx, st.s); }
  function info(st) {
    const T = globalThis.TH, s = st.s, [xl, xr] = T.thresholdGap(s);
    let lit = 0; for (const m of s.motes) if (m.lit) lit++;
    return { door: +s.phi.toFixed(3), target: +s.target.toFixed(3), gap: +(xr - xl).toFixed(3), wedge: +T.thresholdWedge(s).toFixed(3),
      sun: [+(s.sun.elev * 180 / Math.PI).toFixed(1), +s.sun.az.toFixed(2)], dustLit: lit };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-threshold-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Threshold", phrase: "As soon as I wake up, go outside into the sun.", mount,
      // in the room, low, where the wedge runs across the floor toward you
      wordsMode: "around",
      wordsAt: (W, H) => {
        const wide = W > H, size = wide ? Math.min(40, W / 20) : Math.min(40, W / 11);
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.5 : 0.64) }, maxWidth: W * (wide ? 0.62 : 0.84) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
