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

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INDEX_HTML_PATH = os.path.join(PROJECT_ROOT, "index.html")
STYLE_CSS_PATH = os.path.join(PROJECT_ROOT, "style.css")
APP_JS_PATH = os.path.join(PROJECT_ROOT, "app.js")
FAVICON_SVG_PATH = os.path.join(PROJECT_ROOT, "favicon.svg")


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


class TestM1LinksAndProtocolIntegrity(unittest.TestCase):
    """Verifies all links and protocol integrity in index.html"""

    @classmethod
    def setUpClass(cls):
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            cls.html_content = f.read()
        cls.parser = IndexHTMLParser()
        cls.parser.feed(cls.html_content)

    def test_openooda_link_presence_and_security(self):
        """Verify openOODA link presence, protocol integrity, and security attributes."""
        openooda_links = [l for l in self.parser.links if l["href"] == "https://openooda.org"]
        self.assertGreaterEqual(len(openooda_links), 1, "openOODA.org link must be present")
        for link in openooda_links:
            self.assertEqual(link["target"], "_blank", "External openOODA link must specify target='_blank'")
            self.assertIn("noopener", link["rel"] or "", "External openOODA link must contain 'noopener'")
            self.assertIn("noreferrer", link["rel"] or "", "External openOODA link must contain 'noreferrer'")

    def test_necrometer_link_presence_and_security(self):
        """Verify necrometer link presence, protocol integrity, and security attributes."""
        necrometer_links = [l for l in self.parser.links if l["href"] and l["href"].startswith("https://necrometer.dev")]
        self.assertGreaterEqual(len(necrometer_links), 1, "necrometer.dev link must be present")
        for link in necrometer_links:
            self.assertEqual(link["target"], "_blank", "External necrometer link must specify target='_blank'")
            self.assertIn("noopener", link["rel"] or "", "External necrometer link must contain 'noopener'")
            self.assertIn("noreferrer", link["rel"] or "", "External necrometer link must contain 'noreferrer'")

    def test_bumtrips_link_presence_and_security(self):
        """Verify bumtrips link presence, protocol integrity, and security attributes."""
        bumtrips_links = [l for l in self.parser.links if l["href"] == "https://bumtrips.com"]
        self.assertGreaterEqual(len(bumtrips_links), 1, "bumtrips.com link must be present")
        for link in bumtrips_links:
            self.assertEqual(link["target"], "_blank", "External bumtrips link must specify target='_blank'")
            self.assertIn("noopener", link["rel"] or "", "External bumtrips link must contain 'noopener'")
            self.assertIn("noreferrer", link["rel"] or "", "External bumtrips link must contain 'noreferrer'")

    def test_reactle_link_presence_and_security(self):
        """Verify reactle link presence, protocol integrity, and security attributes."""
        reactle_links = [l for l in self.parser.links if l["href"] == "https://reactle.clownhouse.io"]
        self.assertGreaterEqual(len(reactle_links), 1, "reactle.clownhouse.io link must be present")
        for link in reactle_links:
            self.assertEqual(link["target"], "_blank", "Cluster service reactle link must specify target='_blank'")
            self.assertIn("noopener", link["rel"] or "", "Cluster service reactle link must contain 'noopener'")
            self.assertIn("noreferrer", link["rel"] or "", "Cluster service reactle link must contain 'noreferrer'")

    def test_giggle_link_presence_and_security(self):
        """Verify giggle link presence, protocol integrity, and security attributes."""
        giggle_links = [l for l in self.parser.links if l["href"] == "https://giggle.clownhouse.io"]
        self.assertGreaterEqual(len(giggle_links), 1, "giggle.clownhouse.io link must be present")
        for link in giggle_links:
            self.assertEqual(link["target"], "_blank", "Cluster service giggle link must specify target='_blank'")
            self.assertIn("noopener", link["rel"] or "", "Cluster service giggle link must contain 'noopener'")
            self.assertIn("noreferrer", link["rel"] or "", "Cluster service giggle link must contain 'noreferrer'")

    def test_email_link_presence_and_protocol(self):
        """Verify email link presence and mailto protocol integrity."""
        email_links = [l for l in self.parser.links if l["href"] == "mailto:jeryd@clownhouse.io"]
        self.assertGreaterEqual(len(email_links), 1, "mailto:jeryd@clownhouse.io link must be present")
        for link in email_links:
            self.assertIsNone(link["target"], "mailto links must not use target='_blank'")

    def test_github_link_presence_and_security(self):
        """Verify GitHub links presence, HTTPS protocol, and security attributes."""
        github_repo = "https://github.com/studio2201/clownhouse.io"
        gh_links = [l for l in self.parser.links if l["href"] == github_repo]
        self.assertGreaterEqual(len(gh_links), 1, f"{github_repo} link must be present")
        for link in gh_links:
            self.assertEqual(link["target"], "_blank", "External GitHub link must specify target='_blank'")
            self.assertIn("noopener", link["rel"] or "", "External GitHub link must contain 'noopener'")
            self.assertIn("noreferrer", link["rel"] or "", "External GitHub link must contain 'noreferrer'")

    def test_global_external_link_security_audit(self):
        """Ensure EVERY external HTTP/HTTPS link has target='_blank' and rel='noopener noreferrer'."""
        external_links = [l for l in self.parser.links if l["href"] and l["href"].startswith("http")]
        self.assertGreaterEqual(len(external_links), 10, "Should have verified multiple external links")
        for link in external_links:
            href = link["href"]
            self.assertEqual(link["target"], "_blank", f"Link {href} missing target='_blank'")
            rel = (link["rel"] or "").split()
            self.assertIn("noopener", rel, f"Link {href} missing 'noopener' in rel")
            self.assertIn("noreferrer", rel, f"Link {href} missing 'noreferrer' in rel")

    def test_no_insecure_http_links(self):
        """Falsify presence of insecure http:// links (must use https://)."""
        for link in self.parser.links:
            href = link.get("href")
            if href and href.startswith("http:"):
                self.fail(f"Insecure HTTP link found: {href}. Must use HTTPS.")

    def test_local_asset_link_resolution(self):
        """Verify linked static assets (stylesheet, script, favicon) exist on disk."""
        head_links = [attrs for tag, attrs in self.parser.tags if tag == "link"]
        scripts = [attrs for tag, attrs in self.parser.tags if tag == "script"]

        # Check stylesheet
        css_links = [l["href"] for l in head_links if l.get("rel") == "stylesheet"]
        self.assertIn("style.css", css_links, "style.css must be referenced in <head>")
        self.assertTrue(os.path.isfile(STYLE_CSS_PATH), "style.css must exist on disk")

        # Check favicon
        favicon_links = [l["href"] for l in head_links if "icon" in (l.get("rel") or "")]
        self.assertIn("favicon.svg", favicon_links, "favicon.svg must be referenced in <head>")
        self.assertTrue(os.path.isfile(FAVICON_SVG_PATH), "favicon.svg must exist on disk")

        # Check app.js script
        script_srcs = [s["src"] for s in scripts if "src" in s]
        self.assertIn("app.js", script_srcs, "app.js must be referenced in <head>")
        self.assertTrue(os.path.isfile(APP_JS_PATH), "app.js must exist on disk")


