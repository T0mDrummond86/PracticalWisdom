"""Tip illustrations via the 3D AI Studio image API.

One picture per tip, all in a single consistent style. The style lives in a STYLE
TEMPLATE (a fixed prompt prefix); each tip contributes only a short visual concept,
so 130 images share a look. The API exposes no seed or negative-prompt parameter,
so consistency comes entirely from the wording of that template.

Flow (async, per their docs):
    POST /v1/images/gemini/2.5/flash/generate/  -> {"task_id": ...}
    GET  /v1/generation-request/<task_id>/status/ -> poll until "FINISHED"
    then download results[0]["asset"]

Credits: Gemini 2.5 Flash is the cheap tier (~5 credits/image) — deliberately chosen
over Gemini 3 Pro (50/image) because these render small on a card.

The API key is read from the environment (THREEDAI_API_KEY) and never logged.
"""
import os
import time

import requests

BASE = os.environ.get("THREEDAI_API_BASE", "https://api.3daistudio.com/v1")
# Model path segment; overridable so a different tier can be tried without a code change.
MODEL_PATH = os.environ.get("THREEDAI_IMAGE_MODEL", "images/gemini/2.5/flash")
POLL_INTERVAL = 3      # seconds between status checks
POLL_TIMEOUT = 300     # give up on one image after 5 minutes


class ImageGenError(Exception):
    pass


def api_key():
    return os.environ.get("THREEDAI_API_KEY")


def is_enabled():
    return bool(api_key())


# ── Style templates: the five candidates the user picks from ──────────────────
# Each is a prompt PREFIX. The per-tip concept is appended. Keeping the wording
# rigid is what holds 130 images to one look.
STYLE_TEMPLATES = {
    "render": (
        "A soft-lit stylized 3D render, matte clay materials, gentle rim lighting, "
        "muted warm palette with one deep-navy accent, centred single subject on a "
        "plain uncluttered background, calm and contemplative mood. No text, no words, "
        "no lettering, no people's faces. Subject: "
    ),
    "flat": (
        "A flat minimal editorial vector illustration, bold simple geometric shapes, "
        "limited palette of deep navy, cream and antique gold, generous negative space, "
        "no gradients, confident line work, calm and considered. No text, no words, "
        "no lettering, no people's faces. Subject: "
    ),
    "watercolor": (
        "A soft hand-painted watercolour illustration, visible paper texture, loose wet "
        "edges, muted earthy palette with warm gold accents, plenty of white space, "
        "quiet reflective mood. No text, no words, no lettering, no people's faces. Subject: "
    ),
    "goldline": (
        "A fine antique-gold line drawing on a deep midnight-navy background, elegant "
        "single-weight linework like an engraved plate, small constellation-like dots, "
        "centred symmetrical composition, minimal and timeless. No text, no words, "
        "no lettering, no people's faces. Subject: "
    ),
    "papercraft": (
        "A layered papercraft diorama photographed from straight on, cut-paper shapes "
        "with soft drop shadows, warm cream and sage and muted gold papers, tactile and "
        "handmade, shallow depth, centred subject. No text, no words, no lettering, "
        "no people's faces. Subject: "
    ),
}


def build_prompt(style_key, concept):
    """STYLE TEMPLATE + this tip's one-line visual concept."""
    tpl = STYLE_TEMPLATES.get(style_key)
    if not tpl:
        raise ImageGenError("unknown style: %s" % style_key)
    return tpl + concept.strip()


# ── API calls ────────────────────────────────────────────────────────────────
def _headers():
    key = api_key()
    if not key:
        raise ImageGenError("THREEDAI_API_KEY is not set")
    return {"Authorization": "Bearer " + key, "Content-Type": "application/json"}


def submit(prompt, aspect_ratio="4:3", resolution="1K", output_format="webp"):
    """Start one image generation. Returns the task id."""
    url = "%s/%s/generate/" % (BASE, MODEL_PATH)
    try:
        r = requests.post(url, headers=_headers(), timeout=60, json={
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
            "num_images": 1,
            "output_format": output_format,
        })
    except requests.RequestException as e:
        raise ImageGenError("request failed: %s" % e)
    if r.status_code not in (200, 201):
        raise ImageGenError("API %s: %s" % (r.status_code, r.text[:300]))
    try:
        return r.json()["task_id"]
    except (ValueError, KeyError) as e:
        raise ImageGenError("unexpected submit response: %s" % e)


def wait_for(task_id, timeout=POLL_TIMEOUT):
    """Poll one task to completion. Returns the finished image's URL."""
    url = "%s/generation-request/%s/status/" % (BASE, task_id)
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(url, headers=_headers(), timeout=30)
        except requests.RequestException as e:
            raise ImageGenError("status check failed: %s" % e)
        if r.status_code != 200:
            raise ImageGenError("status API %s: %s" % (r.status_code, r.text[:200]))
        data = r.json()
        status = (data.get("status") or "").upper()
        if status == "FINISHED":
            results = data.get("results") or []
            if not results or not results[0].get("asset"):
                raise ImageGenError("finished but no image returned")
            return results[0]["asset"]
        if status in ("FAILED", "ERROR", "CANCELLED"):
            raise ImageGenError("generation failed: %s" % (data.get("failure_reason") or status))
        time.sleep(POLL_INTERVAL)
    raise ImageGenError("timed out after %ss" % timeout)


def download(asset_url):
    """Fetch the finished image's bytes."""
    try:
        r = requests.get(asset_url, timeout=120)
    except requests.RequestException as e:
        raise ImageGenError("download failed: %s" % e)
    if r.status_code != 200:
        raise ImageGenError("download HTTP %s" % r.status_code)
    return r.content


def generate(prompt, **kw):
    """submit -> poll -> download, returning the image bytes."""
    return download(wait_for(submit(prompt, **kw)))
