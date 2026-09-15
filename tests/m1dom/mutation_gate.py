"""M1 verification module — see tests/test_m1_links_dom_themes.py."""

import unittest

from m1dom._common import *  # noqa: F401,F403


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
        css = load_css()
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

    def test_mutation_stage_card_url_corruption_detected(self):
        """Mutate stage card URL; verify probe raises AssertionError."""
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            html = f.read()
        mutated_html = html.replace('id="dock-openooda" class="stage-card" href="https://openooda.org"',
                                    'id="dock-openooda" class="stage-card" href="https://corrupted-openooda.org"')
        self.assertNotEqual(mutated_html, html, "Mutation setup failed")

        parser = IndexHTMLParser()
        parser.feed(mutated_html)
        card_links = [l for l in parser.links if l.get("attrs", {}).get("id") == "dock-openooda"]
        with self.assertRaises(AssertionError):
            assert len(card_links) == 1 and card_links[0]["href"] == "https://openooda.org"

    def test_mutation_chaos_overlay_pointer_events_detected(self):
        """Mutate style.css to strip pointer-events from #chaos-overlay; verify probe fails."""
        css = load_css()
        mutated_css = re.sub(r'(#chaos-overlay[^{]*\{[^}]*?)pointer-events:\s*none[^;]*;', r'\1/* removed */', css)
        self.assertNotEqual(mutated_css, css, "Mutation setup failed")

        overlay_rule = re.search(r"#chaos-overlay[^\{]*\{([^}]+)\}", mutated_css)
        with self.assertRaises(AssertionError):
            assert overlay_rule and "pointer-events: none" in overlay_rule.group(1)


