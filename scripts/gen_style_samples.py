"""Generate one sample image per style, all from the SAME tip, for side-by-side choice.

Costs credits (5 per image on Gemini 2.5 Flash). Run from the project root:
    python3 scripts/gen_style_samples.py
Writes into style_samples/ and prints a summary. Safe to re-run — it skips styles
whose file already exists, so a partial failure doesn't re-spend on the good ones.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

import imagegen

# The sample tip — a concrete, visualisable idea that suits every style.
SAMPLE_TIP = "Measure it! What gets measured gets managed."
# Its visual concept: a metaphor, never literal text in the picture.
SAMPLE_CONCEPT = (
    "a simple measuring tape curling around a small growing plant in a pot, "
    "the idea of tracking progress and tending something over time"
)

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "style_samples")


def main():
    if not imagegen.is_enabled():
        sys.exit("THREEDAI_API_KEY is not set")
    os.makedirs(OUT, exist_ok=True)
    styles = list(imagegen.STYLE_TEMPLATES)
    todo = [s for s in styles if not os.path.exists(os.path.join(OUT, s + ".webp"))]
    print("styles to generate: %s  (~%d credits)" % (todo, len(todo) * 5))

    # The API throttles to roughly one request per half-minute, so run them one at a
    # time: submit (waiting out any 429), poll, save, move on.
    def note_wait(secs, attempt):
        print("    rate-limited, waiting %ss (attempt %d)" % (secs, attempt), flush=True)

    for s in todo:
        prompt = imagegen.build_prompt(s, SAMPLE_CONCEPT)
        try:
            print("  %-11s submitting…" % s, flush=True)
            task_id = imagegen.submit(prompt, aspect_ratio="4:3", resolution="1K",
                                      on_wait=note_wait)
            blob = imagegen.to_webp(imagegen.download(imagegen.wait_for(task_id)))
            path = os.path.join(OUT, s + ".webp")
            with open(path, "wb") as fh:
                fh.write(blob)
            print("  %-11s saved %6.0f KB" % (s, len(blob) / 1024), flush=True)
        except imagegen.ImageGenError as e:
            print("  %-11s FAILED: %s" % (s, e), flush=True)

    done = sorted(f for f in os.listdir(OUT) if f.endswith(".webp"))
    print("\nsamples on disk: %s" % done)


if __name__ == "__main__":
    main()
