(function () {
  "use strict";
  // Threshold (tip #181: "As soon as I wake up, go outside into the sun."): a dark room at dawn, a door
  // ajar, the sun just up outside. Its light comes in nearly level, so it runs a long way across the
  // floor: a wedge, widening as it comes. The door, hinged on one side and opening inward, stands in
  // the way of part of the doorway; what the sun can see past its edge is the gap, and the gap widens
  // steadily as the door swings open, from nothing when it is shut. The air is never empty: dust drifts
  // in it, and shows only where the beam passes. A touch swings the door wider; it eases there, and
  // never past fully open. Floor-plan metres: the doorway in the wall y = 0, the room at y > 0, height z.
  // Pure; node-tested.
  const THRESHOLD = { MAX_RATE: 0.8, FULL: 1.45, OPEN: 0.26, EASE: 0.9, MOTES: 280 };

  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s.rs ^ (s.rs >>> 15), s.rs | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  function thresholdCreate(o) {
    const seed = o.seed >>> 0, s = { seed, rs: seed ^ 0x1f83d9ab, w: o.w, h: o.h };
    s.door = { x0: 0, x1: 0.9, width: 0.9, height: 2.05 };          // hinge at x0, latch jamb at x1
    // the sun: how high (the lower, the further its light runs), how far round to the side, how warm
    const elev = (5 + 9 * rnd(s)) * Math.PI / 180, az = -0.1 + 0.35 * rnd(s);   // mostly round to the latch side, where the gap is
    s.sun = { elev, az, drift: Math.tan(az), drop: Math.tan(elev), warmth: rnd(s) };
    s.phi = 0.12 + 0.3 * rnd(s); s.target = s.phi;
    s.motes = [];
    for (let k = 0; k < THRESHOLD.MOTES; k++) {
      s.motes.push({ x: -0.6 + 2.6 * rnd(s), y: 0.05 + 4.5 * rnd(s), z: 0.05 + 2.2 * rnd(s), vx: 0, vy: 0, vz: 0, lit: false, r: rnd(s) });
    }
    s.t = 0;
    light(s);
    return s;
  }

  // where the door's free edge is when it stands open phi (inward from the hinge)
  const edge = (s, phi) => [s.door.x0 + s.door.width * Math.cos(phi), s.door.width * Math.sin(phi)];
  // The gap the sun shines through, as it crosses the threshold (x from, x to, metres): from the shadow
  // of the door's free edge, traced back along the light to the threshold, to the latch jamb
  function thresholdGap(s, phi) {
    const [ex, ey] = edge(s, phi == null ? s.phi : phi);
    const shadow = Math.max(s.door.x0, ex - s.sun.drift * ey);
    return [Math.min(shadow, s.door.x1), s.door.x1];
  }
  // the wedge's angle: how wide the lit gap looks from the middle of the room, 3 m in (radians)
  function thresholdWedge(s, phi) {
    const [xl, xr] = thresholdGap(s, phi), cx = (s.door.x0 + s.door.x1) / 2;
    return Math.max(0, Math.atan2(xr - cx, 3) - Math.atan2(xl - cx, 3));
  }
  // Is the point (x, y, z) in the beam? Follow the light back to the doorway: it must have come
  // through the gap, below the head of the door, and not through the door itself
  function thresholdLit(s, x, y, z) {
    if (y <= 0 || z <= 0) return false;
    const x0 = x - s.sun.drift * y, z0 = z + s.sun.drop * y;
    if (z0 > s.door.height) return false;
    const [xl, xr] = thresholdGap(s);
    return x0 >= xl && x0 <= xr;
  }
  function light(s) { for (const m of s.motes) m.lit = thresholdLit(s, m.x, m.y, m.z); }

  // a touch: the door swings wider, to at most fully open
  function thresholdOpen(s) { s.target = Math.min(THRESHOLD.FULL, s.target + THRESHOLD.OPEN); }

  function thresholdStep(s, dt) {
    s.t += dt;
    // the door eases toward where it was sent, closing the distance by a share each moment: it can
    // only approach, never pass
    s.phi += (s.target - s.phi) * (1 - Math.exp(-dt / THRESHOLD.EASE));
    if (Math.abs(s.target - s.phi) < 1e-6) s.phi = s.target;
    // dust: a slow random walk, rising a little where the sun has warmed the air, kept in the room
    const k = Math.exp(-dt * 0.8);
    for (const m of s.motes) {
      m.vx = m.vx * k + (rnd(s) - 0.5) * 0.06 * dt;
      m.vy = m.vy * k + (rnd(s) - 0.5) * 0.06 * dt;
      m.vz = m.vz * k + ((rnd(s) - 0.5) * 0.06 + (m.lit ? 0.004 : -0.001)) * dt;
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      if (m.x < -0.6) m.x += 2.6; else if (m.x > 2) m.x -= 2.6;
      if (m.y < 0.05) m.y = 0.05; else if (m.y > 4.6) m.y = 4.6;
      if (m.z < 0.05) m.z = 2.25; else if (m.z > 2.25) m.z = 0.05;
    }
    light(s);
  }

  const api = { THRESHOLD, thresholdCreate, thresholdGap, thresholdWedge, thresholdLit, thresholdOpen, thresholdStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
