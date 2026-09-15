"""M1 verification module — see tests/test_m1_links_dom_themes.py."""

import unittest

from m1dom._common import *  # noqa: F401,F403


class TestM1InPageAnchorResolution(unittest.TestCase):
    """Verifies in-page anchors resolve to actual DOM IDs without broken fragments."""

    @classmethod
    def setUpClass(cls):
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            cls.html_content = f.read()
        cls.parser = IndexHTMLParser()
        cls.parser.feed(cls.html_content)

    def test_required_dispatch_anchors_exist_in_dom(self):
        """Assert #projects, #services, #hero, #cluster exist as DOM IDs."""
        required_anchors = ["projects", "services", "hero", "cluster"]
        for anchor in required_anchors:
            self.assertIn(anchor, self.parser.ids, f"Required DOM anchor #{anchor} is missing from index.html")

    def test_all_in_page_href_links_resolve(self):
        """Assert EVERY href='#...' in index.html resolves to an existing DOM ID."""
        fragment_links = [l["href"] for l in self.parser.links if l["href"] and l["href"].startswith("#")]
        self.assertGreaterEqual(len(fragment_links), 3, "Expected in-page navigation anchors")
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
                     "services": "section", "site-footer": "footer"}
        for el_id, expected_tag in landmarks.items():
            found = False
            for tag, attrs in self.parser.tags:
                if attrs.get("id") == el_id:
                    self.assertEqual(tag, expected_tag, f"Element #{el_id} should be <{expected_tag}>, got <{tag}>")
                    found = True
                    break
            self.assertTrue(found, f"Landmark #{el_id} (<{expected_tag}>) not found")


