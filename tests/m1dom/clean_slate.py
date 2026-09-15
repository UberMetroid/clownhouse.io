"""M1 verification module — see tests/test_m1_links_dom_themes.py."""

import unittest

from m1dom._common import *  # noqa: F401,F403


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
        cls.css_content = load_css()

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


