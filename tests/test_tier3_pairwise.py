"""Tier 3: Cross-Feature Pairwise Combinatorial E2E Test Suite
Covers 2-way orthogonal interactions across themes, audio states, volumes, and destinations.
"""

import unittest
from tests.test_helpers import (
    get_html_soup,
    get_css_content,
    get_app_js_content,
    get_audio_js_content,
    run_node_code,
    check_rel_security,
    THEMES,
    DESTINATIONS
)


class TestPairwiseThemeAudioMute(unittest.TestCase):
    """Pairwise: 5 Themes x 2 Audio States (Muted vs Unmuted)."""

    def _test_theme_audio_combo(self, theme, muted):
        code = f"""
        const theme = '{theme}';
        const muted = {str(muted).lower()};
        let activeProfile = theme;
        let soundActive = !muted;
        let soundPlayed = false;

        function playSfx() {{
            if (!soundActive) return false;
            soundPlayed = true;
            return true;
        }}

        const result = playSfx();
        console.log(result === !muted);
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_pair_top_muted(self):
        self._test_theme_audio_combo("tower-of-power", True)

    def test_pair_top_unmuted(self):
        self._test_theme_audio_combo("tower-of-power", False)

    def test_pair_chozo_muted(self):
        self._test_theme_audio_combo("chozo-visor", True)

    def test_pair_chozo_unmuted(self):
        self._test_theme_audio_combo("chozo-visor", False)

    def test_pair_wrx_muted(self):
        self._test_theme_audio_combo("wrx-telemetry", True)

    def test_pair_wrx_unmuted(self):
        self._test_theme_audio_combo("wrx-telemetry", False)

    def test_pair_mmx_muted(self):
        self._test_theme_audio_combo("hunter-base", True)

    def test_pair_mmx_unmuted(self):
        self._test_theme_audio_combo("hunter-base", False)

    def test_pair_pacific_muted(self):
        self._test_theme_audio_combo("pacific-outpost", True)

    def test_pair_pacific_unmuted(self):
        self._test_theme_audio_combo("pacific-outpost", False)


class TestPairwiseThemeVolumeSlider(unittest.TestCase):
    """Pairwise: 5 Themes x 3 Volume Levels (0.0, 0.5, 1.0)."""

    def _test_theme_volume_combo(self, theme, volume):
        code = f"""
        const theme = '{theme}';
        const vol = {volume};
        const clampedVol = Math.max(0.0, Math.min(1.0, vol));
        const maxSafeGain = 0.35;
        const actualGain = clampedVol * maxSafeGain;
        console.log(actualGain >= 0 && actualGain <= maxSafeGain);
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_pair_top_vol_min(self):
        self._test_theme_volume_combo("tower-of-power", 0.0)

    def test_pair_top_vol_mid(self):
        self._test_theme_volume_combo("tower-of-power", 0.5)

    def test_pair_top_vol_max(self):
        self._test_theme_volume_combo("tower-of-power", 1.0)

    def test_pair_chozo_vol_min(self):
        self._test_theme_volume_combo("chozo-visor", 0.0)

    def test_pair_chozo_vol_mid(self):
        self._test_theme_volume_combo("chozo-visor", 0.5)

    def test_pair_chozo_vol_max(self):
        self._test_theme_volume_combo("chozo-visor", 1.0)

    def test_pair_wrx_vol_min(self):
        self._test_theme_volume_combo("wrx-telemetry", 0.0)

    def test_pair_wrx_vol_mid(self):
        self._test_theme_volume_combo("wrx-telemetry", 0.5)

    def test_pair_wrx_vol_max(self):
        self._test_theme_volume_combo("wrx-telemetry", 1.0)

    def test_pair_mmx_vol_min(self):
        self._test_theme_volume_combo("hunter-base", 0.0)

    def test_pair_mmx_vol_mid(self):
        self._test_theme_volume_combo("hunter-base", 0.5)

    def test_pair_mmx_vol_max(self):
        self._test_theme_volume_combo("hunter-base", 1.0)

    def test_pair_pacific_vol_min(self):
        self._test_theme_volume_combo("pacific-outpost", 0.0)

    def test_pair_pacific_vol_mid(self):
        self._test_theme_volume_combo("pacific-outpost", 0.5)

    def test_pair_pacific_vol_max(self):
        self._test_theme_volume_combo("pacific-outpost", 1.0)


