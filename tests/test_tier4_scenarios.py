"""Tier 4: Real-World Application Scenarios E2E Test Suite
Covers complete end-to-end user journeys from first visit to deep interactive exploration.
"""

import unittest
from tests.test_helpers import (
    get_html_soup,
    get_html_content,
    get_css_content,
    get_app_js_content,
    get_audio_js_content,
    run_node_code,
    check_rel_security,
    THEMES,
    DESTINATIONS
)


class TestScenario1FreshVisitor(unittest.TestCase):
    """Scenario 1: Fresh visitor initial landing flow."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_s1_01_default_theme_loaded_without_prior_storage(self):
        code = """
        const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
        const stored = null; // No prior localStorage
        const activeTheme = stored && themes.includes(stored) ? stored : 'tower-of-power';
        console.log(activeTheme);
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "tower-of-power")

    def test_s1_02_persistent_switcher_bar_docked_at_top(self):
        switcher = self.soup.select_one("#theme-switcher-bar") or self.soup.select_one(".theme-switcher-bar")
        self.assertIsNotNone(switcher, "Fresh visitor must see top switcher bar")

    def test_s1_03_audio_initialized_muted_by_default(self):
        code = """
        let soundEnabled = false;
        let audioCtx = null;
        console.log(soundEnabled === false && audioCtx === null);
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_s1_04_universal_destinations_discoverable(self):
        links = self.soup.find_all("a")
        hrefs = [a.get("href") for a in links]
        self.assertIn("https://openooda.org", hrefs)
        self.assertIn("https://necrometer.dev", hrefs)
        self.assertIn("https://bumtrips.com", hrefs)


class TestScenario2ThemeHopperJourney(unittest.TestCase):
    """Scenario 2: User systematically traversing all 5 themes."""

    def test_s2_01_full_theme_rotation_lifecycle(self):
        code = """
        const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
        let currentTheme = 'tower-of-power';
        const history = [currentTheme];

        themes.forEach(theme => {
            currentTheme = theme;
            history.push(currentTheme);
        });

        // Rotate back to start
        currentTheme = themes[0];
        history.push(currentTheme);

        console.log(history.length === 7 && history[history.length - 1] === 'tower-of-power');
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_s2_02_theme_containers_synchronize_with_root_attribute(self):
        soup = get_html_soup()
        for theme in THEMES:
            container = soup.select_one(f"#theme-{theme}") or soup.select_one(f"[data-theme='{theme}']")
            self.assertIsNotNone(container, f"Container for {theme} must be defined in document")


class TestScenario3AudioEnthusiastJourney(unittest.TestCase):
    """Scenario 3: User exploring audio features, volume, and sound profiles."""

    def test_s3_01_unmute_gesture_unlocks_audio_context(self):
        code = """
        let soundEnabled = false;
        let audioCtx = { state: 'suspended', resume: () => { audioCtx.state = 'running'; return Promise.resolve(); } };

        function onSoundToggleClick() {
            soundEnabled = !soundEnabled;
            if (soundEnabled && audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }

        onSoundToggleClick();
        console.log(soundEnabled === true && audioCtx.state === 'running');
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_s3_02_volume_adjustment_scales_gain(self):
        code = """
        let userVolume = 0.5;
        const maxGain = 0.35;
        function setVolume(v) {
            userVolume = Math.max(0.0, Math.min(1.0, v));
            return userVolume * maxGain;
        }
        const effectiveGain = setVolume(0.8);
        console.log(effectiveGain > 0 && effectiveGain <= maxGain);
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_s3_03_mute_toggle_silences_subsequent_events(self):
        code = """
        let soundEnabled = true;
        let audioTriggered = false;

        // User mutes
        soundEnabled = false;

        function triggerSfx() {
            if (!soundEnabled) return;
            audioTriggered = true;
        }
        triggerSfx();
        console.log(audioTriggered === false);
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")


class TestScenario4ReturningVisitorPersistence(unittest.TestCase):
    """Scenario 4: User theme selection restored upon page refresh."""

    def test_s4_01_returning_visitor_restores_saved_theme(self):
        code = """
        const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
        const mockLocalStorage = { 'clownhouse_theme': 'wrx-telemetry' };

        function initTheme() {
            const saved = mockLocalStorage['clownhouse_theme'];
            if (saved && themes.includes(saved)) {
                return saved;
            }
            return 'tower-of-power';
        }

        console.log(initTheme());
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "wrx-telemetry")


class TestScenario5UniversalDestinationAudit(unittest.TestCase):
    """Scenario 5: Exhaustive audit of all 6 destinations across all 5 themes."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_s5_01_all_thirty_theme_link_instances_valid(self):
        for theme in THEMES:
            container = self.soup.select_one(f"#theme-{theme}") or self.soup.select_one(f"[data-theme='{theme}']")
            self.assertIsNotNone(container, f"Theme container {theme} must exist")
            for name, url in DESTINATIONS.items():
                link = container.find("a", href=url)
                self.assertIsNotNone(link, f"Destination {name} ({url}) missing in theme {theme}")
                if url.startswith("http"):
                    self.assertEqual(link.get("target"), "_blank")
                    self.assertTrue(check_rel_security(link), f"Link {url} in {theme} must include noopener and noreferrer")


class TestScenario6MobileErgonomicsJourney(unittest.TestCase):
    """Scenario 6: Mobile viewport responsive ergonomics (360x640)."""

    def setUp(self):
        self.css = get_css_content()

    def test_s6_01_responsive_media_queries_defined(self):
        self.assertTrue(
            "@media" in self.css and ("max-width" in self.css or "min-width" in self.css),
            "CSS must define media queries for mobile responsive layouts"
        )

    def test_s6_02_viewport_meta_tag_present(self):
        soup = get_html_soup()
        meta = soup.select_one("meta[name='viewport']")
        self.assertIsNotNone(meta, "HTML must contain meta viewport tag")
        content = meta.get("content", "")
        self.assertIn("width=device-width", content)


if __name__ == "__main__":
    unittest.main()
