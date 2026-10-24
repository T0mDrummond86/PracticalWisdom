(function () {
  "use strict";
  // Swing (tip #122): one swing at dusk, side-on (lib/visual-pw-swing.js). From the front a seat on two
  // chains is a face; side-on the chains are one line and the seat a plank seen end-on. Its frame and
  // the ground are silhouettes against the last of the light. The line hangs pale in the sky and the
  // chain sweeps through it at every pass. Touch to push: it climbs higher, and the higher it climbs
  // the longer it hangs at the top before it comes back. Each visit: the dusk's colour, the swing's
  // length, the arc it starts on.
  const ID = "pw-swing";
  const CSS = "";
  const DUSKS = [
    { top: [14, 20, 46], mid: [64, 52, 96], low: [214, 128, 86] },     // violet into amber
    { top: [10, 24, 44], mid: [44, 70, 104], low: [226, 156, 104] },   // blue into peach
    { top: [20, 16, 36], mid: [92, 50, 78], low: [232, 112, 72] },     // plum into ember
  ];
  const INK = "rgb(14,13,20)";

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  const mix = (a, b, u) => a.map((v, k) => Math.round(v + (b[k] - v) * u));

  // the scene, once per size, in two layers so the line can hang between them: behind, a dusk sky and a
  // glow where the sun went down; in front, a long low rise of grass and the swing's frame (an A seen
  // from the side, its top beam end-on at the pivot)
  function sceneFor(s, W, H, rand) {
    const cv = canvas(W, H), front = canvas(W, H), f = front.getContext("2d");
    let g = cv.getContext("2d");
    const d = DUSKS[Math.floor(s.dusk * DUSKS.length) % DUSKS.length], ground = s.pivotY + s.len + 0.05 * H;
    const sky = g.createLinearGradient(0, 0, 0, ground);
    sky.addColorStop(0, "rgb(" + d.top + ")"); sky.addColorStop(0.55, "rgb(" + d.mid + ")"); sky.addColorStop(1, "rgb(" + d.low + ")");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const gx = W * (0.15 + 0.7 * rand()), glow = g.createRadialGradient(gx, ground, 0, gx, ground, Math.max(W, H) * 0.55);
    glow.addColorStop(0, "rgba(" + mix(d.low, [255, 236, 200], 0.4) + ",0.55)"); glow.addColorStop(1, "rgba(" + d.low + ",0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    // the ground: a gentle rise, a little uneven, catching a last faint warmth along its crest
    const bumps = Array.from({ length: 12 }, () => rand());
    const earth = f.createLinearGradient(0, ground - 8, 0, H);
    earth.addColorStop(0, "rgb(" + mix([14, 13, 20], d.low, 0.12) + ")"); earth.addColorStop(0.25, INK); earth.addColorStop(1, "rgb(6,6,10)");
    g = f;                                      // from here on, the front layer
    g.fillStyle = earth;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) {
      const u = x / W * 11, k = Math.floor(u), f = u - k, sm = f * f * (3 - 2 * f);
      g.lineTo(x, ground + 6 * (bumps[k] + (bumps[k + 1] - bumps[k]) * sm) - 3 + 10 * (x / W - 0.5) * (s.dusk - 0.5));
    }
    g.lineTo(W, H); g.closePath(); g.fill();
    // the frame: two legs splayed fore and aft from the beam
    const splay = 0.42 * s.len;
    g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = "round";
    g.beginPath();
    g.moveTo(s.pivotX - 3, s.pivotY); g.lineTo(s.pivotX - splay, ground + 4);
    g.moveTo(s.pivotX + 3, s.pivotY); g.lineTo(s.pivotX + splay, ground + 4);
    g.stroke();
    g.fillStyle = INK; g.fillRect(s.pivotX - 7, s.pivotY - 7, 14, 12);
    return { sky: cv, front };
  }

  function create(ctx) {
    const T = globalThis.TH, s = T.swingCreate({ seed: ctx.seed, w: ctx.W, h: ctx.H });
    return { s, scene: sceneFor(s, ctx.W, ctx.H, T.wonderRand(ctx.seed ^ 0x2c1b3c6d)), field: null };
  }
  function words(st, field) { st.field = field; }
  function step(st, dt) { globalThis.TH.swingStep(st.s, dt); }
  function draw(g, st, ctx) {
    const s = st.s;
    g.drawImage(st.scene.sky, 0, 0, ctx.W, ctx.H);
    if (st.field) globalThis.TH.wonderLine(g, st.field, "rgba(246,232,214,0.86)");   // the line, pale against the sky
    g.drawImage(st.scene.front, 0, 0, ctx.W, ctx.H);
    // the chain (both chains, one behind the other) and the seat end-on
    const sx = s.pivotX + s.len * Math.sin(s.theta), sy = s.pivotY + s.len * Math.cos(s.theta);
    g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = "round";
    g.beginPath(); g.moveTo(s.pivotX, s.pivotY); g.lineTo(sx, sy); g.stroke();
    g.save(); g.translate(sx, sy); g.rotate(-s.theta);
    g.fillStyle = INK; g.fillRect(-15, -1, 30, 6);
    g.restore();
  }
  function touch(st, kind) { if (kind === "down") globalThis.TH.swingPush(st.s); }
  // a new size: the same swing, at the same point in its arc, in the new frame
  function resize(st, ctx) {
    const old = st.s, fresh = create(ctx);
    fresh.s.theta = old.theta; fresh.s.omega = old.omega * Math.sqrt(fresh.s.G / old.G);
    Object.assign(st, { s: fresh.s, scene: fresh.scene });
  }
  function info(st) {
    const T = globalThis.TH, s = st.s;
    return { theta: +s.theta.toFixed(3), omega: +s.omega.toFixed(3), arc: +T.swingAmplitude(s).toFixed(3), period: +s.period.toFixed(2), len: Math.round(s.len), pushes: s.pushes };
  }

  function mount(el, opts) {
    return globalThis.TH.wonder2d(el, opts, { id: ID, styleId: "vis-pw-swing-style", css: CSS, create, words, step, draw, touch, resize, info });
  }

  const api = { VISUALS: Object.assign((globalThis.TH && globalThis.TH.VISUALS) || {}, {
    [ID]: { id: ID, name: "Swing", phrase: "Life is swings and roundabouts.", mount,
      // in the sky the chain sweeps through: six tenths of the way from the beam to the seat
      // (the frame as in lib swingFrame: upright, beam at 30% of the height, rope the lesser of 62% of
      // the height and half the width; sideways, beam at 12%, rope 62% of the height)
      wordsMode: "around",
      wordsAt: (W, H) => {
        const wide = W > H, len = wide ? 0.62 * H : Math.min(0.62 * H, 0.5 * W), size = wide ? Math.min(40, W / 20) : Math.min(40, W / 9);
        return { size, cell: 1.5, at: { x: W / 2, y: H * (wide ? 0.12 : 0.3) + 0.6 * len }, maxWidth: W * (wide ? 0.6 : 0.82) };
      } }
  }) };
  globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
