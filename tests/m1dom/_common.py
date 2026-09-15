#!/usr/bin/env python3
"""
Empirical Test Suite: Milestone M1 Link, DOM & Theme Integrity Challenger
Verifies clownhouse.io index.html and style.css:
- External links, protocol integrity, and security attributes (target/rel)
- In-page navigation anchors & DOM ID resolution
- Complete clean slate (zero legacy theme strings/IDs)
- CSS token completeness for all 7 Omarchy themes
- HTML5 / JSON-LD / CSS parsing and structural invariants
- Double-Run Invariance ($Run_1 == Run_2$)
"""

import os
import re
import json
import unittest
from html.parser import HTMLParser
from urllib.parse import urlparse

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
INDEX_HTML_PATH = os.path.join(PROJECT_ROOT, "index.html")
STYLE_CSS_PATH = os.path.join(PROJECT_ROOT, "style.css")
APP_JS_PATH = os.path.join(PROJECT_ROOT, "app.js")
FAVICON_SVG_PATH = os.path.join(PROJECT_ROOT, "favicon.svg")


def load_css() -> str:
    """style.css is an @import manifest over styles/ — resolve it fully."""
    with open(STYLE_CSS_PATH, "r", encoding="utf-8") as f:
        manifest = f.read()
    parts = [manifest]
    for rel in re.findall(r'@import url\("([^"]+)"\)', manifest):
        with open(os.path.join(PROJECT_ROOT, rel), "r", encoding="utf-8") as f:
            parts.append(f.read())
    return "\n".join(parts)


class IndexHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.ids = set()
        self.id_counts = {}
        self.links = []
        self.json_ld_scripts = []
        self._in_json_ld = False
        self._json_ld_buffer = []

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        self.tags.append((tag, attr_dict))

        if "id" in attr_dict:
            el_id = attr_dict["id"]
            self.ids.add(el_id)
            self.id_counts[el_id] = self.id_counts.get(el_id, 0) + 1

        if tag == "a":
            href = attr_dict.get("href")
            target = attr_dict.get("target")
            rel = attr_dict.get("rel")
            self.links.append({
                "href": href,
                "target": target,
                "rel": rel,
                "attrs": attr_dict
            })

        if tag == "script" and attr_dict.get("type") == "application/ld+json":
            self._in_json_ld = True
            self._json_ld_buffer = []

    def handle_endtag(self, tag):
        if tag == "script" and self._in_json_ld:
            self.json_ld_scripts.append("".join(self._json_ld_buffer).strip())
            self._in_json_ld = False
            self._json_ld_buffer = []

    def handle_data(self, data):
        if self._in_json_ld:
            self._json_ld_buffer.append(data)


