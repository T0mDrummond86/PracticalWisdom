/* Where the picture marker lands when you press "Place here" / "Move here".
 *
 * There is no JS test runner in this project, so rather than re-implement the logic
 * here (which would test a copy, not the code) this pulls the real function out of
 * static/app.js and exercises it. Run with:  node tests/test_marker_placement.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "static/app.js"), "utf8");

/** Lift one named function out of app.js by matching its braces. */
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name}() not found in static/app.js`);
  let depth = 0, i = source.indexOf("{", start);
  for (let j = i; j < source.length; j++) {
    if (source[j] === "{") depth++;
    else if (source[j] === "}" && --depth === 0)
      return source.slice(start, j + 1);
  }
  throw new Error(`unbalanced braces in ${name}()`);
}

const PICTURE_MARKER = "[[#]]";
const markerPlacement = new Function(
  "PICTURE_MARKER", extract("markerPlacement") + "; return markerPlacement;")(PICTURE_MARKER);

let failed = 0;
function check(label, raw, caretBefore, expectMarkerBefore) {
  const caret = raw.indexOf(caretBefore);
  if (caret === -1) throw new Error(`fixture has no ${caretBefore}`);
  const { value } = markerPlacement(raw, caret, PICTURE_MARKER);
  const at = value.indexOf(PICTURE_MARKER);
  const after = value.slice(at + PICTURE_MARKER.length).trim();
  const ok = at !== -1 && after.startsWith(expectMarkerBefore)
    && value.split(PICTURE_MARKER).length === 2;   // exactly one marker
  if (!ok) {
    failed++;
    console.log(`FAIL  ${label}`);
    console.log(`      caret sat immediately before ${JSON.stringify(expectMarkerBefore)}`);
    console.log(`      got: ${JSON.stringify(value)}`);
  } else {
    console.log(`ok    ${label}`);
  }
}

// The caret must survive the marker being removed and whitespace being collapsed,
// because both happen between reading selectionStart and using it.
check("clean text",
  "Notice when small things annoy you because that is usually bigger.", "usually", "usually");
check("moving an existing marker forward",
  "Notice [[#]] when small things annoy you because that is usually bigger.",
  "usually", "usually");
check("moving an existing marker backward",
  "Notice when small things annoy you because that is usually [[#]] bigger.",
  "small", "small");
check("a double space before the caret",
  "Notice when  small things annoy you because that is usually bigger.",
  "usually", "usually");
check("a newline before the caret",
  "Notice when small things annoy you.\n\nThat is usually bigger.", "That", "That");
check("caret at the very start", "Notice when small things.", "Notice", "Notice");

// Caret landing inside the existing marker must not split it into fragments.
{
  const raw = "Notice [[#]] when small things.";
  const { value } = markerPlacement(raw, raw.indexOf("[[#]]") + 2, PICTURE_MARKER);
  const clean = !/\[\[(?!#\]\])|(?<!\[\[#)\]\]/.test(value)
    && value.split(PICTURE_MARKER).length === 2;
  console.log(clean ? "ok    caret inside the existing marker"
                    : `FAIL  caret inside the existing marker\n      got: ${JSON.stringify(value)}`);
  if (!clean) failed++;
}

console.log(failed ? `\n${failed} failing` : "\nall passing");
process.exit(failed ? 1 : 0);
