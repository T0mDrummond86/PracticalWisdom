(function () {
  "use strict";
  // The ten tip Wonders and the tip each one carries (docs/wonders-plan.md), in build order. Loaded
  // with the page, small on purpose: the app needs it to know which tips have a Wonder and which
  // scripts to fetch, long before the Animations section loads the Wonders themselves.
  // id is the tip's id on the live site; match is a phrase only that tip contains. A Wonder takes
  // the tip at its id when the words agree, else the tip with the words, so a local copy of the
  // tips or a re-import (where the ids differ) still finds the right one and never a wrong one.
  // font is the Wonder's voice, from the ten house fonts (fonts.js `feel`), none used twice.
  const WONDER_TIPS = [
    { wonder: "pw-pencil", id: 39, match: "bluntest pencil", font: "caveat" },
    { wonder: "pw-reduction", id: 86, match: "boil things down", font: "cormorant" },
    { wonder: "pw-filings", id: 67, match: "polar opposite", font: "instrument" },
    { wonder: "pw-kerf", id: 20, match: "measure twice", font: "josefin" },
    { wonder: "pw-swing", id: 122, match: "swings and roundabouts", font: "syne" },
    { wonder: "pw-threshold", id: 181, match: "go outside into the sun", font: "outfit" },
    { wonder: "pw-stalagmite", id: 12, match: "tiny successes", font: "fell" },
    { wonder: "pw-shoot", id: 65, match: "push through", font: "fraunces" },
    { wonder: "pw-bloom", id: 3, match: "help others to flourish", font: "playfair" },
    { wonder: "pw-petal", id: 107, match: "bringing my mind back", font: "shippori" },
  ];
  const WONDER_ORDER = WONDER_TIPS.map(e => e.wonder);
  const ITALIC = { fraunces: true, instrument: true };   // italic only where the font has its own

  const says = (tip, e) => !!tip && String(tip.content || "").toLowerCase().includes(e.match);
  const entry = id => WONDER_TIPS.find(e => e.wonder === id) || null;

  function wonderFont(id) { const e = entry(id), font = e ? e.font : "shippori"; return { font, italic: !!ITALIC[font] }; }
  function tipForWonder(tips, id) {
    const e = entry(id);
    if (!e || !Array.isArray(tips)) return null;
    const at = tips.find(t => t.id === e.id);
    return says(at, e) ? at : (tips.find(t => says(t, e)) || null);
  }
  function wonderForTip(tip) { const e = WONDER_TIPS.find(x => says(tip, x)); return e ? e.wonder : null; }

  const api = { WONDER_TIPS, WONDER_ORDER, wonderFont, tipForWonder, wonderForTip };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
