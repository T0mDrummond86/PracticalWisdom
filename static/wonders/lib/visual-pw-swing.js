(function () {
  "use strict";
  // Swing (tip #122: "Life is swings and roundabouts."): one swing, seen side-on, as the pendulum it is.
  // Left alone it trades height for speed and back without loss (a playground swing loses a little to
  // the air; this one is kept honest, so what you see is the trade itself): slow at the top of each arc,
  // fast through the bottom, and the higher it climbs the longer it hangs at the top, because a
  // pendulum's swing lengthens with its arc. A push in the direction it is going adds energy, and it
  // climbs higher, never over the top. Pure; node-tested.
  const SWING = { MAX_RATE: 0.8, MAX_ARC: 1.35, PUSH: 0.42, SUB: 0.004 };

  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s.rs ^ (s.rs >>> 15), s.rs | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  // the pivot and the rope's length (px) for a pane of w x h: the same in the drawing and the line's place.
  // Upright, the rope is short enough that even the highest arc stays in the frame, and the swing hangs
  // in the middle of it; sideways there is room to the sides and the beam goes near the top.
  function swingFrame(w, h) {
    const wide = w > h, pivotY = h * (wide ? 0.12 : 0.3), len = wide ? 0.62 * h : Math.min(0.62 * h, 0.5 * w);
    return { pivotX: w / 2, pivotY, len };
  }

  function swingCreate(o) {
    const seed = o.seed >>> 0, s = { seed, rs: seed ^ 0x3c6ef372, w: o.w, h: o.h };
    Object.assign(s, swingFrame(o.w, o.h));
    s.len *= 0.9 + 0.1 * rnd(s);
    // a small-arc period near a real swing's (about 3 s), longer for a longer rope
    s.period = 3.1 * Math.sqrt(s.len / swingFrame(o.w, o.h).len);
    s.G = (2 * Math.PI / s.period) * (2 * Math.PI / s.period);   // g / L, per s^2
    s.theta = (0.35 + 0.35 * rnd(s)) * (rnd(s) < 0.5 ? -1 : 1);
    s.omega = 0;
    s.dusk = rnd(s);
    s.pushes = 0;
    return s;
  }

  // energy per unit length^2: kinetic minus G cos(theta)
  function swingEnergy(s) { return 0.5 * s.omega * s.omega - s.G * Math.cos(s.theta); }
  // the arc it will reach: where all of that energy is height
  function swingAmplitude(s) {
    const c = -swingEnergy(s) / s.G;
    return Math.acos(Math.max(-1, Math.min(1, c)));
  }

  // velocity Verlet in small steps: no energy creeps in or out
  function swingStep(s, dt) {
    const n = Math.max(1, Math.ceil(dt / SWING.SUB)), h = dt / n;
    for (let k = 0; k < n; k++) {
      const a0 = -s.G * Math.sin(s.theta);
      s.theta += s.omega * h + 0.5 * a0 * h * h;
      const a1 = -s.G * Math.sin(s.theta);
      s.omega += 0.5 * (a0 + a1) * h;
    }
  }

  // a push from behind, the way it is going (or, hanging at the top, back the way it came)
  function swingPush(s) {
    const dir = Math.abs(s.omega) > 0.05 ? Math.sign(s.omega) : -Math.sign(s.theta || 1);
    const before = s.omega;
    s.omega += dir * SWING.PUSH;
    // never over the top: if this would take it past the highest arc, give it only what reaches there
    const maxE = -s.G * Math.cos(SWING.MAX_ARC - 0.002);   // a hair under, for the integrator's wobble
    if (swingEnergy(s) > maxE) {
      const need = 2 * (maxE + s.G * Math.cos(s.theta));
      s.omega = need > 0 ? dir * Math.sqrt(need) : before;
      if (Math.abs(s.omega) < Math.abs(before) && Math.sign(s.omega) === Math.sign(before)) s.omega = before;
    }
    s.pushes++;
  }

  const api = { SWING, swingFrame, swingCreate, swingEnergy, swingAmplitude, swingStep, swingPush };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
