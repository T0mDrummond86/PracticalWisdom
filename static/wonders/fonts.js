(function () {
  "use strict";
  // The phrase cards' typefaces (fonts/*.woff2, latin subsets, OFL). Each score names one by id.
  // size: a multiplier that evens out x-heights so every face reads at the same size;
  // weight: the resting weight (all variable faces accept any weight in their range);
  // track: letter spacing in em, added between letters by the engine.
  const FONTS = {
    fraunces:   { family: "CC Fraunces", feel: "soft, warm modern serif — the house voice",   files: [["fraunces.woff2", "normal", "300 700"], ["fraunces-italic.woff2", "italic", "300 700"]], weight: 400, size: 1.0, track: 0 },
    cormorant:  { family: "CC Cormorant", feel: "classical, elegant, Roman — Stoic and old wisdom",  files: [["cormorant.woff2", "normal", "300 700"], ["cormorant-italic.woff2", "italic", "400"]], weight: 500, size: 1.16, track: 0 },
    fell:       { family: "CC Fell", feel: "old printed book, slightly rough — 18th/19th-century voices",       files: [["fell.woff2", "normal", "400"], ["fell-italic.woff2", "italic", "400"]], weight: 400, size: 1.08, track: 0 },
    instrument: { family: "CC Instrument", feel: "thin, fine, editorial — quiet, delicate, fleeting things", files: [["instrument.woff2", "normal", "400"], ["instrument-italic.woff2", "italic", "400"]], weight: 400, size: 1.14, track: 0 },
    playfair:   { family: "CC Playfair", feel: "high-contrast and dramatic — bold claims, wonder",   files: [["playfair.woff2", "normal", "400 900"], ["playfair-italic.woff2", "italic", "400 900"]], weight: 500, size: 0.96, track: 0 },
    caveat:     { family: "CC Caveat", feel: "handwriting — a person's own words, casual, intimate",     files: [["caveat.woff2", "normal", "400 700"]], weight: 500, size: 1.3, track: 0 },
    josefin:    { family: "CC Josefin", feel: "light geometric — space, stars, air",    files: [["josefin.woff2", "normal", "100 400"]], weight: 300, size: 0.98, track: 0.04 },
    outfit:     { family: "CC Outfit", feel: "clean, round, spoken — plain talk, conversation",     files: [["outfit.woff2", "normal", "200 500"]], weight: 300, size: 0.95, track: 0.01 },
    syne:       { family: "CC Syne", feel: "wide, expressive, playful — joy, music, surprise",       files: [["syne.woff2", "normal", "400 800"]], weight: 600, size: 0.9, track: 0 },
    shippori:   { family: "CC Shippori", feel: "Japanese-style mincho serif — stillness, the Tao, water",   files: [["shippori.woff2", "normal", "400"]], weight: 400, size: 1.0, track: 0.02 }
  };
  const FONT_IDS = Object.keys(FONTS);
  const loading = {};

  // Resolves when every file of the face is usable by canvas (FontFace + document.fonts).
  function loadFont(id) {
    const f = FONTS[id] || FONTS.fraunces;
    if (!loading[f.family]) {
      loading[f.family] = Promise.all(f.files.map(([file, style, weight]) => {
        const face = new FontFace(f.family, "url(/static/wonders/fonts/" + file + ")", { style, weight });
        return face.load().then(ff => { document.fonts.add(ff); return ff; });
      })).catch(e => { delete loading[f.family]; throw e; });
    }
    return loading[f.family];
  }

  // The CSS font string canvas wants.
  function fontString(id, px, opts) {
    const f = FONTS[id] || FONTS.fraunces; opts = opts || {};
    return (opts.italic ? "italic " : "") + Math.round(opts.weight || f.weight) + " " + px.toFixed(1) + 'px "' + f.family + '", Georgia, serif';
  }

  const api = { FONTS, FONT_IDS, loadFont, fontString };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.TH = Object.assign(globalThis.TH || {}, api);
})();
