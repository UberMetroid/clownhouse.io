"""M1 verification module — see tests/test_m1_links_dom_themes.py."""

import unittest

from m1dom._common import *  # noqa: F401,F403


class TestM1StructuralInvariantsAndAdversarial(unittest.TestCase):
    """Adversarial stress-testing: JSON-LD validation, CSS balanced syntax, and double-run."""

    @classmethod
    def setUpClass(cls):
        with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
            cls.html_content = f.read()
        cls.css_content = load_css()
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