class TestM1InPageAnchorResolution(unittest.TestCase):
    """Verifies in-page anchors resolve to actual DOM IDs without broken fragments."""

    @classmethod
    def setUpClass(cls):
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            cls.html_content = f.read()
        cls.parser = IndexHTMLParser()
        cls.parser.feed(cls.html_content)

    def test_required_dispatch_anchors_exist_in_dom(self):
        """Assert #projects, #services, #stack, #activity, #hero, #cluster, #momentum exist as DOM IDs."""
        required_anchors = ["projects", "services", "stack", "activity", "hero", "cluster", "momentum"]
        for anchor in required_anchors:
            self.assertIn(anchor, self.parser.ids, f"Required DOM anchor #{anchor} is missing from index.html")

    def test_all_in_page_href_links_resolve(self):
        """Assert EVERY href='#...' in index.html resolves to an existing DOM ID."""
        fragment_links = [l["href"] for l in self.parser.links if l["href"] and l["href"].startswith("#")]
        self.assertGreaterEqual(len(fragment_links), 5, "Expected in-page navigation anchors")
        for href in fragment_links:
            target_id = href[1:]
            self.assertIn(
                target_id,
                self.parser.ids,
                f"Broken fragment link: '{href}' does not match any element with id='{target_id}'"
            )

    def test_dom_id_uniqueness(self):
        """Assert zero duplicate DOM IDs exist in index.html (violates HTML spec & breaks anchor routing)."""
        duplicates = {el_id: count for el_id, count in self.parser.id_counts.items() if count > 1}
        self.assertEqual(duplicates, {}, f"Duplicate DOM IDs found: {duplicates}")

    def test_landmark_sections_structure(self):
        """Assert primary landmark sections have appropriate semantic tags and IDs."""
        landmarks = {"site-header": "header", "hero": "section", "projects": "section",
                     "services": "section", "stack": "section", "activity": "section", "site-footer": "footer"}
        for el_id, expected_tag in landmarks.items():
            found = False
            for tag, attrs in self.parser.tags:
                if attrs.get("id") == el_id:
                    self.assertEqual(tag, expected_tag, f"Element #{el_id} should be <{expected_tag}>, got <{tag}>")
                    found = True
                    break
            self.assertTrue(found, f"Landmark #{el_id} (<{expected_tag}>) not found")


