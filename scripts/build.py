#!/usr/bin/env python3
"""build.py — assemble generated artifacts from split sources.

Sources of truth (256-line cap):
  index.src.html   — page skeleton; pulls section partials via
                     <!-- INCLUDE: sections/hero.html -->
  sections/*.html  — page section partials
  app/*.js         — ordered fragments of the application IIFE;
                     concatenated verbatim into app.js

Generated artifacts (never edit directly):
  index.html
  app.js

style.css is an @import manifest over styles/ — no build step needed.

Usage: python3 scripts/build.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_SRC = ROOT / "index.src.html"
HTML_OUT = ROOT / "index.html"
APP_DIR = ROOT / "app"
APP_OUT = ROOT / "app.js"

INCLUDE_PAT = re.compile(r"^[ \t]*<!--\s*INCLUDE:\s*(\S+)\s*-->[ \t]*\n?", re.M)


def build_html() -> None:
    src = HTML_SRC.read_text(encoding="utf-8")

    def sub(m: re.Match) -> str:
        return (ROOT / m.group(1)).read_text(encoding="utf-8")

    out = INCLUDE_PAT.sub(sub, src)
    HTML_OUT.write_text(out, encoding="utf-8")
    n_includes = len(INCLUDE_PAT.findall(src))
    print(f"index.html: {n_includes} includes resolved, {len(out)} bytes")


def build_app() -> None:
    parts = sorted(APP_DIR.glob("*.js"))
    if not parts:
        print("error: no fragments in app/", file=sys.stderr)
        sys.exit(1)
    out = "".join(p.read_text(encoding="utf-8") for p in parts)
    APP_OUT.write_text(out, encoding="utf-8")
    print(f"app.js: {len(parts)} fragments concatenated, {len(out)} bytes")


def main() -> int:
    build_html()
    build_app()
    return 0


if __name__ == "__main__":
    sys.exit(main())
