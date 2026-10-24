(function () {
  "use strict";
  // The Animations (demo) section: the tip Wonders one at a time, filling the section's pane, in the
  // plan's order (catalogue.js), opening on the one asked for or where you left off (pw:wonder-last).
  // Each is a real phenomenon you can touch, with its tip's line made out of its own material
  // (wordfield.js). Tao's gallery (ui/gallery.js there), without its crossings, which need WebGL2 and
  // a dozen more files: moving on is the crossfade Tao itself falls back to. No hash routes either;
  // the app has none.
  const T = globalThis.TH;
  const LAST = "pw:wonder-last";

  // ---- pure pieces (node-tested) ---------------------------------------------------------------
  const neighbour = (available, id, step) => available[(available.indexOf(id) + step + available.length) % available.length];
  // Open on the Wonder asked for, else where you left off, else the first
  const startAt = (available, last, asked) => available.includes(asked) ? asked : available.includes(last) ? last : available[0];

  // ---- the gallery ------------------------------------------------------------------------------
  // o: { start, tipFor(wonderId) -> Promise<{ id, content, anecdote } | null>, openTip(tipId) }
  function renderWonders(host, o) {
    o = o || {};
    const { h } = T;
    const available = T.WONDER_ORDER.filter(id => T.VISUALS && T.VISUALS[id]);
    if (!available.length) {
      const empty = h("p", { class: "wonder-empty" }, "Nothing here yet.");
      host.appendChild(empty);
      return { el: empty, teardown() { empty.remove(); } };
    }
    let last = null; try { last = localStorage.getItem(LAST); } catch (e) { /* private mode */ }
    const reduced = !!(globalThis.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    let current = startAt(available, last, o.start);
    let handle = null, phraseTimer = null, busy = false, dead = false;

    const stage = h("div", { class: "wonder-stage" });
    const phrase = h("p", { class: "wonder-phrase", "aria-live": "polite" });
    const arrow = (dir, label) => {
      const b = h("button", { class: "wonder-arrow wonder-" + dir, type: "button", "aria-label": label, onclick: e => { e.stopPropagation(); go(dir === "next" ? 1 : -1); } });
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (dir === "next" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7") + '"/></svg>';
      return b;
    };
    const dots = h("div", { class: "wonder-dots", "aria-hidden": "true" }, available.map(() => h("i")));
    const layer = h("div", { class: "wonder" }, stage, phrase, arrow("prev", "Previous animation"), arrow("next", "Next animation"), dots);
    const reading = T.tipReading ? T.tipReading(layer, { tipFor: o.tipFor, openTip: o.openTip }) : null;
    if (reading) layer.appendChild(reading.el);
    host.appendChild(layer);

    function showPhrase(text) {
      clearTimeout(phraseTimer);
      phrase.textContent = text;
      phrase.classList.remove("in", "out"); void phrase.offsetWidth;
      phrase.classList.add("in");
      phraseTimer = setTimeout(() => phrase.classList.add("out"), reduced ? 4500 : 3600);
    }
    function mount(id) {
      const v = T.VISUALS[id];
      const el = h("div", { class: "wonder-visual" });
      stage.appendChild(el);
      let hnd = null;
      const wf = T.wonderFont(id);
      // the line is laid out against the pane, not the window: the toolbar sits above it
      const W = layer.clientWidth || innerWidth, H = layer.clientHeight || innerHeight;
      const words = v.wordsMode && v.phrase && T.buildWordField
        ? T.buildWordField(v.phrase, Object.assign({ W, H, rand: Math.random, font: wf.font, italic: wf.italic }, v.wordsAt ? v.wordsAt(W, H) : {}))
        : null;
      const fam = T.FONTS && T.FONTS[wf.font];
      phrase.style.fontFamily = fam ? '"' + fam.family + '", Georgia, serif' : "";
      phrase.style.fontStyle = wf.italic ? "italic" : "normal";
      if (fam && T.loadFont) T.loadFont(wf.font).catch(() => {});
      try { hnd = v.mount(el, { reduced, words }); } catch (e) { console.error("animation " + id + " failed", e); }
      [...dots.children].forEach((d, n) => d.classList.toggle("on", available[n] === id));
      if (words) { clearTimeout(phraseTimer); phrase.classList.remove("in", "out"); phrase.classList.add("spoken"); phrase.textContent = v.phrase; }
      else { phrase.classList.remove("spoken"); showPhrase(v.phrase || ""); }
      if (reading) reading.set({ wonder: id, phrase: v.phrase });
      try { localStorage.setItem(LAST, id); } catch (e) { /* private mode */ }
      return { el, hnd, id };
    }
    function go(step) {
      if (busy || dead) return;
      busy = true;
      const old = handle, next = neighbour(available, current, step);
      current = next;
      handle = mount(next);
      if (!old) { busy = false; return; }
      handle.el.classList.add("arriving");
      old.el.classList.add("leaving");
      setTimeout(() => { try { if (old.hnd) old.hnd.destroy(); } catch (e) { /* gone */ } old.el.remove(); busy = false; }, reduced ? 0 : 900);
      requestAnimationFrame(() => handle.el.classList.remove("arriving"));
    }
    // tapping the line lets it go at once, so you can touch the visual underneath
    phrase.addEventListener("pointerdown", () => { clearTimeout(phraseTimer); phrase.classList.add("out"); });
    const key = e => {
      if (reading && reading.open()) return;
      if (e.target && /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1);
    };
    const vis = () => { if (!handle || !handle.hnd) return; try { if (document.hidden) handle.hnd.pause(); else handle.hnd.resume(); } catch (e) { /* optional */ } };
    addEventListener("keydown", key);
    document.addEventListener("visibilitychange", vis);
    const first = setTimeout(() => { if (!dead) handle = mount(current); }, 0);
    return {
      el: layer,
      teardown() {
        if (dead) return;
        dead = true;
        clearTimeout(first); clearTimeout(phraseTimer);
        removeEventListener("keydown", key); document.removeEventListener("visibilitychange", vis);
        if (reading) reading.destroy();
        // a crossfade under way destroys the outgoing one on its own timer
        if (handle && handle.hnd) { try { handle.hnd.destroy(); } catch (e) { /* gone */ } }
        layer.remove();
      },
      // verification: the handle of the Wonder showing
      _current: () => handle,
    };
  }

  const api = { renderWonders, wonderNeighbour: neighbour, wonderStart: startAt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
