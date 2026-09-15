"""M1 verification module — see tests/test_m1_links_dom_themes.py."""

import unittest

from m1dom._common import *  # noqa: F401,F403


class TestM1StageSelectDockAndChaosOverlay(unittest.TestCase):
    """Verifies Mega Man X stage-select bottom dock, 5 cards, chaos overlay, and zero legacy strings."""

    EXPECTED_STAGE_CARDS = {
        "dock-openooda": "https://openooda.org",
        "dock-bumtrips": "https://bumtrips.com",
        "dock-necrometer": "https://necrometer.dev",
        "dock-giggle": "https://giggle.clownhouse.io",
        "dock-reactle": "https://reactle.clownhouse.io"
    }

    FORBIDDEN_LEGACY_STRINGS = [
        "hunter-base",
        "tower-of-power",
        "chozo-visor",
        "wrx-telemetry",
        "pacific-outpost"
    ]

    @classmethod
    def setUpClass(cls):
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            cls.html_content = f.read()
        cls.css_content = load_css()
        cls.parser = IndexHTMLParser()
        cls.parser.feed(cls.html_content)

    def test_stage_select_dock_presence(self):
        """Assert #stage-select-dock exists as <nav> and contains all 5 stage cards."""
        self.assertIn("stage-select-dock", self.parser.ids, "#stage-select-dock must exist in index.html")
        dock_tags = [attrs for tag, attrs in self.parser.tags if tag == "nav" and attrs.get("id") == "stage-select-dock"]
        self.assertEqual(len(dock_tags), 1, "Must have exactly one <nav id='stage-select-dock'>")
        self.assertTrue(dock_tags[0].get("aria-label"), "#stage-select-dock must define aria-label")

        for card_id in self.EXPECTED_STAGE_CARDS:
            self.assertIn(card_id, self.parser.ids, f"Stage card #{card_id} missing from index.html")

    def test_stage_cards_exact_urls_and_security_attributes(self):
        """Assert all 5 stage cards have exact URLs, target='_blank', and rel='noopener noreferrer'."""
        for card_id, expected_url in self.EXPECTED_STAGE_CARDS.items():
            card_links = [l for l in self.parser.links if l.get("attrs", {}).get("id") == card_id]
            self.assertEqual(len(card_links), 1, f"Expected exactly one link for #{card_id}")
            card = card_links[0]
            self.assertEqual(card["href"], expected_url, f"Card #{card_id} href must be {expected_url}")
            self.assertEqual(card["target"], "_blank", f"Card #{card_id} must have target='_blank'")
            rel = (card["rel"] or "").split()
            self.assertIn("noopener", rel, f"Card #{card_id} missing 'noopener' in rel")
            self.assertIn("noreferrer", rel, f"Card #{card_id} missing 'noreferrer' in rel")
            classes = card.get("attrs", {}).get("class", "").split()
            self.assertIn("stage-card", classes, f"Card #{card_id} missing 'stage-card' CSS class")

    def test_chaos_overlay_and_canvas_dom_invariants(self):
        """Assert #chaos-overlay and #chaos-canvas exist with aria-hidden='true'."""
        self.assertIn("chaos-overlay", self.parser.ids, "#chaos-overlay must exist in index.html")
        self.assertIn("chaos-canvas", self.parser.ids, "#chaos-canvas must exist in index.html")

        overlay_attrs = next((attrs for tag, attrs in self.parser.tags if attrs.get("id") == "chaos-overlay"), None)
        self.assertIsNotNone(overlay_attrs, "#chaos-overlay attributes not found")
        self.assertEqual(overlay_attrs.get("aria-hidden"), "true", "#chaos-overlay must have aria-hidden='true'")

    def test_chaos_overlay_css_pointer_events_none(self):
        """Assert #chaos-overlay and #chaos-canvas specify pointer-events: none in style.css."""
        overlay_rule = re.search(r"#chaos-overlay[^\{]*\{([^}]+)\}", self.css_content)
        self.assertIsNotNone(overlay_rule, "#chaos-overlay CSS selector not found in style.css")
        self.assertIn("pointer-events: none", overlay_rule.group(1), "#chaos-overlay must specify pointer-events: none")

        canvas_rule = re.search(r"#chaos-canvas[^\{]*\{([^}]+)\}", self.css_content)
        self.assertIsNotNone(canvas_rule, "#chaos-canvas CSS selector not found in style.css")
        self.assertIn("pointer-events: none", canvas_rule.group(1), "#chaos-canvas must specify pointer-events: none")

    def test_zero_forbidden_legacy_strings_comprehensive(self):
        """Assert zero occurrences of forbidden legacy strings in index.html and style.css."""
        for forbidden in self.FORBIDDEN_LEGACY_STRINGS:
            self.assertNotIn(
                forbidden,
                self.html_content.lower(),
                f"Forbidden legacy string '{forbidden}' detected in index.html"
            )
            self.assertNotIn(
                forbidden,
                self.css_content.lower(),
                f"Forbidden legacy string '{forbidden}' detected in style.css"
            )


