"""Shared test utilities and constants for the clownhouse.io E2E test suite.
"""

import os
import subprocess
from bs4 import BeautifulSoup

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
HTML_PATH = os.path.join(PROJECT_ROOT, "index.html")
CSS_PATH = os.path.join(PROJECT_ROOT, "style.css")
APP_JS_PATH = os.path.join(PROJECT_ROOT, "app.js")
AUDIO_JS_PATH = os.path.join(PROJECT_ROOT, "audio.js")
FAVICON_PATH = os.path.join(PROJECT_ROOT, "favicon.svg")
CNAME_PATH = os.path.join(PROJECT_ROOT, "CNAME")
NOJEKYLL_PATH = os.path.join(PROJECT_ROOT, ".nojekyll")

THEMES = [
    "tower-of-power",
    "chozo-visor",
    "wrx-telemetry",
    "hunter-base",
    "pacific-outpost"
]

DESTINATIONS = {
    "openooda": "https://openooda.org",
    "necrometer": "https://necrometer.dev",
    "bumtrips": "https://bumtrips.com",
    "reactle": "https://reactle.clownhouse.io",
    "giggle": "https://giggle.clownhouse.io",
    "contact": "mailto:jeryd@clownhouse.io"
}

def get_html_content():
    if not os.path.exists(HTML_PATH):
        return ""
    with open(HTML_PATH, "r", encoding="utf-8") as f:
        return f.read()

def get_html_soup():
    content = get_html_content()
    return BeautifulSoup(content, "html.parser")

def get_css_content():
    if not os.path.exists(CSS_PATH):
        return ""
    with open(CSS_PATH, "r", encoding="utf-8") as f:
        return f.read()

def get_app_js_content():
    if not os.path.exists(APP_JS_PATH):
        return ""
    with open(APP_JS_PATH, "r", encoding="utf-8") as f:
        return f.read()

def get_audio_js_content():
    if not os.path.exists(AUDIO_JS_PATH):
        return ""
    with open(AUDIO_JS_PATH, "r", encoding="utf-8") as f:
        return f.read()

def run_node_code(code, timeout=5):
    """Executes a snippet of Node.js code and returns (returncode, stdout, stderr)."""
    try:
        proc = subprocess.run(
            ["node", "-e", code],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Execution timed out"
    except Exception as e:
        return -1, "", str(e)

def check_rel_security(link):
    """Verifies that an anchor tag has both noopener and noreferrer."""
    if not link:
        return False
    rel = link.get("rel")
    if isinstance(rel, list):
        return "noopener" in rel and "noreferrer" in rel
    elif isinstance(rel, str):
        return "noopener" in rel and "noreferrer" in rel
    return False