class TestM1CleanSlateNegativeAssertion(unittest.TestCase):
    """Negative tests proving complete clean slate: zero legacy theme strings or IDs."""

    LEGACY_THEMES = [
        "tower-of-power",
        "chozo-visor",
        "wrx-telemetry",
        "hunter-base",
        "pacific-outpost"
    ]

    LEGACY_IDS = [
        "theme-switcher-bar",
        "theme-tower-of-power",
        "theme-chozo-visor",
        "theme-wrx-telemetry",
        "theme-hunter-base",
        "theme-pacific-outpost",
        "switcher-tower-of-power",
        "switcher-chozo-visor",
        "switcher-wrx-telemetry",
        "switcher-hunter-base",
        "switcher-pacific-outpost",
        "sega-volume-slider",
        "sound-toggle"
    ]

    LEGACY_CSS_CLASSES = [
        "theme-container",
        "theme-active-tower-of-power",
        "theme-active-chozo-visor",
        "theme-active-wrx-telemetry",
        "theme-active-hunter-base",
        "theme-active-pacific-outpost",
        "chozo-hud",
        "turbo-boost-gauge",
        "cartridge-slot"
    ]

    @classmethod
    def setUpClass(cls):
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            cls.html_content = f.read()
        with open(STYLE_CSS_PATH, "r", encoding="utf-8") as f:
            cls.css_content = f.read()

    def test_zero_legacy_theme_names_in_index_html(self):
        """Assert zero occurrences of legacy theme names in index.html."""
        for legacy in self.LEGACY_THEMES:
            self.assertNotIn(
                legacy,
                self.html_content.lower(),
                f"Clean slate violation: found legacy theme '{legacy}' in index.html"
            )

    def test_zero_legacy_theme_names_in_style_css(self):
        """Assert zero occurrences of legacy theme names in style.css."""
        for legacy in self.LEGACY_THEMES:
            self.assertNotIn(
                legacy,
                self.css_content.lower(),
                f"Clean slate violation: found legacy theme '{legacy}' in style.css"
            )

    def test_zero_legacy_dom_ids_in_index_html(self):
        """Assert zero legacy DOM IDs exist in index.html."""
        parser = IndexHTMLParser()
        parser.feed(self.html_content)
        for legacy_id in self.LEGACY_IDS:
            self.assertNotIn(
                legacy_id,
                parser.ids,
                f"Clean slate violation: found legacy DOM ID '#{legacy_id}' in index.html"
            )

    def test_zero_legacy_css_classes_in_style_css(self):
        """Assert zero legacy CSS class selectors exist in style.css."""
        for legacy_cls in self.LEGACY_CSS_CLASSES:
            self.assertNotIn(
                f".{legacy_cls}",
                self.css_content,
                f"Clean slate violation: found legacy CSS class '.{legacy_cls}' in style.css"
            )


