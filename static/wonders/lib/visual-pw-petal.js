(function () {
  "use strict";
  // Petal (tip #107: "Whenever my mind wanders off, bring it back."): one petal on a still pool, seen from
  // above. The pool is brimful, so its surface stands in a shallow dome, highest in the middle. A petal is
  // wetted by water, and the meniscus round a wetted floating thing climbs: it is drawn up the surface's
  // slope to the top of the dome and rests there (the same pull that gathers cereal in a bowl). The
  // further it is from the top, the harder the pull back, and the water's drag slows it, so it returns
  // smoothly, by itself. A touch sends a ripple out across the water; where the ripple passes the petal,
  // it shoves it on outward, away from where the ripple began. The petal drifts off, and comes back.
  // Pure; node-tested.
  const PETAL = {
    MAX_RATE: 0.8,
    PULL: 0.4,           // 1/s^2: the dome's pull back, per px off the top
    DRAG: 0.9,           // 1/s: the water's drag
    SPEED: 120,          // px/s a ripple spreads
    SHOVE: 70,           // px/s a fresh ripple gives the petal as it passes
    FADE: 1.3,           // s for a ripple to die away (a ring that lingers round the petal is an eye)
    SIZE: 20,            // px: the petal's half-length
    EDGE: 24,            // px: it never comes nearer the edge than this
  };

  function rnd(s) {
    s.rs = (s.rs + 0x6D2B79F5) >>> 0;
    let x = Math.imul(s.rs ^ (s.rs >>> 15), s.rs | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  // the top of the dome, where the petal rests: below the line, so it never sits on the words
  function petalHome(w, h) { return { x: w / 2, y: h * (w > h ? 0.72 : 0.64) }; }

  function petalCreate(o) {
    const seed = o.seed >>> 0, s = { seed, rs: seed ^ 0x9b05688c, w: o.w, h: o.h };
    s.home = petalHome(o.w, o.h);
    // the visit: the petal's colour and shape, the light on the water, where the petal starts
    s.hue = rnd(s); s.shape = rnd(s); s.light = rnd(s);
    const a = rnd(s) * 2 * Math.PI, r = 40 + 50 * rnd(s);
    s.x = s.home.x + Math.cos(a) * r; s.y = s.home.y + Math.sin(a) * r * 0.6;
    s.vx = 0; s.vy = 0; s.angle = rnd(s) * 2 * Math.PI; s.spin = (rnd(s) - 0.5) * 0.3;
    s.ripples = []; s.t = 0;
    return s;
  }

  function petalRipple(s, x, y) { s.ripples.push({ x, y, r: 0, age: 0, prev: Math.hypot(s.x - x, s.y - y) }); }

  function petalStep(s, dt) {
    s.t += dt;
    // ripples spread and fade; one passing the petal shoves it on, away from where it began
    for (const rp of s.ripples) {
      const before = rp.r;
      rp.r += PETAL.SPEED * dt; rp.age += dt;
      const dx = s.x - rp.x, dy = s.y - rp.y, d = Math.hypot(dx, dy) || 1;
      if (d > before && d <= rp.r) {
        const k = PETAL.SHOVE * Math.exp(-rp.age / PETAL.FADE);
        s.vx += k * dx / d; s.vy += k * dy / d;
        s.spin += (dx * s.vy - dy * s.vx > 0 ? 1 : -1) * 0.25 * Math.exp(-rp.age / PETAL.FADE);
      }
    }
    s.ripples = s.ripples.filter(rp => rp.age < PETAL.FADE * 2.5);
    // the dome draws it back to the top, the water drags on it
    s.vx += -PETAL.PULL * (s.x - s.home.x) * dt; s.vy += -PETAL.PULL * (s.y - s.home.y) * dt;
    const drag = Math.exp(-PETAL.DRAG * dt);
    s.vx *= drag; s.vy *= drag;
    s.x += s.vx * dt; s.y += s.vy * dt;
    // the pool's edge: it stops there
    const e = PETAL.EDGE;
    if (s.x < e) { s.x = e; s.vx = Math.max(0, s.vx); } else if (s.x > s.w - e) { s.x = s.w - e; s.vx = Math.min(0, s.vx); }
    if (s.y < e) { s.y = e; s.vy = Math.max(0, s.vy); } else if (s.y > s.h - e) { s.y = s.h - e; s.vy = Math.min(0, s.vy); }
    // it turns slowly as it goes, the water slowing that too
    s.spin *= Math.exp(-0.6 * dt);
    s.spin = Math.max(-0.6, Math.min(0.6, s.spin));
    s.angle += s.spin * dt;
  }

  const api = { PETAL, petalHome, petalCreate, petalRipple, petalStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
