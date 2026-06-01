"""
Bulk-import tips from a text or JSON file into the database.

TEXT format (.txt) — one tip per line, tags inline with #:
    Drink water first thing in the morning. #health #morning
    Write down three priorities before starting work. #productivity

JSON format (.json) — a list of objects:
    [
      { "content": "Drink water first thing.", "tags": ["health", "morning"] },
      { "content": "Write down three priorities.", "tags": ["productivity"] }
    ]

Usage:
    python import_tips.py tips.txt
    python import_tips.py tips.json
"""

import json
import sqlite3
import sys
import os

DB = os.path.join(os.path.dirname(__file__), "tips.db")


def get_or_create_tag(conn, name, tier=None):
    name = name.strip().lower()
    row = conn.execute("SELECT id FROM tags WHERE name = ?", (name,)).fetchone()
    if row:
        if tier in ("primary", "secondary"):
            conn.execute("UPDATE tags SET tier = ? WHERE id = ?", (tier, row[0]))
        return row[0]
    return conn.execute(
        "INSERT INTO tags (name, tier) VALUES (?, ?)", (name, tier or "primary")
    ).lastrowid


def insert_tip(conn, content, tags):
    cur = conn.execute("INSERT INTO tips (content) VALUES (?)", (content,))
    tip_id = cur.lastrowid
    # First tag of a tip is primary; the rest are secondary.
    for i, tag in enumerate(tags):
        tag_id = get_or_create_tag(conn, tag, tier="primary" if i == 0 else "secondary")
        conn.execute(
            "INSERT OR IGNORE INTO tip_tags (tip_id, tag_id) VALUES (?, ?)", (tip_id, tag_id)
        )
    return tip_id


def parse_text(text):
    """Parse a stream of words into tips.

    Content words build up a tip; #tags attach to it. The first content word
    seen *after* a tag begins the next tip. Newlines are treated as spaces.
    """
    tips = []
    content_words = []
    tags = []
    for word in text.split():
        if word.startswith("#"):
            if len(word) > 1:
                tags.append(word[1:].lower())
        else:
            if tags:  # a content word after tags starts a new tip
                tips.append({"content": " ".join(content_words).strip(), "tags": tags})
                content_words, tags = [], []
            content_words.append(word)
    if content_words or tags:
        tips.append({"content": " ".join(content_words).strip(), "tags": tags})
    return [t for t in tips if t["content"]]


def import_file(path):
    with open(path) as f:
        raw = f.read()

    if path.endswith(".json"):
        items = json.loads(raw)
        if not isinstance(items, list):
            print("Error: JSON file must contain a list of tip objects.")
            sys.exit(1)
        tips = [{"content": (i.get("content") or "").strip(), "tags": i.get("tags", [])} for i in items]
    else:
        tips = parse_text(raw)

    conn = sqlite3.connect(DB)
    conn.execute("PRAGMA foreign_keys = ON")
    added = skipped = 0

    with conn:
        for tip in tips:
            if not tip["content"]:
                skipped += 1
                continue
            insert_tip(conn, tip["content"], tip["tags"])
            added += 1

    print(f"Imported {added} tip(s) from {path}" + (f", skipped {skipped}" if skipped else ""))
    conn.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    import_file(sys.argv[1])
