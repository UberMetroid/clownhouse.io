"""M1 verification module — see tests/test_m1_links_dom_themes.py."""

import unittest

from m1dom._common import *  # noqa: F401,F403


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