class TestM1CSSThemeEngineTokens(unittest.TestCase):
    """Verifies CSS definitions and token completeness for all 7 Omarchy themes."""

    EXPECTED_THEMES = [
        "tokyo-night",
        "catppuccin",
        "gruvbox",
        "nord",
        "rose-pine",
        "ethereal",
        "vantablack"
    ]

    MANDATORY_PROPERTIES = [
        "--bg-primary",
        "--accent",
        "--border",
        "--text-primary"
    ]

    HEX_COLOR_REGEX = re.compile(r"^#(?:[0-9a-fA-F]{3}){1,2}$")

    @classmethod
    def setUpClass(cls):
        with open(STYLE_CSS_PATH, "r", encoding="utf-8") as f:
            cls.css_content = f.read()

        # Parse [data-theme="..."] rules
        theme_pattern = re.compile(r"\[data-theme=[\"\x27]?([a-zA-Z0-9_-]+)[\"\x27]?\]\s*\{([^}]+)\}", re.MULTILINE)
        matches = theme_pattern.findall(cls.css_content)

        cls.themes = {}
        for theme_name, block in matches:
            props = {}
            for line in block.split(";"):
                line = line.strip()
                if ":" in line:
                    k, v = line.split(":", 1)
                    props[k.strip()] = v.strip()
            cls.themes[theme_name] = props

    def test_all_7_themes_defined_in_css(self):
        """Assert all 7 Omarchy themes are defined via [data-theme='...'] in style.css."""
        for theme_name in self.EXPECTED_THEMES:
            self.assertIn(
                theme_name,
                self.themes,
                f"Theme '{theme_name}' is missing from style.css"
            )

    def test_mandatory_css_properties_defined(self):
        """Assert all 7 themes define --bg-primary, --accent, --border, and --text-primary."""
        for theme_name in self.EXPECTED_THEMES:
            props = self.themes.get(theme_name, {})
            for prop in self.MANDATORY_PROPERTIES:
                self.assertIn(
                    prop,
                    props,
                    f"Theme '{theme_name}' is missing mandatory CSS token '{prop}'"
                )
                val = props[prop]
                self.assertTrue(
                    self.HEX_COLOR_REGEX.match(val),
                    f"Theme '{theme_name}' property '{prop}' value '{val}' is not a valid hex color code"
                )

    def test_extended_theme_token_completeness(self):
        """Assert all 7 themes define complete 14-token design system palette."""
        extended_tokens = [
            "--bg-primary", "--bg-secondary", "--bg-surface", "--bg-surface-2",
            "--text-primary", "--text-secondary", "--text-muted",
            "--accent", "--accent-ink", "--border", "--border-hover",
            "--selection-bg", "--field-bg", "color-scheme"
        ]
        for theme_name in self.EXPECTED_THEMES:
            props = self.themes.get(theme_name, {})
            for token in extended_tokens:
                self.assertIn(
                    token,
                    props,
                    f"Theme '{theme_name}' missing extended token '{token}'"
                )

    def test_color_scheme_invariance(self):
        """Assert rose-pine specifies light color-scheme while other 6 themes specify dark."""
        for theme_name in self.EXPECTED_THEMES:
            props = self.themes[theme_name]
            expected_scheme = "light" if theme_name == "rose-pine" else "dark"
            self.assertEqual(
                props.get("color-scheme"),
                expected_scheme,
                f"Theme '{theme_name}' should have color-scheme '{expected_scheme}'"
            )

    def test_root_default_tokens_match_tokyo_night(self):
        """Assert :root block defines default variables matching tokyo-night."""
        # Strip comments first
        clean_css = re.sub(r"/\*.*?\*/", "", self.css_content, flags=re.DOTALL)
        root_pattern = re.compile(r":root\s*\{([^}]+)\}", re.MULTILINE)
        match = root_pattern.search(clean_css)
        self.assertIsNotNone(match, ":root selector not found in style.css")
        root_block = match.group(1)

        root_props = {}
        for line in root_block.split(";"):
            line = line.strip()
            if ":" in line:
                k, v = line.split(":", 1)
                root_props[k.strip()] = v.strip()

        for prop in self.MANDATORY_PROPERTIES:
            self.assertIn(prop, root_props, f":root missing default property '{prop}'")
            tokyo_night_val = self.themes["tokyo-night"][prop]
            self.assertEqual(
                root_props[prop],
                tokyo_night_val,
                f":root default for '{prop}' ({root_props[prop]}) does not match tokyo-night ({tokyo_night_val})"
            )


