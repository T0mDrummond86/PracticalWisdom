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
import re
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


def _retry_after(body, default=30):
    """The API's 429 body carries 'Expected available in N seconds' — honour it."""
    m = re.search(r"in\s+(\d+)\s+second", body or "")
    return int(m.group(1)) + 2 if m else default


def submit(prompt, aspect_ratio="4:3", resolution="1K", output_format=None,
           max_retries=8, on_wait=None):
    """Start one image generation. Returns the task id.

    The API throttles hard (roughly one request per half-minute), so a 429 is
    normal rather than exceptional: wait the advertised time and try again.
    A throttled request is rejected before generating, so it costs no credits.
    """
    url = "%s/%s/generate/" % (BASE, MODEL_PATH)
    payload = {
        "prompt": prompt,
        "aspect_ratio": aspect_ratio,
        "resolution": resolution,
        "num_images": 1,
    }
    # Gemini 2.5 Flash rejects output_format outright ("invalid input") and always
    # returns PNG — so only send it when a caller explicitly asks, and convert to
    # WebP locally instead (see to_webp).
    if output_format:
        payload["output_format"] = output_format
    for attempt in range(max_retries):
        try:
            r = requests.post(url, headers=_headers(), timeout=60, json=payload)
        except requests.RequestException as e:
            raise ImageGenError("request failed: %s" % e)
        if r.status_code in (200, 201):
            try:
                return r.json()["task_id"]
            except (ValueError, KeyError) as e:
                raise ImageGenError("unexpected submit response: %s" % e)
        if r.status_code == 429 and attempt < max_retries - 1:
            wait = _retry_after(r.text)
            if on_wait:
                on_wait(wait, attempt + 1)
            time.sleep(wait)
            continue
        raise ImageGenError("API %s: %s" % (r.status_code, r.text[:300]))
    raise ImageGenError("still rate-limited after %d attempts" % max_retries)


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
            if results and results[0].get("asset"):
                return results[0]["asset"]
            # The API can report FINISHED a beat before the asset URL is attached —
            # keep polling rather than treating that instant as a failure.
            time.sleep(POLL_INTERVAL)
            continue
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


def to_webp(png_bytes, max_width=1000, quality=82):
    """PNG from the API -> a right-sized WebP for the web app.

    The API returns PNG (often 1K+), which is far larger than these need to be on a
    card. Converting locally keeps the repo small and avoids an unsupported API param.
    """
    from io import BytesIO
    from PIL import Image

    img = Image.open(BytesIO(png_bytes)).convert("RGB")
    if img.width > max_width:
        img = img.resize((max_width, round(img.height * max_width / img.width)),
                         Image.LANCZOS)
    out = BytesIO()
    img.save(out, format="WEBP", quality=quality, method=6)
    return out.getvalue()


def generate(prompt, webp=True, **kw):
    """submit -> poll -> download, returning image bytes (WebP by default)."""
    blob = download(wait_for(submit(prompt, **kw)))
    return to_webp(blob) if webp else blob
