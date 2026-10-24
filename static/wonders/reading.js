(function () {
  "use strict";
  // The tip behind the Wonder: a quiet "Read the tip" control in the corner. Press it and the reading
  // comes up from below: the tip, then its anecdote exactly as Tom wrote it (fetched live, so an edit
  // to the tip shows here; never generated), then "Open this tip", which hands over to the app's own
  // Explore pane. A tip without an anecdote reads as the tip alone. A press on the reading, or
  // Escape, lets it go. Tao's book control (ui/reading.js there), pointed at a tip, not a chapter.
  const T = globalThis.TH;
  const BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10 5 7 4.6 3.5 5v13c3.5-.4 6.5 0 8.5 1.5 2-1.5 5-1.9 8.5-1.5V5C17 4.6 14 5 12 6.5z"/><path d="M12 6.5v13"/></svg>';

  // o: { tipFor(wonderId) -> Promise<{ id, content, anecdote } | null>, openTip(tipId) }
  function tipReading(host, o) {
    const { h } = T;
    let current = null, veil = null;
    const btn = h("button", { class: "wonder-read", type: "button" });
    btn.innerHTML = BOOK + "<span>Read the tip</span>";
    function close() {
      if (!veil) return;
      const v = veil; veil = null;
      v.classList.remove("in");
      removeEventListener("keydown", key);
      setTimeout(() => v.remove(), 450);
      btn.focus({ preventScroll: true });
    }
    const key = e => { if (e.key === "Escape") close(); };
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      if (!current || veil) return;
      const asked = current;
      const body = h("div", { class: "wonder-reading-body" }, h("p", { class: "wonder-reading-line" }, asked.phrase || ""));
      veil = h("div", { class: "wonder-reading", role: "dialog", "aria-modal": "true", "aria-label": "The tip", tabindex: "-1" }, body);
      veil.addEventListener("click", close);
      host.appendChild(veil);
      addEventListener("keydown", key);
      const shown = veil;
      requestAnimationFrame(() => { if (veil === shown) { shown.classList.add("in"); shown.focus({ preventScroll: true }); } });
      let tip = null;
      try { tip = o.tipFor ? await o.tipFor(asked.wonder) : null; } catch (err) { tip = null; }
      if (veil !== shown || !tip) return;   // closed meanwhile, or no tip: the line alone
      body.textContent = "";
      body.appendChild(h("p", { class: "wonder-reading-line" }, tip.content || asked.phrase || ""));
      String(tip.anecdote || "").split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean)
        .forEach(p => body.appendChild(h("p", { class: "wonder-reading-idea" }, p)));
      if (o.openTip) {
        body.appendChild(h("button", { class: "wonder-reading-open", type: "button",
          onclick: ev => { ev.stopPropagation(); close(); o.openTip(tip.id); } }, "Open this tip"));
      }
    });
    return {
      el: btn,
      // point it at the Wonder now showing; a reading left open closes
      set(item) { current = item; close(); },
      open: () => !!veil,
      destroy() { close(); }
    };
  }

  const api = { tipReading };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