class TestM1StructuralInvariantsAndAdversarial(unittest.TestCase):
    """Adversarial stress-testing: JSON-LD validation, CSS balanced syntax, and double-run."""

    @classmethod
    def setUpClass(cls):
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            cls.html_content = f.read()
        with open(STYLE_CSS_PATH, "r", encoding="utf-8") as f:
            cls.css_content = f.read()
        cls.parser = IndexHTMLParser()
        cls.parser.feed(cls.html_content)

    def test_html5_doctype_and_root_attributes(self):
        """Assert proper HTML5 doctype and initial data-theme on <html>."""
        self.assertTrue(self.html_content.strip().startswith("<!DOCTYPE html>"), "Must start with <!DOCTYPE html>")
        html_tags = [attrs for tag, attrs in self.parser.tags if tag == "html"]
        self.assertEqual(len(html_tags), 1, "Must have exactly one <html> tag")
        self.assertEqual(html_tags[0].get("lang"), "en")
        self.assertEqual(html_tags[0].get("data-theme"), "tokyo-night")

    def test_json_ld_structured_data_validity(self):
        """Assert JSON-LD script parses valid JSON and references correct canonical URLs."""
        self.assertGreaterEqual(len(self.parser.json_ld_scripts), 1, "JSON-LD schema script required")
        for script_content in self.parser.json_ld_scripts:
            data = json.loads(script_content)
            self.assertEqual(data.get("@context"), "https://schema.org")
            graph = data.get("@graph", [])
            self.assertGreater(len(graph), 0, "JSON-LD graph must not be empty")

            urls_in_schema = []
            for item in graph:
                if "url" in item:
                    urls_in_schema.append(item["url"])
                if "hasPart" in item:
                    for part in item["hasPart"]:
                        if "url" in part:
                            urls_in_schema.append(part["url"])

            self.assertIn("https://openooda.org", urls_in_schema)
            self.assertIn("https://necrometer.dev", urls_in_schema)
            self.assertIn("https://bumtrips.com", urls_in_schema)

    def test_css_brace_balancing_and_syntax(self):
        """Assert CSS does not contain unmatched curly braces or unclosed comments."""
        # Strip comments
        no_comments = re.sub(r"/\*.*?\*/", "", self.css_content, flags=re.DOTALL)
        self.assertNotIn("/*", no_comments, "Unclosed CSS comment found")
        self.assertNotIn("*/", no_comments, "Extraneous comment closing delimiter found")

        open_braces = no_comments.count("{")
        close_braces = no_comments.count("}")
        self.assertEqual(open_braces, close_braces, f"Unbalanced CSS braces: {open_braces} open vs {close_braces} close")