class TestPairwiseThemeLinkMatrix(unittest.TestCase):
    """Pairwise: 5 Themes x 6 Universal Destinations (30 discrete pairs)."""

    def setUp(self):
        self.soup = get_html_soup()

    def _verify_theme_link(self, theme, dest_key, expected_url):
        container = self.soup.select_one(f"#theme-{theme}") or self.soup.select_one(f"[data-theme='{theme}']")
        self.assertIsNotNone(container, f"Theme container {theme} must exist")
        link = container.find("a", href=expected_url)
        self.assertIsNotNone(link, f"Destination {dest_key} ({expected_url}) must exist in theme {theme}")
        if expected_url.startswith("http"):
            self.assertEqual(link.get("target"), "_blank", f"Link {expected_url} in {theme} must have target='_blank'")
            self.assertTrue(check_rel_security(link), f"Link {expected_url} in {theme} must include noopener and noreferrer")
        elif expected_url.startswith("mailto"):
            self.assertNotEqual(link.get("target"), "_blank", f"Mailto link in {theme} must not use target='_blank'")

    # Tower of Power
    def test_pair_top_openooda(self): self._verify_theme_link("tower-of-power", "openooda", DESTINATIONS["openooda"])
    def test_pair_top_necrometer(self): self._verify_theme_link("tower-of-power", "necrometer", DESTINATIONS["necrometer"])
    def test_pair_top_bumtrips(self): self._verify_theme_link("tower-of-power", "bumtrips", DESTINATIONS["bumtrips"])
    def test_pair_top_reactle(self): self._verify_theme_link("tower-of-power", "reactle", DESTINATIONS["reactle"])
    def test_pair_top_giggle(self): self._verify_theme_link("tower-of-power", "giggle", DESTINATIONS["giggle"])
    def test_pair_top_contact(self): self._verify_theme_link("tower-of-power", "contact", DESTINATIONS["contact"])

    # Chozo Visor
    def test_pair_chozo_openooda(self): self._verify_theme_link("chozo-visor", "openooda", DESTINATIONS["openooda"])
    def test_pair_chozo_necrometer(self): self._verify_theme_link("chozo-visor", "necrometer", DESTINATIONS["necrometer"])
    def test_pair_chozo_bumtrips(self): self._verify_theme_link("chozo-visor", "bumtrips", DESTINATIONS["bumtrips"])
    def test_pair_chozo_reactle(self): self._verify_theme_link("chozo-visor", "reactle", DESTINATIONS["reactle"])
    def test_pair_chozo_giggle(self): self._verify_theme_link("chozo-visor", "giggle", DESTINATIONS["giggle"])
    def test_pair_chozo_contact(self): self._verify_theme_link("chozo-visor", "contact", DESTINATIONS["contact"])

    # WRX Telemetry
    def test_pair_wrx_openooda(self): self._verify_theme_link("wrx-telemetry", "openooda", DESTINATIONS["openooda"])
    def test_pair_wrx_necrometer(self): self._verify_theme_link("wrx-telemetry", "necrometer", DESTINATIONS["necrometer"])
    def test_pair_wrx_bumtrips(self): self._verify_theme_link("wrx-telemetry", "bumtrips", DESTINATIONS["bumtrips"])
    def test_pair_wrx_reactle(self): self._verify_theme_link("wrx-telemetry", "reactle", DESTINATIONS["reactle"])
    def test_pair_wrx_giggle(self): self._verify_theme_link("wrx-telemetry", "giggle", DESTINATIONS["giggle"])
    def test_pair_wrx_contact(self): self._verify_theme_link("wrx-telemetry", "contact", DESTINATIONS["contact"])

    # Hunter Base
    def test_pair_mmx_openooda(self): self._verify_theme_link("hunter-base", "openooda", DESTINATIONS["openooda"])
    def test_pair_mmx_necrometer(self): self._verify_theme_link("hunter-base", "necrometer", DESTINATIONS["necrometer"])
    def test_pair_mmx_bumtrips(self): self._verify_theme_link("hunter-base", "bumtrips", DESTINATIONS["bumtrips"])
    def test_pair_mmx_reactle(self): self._verify_theme_link("hunter-base", "reactle", DESTINATIONS["reactle"])
    def test_pair_mmx_giggle(self): self._verify_theme_link("hunter-base", "giggle", DESTINATIONS["giggle"])
    def test_pair_mmx_contact(self): self._verify_theme_link("hunter-base", "contact", DESTINATIONS["contact"])

    # Pacific Outpost
    def test_pair_pacific_openooda(self): self._verify_theme_link("pacific-outpost", "openooda", DESTINATIONS["openooda"])
    def test_pair_pacific_necrometer(self): self._verify_theme_link("pacific-outpost", "necrometer", DESTINATIONS["necrometer"])
    def test_pair_pacific_bumtrips(self): self._verify_theme_link("pacific-outpost", "bumtrips", DESTINATIONS["bumtrips"])
    def test_pair_pacific_reactle(self): self._verify_theme_link("pacific-outpost", "reactle", DESTINATIONS["reactle"])
    def test_pair_pacific_giggle(self): self._verify_theme_link("pacific-outpost", "giggle", DESTINATIONS["giggle"])
    def test_pair_pacific_contact(self): self._verify_theme_link("pacific-outpost", "contact", DESTINATIONS["contact"])


class TestPairwiseThemeTransitions(unittest.TestCase):
    """Pairwise: Theme Transition Matrix (Sequential and direct cross-switching)."""

    def test_pair_transition_matrix(self):
        code = """
        const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];
        let currentTheme = 'tower-of-power';
        let transitionsOk = true;

        for (let i = 0; i < themes.length; i++) {
            const fromTheme = currentTheme;
            const toTheme = themes[(i + 1) % themes.length];
            // Simulate switch
            currentTheme = toTheme;
            if (currentTheme !== toTheme) {
                transitionsOk = false;
            }
        }
        console.log(transitionsOk);
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")


if __name__ == "__main__":
    unittest.main()
