(function () {
  "use strict";
  // The one runtime every tip Wonder runs on (docs/superpowers/plans/2026-10-24-tip-wonders.md).
  // Tao's Wonders each carry their own mount: style, canvas, touch, frame loop, teardown, the same
  // ninety lines ten times over. Here a Wonder hands over only what is its own (its world, how the
  // world moves, how it looks, what a finger does to it) and this file keeps the visuals contract:
  //   edges: the outer 56 px left and right and the top 64 px are the gallery's, never touch
  //   touch-action: none on the canvas, pointer capture while a finger is down
  //   at most 30 fps (10 under reduced motion, at 0.3 of the pace, still answering touch)
  //   devicePixelRatio capped at 2; paused when the page is hidden or the gallery says so
  //   destroy() removes every listener, the canvas, and the style once its last user goes
  // spec: { id, styleId: "vis-<id>-style", css,
  //   create(ctx) -> state            ctx: { W, H, S, dpr, rand, reduced, seed, t }
  //   words?(state, field, ctx)       once the line's font has loaded (lib/wordfield.js)
  //   step(state, dt, ctx)            dt already at the visit's pace
  //   draw(g, state, ctx)             g is the 2D context, in CSS px
  //   touch?(state, kind, x, y, ctx)  kind "down" | "move" | "up"
  //   resize?(state, ctx), info?(state) -> extra fields for _state() }
  const EDGE_X = 56, EDGE_TOP = 64;
  const styleUsers = {};
  const baseCss = id => ".vis-" + id + " { position: absolute; inset: 0; overflow: hidden; background: #04050a; }\n" +
    ".vis-" + id + "-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }\n";

  // mulberry32: a small seeded generator, so a visit can be replayed from its seed
  function wonderRand(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let x = Math.imul(a ^ (a >>> 15), a | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function wonder2d(el, opts, spec) {
    opts = opts || {};
    const id = spec.id;
    if (spec.styleId !== "vis-" + id + "-style") throw new Error("wonder2d: styleId must be vis-" + id + "-style");
    const reduced = !!opts.reduced;
    if (!styleUsers[id]) {
      const st = document.createElement("style"); st.id = spec.styleId; st.textContent = baseCss(id) + (spec.css || "");
      document.head.appendChild(st);
    }
    styleUsers[id] = (styleUsers[id] || 0) + 1;
    const root = document.createElement("div"); root.className = "vis-" + id;
    const canvas = document.createElement("canvas"); canvas.className = "vis-" + id + "-canvas"; canvas.setAttribute("aria-hidden", "true");
    root.appendChild(canvas); el.appendChild(root);
    const g = canvas.getContext("2d");

    const seed = opts.seed != null ? opts.seed >>> 0 : Math.floor(Math.random() * 4294967296);
    const ctx = { W: 0, H: 0, S: 0, dpr: 1, rand: wonderRand(seed), reduced, seed, t: 0 };
    function measure() {
      const W = root.clientWidth || el.clientWidth || innerWidth, H = root.clientHeight || el.clientHeight || innerHeight;
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      const changed = W !== ctx.W || H !== ctx.H || dpr !== ctx.dpr;
      Object.assign(ctx, { W, H, S: Math.sqrt(W * H), dpr });
      canvas.width = Math.max(2, Math.round(W * dpr)); canvas.height = Math.max(2, Math.round(H * dpr));
      return changed;
    }
    measure();
    const state = spec.create(ctx);
    let destroyed = false;
    function draw() {
      if (destroyed || !g) return;
      g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
      spec.draw(g, state, ctx);
    }
    if (opts.words && opts.words.ready && spec.words) {
      opts.words.ready.then(f => { if (destroyed) return; spec.words(state, f, ctx); draw(); }).catch(() => { /* the visual stands without its line */ });
    }

    // ---- touch: one finger at a time, never inside the edges
    let held = null;
    const local = e => { const r = root.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const clampX = x => Math.min(ctx.W - EDGE_X, Math.max(EDGE_X, x)), clampY = y => Math.max(EDGE_TOP, y);
    function touch(kind, x, y, pid) {
      if (kind === "down") {
        if (held != null || x < EDGE_X || x > ctx.W - EDGE_X || y < EDGE_TOP) return false;
        held = pid == null ? -1 : pid;
      } else if (held == null || (pid != null && pid !== held)) return false;
      if (kind === "up") held = null;
      if (spec.touch) spec.touch(state, kind, kind === "down" ? x : clampX(x), kind === "down" ? y : clampY(y), ctx);
      wake();
      return true;
    }
    const onDown = e => { const [x, y] = local(e); if (touch("down", x, y, e.pointerId)) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } } };
    const onMove = e => { const [x, y] = local(e); touch("move", x, y, e.pointerId); };
    const onUp = e => { const [x, y] = local(e); touch("up", x, y, e.pointerId); };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    // ---- the loop
    const pace = reduced ? 0.3 : 1;
    const FRAME_MS = reduced ? 100 : 1000 / 30;
    function step(dt) { ctx.t += dt * pace; spec.step(state, dt * pace, ctx); }
    let raf = 0, last = 0, paused = false, hidden = document.visibilityState === "hidden";
    const running = () => !destroyed && !paused && !hidden;
    function frame(now) {
      raf = 0;
      if (!running()) return;
      if (last && now - last < FRAME_MS - 2) { raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 30;
      last = now;
      step(dt); draw();
      raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && running()) { last = 0; raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    const onVis = () => { hidden = document.visibilityState === "hidden"; if (running()) wake(); else stop(); };
    document.addEventListener("visibilitychange", onVis);
    const onResize = () => { if (measure() && spec.resize) spec.resize(state, ctx); draw(); };
    addEventListener("resize", onResize);
    // the pane can change size without the window doing so (the section opening, a phone turning)
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : null;
    if (ro) ro.observe(root);

    draw(); wake();
    return {
      destroy() {
        if (destroyed) return;
        destroyed = true; stop();
        document.removeEventListener("visibilitychange", onVis);
        removeEventListener("resize", onResize);
        if (ro) ro.disconnect();
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        root.remove();
        if (--styleUsers[id] <= 0) { delete styleUsers[id]; const st = document.getElementById(spec.styleId); if (st) st.remove(); }
      },
      pause() { paused = true; stop(); },
      resume() { paused = false; wake(); },
      // verification: step by hand (a hidden pane runs no frames)
      _advance(seconds) {
        const n = Math.max(1, Math.round(seconds * 30));
        for (let i = 0; i < n; i++) step(seconds / n);
        draw();
      },
      _touch: (kind, x, y) => touch(kind, x, y, null),
      _state: () => Object.assign({ id, seed, t: +ctx.t.toFixed(2), W: ctx.W, H: ctx.H, canvas: [canvas.width, canvas.height], reduced },
        spec.info ? spec.info(state) : {}),
      _canvas: canvas
    };
  }

  const api = { wonder2d, wonderRand, WONDER_EDGE: { x: EDGE_X, top: EDGE_TOP } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