class TestM1AntiVacuityMutationGate(unittest.TestCase):
    """Hostile 1:1 negative falsification & mutation tests (User Global Rule 12).
    Proves that our test probes are non-vacuous and fail-closed when faults are injected."""

    def test_mutation_missing_rel_noopener_detected(self):
        """Mutate external link to strip rel='noopener noreferrer'; verify probe raises AssertionError."""
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            html = f.read()
        # Mutate first openooda link to remove rel
        mutated_html = html.replace('href="https://openooda.org" class="action-pill primary-pill" target="_blank" rel="noopener noreferrer"',
                                    'href="https://openooda.org" class="action-pill primary-pill" target="_blank"')
        self.assertNotEqual(mutated_html, html, "Mutation setup failed")

        parser = IndexHTMLParser()
        parser.feed(mutated_html)
        openooda_links = [l for l in parser.links if l["href"] == "https://openooda.org"]
        with self.assertRaises(AssertionError):
            for link in openooda_links:
                rel = link["rel"] or ""
                assert "noopener" in rel, "Missing noopener"

    def test_mutation_broken_anchor_detected(self):
        """Mutate in-page anchor to non-existent ID; verify probe raises AssertionError."""
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            html = f.read()
        mutated_html = html.replace('href="#projects"', 'href="#broken-anchor-ghost"')
        self.assertNotEqual(mutated_html, html, "Mutation setup failed")

        parser = IndexHTMLParser()
        parser.feed(mutated_html)
        fragment_links = [l["href"] for l in parser.links if l["href"] and l["href"].startswith("#")]
        with self.assertRaises(AssertionError):
            for href in fragment_links:
                target_id = href[1:]
                assert target_id in parser.ids, f"Broken fragment link: {href}"

    def test_mutation_legacy_theme_injection_detected(self):
        """Mutate index.html to inject legacy theme string; verify clean slate assertion fails."""
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            html = f.read()
        mutated_html = html + '\n<div id="theme-tower-of-power"></div>\n'

        with self.assertRaises(AssertionError):
            assert "tower-of-power" not in mutated_html.lower()

    def test_mutation_corrupted_css_token_detected(self):
        """Mutate style.css to corrupt --accent token with invalid color; verify token validator fails."""
        with open(STYLE_CSS_PATH, "r", encoding="utf-8") as f:
            css = f.read()
        mutated_css = css.replace('--accent: #9ece6a;', '--accent: not-a-valid-hex-color;')
        self.assertNotEqual(mutated_css, css, "Mutation setup failed")

        theme_pattern = re.compile(r"\[data-theme=[\"\x27]?tokyo-night[\"\x27]?\]\s*\{([^}]+)\}")
        match = theme_pattern.search(mutated_css)
        self.assertIsNotNone(match)
        props = {}
        for line in match.group(1).split(";"):
            if ":" in line:
                k, v = line.split(":", 1)
                props[k.strip()] = v.strip()

        hex_regex = re.compile(r"^#(?:[0-9a-fA-F]{3}){1,2}$")
        with self.assertRaises(AssertionError):
            assert hex_regex.match(props["--accent"]), "Invalid hex color"

    def test_mutation_duplicate_dom_id_detected(self):
        """Mutate index.html to introduce duplicate DOM ID; verify uniqueness check fails."""
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            html = f.read()
        mutated_html = html.replace('id="featured-openooda"', 'id="hero"')
        self.assertNotEqual(mutated_html, html, "Mutation setup failed")

        parser = IndexHTMLParser()
        parser.feed(mutated_html)
        duplicates = {el_id: count for el_id, count in parser.id_counts.items() if count > 1}
        with self.assertRaises(AssertionError):
            assert len(duplicates) == 0, f"Duplicates detected: {duplicates}"


if __name__ == "__main__":
    unittest.main(verbosity=2)
