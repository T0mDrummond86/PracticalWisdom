"""Tip illustrations — one picture per tip, all in a single consistent style.

The style lives in a STYLE TEMPLATE (a fixed prompt prefix); each tip contributes only
a short visual concept, so the whole library shares a look. Neither backend exposes a
seed, so consistency comes entirely from the wording of that template.

TWO BACKENDS, same public interface (generate / is_enabled):

  * Google Gemini (GEMINI_API_KEY) — the default when configured. Synchronous, cheap
    (~$0.04/image) and barely throttled.
  * 3D AI Studio (THREEDAI_API_KEY) — the original. Async submit/poll/download, heavily
    throttled (~1 request per 30s) and far pricier than its docs implied: it billed
    ~30 credits/image, so it is now only the fallback.

Keys are read from the environment and never logged.
"""
import base64
import os
import re
import time

import requests

# ── 3D AI Studio (legacy backend) ──
BASE = os.environ.get("THREEDAI_API_BASE", "https://api.3daistudio.com/v1")
MODEL_PATH = os.environ.get("THREEDAI_IMAGE_MODEL", "images/gemini/2.5/flash")
POLL_INTERVAL = 3      # seconds between status checks
POLL_TIMEOUT = 300     # give up on one image after 5 minutes

# ── Google Gemini (preferred backend) ──
GEMINI_BASE = os.environ.get(
    "GEMINI_API_BASE", "https://generativelanguage.googleapis.com/v1beta")
GEMINI_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")


class ImageGenError(Exception):
    pass


def api_key():
    return os.environ.get("THREEDAI_API_KEY")


def gemini_key():
    return os.environ.get("GEMINI_API_KEY")


def provider():
    """Which backend to use. Gemini wins when configured; explicit override respected."""
    forced = (os.environ.get("IMAGE_PROVIDER") or "").strip().lower()
    if forced in ("gemini", "threedai"):
        return forced
    return "gemini" if gemini_key() else "threedai"


def is_enabled():
    return bool(gemini_key() or api_key())


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


# ── Google Gemini backend ────────────────────────────────────────────────────
def _gemini_generate(prompt, aspect_ratio="4:3", max_retries=5, on_wait=None):
    """One image from Gemini, returned as raw bytes. Synchronous — no polling.

    Images come back inline as base64 in the response, so there is nothing to download
    separately. 429/503 (rate limit / model busy) are retried with a short backoff.
    """
    key = gemini_key()
    if not key:
        raise ImageGenError("GEMINI_API_KEY is not set")
    url = "%s/models/%s:generateContent" % (GEMINI_BASE, GEMINI_MODEL)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": aspect_ratio},
        },
    }
    for attempt in range(max_retries):
        try:
            r = requests.post(url, timeout=180,
                              headers={"x-goog-api-key": key,
                                       "Content-Type": "application/json"},
                              json=payload)
        except requests.RequestException as e:
            raise ImageGenError("request failed: %s" % e)

        if r.status_code in (429, 503) and attempt < max_retries - 1:
            wait = 10 * (attempt + 1)
            if on_wait:
                on_wait(wait, attempt + 1)
            time.sleep(wait)
            continue

        # Older/other models reject imageConfig or responseModalities — drop them and retry
        # once rather than failing the whole batch on a config the model doesn't take.
        if r.status_code == 400 and "generationConfig" in payload:
            body = r.text[:400]
            if "imageConfig" in body or "aspectRatio" in body:
                payload["generationConfig"].pop("imageConfig", None)
                continue
            if "responseModalities" in body:
                payload.pop("generationConfig", None)
                continue

        if r.status_code != 200:
            raise ImageGenError("Gemini API %s: %s" % (r.status_code, r.text[:300]))

        try:
            parts = r.json()["candidates"][0]["content"]["parts"]
        except (ValueError, KeyError, IndexError) as e:
            raise ImageGenError("unexpected Gemini response: %s" % e)
        for p in parts:
            inline = p.get("inlineData") or p.get("inline_data")
            if inline and inline.get("data"):
                return base64.b64decode(inline["data"])
        raise ImageGenError("Gemini returned no image (safety filter or text-only reply)")
    raise ImageGenError("Gemini still unavailable after %d attempts" % max_retries)


def generate(prompt, webp=True, aspect_ratio="4:3", resolution="1K",
             max_retries=8, on_wait=None):
    """Make one image with whichever backend is configured. Returns WebP bytes."""
    if provider() == "gemini":
        blob = _gemini_generate(prompt, aspect_ratio=aspect_ratio, on_wait=on_wait)
    else:
        blob = download(wait_for(submit(prompt, aspect_ratio=aspect_ratio,
                                        resolution=resolution,
                                        max_retries=max_retries, on_wait=on_wait)))
    return to_webp(blob) if webp else blob
