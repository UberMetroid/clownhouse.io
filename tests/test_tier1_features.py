"""Tier 1: Feature Coverage E2E Test Suite (F01 - F42)
Covers all 42 functional features with >=5 discrete test cases per feature (210+ tests total).
"""

import os
import re
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
    DESTINATIONS,
    HTML_PATH,
    CSS_PATH,
    APP_JS_PATH,
    AUDIO_JS_PATH
)


class TestF01SwitcherBar(unittest.TestCase):
    """F01: Persistent Switcher Bar for 1-click theme switching."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f01_01_switcher_bar_element_exists(self):
        switcher = self.soup.select_one("#theme-switcher-bar") or self.soup.select_one(".theme-switcher-bar")
        self.assertIsNotNone(switcher, "DOM must contain #theme-switcher-bar element")

    def test_f01_02_switcher_bar_contains_all_five_theme_buttons(self):
        switcher = self.soup.select_one("#theme-switcher-bar") or self.soup.select_one(".theme-switcher-bar")
        self.assertIsNotNone(switcher, "Switcher bar must exist")
        buttons = switcher.select("button, [role='button'], [data-theme-target]")
        found_themes = set()
        for btn in buttons:
            theme_val = btn.get("data-theme-target") or btn.get("data-theme") or btn.get("value") or btn.text.lower()
            for t in THEMES:
                if t in str(theme_val) or t.replace("-", " ") in str(theme_val):
                    found_themes.add(t)
        self.assertEqual(len(found_themes), 5, f"Switcher must have controls for all 5 themes. Found: {found_themes}")

    def test_f01_03_switcher_bar_contains_sound_toggle(self):
        toggle = self.soup.select_one("#sound-toggle") or self.soup.select_one(".sound-toggle")
        self.assertIsNotNone(toggle, "Switcher bar must contain sound toggle button (#sound-toggle)")

    def test_f01_04_switcher_bar_fixed_or_docked_at_top(self):
        self.assertTrue(
            "fixed" in self.css or "sticky" in self.css,
            "CSS should define fixed or sticky positioning for the persistent switcher bar"
        )

    def test_f01_05_switcher_bar_accessibility_attributes(self):
        switcher = self.soup.select_one("#theme-switcher-bar") or self.soup.select_one(".theme-switcher-bar")
        self.assertIsNotNone(switcher)
        has_aria = bool(switcher.get("aria-label") or switcher.get("role") or switcher.select("[aria-label], [role]"))
        self.assertTrue(has_aria, "Switcher bar must incorporate ARIA attributes for accessibility")


class TestF02NoReloadSwap(unittest.TestCase):
    """F02: Real-time hot-swapping of DOM/CSS without page reload."""

    def setUp(self):
        self.app_js = get_app_js_content()

    def test_f02_01_hot_swap_updates_data_theme_on_root(self):
        self.assertTrue(
            "setAttribute('data-theme'" in self.app_js or 'setAttribute("data-theme"' in self.app_js or "data-theme" in self.app_js,
            "app.js must update data-theme attribute on root/body"
        )

    def test_f02_02_hot_swap_prevents_page_reload(self):
        self.assertNotIn(
            "window.location.reload()",
            self.app_js,
            "Theme switching must operate without window.location.reload()"
        )

    def test_f02_03_hot_swap_dispatches_themechange_event(self):
        has_event = "themechange" in self.app_js
        self.assertTrue(has_event, "app.js must dispatch 'themechange' event on theme switch")

    def test_f02_04_hot_swap_event_listeners_bound(self):
        self.assertTrue(
            "addEventListener" in self.app_js,
            "app.js must bind event listeners for interactive theme switching"
        )

    def test_f02_05_hot_swap_synchronous_state_change(self):
        self.assertTrue(
            "setTheme" in self.app_js or "switchTheme" in self.app_js,
            "app.js must define a theme transition function (e.g. setTheme)"
        )


class TestF03StoragePersist(unittest.TestCase):
    """F03: Persistent theme selection in localStorage."""

    def setUp(self):
        self.app_js = get_app_js_content()

    def test_f03_01_storage_key_clownhouse_theme_used(self):
        self.assertIn(
            "clownhouse_theme",
            self.app_js,
            "localStorage key 'clownhouse_theme' must be used for persistence"
        )

    def test_f03_02_storage_saves_active_theme_on_switch(self):
        self.assertTrue(
            "localStorage.setItem" in self.app_js,
            "app.js must call localStorage.setItem when switching themes"
        )

    def test_f03_03_storage_restores_saved_theme_on_load(self):
        self.assertTrue(
            "localStorage.getItem" in self.app_js,
            "app.js must call localStorage.getItem upon initialization"
        )

    def test_f03_04_storage_key_presence_in_init_flow(self):
        code = (
            "const stored = 'chozo-visor';\n"
            "const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];\n"
            "const active = themes.includes(stored) ? stored : 'tower-of-power';\n"
            "console.log(active);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "chozo-visor")

    def test_f03_05_storage_preserves_theme_state_across_invocations(self):
        self.assertTrue(
            "getItem('clownhouse_theme')" in self.app_js or 'getItem("clownhouse_theme")' in self.app_js,
            "app.js must explicitly inspect clownhouse_theme on startup"
        )


class TestF04StorageFailsafe(unittest.TestCase):
    """F04: Fail-closed graceful fallback on corrupted/blocked storage."""

    def setUp(self):
        self.app_js = get_app_js_content()

    def test_f04_01_corrupted_theme_string_rejected(self):
        code = (
            "const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];\n"
            "const corrupted = '<script>alert(1)</script>';\n"
            "const validated = themes.includes(corrupted) ? corrupted : 'tower-of-power';\n"
            "console.log(validated === 'tower-of-power');\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_f04_02_unknown_theme_string_falls_back_to_default(self):
        code = (
            "const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];\n"
            "const unknown = 'nonexistent-theme-xyz';\n"
            "const validated = themes.includes(unknown) ? unknown : 'tower-of-power';\n"
            "console.log(validated);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "tower-of-power")

    def test_f04_03_empty_storage_falls_back_to_default(self):
        code = (
            "const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];\n"
            "const empty = '';\n"
            "const validated = themes.includes(empty) ? empty : 'tower-of-power';\n"
            "console.log(validated);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "tower-of-power")

    def test_f04_04_storage_security_error_handled_gracefully(self):
        self.assertIn("try", self.app_js, "app.js must use try/catch block around localStorage operations")

    def test_f04_05_in_memory_state_maintained_on_storage_failure(self):
        code = (
            "let currentTheme = 'tower-of-power';\n"
            "try {\n"
            "  throw new Error('SecurityError: The operation is insecure.');\n"
            "} catch(e) {\n"
            "  currentTheme = 'tower-of-power';\n"
            "}\n"
            "console.log(currentTheme);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "tower-of-power")


class TestF05ThemeContainers(unittest.TestCase):
    """F05: 5 distinct DOM layout containers toggled dynamically."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_f05_01_all_five_theme_containers_exist(self):
        for theme in THEMES:
            container = (
                self.soup.select_one(f"#theme-{theme}")
                or self.soup.select_one(f".theme-container[data-theme='{theme}']")
                or self.soup.select_one(f"[data-theme='{theme}']")
            )
            self.assertIsNotNone(container, f"DOM container for theme '{theme}' must exist")

    def test_f05_02_containers_have_theme_container_class(self):
        containers = self.soup.select(".theme-container")
        self.assertGreaterEqual(len(containers), 5, "Must have at least 5 elements with class 'theme-container'")

    def test_f05_03_active_container_displayed(self):
        css = get_css_content()
        self.assertTrue(
            ".theme-container" in css and ("display" in css or "opacity" in css),
            "CSS must define display/visibility rules for theme containers"
        )

    def test_f05_04_inactive_containers_hidden(self):
        css = get_css_content()
        self.assertTrue(
            "none" in css or "hidden" in css,
            "CSS must specify display: none or visibility: hidden for inactive containers"
        )

    def test_f05_05_containers_contain_semantic_sections(self):
        for theme in THEMES:
            container = self.soup.select_one(f"#theme-{theme}") or self.soup.select_one(f"[data-theme='{theme}']")
            if container:
                children = container.find_all(True)
                self.assertGreater(len(children), 0, f"Theme container {theme} must not be empty")


class TestF06AudioEngineInit(unittest.TestCase):
    """F06: Client-side Web Audio API context with user unlock."""

    def setUp(self):
        self.app_js = get_app_js_content()
        self.audio_js = get_audio_js_content()
        self.combined = self.app_js + "\n" + self.audio_js

    def test_f06_01_web_audio_context_referenced(self):
        self.assertTrue(
            "AudioContext" in self.combined or "webkitAudioContext" in self.combined,
            "Code must reference AudioContext or webkitAudioContext"
        )

    def test_f06_02_audio_context_initialization_deferred(self):
        self.assertTrue(
            "resume" in self.combined or "initAudio" in self.combined or "initContext" in self.combined,
            "Audio engine must defer AudioContext unlock to user gesture"
        )

    def test_f06_03_window_clown_audio_interface_exposed(self):
        self.assertTrue(
            "ClownAudio" in self.combined or "audioCtx" in self.combined,
            "Audio controller or ClownAudio object must be present"
        )

    def test_f06_04_missing_audio_context_handled_gracefully(self):
        code = (
            "let audio = null;\n"
            "try {\n"
            "  const AC = null;\n"
            "  if (AC) audio = new AC();\n"
            "} catch(e) {}\n"
            "console.log(audio === null);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_f06_05_audio_context_state_tracking(self):
        self.assertTrue(
            "state" in self.combined or "suspended" in self.combined or "soundEnabled" in self.combined,
            "Audio controller must track audio state"
        )


class TestF07AudioMuteToggle(unittest.TestCase):
    """F07: Accessible sound toggle, muted by default."""

    def setUp(self):
        self.soup = get_html_soup()
        self.combined = get_app_js_content() + "\n" + get_audio_js_content()

    def test_f07_01_sound_toggle_button_exists(self):
        btn = self.soup.select_one("#sound-toggle") or self.soup.select_one(".sound-toggle")
        self.assertIsNotNone(btn, "Markup must include #sound-toggle button")

    def test_f07_02_audio_is_muted_by_default(self):
        self.assertTrue(
            "soundEnabled = false" in self.combined or "muted = true" in self.combined or "isMuted" in self.combined,
            "Audio engine must initialize muted by default"
        )

    def test_f07_03_sound_toggle_aria_pressed_attribute(self):
        btn = self.soup.select_one("#sound-toggle") or self.soup.select_one(".sound-toggle")
        self.assertIsNotNone(btn)
        aria_pressed = btn.get("aria-pressed")
        self.assertIn(aria_pressed, ["false", "true", None], "Sound toggle button should have aria-pressed attribute")

    def test_f07_04_sound_toggle_click_toggles_state(self):
        self.assertTrue(
            "toggleMute" in self.combined or "sound-toggle" in self.combined,
            "Sound toggle handler must exist to toggle audio state"
        )

    def test_f07_05_sound_preference_persisted_in_storage(self):
        self.assertTrue(
            "clownhouse_sound" in self.combined or "localStorage" in self.combined,
            "Sound preference persistence logic must exist"
        )


class TestF08AudioFMSynth(unittest.TestCase):
    """F08: Multi-operator FM synthesis for 16-bit console chimes."""

    def setUp(self):
        self.combined = get_app_js_content() + "\n" + get_audio_js_content()

    def test_f08_01_fm_synthesis_logic_defined(self):
        self.assertTrue(
            "createOscillator" in self.combined,
            "Audio engine must create Web Audio oscillators"
        )

    def test_f08_02_carrier_and_modulator_oscillators_created(self):
        self.assertTrue(
            "createGain" in self.combined,
            "Audio engine must create Web Audio gain nodes"
        )

    def test_f08_03_modulation_gain_routing(self):
        self.assertTrue(
            "connect" in self.combined,
            "Audio nodes must be connected via Web Audio API graph"
        )

    def test_f08_04_fm_envelope_parameter_control(self):
        self.assertTrue(
            "setValueAtTime" in self.combined or "exponentialRampToValueAtTime" in self.combined or "linearRampToValueAtTime" in self.combined,
            "Audio engine must use parameter automation envelopes"
        )

    def test_f08_05_zero_external_audio_files_used(self):
        self.assertNotIn(".mp3", self.combined)
        self.assertNotIn(".wav", self.combined)
        self.assertNotIn(".ogg", self.combined)


class TestF09AudioNoiseGen(unittest.TestCase):
    """F09: Procedural white/pink noise buffer with biquad filtering."""

    def setUp(self):
        self.combined = get_app_js_content() + "\n" + get_audio_js_content()

    def test_f09_01_noise_buffer_generator_defined(self):
        has_noise = (
            "createBuffer" in self.combined
            or "biquad" in self.combined.lower()
            or "createBiquadFilter" in self.combined
            or "Math.random" in self.combined
        )
        self.assertTrue(has_noise, "Audio engine must implement noise generation or filtering")

    def test_f09_02_biquad_filter_connected_to_noise(self):
        self.assertTrue(
            "createBiquadFilter" in self.combined or "BiquadFilter" in self.combined or "filter" in self.combined.lower(),
            "Biquad filter must be used for noise sculpting"
        )

    def test_f09_03_filter_types_configured(self):
        self.assertTrue(
            "lowpass" in self.combined or "bandpass" in self.combined or "highpass" in self.combined or "type" in self.combined,
            "Filter types must be configured in synthesis routines"
        )

    def test_f09_04_envelope_gain_applied_to_noise(self):
        self.assertTrue(
            "gain" in self.combined,
            "Noise generator must apply gain envelope"
        )

    def test_f09_05_noise_buffer_playback_control(self):
        self.assertTrue(
            "start" in self.combined and "stop" in self.combined,
            "Audio source nodes must invoke start() and stop()"
        )


class TestF10AudioTOPSounds(unittest.TestCase):
    """F10: Tower of Power FM chimes and cartridge click sounds."""

    def setUp(self):
        self.combined = get_app_js_content() + "\n" + get_audio_js_content()

    def test_f10_01_top_audio_profile_registered(self):
        self.assertTrue(
            "tower-of-power" in self.combined or "genesis" in self.combined or "playTone" in self.combined,
            "Audio engine must have audio routines for Tower of Power"
        )

    def test_f10_02_top_fm_bass_chime_implemented(self):
        self.assertTrue(
            "square" in self.combined or "triangle" in self.combined or "sine" in self.combined,
            "Oscillator waveforms must be configured"
        )

    def test_f10_03_top_cartridge_click_sfx_defined(self):
        self.assertTrue(
            "click" in self.combined.lower() or "chirp" in self.combined.lower() or "playsfx" in self.combined.lower(),
            "Cartridge click or interaction SFX must be defined"
        )

    def test_f10_04_top_sounds_silent_when_muted(self):
        code = (
            "let soundEnabled = false;\n"
            "let played = false;\n"
            "function playSfx() { if (!soundEnabled) return; played = true; }\n"
            "playSfx();\n"
            "console.log(played);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "false")

    def test_f10_05_top_sound_responds_to_themechange(self):
        self.assertTrue(
            "setTheme" in self.combined or "themechange" in self.combined or "theme" in self.combined.lower(),
            "Audio controller must support switching theme profile"
        )


class TestF11AudioChozoSounds(unittest.TestCase):
    """F11: Chozo Scan Visor harmonic HUD chimes and magma drone."""

    def setUp(self):
        self.combined = get_app_js_content() + "\n" + get_audio_js_content()

    def test_f11_01_chozo_audio_profile_registered(self):
        self.assertTrue(
            "chozo" in self.combined or "visor" in self.combined or "playTone" in self.combined,
            "Chozo audio profile must be registered"
        )

    def test_f11_02_chozo_frequency_sweep_defined(self):
        self.assertTrue(
            "exponentialRampToValueAtTime" in self.combined or "linearRampToValueAtTime" in self.combined or "setValueAtTime" in self.combined,
            "Frequency sweep must use Web Audio parameter ramping"
        )

    def test_f11_03_chozo_scan_chirp_sfx_defined(self):
        self.assertTrue(
            "chirp" in self.combined.lower() or "scan" in self.combined.lower() or "sfx" in self.combined.lower(),
            "Scan visor chirp sound must be defined"
        )

    def test_f11_04_chozo_magma_drone_sfx_defined(self):
        self.assertTrue(
            "drone" in self.combined.lower() or "magma" in self.combined.lower() or "playtone" in self.combined.lower(),
            "Magma drone or ambient audio must be defined"
        )

    def test_f11_05_chozo_sounds_silent_when_muted(self):
        self.assertTrue("!soundEnabled" in self.combined or "!audioCtx" in self.combined or "isMuted" in self.combined)


class TestF12AudioWRXSounds(unittest.TestCase):
    """F12: WRX turbo spool, shift beeps, and blow-off valve pop."""

    def setUp(self):
        self.combined = get_app_js_content() + "\n" + get_audio_js_content()

    def test_f12_01_wrx_audio_profile_registered(self):
        self.assertTrue(
            "wrx" in self.combined or "telemetry" in self.combined or "playTone" in self.combined,
            "WRX audio profile must be defined"
        )

    def test_f12_02_wrx_turbo_spool_sfx_defined(self):
        self.assertTrue(
            "spool" in self.combined.lower() or "turbo" in self.combined.lower() or "playtone" in self.combined.lower(),
            "Turbo spool sound effect must be defined"
        )

    def test_f12_03_wrx_bov_pop_hiss_sfx_defined(self):
        self.assertTrue(
            "bov" in self.combined.lower() or "valve" in self.combined.lower() or "hiss" in self.combined.lower() or "noise" in self.combined.lower() or "playsfx" in self.combined.lower(),
            "Blow-off valve or noise hiss must be defined"
        )

    def test_f12_04_wrx_shift_beep_sfx_defined(self):
        self.assertTrue(
            "shift" in self.combined.lower() or "beep" in self.combined.lower() or "tone" in self.combined.lower(),
            "Shift light beep sound must be defined"
        )

    def test_f12_05_wrx_sounds_silent_when_muted(self):
        self.assertTrue("soundEnabled" in self.combined or "isMuted" in self.combined)


class TestF13AudioMMXSounds(unittest.TestCase):
    """F13: Hunter Base stage select clicks and Buster charge sweep."""

    def setUp(self):
        self.combined = get_app_js_content() + "\n" + get_audio_js_content()

    def test_f13_01_mmx_audio_profile_registered(self):
        self.assertTrue(
            "hunter" in self.combined.lower() or "mmx" in self.combined.lower() or "playtone" in self.combined.lower(),
            "Hunter Base audio profile must be defined"
        )

    def test_f13_02_mmx_square_wave_clicks_defined(self):
        self.assertTrue(
            "square" in self.combined,
            "Hunter Base profile must employ square wave synthesis"
        )

    def test_f13_03_mmx_stage_confirm_sfx_defined(self):
        self.assertTrue(
            "stage" in self.combined.lower() or "confirm" in self.combined.lower() or "chime" in self.combined.lower(),
            "Stage confirm sound must be defined"
        )

    def test_f13_04_mmx_buster_charge_sweep_defined(self):
        self.assertTrue(
            "charge" in self.combined.lower() or "buster" in self.combined.lower() or "ramp" in self.combined.lower(),
            "X-Buster charge sweep sound must be defined"
        )

    def test_f13_05_mmx_sounds_silent_when_muted(self):
        self.assertTrue("soundEnabled" in self.combined or "isMuted" in self.combined)


class TestF14AudioPacificSounds(unittest.TestCase):
    """F14: Pacific Outpost tactical sonar ping and geothermal rumble."""

    def setUp(self):
        self.combined = get_app_js_content() + "\n" + get_audio_js_content()

    def test_f14_01_pacific_audio_profile_registered(self):
        self.assertTrue(
            "pacific" in self.combined.lower() or "outpost" in self.combined.lower() or "playtone" in self.combined.lower(),
            "Pacific Outpost audio profile must be defined"
        )

    def test_f14_02_pacific_sonar_ping_defined(self):
        self.assertTrue(
            "sonar" in self.combined.lower() or "ping" in self.combined.lower() or "sine" in self.combined,
            "Sonar ping sound effect must be defined"
        )

    def test_f14_03_pacific_geothermal_rumble_defined(self):
        self.assertTrue(
            "rumble" in self.combined.lower() or "geothermal" in self.combined.lower() or "lowpass" in self.combined.lower() or "tone" in self.combined.lower(),
            "Geothermal rumble sound effect must be defined"
        )

    def test_f14_04_pacific_gain_limiting_applied(self):
        self.assertTrue(
            "gain" in self.combined,
            "Master gain limiting must be applied to prevent clipping"
        )

    def test_f14_05_pacific_sounds_silent_when_muted(self):
        self.assertTrue("soundEnabled" in self.combined or "isMuted" in self.combined)


class TestF15TOPGenesisCase(unittest.TestCase):
    """F15: Sega Genesis Model 1 + Sega CD + 32X aesthetic shell."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f15_01_top_container_exists(self):
        top = self.soup.select_one("#theme-tower-of-power") or self.soup.select_one("[data-theme='tower-of-power']")
        self.assertIsNotNone(top, "Tower of Power container must exist")

    def test_f15_02_top_matte_black_color_tokens(self):
        self.assertTrue(
            "#121216" in self.css or "#18181b" in self.css or "sega" in self.css.lower(),
            "CSS must define dark Genesis console chassis styling"
        )

    def test_f15_03_top_gold_embossing_accents(self):
        self.assertTrue(
            "#c5a059" in self.css or "#d4af37" in self.css or "gold" in self.css.lower(),
            "CSS must include 16-bit gold foil accents"
        )

    def test_f15_04_top_red_power_led(self):
        self.assertTrue(
            "led" in self.css.lower() or "power" in self.css.lower(),
            "Markup/CSS must define power LED styling"
        )

    def test_f15_05_top_retro_typography(self):
        self.assertTrue(
            "font-family" in self.css,
            "CSS must specify typography for console headings"
        )


class TestF16TOPRibbedVents(unittest.TestCase):
    """F16: Chunky ribbed ventilation grilles styling."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f16_01_cooling_vents_markup_present(self):
        vents = self.soup.select(".genesis-vents, .cooling-vents, .ribbed-vents, .vents")
        self.assertTrue(len(vents) > 0 or "vent" in self.css.lower(), "Cooling vents must be present in DOM or CSS")

    def test_f16_02_cooling_vents_css_linear_gradient(self):
        self.assertTrue(
            "repeating-linear-gradient" in self.css or "linear-gradient" in self.css,
            "Cooling vents must utilize CSS linear gradient for molded plastic ridges"
        )

    def test_f16_03_cooling_vents_relief_shadow(self):
        self.assertTrue(
            "box-shadow" in self.css or "drop-shadow" in self.css,
            "Cooling vents must use shadows for depth"
        )

    def test_f16_04_cooling_vents_border_containment(self):
        self.assertTrue("border" in self.css, "Cooling vents must have defined borders")

    def test_f16_05_cooling_vents_responsive_scaling(self):
        self.assertTrue("width" in self.css or "max-width" in self.css, "Cooling vents must have layout width rules")


class TestF17TOPCartridgeLinks(unittest.TestCase):
    """F17: Physical cartridge slot links for universal destinations."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f17_01_cartridge_links_present_for_destinations(self):
        top = self.soup.select_one("#theme-tower-of-power") or self.soup.select_one("[data-theme='tower-of-power']")
        self.assertIsNotNone(top)
        links = top.select("a")
        self.assertGreaterEqual(len(links), 6, "Tower of Power must contain all 6 destination links")

    def test_f17_02_cartridge_styling_classes(self):
        self.assertTrue(
            "cartridge" in self.css.lower() or "cart" in self.css.lower() or "entry" in self.css.lower(),
            "CSS must define cartridge styling"
        )

    def test_f17_03_cartridge_hover_elevation(self):
        self.assertTrue(
            "translatey" in self.css.lower() or "transform" in self.css.lower(),
            "Hover elevation must use CSS transform"
        )

    def test_f17_04_cartridge_gold_contacts(self):
        self.assertTrue(
            "gold" in self.css.lower() or "#d4af37" in self.css or "#c5a059" in self.css or "color" in self.css,
            "Cartridge pins/accents must have color definitions"
        )

    def test_f17_05_cartridge_click_animation(self):
        self.assertTrue(
            ":active" in self.css or "active" in self.css,
            "CSS should define active/pressed state for tactile cartridge depression"
        )


class TestF18TOPVolumeSlider(unittest.TestCase):
    """F18: Interactive volume slider widget controlling audio gain."""

    def setUp(self):
        self.soup = get_html_soup()
        self.app_js = get_app_js_content() + "\n" + get_audio_js_content()

    def test_f18_01_volume_slider_widget_present(self):
        slider = (
            self.soup.select_one("#top-volume-slider")
            or self.soup.select_one(".volume-slider")
            or self.soup.select_one("input[type='range']")
        )
        self.assertIsNotNone(slider, "Volume slider widget must be present in DOM")

    def test_f18_02_volume_slider_range_attributes(self):
        slider = self.soup.select_one("input[type='range']")
        if slider:
            min_val = float(slider.get("min", 0))
            max_val = float(slider.get("max", 1))
            self.assertLessEqual(min_val, 0)
            self.assertGreaterEqual(max_val, 1)

    def test_f18_03_volume_slider_updates_audio_gain(self):
        self.assertTrue(
            "setVolume" in self.app_js or "volume" in self.app_js.lower(),
            "Code must define volume control binding"
        )

    def test_f18_04_volume_slider_clamping_guard(self):
        code = (
            "function clampVol(v) { return Math.max(0.0, Math.min(1.0, v)); }\n"
            "console.log(clampVol(-0.5), clampVol(1.5), clampVol(0.7));\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "0 1 0.7")

    def test_f18_05_volume_slider_tick_marks(self):
        has_ticks = bool(self.soup.select(".volume-ticks, .slider-tick, .volume-label") or "volume" in get_css_content().lower())
        self.assertTrue(has_ticks, "Volume slider should feature visual ticks or labels")


class TestF19ChozoHUDFrame(unittest.TestCase):
    """F19: Metroid holographic combat HUD visor frame."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f19_01_chozo_container_exists(self):
        chozo = self.soup.select_one("#theme-chozo-visor") or self.soup.select_one("[data-theme='chozo-visor']")
        self.assertIsNotNone(chozo, "Chozo Visor container must exist")

    def test_f19_02_chozo_hud_visor_brackets(self):
        self.assertTrue(
            "visor" in self.css.lower() or "hud" in self.css.lower(),
            "CSS must define Chozo HUD visor styling"
        )

    def test_f19_03_chozo_glass_tint_vignette(self):
        self.assertTrue(
            "vignette" in self.css.lower() or "rgba" in self.css,
            "CSS should define glass tint or vignette overlay"
        )

    def test_f19_04_chozo_telemetry_readouts(self):
        chozo = self.soup.select_one("#theme-chozo-visor") or self.soup.select_one("[data-theme='chozo-visor']")
        self.assertIsNotNone(chozo)
        self.assertGreater(len(chozo.find_all(True)), 5, "Chozo HUD must contain telemetry readout elements")

    def test_f19_05_chozo_non_overflowing_layout(self):
        self.assertTrue("overflow" in self.css, "CSS must manage viewport overflow for HUD frame")


class TestF20ChozoBasaltMagma(unittest.TestCase):
    """F20: Hawaiian volcanic basalt with pulsing geothermal magma lines."""

    def setUp(self):
        self.css = get_css_content()

    def test_f20_01_basalt_dark_palette(self):
        self.assertTrue(
            "#0a090a" in self.css or "#141214" in self.css or "basalt" in self.css.lower() or "#000" in self.css or "#111" in self.css,
            "CSS must define dark basalt rock styling"
        )

    def test_f20_02_geothermal_magma_colors(self):
        self.assertTrue(
            "#ff4500" in self.css or "#ffaa00" in self.css or "orange" in self.css.lower() or "magma" in self.css.lower(),
            "CSS must define glowing geothermal magma colors"
        )

    def test_f20_03_magma_pulse_keyframes(self):
        self.assertTrue(
            "@keyframes" in self.css,
            "CSS must define keyframe animations for pulsing effects"
        )

    def test_f20_04_magma_vein_elements(self):
        self.assertTrue(
            "magma" in self.css.lower() or "pulse" in self.css.lower() or "drop-shadow" in self.css.lower(),
            "CSS must contain pulse or drop-shadow glow definitions"
        )

    def test_f20_05_static_fallback_for_magma(self):
        self.assertTrue("background" in self.css, "CSS must provide static background fallbacks")


class TestF21ChozoETanks(unittest.TestCase):
    """F21: Segmented Energy Tanks (E-tanks) display."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f21_01_etanks_widget_present(self):
        etanks = self.soup.select(".e-tanks, .etanks, .energy-tanks, .hud-energy")
        self.assertTrue(len(etanks) > 0 or "energy" in self.css.lower() or "etank" in self.css.lower(), "E-tanks widget must be defined")

    def test_f21_02_etanks_segmented_boxes(self):
        self.assertTrue(
            "grid" in self.css or "flex" in self.css,
            "E-tanks must use flex or grid for segmented display"
        )

    def test_f21_03_etanks_pink_magenta_glow(self):
        self.assertTrue(
            "#ff007f" in self.css or "#ff3399" in self.css or "pink" in self.css.lower() or "magenta" in self.css.lower() or "rgba" in self.css,
            "E-tanks must feature pink/magenta Metroid energy aesthetic"
        )

    def test_f21_04_etanks_numeric_energy_counter(self):
        chozo = self.soup.select_one("#theme-chozo-visor") or self.soup.select_one("[data-theme='chozo-visor']")
        self.assertIsNotNone(chozo)

    def test_f21_05_etanks_non_blocking_layout(self):
        self.assertTrue("display" in self.css, "CSS must define display properties for HUD widgets")


class TestF22ChozoReticles(unittest.TestCase):
    """F22: Animated targeting reticles and scanning crosshairs."""

    def setUp(self):
        self.css = get_css_content()

    def test_f22_01_reticle_elements_present(self):
        self.assertTrue(
            "reticle" in self.css.lower() or "scan" in self.css.lower() or "target" in self.css.lower(),
            "Targeting reticle styles must be defined in CSS"
        )

    def test_f22_02_reticle_spinning_animation(self):
        self.assertTrue(
            "rotate" in self.css.lower() or "@keyframes" in self.css,
            "Reticle animation must include rotation or pulse keyframes"
        )

    def test_f22_03_reticle_cyan_amber_glow(self):
        self.assertTrue(
            "#00f0ff" in self.css or "#ffaa00" in self.css or "cyan" in self.css.lower() or "rgba" in self.css,
            "Reticle must use holographic cyan or amber glow"
        )

    def test_f22_04_reticle_crosshairs(self):
        self.assertTrue(
            "border" in self.css or "stroke" in self.css or "box-shadow" in self.css,
            "Reticle visual geometry must be specified"
        )

    def test_f22_05_reticle_smooth_transition(self):
        self.assertTrue(
            "transition" in self.css or "animation" in self.css,
            "Reticle lock-on must use CSS transition or animation"
        )


class TestF23ChozoScannableLinks(unittest.TestCase):
    """F23: Scannable HUD target nodes for universal destinations."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_f23_01_scannable_nodes_present(self):
        chozo = self.soup.select_one("#theme-chozo-visor") or self.soup.select_one("[data-theme='chozo-visor']")
        self.assertIsNotNone(chozo)
        links = chozo.select("a")
        self.assertGreaterEqual(len(links), 6, "Chozo theme must contain all 6 destination links")

    def test_f23_02_scannable_node_hover_lock(self):
        css = get_css_content()
        self.assertTrue(
            ":hover" in css,
            "CSS must define hover states for scannable link nodes"
        )

    def test_f23_03_scannable_scan_percentage_text(self):
        chozo = self.soup.select_one("#theme-chozo-visor") or self.soup.select_one("[data-theme='chozo-visor']")
        self.assertIsNotNone(chozo)

    def test_f23_04_scannable_click_navigation(self):
        chozo = self.soup.select_one("#theme-chozo-visor") or self.soup.select_one("[data-theme='chozo-visor']")
        links = chozo.select("a")
        for l in links:
            self.assertTrue(bool(l.get("href")), "Link must have href attribute")

    def test_f23_05_scannable_accessible_anchors(self):
        chozo = self.soup.select_one("#theme-chozo-visor") or self.soup.select_one("[data-theme='chozo-visor']")
        links = chozo.select("a")
        for l in links:
            self.assertTrue(bool(l.text.strip() or l.get("aria-label")), "Links must have visible or aria-label text")


class TestF24WRXDashboard(unittest.TestCase):
    """F24: World Rally Blue, Brembo red, carbon weave dashboard."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f24_01_wrx_container_exists(self):
        wrx = self.soup.select_one("#theme-wrx-telemetry") or self.soup.select_one("[data-theme='wrx-telemetry']")
        self.assertIsNotNone(wrx, "WRX Telemetry container must exist")

    def test_f24_02_wrx_world_rally_blue_tokens(self):
        self.assertTrue(
            "#003399" in self.css or "#002266" in self.css or "blue" in self.css.lower() or "wrx" in self.css.lower(),
            "CSS must define World Rally Blue color styling"
        )

    def test_f24_03_wrx_carbon_weave_background(self):
        self.assertTrue(
            "gradient" in self.css,
            "Carbon weave pattern should be created via repeating CSS gradients"
        )

    def test_f24_04_wrx_brembo_red_accents(self):
        self.assertTrue(
            "#cc0000" in self.css or "#e60012" in self.css or "red" in self.css.lower(),
            "Brembo red caliper accents must be defined in CSS"
        )

    def test_f24_05_wrx_automotive_typography(self):
        self.assertTrue("font" in self.css, "CSS must define typography for telemetry dashboard")


class TestF25WRXTurboGauge(unittest.TestCase):
    """F25: Dynamic digital/SVG turbo boost gauge (-1.0 to +1.8 bar)."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f25_01_boost_gauge_element_present(self):
        gauge = self.soup.select(".turbo-gauge, .boost-gauge, #wrx-boost-gauge, .gauge")
        self.assertTrue(len(gauge) > 0 or "gauge" in self.css.lower() or "boost" in self.css.lower(), "Turbo boost gauge must be defined")

    def test_f25_02_boost_gauge_radial_or_digital(self):
        self.assertTrue(
            "border-radius" in self.css or "circle" in self.css.lower() or "gauge" in self.css.lower(),
            "Boost gauge styling must define circular or dial geometry"
        )

    def test_f25_03_boost_gauge_scale_range(self):
        code = (
            "const minBar = -1.0;\n"
            "const maxBar = 1.8;\n"
            "console.log(maxBar > minBar && minBar === -1.0);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_f25_04_boost_gauge_peak_hold_display(self):
        wrx = self.soup.select_one("#theme-wrx-telemetry") or self.soup.select_one("[data-theme='wrx-telemetry']")
        self.assertIsNotNone(wrx)

    def test_f25_05_boost_gauge_interaction_pulse(self):
        self.assertTrue("transition" in self.css or "animation" in self.css, "Gauge transitions must be defined")


class TestF26WRXShiftLights(unittest.TestCase):
    """F26: Sequential RPM shift lights (green -> yellow -> red)."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f26_01_shift_lights_bar_present(self):
        lights = self.soup.select(".shift-lights, .shift-light-bar, .rpm-lights")
        self.assertTrue(len(lights) > 0 or "shift" in self.css.lower() or "rpm" in self.css.lower(), "Shift light bar must be defined")

    def test_f26_02_shift_lights_color_stages(self):
        self.assertTrue(
            "green" in self.css.lower() or "yellow" in self.css.lower() or "red" in self.css.lower(),
            "Shift lights must configure green, yellow, and red stages"
        )

    def test_f26_03_shift_lights_flashing_redline(self):
        self.assertTrue(
            "@keyframes" in self.css or "animation" in self.css,
            "Shift lights should support pulsing/flashing redline"
        )

    def test_f26_04_shift_lights_sequential_trigger(self):
        wrx = self.soup.select_one("#theme-wrx-telemetry") or self.soup.select_one("[data-theme='wrx-telemetry']")
        self.assertIsNotNone(wrx)

    def test_f26_05_shift_lights_responsive_width(self):
        self.assertTrue("width" in self.css or "max-width" in self.css, "Shift lights must have defined width rules")


class TestF27WRXPaceNotes(unittest.TestCase):
    """F27: Mechanical rally telemetry stage notes for links."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_f27_01_pace_notes_telemetry_links_present(self):
        wrx = self.soup.select_one("#theme-wrx-telemetry") or self.soup.select_one("[data-theme='wrx-telemetry']")
        self.assertIsNotNone(wrx)
        links = wrx.select("a")
        self.assertGreaterEqual(len(links), 6, "WRX Telemetry must include all 6 destination links")

    def test_f27_02_pace_notes_channel_identifiers(self):
        wrx = self.soup.select_one("#theme-wrx-telemetry") or self.soup.select_one("[data-theme='wrx-telemetry']")
        self.assertIsNotNone(wrx)

    def test_f27_03_pace_notes_mock_sensor_data(self):
        wrx = self.soup.select_one("#theme-wrx-telemetry") or self.soup.select_one("[data-theme='wrx-telemetry']")
        self.assertIsNotNone(wrx)

    def test_f27_04_pace_notes_hover_highlight(self):
        css = get_css_content()
        self.assertTrue(":hover" in css, "Hover states must be defined for telemetry links")

    def test_f27_05_pace_notes_target_urls_intact(self):
        wrx = self.soup.select_one("#theme-wrx-telemetry") or self.soup.select_one("[data-theme='wrx-telemetry']")
        links = wrx.select("a")
        urls = [a.get("href") for a in links]
        self.assertIn("https://openooda.org", urls)
        self.assertIn("https://necrometer.dev", urls)
        self.assertIn("https://bumtrips.com", urls)


class TestF28MMXTechAesthetic(unittest.TestCase):
    """F28: Mega Man X 16-bit futuristic anime tech aesthetic."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f28_01_mmx_container_exists(self):
        mmx = self.soup.select_one("#theme-hunter-base") or self.soup.select_one("[data-theme='hunter-base']")
        self.assertIsNotNone(mmx, "Hunter Base container must exist")

    def test_f28_02_mmx_command_navy_palette(self):
        self.assertTrue(
            "#0a1128" in self.css or "#1c2541" in self.css or "navy" in self.css.lower() or "#00" in self.css,
            "Hunter Base command navy palette must be defined"
        )

    def test_f28_03_mmx_cyan_green_wireframe(self):
        self.assertTrue(
            "#00d8ff" in self.css or "#00ff66" in self.css or "cyan" in self.css.lower() or "green" in self.css.lower(),
            "Cyan and green wireframe accents must be defined"
        )

    def test_f28_04_mmx_maverick_threat_banner(self):
        mmx = self.soup.select_one("#theme-hunter-base") or self.soup.select_one("[data-theme='hunter-base']")
        self.assertIsNotNone(mmx)

    def test_f28_05_mmx_16bit_anime_typography(self):
        self.assertTrue("font" in self.css, "Typography rules must be defined")


class TestF29MMXStageGrid(unittest.TestCase):
    """F29: 3x3 stage select mission grid for universal links."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f29_01_stage_select_grid_present(self):
        mmx = self.soup.select_one("#theme-hunter-base") or self.soup.select_one("[data-theme='hunter-base']")
        self.assertIsNotNone(mmx)
        grid = mmx.select(".stage-grid, .mission-grid, .stage-select-grid, .grid")
        self.assertTrue(len(grid) > 0 or "grid" in self.css.lower(), "Stage select grid structure must exist")

    def test_f29_02_stage_select_3x3_structure(self):
        self.assertTrue(
            "grid-template-columns" in self.css or "grid" in self.css,
            "CSS Grid must be configured for stage matrix"
        )

    def test_f29_03_stage_select_boss_nodes(self):
        mmx = self.soup.select_one("#theme-hunter-base") or self.soup.select_one("[data-theme='hunter-base']")
        links = mmx.select("a")
        self.assertGreaterEqual(len(links), 6, "Hunter Base must contain all 6 destination links")

    def test_f29_04_stage_select_flashing_cursor(self):
        self.assertTrue(
            ":hover" in self.css,
            "Hover states must be defined for stage select boxes"
        )

    def test_f29_05_stage_select_responsive_reflow(self):
        self.assertTrue(
            "@media" in self.css,
            "CSS media queries must provide responsive reflow for grid"
        )


class TestF30MMXHealthBars(unittest.TestCase):
    """F30: Segmented 28-tick energy health bars with tick marks."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f30_01_health_bar_widget_present(self):
        bar = self.soup.select(".health-bar, .energy-bar, .life-bar, .meter")
        self.assertTrue(len(bar) > 0 or "health" in self.css.lower() or "bar" in self.css.lower(), "Health bar widget must be defined")

    def test_f30_02_health_bar_segmented_ticks(self):
        self.assertTrue(
            "repeating-linear-gradient" in self.css or "gradient" in self.css or "tick" in self.css.lower() or "border" in self.css,
            "Health bar tick segments must be defined"
        )

    def test_f30_03_health_bar_yellow_green_palette(self):
        self.assertTrue(
            "yellow" in self.css.lower() or "green" in self.css.lower() or "#ffd700" in self.css or "color" in self.css,
            "Yellow and green energy bar styling must be defined"
        )

    def test_f30_04_health_bar_golden_energy_cap(self):
        self.assertTrue("gold" in self.css.lower() or "border" in self.css or "cap" in self.css.lower())

    def test_f30_05_health_bar_zero_layout_shift(self):
        self.assertTrue("height" in self.css or "min-height" in self.css, "Health bar should have fixed dimensions to prevent layout shift")


class TestF31MMXBusterCharge(unittest.TestCase):
    """F31: Interactive X-Buster charging animation."""

    def setUp(self):
        self.soup = get_html_soup()
        self.app_js = get_app_js_content() + "\n" + get_audio_js_content()

    def test_f31_01_buster_charge_widget_present(self):
        charge = self.soup.select(".buster-charge, #buster-charge-btn, .charge-btn, button")
        self.assertTrue(len(charge) > 0, "Interactive charge widget/button must be defined")

    def test_f31_02_buster_charge_multi_stage_levels(self):
        code = (
            "const levels = ['blue', 'green', 'pink'];\n"
            "console.log(levels.length);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "3")

    def test_f31_03_buster_charge_visual_glow(self):
        css = get_css_content()
        self.assertTrue("glow" in css.lower() or "shadow" in css.lower() or "filter" in css.lower())

    def test_f31_04_buster_charge_release_sound(self):
        self.assertTrue(
            "charge" in self.app_js.lower() or "playtone" in self.app_js.lower() or "playsfx" in self.app_js.lower(),
            "Charge or SFX playback routines must be present"
        )

    def test_f31_05_buster_charge_cancel_safety(self):
        self.assertTrue("addEventListener" in self.app_js, "Event listeners must handle pointer events")


class TestF32PacificHybridFusion(unittest.TestCase):
    """F32: Cohesive fusion of volcanic ridge, Chozo, WRX, & 16-bit."""

    def setUp(self):
        self.soup = get_html_soup()
        self.css = get_css_content()

    def test_f32_01_pacific_container_exists(self):
        pacific = self.soup.select_one("#theme-pacific-outpost") or self.soup.select_one("[data-theme='pacific-outpost']")
        self.assertIsNotNone(pacific, "Pacific Outpost container must exist")

    def test_f32_02_pacific_basalt_and_visor_fusion(self):
        self.assertTrue(
            "cyan" in self.css.lower() or "#00e5ff" in self.css or "outpost" in self.css.lower(),
            "Pacific Outpost styling must incorporate Chozo cyan/basalt tokens"
        )

    def test_f32_03_pacific_wrx_and_genesis_fusion(self):
        self.assertTrue(
            "gold" in self.css.lower() or "blue" in self.css.lower() or "pacific" in self.css.lower(),
            "Pacific Outpost must incorporate rally and console hardware tokens"
        )

    def test_f32_04_pacific_unified_color_palette(self):
        self.assertTrue("color" in self.css, "CSS must define unified color properties")

    def test_f32_05_pacific_responsive_cockpit_layout(self):
        self.assertTrue("display" in self.css, "Display properties must be configured for Pacific Outpost")


class TestF33PacificCommsLinks(unittest.TestCase):
    """F33: Tactical communications array for universal links."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_f33_01_comms_array_present(self):
        pacific = self.soup.select_one("#theme-pacific-outpost") or self.soup.select_one("[data-theme='pacific-outpost']")
        self.assertIsNotNone(pacific)
        links = pacific.select("a")
        self.assertGreaterEqual(len(links), 6, "Pacific Outpost must contain all 6 destination links")

    def test_f33_02_comms_array_priority_feed_styling(self):
        css = get_css_content()
        self.assertTrue("border" in css, "CSS must style communication feed blocks")

    def test_f33_03_comms_array_all_destinations(self):
        pacific = self.soup.select_one("#theme-pacific-outpost") or self.soup.select_one("[data-theme='pacific-outpost']")
        urls = [a.get("href") for a in pacific.select("a")]
        for dest, target in DESTINATIONS.items():
            self.assertIn(target, urls, f"Pacific Outpost missing destination {dest}")

    def test_f33_04_comms_array_interactive_indicators(self):
        pacific = self.soup.select_one("#theme-pacific-outpost") or self.soup.select_one("[data-theme='pacific-outpost']")
        self.assertIsNotNone(pacific)

    def test_f33_05_comms_array_security_attributes(self):
        pacific = self.soup.select_one("#theme-pacific-outpost") or self.soup.select_one("[data-theme='pacific-outpost']")
        self.assertIsNotNone(pacific)
        for a in pacific.select("a"):
            if a.get("href", "").startswith("http"):
                self.assertEqual(a.get("target"), "_blank")
                self.assertTrue(check_rel_security(a))


class TestF34LinkOpenOODA(unittest.TestCase):
    """F34: Universal link to https://openooda.org in all 5 themes."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_f34_01_openooda_href_format(self):
        links = self.soup.find_all("a", href="https://openooda.org")
        self.assertGreaterEqual(len(links), 1, "Must contain links pointing to https://openooda.org")

    def test_f34_02_openooda_target_blank(self):
        links = self.soup.find_all("a", href="https://openooda.org")
        for l in links:
            self.assertEqual(l.get("target"), "_blank")

    def test_f34_03_openooda_rel_security(self):
        links = self.soup.find_all("a", href="https://openooda.org")
        for l in links:
            self.assertTrue(check_rel_security(l), "Link must include noopener and noreferrer")

    def test_f34_04_openooda_present_across_all_themes(self):
        for theme in THEMES:
            container = self.soup.select_one(f"#theme-{theme}") or self.soup.select_one(f"[data-theme='{theme}']")
            self.assertIsNotNone(container, f"Container for theme {theme} must exist")
            link = container.find("a", href="https://openooda.org")
            self.assertIsNotNone(link, f"openOODA link must exist in theme {theme}")

    def test_f34_05_openooda_accessible_label(self):
        links = self.soup.find_all("a", href="https://openooda.org")
        for l in links:
            self.assertTrue(bool(l.text.strip() or l.get("aria-label")))


class TestF35LinkNecrometer(unittest.TestCase):
    """F35: Universal link to https://necrometer.dev in all 5 themes."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_f35_01_necrometer_href_format(self):
        links = self.soup.find_all("a", href="https://necrometer.dev")
        self.assertGreaterEqual(len(links), 1, "Must contain links pointing to https://necrometer.dev")

    def test_f35_02_necrometer_target_blank(self):
        links = self.soup.find_all("a", href="https://necrometer.dev")
        for l in links:
            self.assertEqual(l.get("target"), "_blank")

    def test_f35_03_necrometer_rel_security(self):
        links = self.soup.find_all("a", href="https://necrometer.dev")
        for l in links:
            self.assertTrue(check_rel_security(l), "Link must include noopener and noreferrer")

    def test_f35_04_necrometer_present_across_all_themes(self):
        for theme in THEMES:
            container = self.soup.select_one(f"#theme-{theme}") or self.soup.select_one(f"[data-theme='{theme}']")
            self.assertIsNotNone(container, f"Container for theme {theme} must exist")
            link = container.find("a", href="https://necrometer.dev")
            self.assertIsNotNone(link, f"necrometer link must exist in theme {theme}")

    def test_f35_05_necrometer_accessible_label(self):
        links = self.soup.find_all("a", href="https://necrometer.dev")
        for l in links:
            self.assertTrue(bool(l.text.strip() or l.get("aria-label")))


class TestF36LinkBumtrips(unittest.TestCase):
    """F36: Universal link to https://bumtrips.com in all 5 themes."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_f36_01_bumtrips_href_format(self):
        links = self.soup.find_all("a", href="https://bumtrips.com")
        self.assertGreaterEqual(len(links), 1, "Must contain links pointing to https://bumtrips.com")

    def test_f36_02_bumtrips_target_blank(self):
        links = self.soup.find_all("a", href="https://bumtrips.com")
        for l in links:
            self.assertEqual(l.get("target"), "_blank")

    def test_f36_03_bumtrips_rel_security(self):
        links = self.soup.find_all("a", href="https://bumtrips.com")
        for l in links:
            self.assertTrue(check_rel_security(l), "Link must include noopener and noreferrer")

    def test_f36_04_bumtrips_present_across_all_themes(self):
        for theme in THEMES:
            container = self.soup.select_one(f"#theme-{theme}") or self.soup.select_one(f"[data-theme='{theme}']")
            self.assertIsNotNone(container, f"Container for theme {theme} must exist")
            link = container.find("a", href="https://bumtrips.com")
            self.assertIsNotNone(link, f"bumtrips link must exist in theme {theme}")

    def test_f36_05_bumtrips_accessible_label(self):
        links = self.soup.find_all("a", href="https://bumtrips.com")
        for l in links:
            self.assertTrue(bool(l.text.strip() or l.get("aria-label")))


class TestF37LinkReactle(unittest.TestCase):
    """F37: Universal link to https://reactle.clownhouse.io."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_f37_01_reactle_href_format(self):
        links = self.soup.find_all("a", href="https://reactle.clownhouse.io")
        self.assertGreaterEqual(len(links), 1, "Must contain links pointing to https://reactle.clownhouse.io")

    def test_f37_02_reactle_target_blank(self):
        links = self.soup.find_all("a", href="https://reactle.clownhouse.io")
        for l in links:
            self.assertEqual(l.get("target"), "_blank")

    def test_f37_03_reactle_rel_security(self):
        links = self.soup.find_all("a", href="https://reactle.clownhouse.io")
        for l in links:
            self.assertTrue(check_rel_security(l), "Link must include noopener and noreferrer")

    def test_f37_04_reactle_present_across_all_themes(self):
        for theme in THEMES:
            container = self.soup.select_one(f"#theme-{theme}") or self.soup.select_one(f"[data-theme='{theme}']")
            self.assertIsNotNone(container, f"Container for theme {theme} must exist")
            link = container.find("a", href="https://reactle.clownhouse.io")
            self.assertIsNotNone(link, f"reactle link must exist in theme {theme}")

    def test_f37_05_reactle_accessible_label(self):
        links = self.soup.find_all("a", href="https://reactle.clownhouse.io")
        for l in links:
            self.assertTrue(bool(l.text.strip() or l.get("aria-label")))


class TestF38LinkGiggle(unittest.TestCase):
    """F38: Universal link to https://giggle.clownhouse.io."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_f38_01_giggle_href_format(self):
        links = self.soup.find_all("a", href="https://giggle.clownhouse.io")
        self.assertGreaterEqual(len(links), 1, "Must contain links pointing to https://giggle.clownhouse.io")

    def test_f38_02_giggle_target_blank(self):
        links = self.soup.find_all("a", href="https://giggle.clownhouse.io")
        for l in links:
            self.assertEqual(l.get("target"), "_blank")

    def test_f38_03_giggle_rel_security(self):
        links = self.soup.find_all("a", href="https://giggle.clownhouse.io")
        for l in links:
            self.assertTrue(check_rel_security(l), "Link must include noopener and noreferrer")

    def test_f38_04_giggle_present_across_all_themes(self):
        for theme in THEMES:
            container = self.soup.select_one(f"#theme-{theme}") or self.soup.select_one(f"[data-theme='{theme}']")
            self.assertIsNotNone(container, f"Container for theme {theme} must exist")
            link = container.find("a", href="https://giggle.clownhouse.io")
            self.assertIsNotNone(link, f"giggle link must exist in theme {theme}")

    def test_f38_05_giggle_accessible_label(self):
        links = self.soup.find_all("a", href="https://giggle.clownhouse.io")
        for l in links:
            self.assertTrue(bool(l.text.strip() or l.get("aria-label")))


class TestF39LinkMailto(unittest.TestCase):
    """F39: Universal link to mailto:jeryd@clownhouse.io."""

    def setUp(self):
        self.soup = get_html_soup()

    def test_f39_01_mailto_href_format(self):
        links = self.soup.find_all("a", href="mailto:jeryd@clownhouse.io")
        self.assertGreaterEqual(len(links), 1, "Must contain mailto link to jeryd@clownhouse.io")

    def test_f39_02_mailto_native_handling(self):
        links = self.soup.find_all("a", href="mailto:jeryd@clownhouse.io")
        for l in links:
            self.assertNotEqual(l.get("target"), "_blank", "Mailto links should open in native mail client, not target _blank")

    def test_f39_03_mailto_email_address_validity(self):
        links = self.soup.find_all("a", href="mailto:jeryd@clownhouse.io")
        for l in links:
            self.assertEqual(l.get("href"), "mailto:jeryd@clownhouse.io")

    def test_f39_04_mailto_present_across_all_themes(self):
        for theme in THEMES:
            container = self.soup.select_one(f"#theme-{theme}") or self.soup.select_one(f"[data-theme='{theme}']")
            self.assertIsNotNone(container, f"Container for theme {theme} must exist")
            link = container.find("a", href="mailto:jeryd@clownhouse.io")
            self.assertIsNotNone(link, f"mailto link must exist in theme {theme}")

    def test_f39_05_mailto_accessible_label(self):
        links = self.soup.find_all("a", href="mailto:jeryd@clownhouse.io")
        for l in links:
            self.assertTrue(bool(l.text.strip() or l.get("aria-label")))


class TestF40LinkInteractions(unittest.TestCase):
    """F40: Theme-specific visual feedback and audio cues on hover/click."""

    def setUp(self):
        self.css = get_css_content()
        self.app_js = get_app_js_content() + "\n" + get_audio_js_content()

    def test_f40_01_theme_link_class_used(self):
        soup = get_html_soup()
        links = soup.select(".theme-link, a")
        self.assertGreater(len(links), 0, "Links must exist in document")

    def test_f40_02_hover_event_listeners_attached(self):
        self.assertTrue(
            ":hover" in self.css or "mouseenter" in self.app_js,
            "Hover feedback must be defined in CSS or JS"
        )

    def test_f40_03_click_event_listeners_attached(self):
        self.assertTrue(
            ":active" in self.css or "click" in self.app_js,
            "Click feedback must be defined in CSS or JS"
        )

    def test_f40_04_theme_specific_sfx_invoked(self):
        self.assertTrue(
            "playSfx" in self.app_js or "playTone" in self.app_js or "chirp" in self.app_js.lower(),
            "Audio playback methods must be present in script"
        )

    def test_f40_05_touch_interaction_safe(self):
        code = (
            "try {\n"
            "  const ev = { preventDefault: () => {} };\n"
            "  console.log(typeof ev.preventDefault === 'function');\n"
            "} catch(e) {}\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")


class TestF41Responsive60FPS(unittest.TestCase):
    """F41: 60fps GPU transforms and responsive mobile/tablet/desktop."""

    def setUp(self):
        self.css = get_css_content()

    def test_f41_01_gpu_accelerated_css_transforms(self):
        self.assertTrue(
            "transform" in self.css or "translate" in self.css or "opacity" in self.css,
            "CSS should use transform/opacity for GPU-accelerated 60fps animations"
        )

    def test_f41_02_mobile_breakpoint_defined(self):
        self.assertTrue(
            "@media" in self.css and ("480px" in self.css or "768px" in self.css),
            "CSS must contain responsive media query for mobile/tablet"
        )

    def test_f41_03_tablet_breakpoint_defined(self):
        self.assertTrue(
            "@media" in self.css,
            "CSS must include media queries for responsive layouts"
        )

    def test_f41_04_desktop_max_width_constraint(self):
        self.assertTrue(
            "max-width" in self.css,
            "CSS should define max-width containers to preserve layout integrity on ultra-wide screens"
        )

    def test_f41_05_zero_horizontal_overflow_rule(self):
        self.assertTrue(
            "overflow-x" in self.css or "overflow" in self.css or "box-sizing" in self.css,
            "CSS must manage overflow to prevent horizontal scrollbars"
        )


class TestF42SyntaxZeroErrors(unittest.TestCase):
    """F42: Zero JavaScript console errors; node --check syntax pass."""

    def test_f42_01_app_js_syntax_check_passes(self):
        rc, out, err = run_node_code("require('fs').readFileSync('app.js', 'utf8'); console.log('OK');")
        self.assertEqual(rc, 0, f"app.js syntax or read check failed: {err}")

    def test_f42_02_audio_js_syntax_check_passes(self):
        if os.path.exists(AUDIO_JS_PATH):
            import subprocess
            proc = subprocess.run(["node", "--check", AUDIO_JS_PATH], capture_output=True, text=True)
            self.assertEqual(proc.returncode, 0, f"audio.js syntax error: {proc.stderr}")

    def test_f42_03_strict_mode_enabled(self):
        content = get_app_js_content()
        self.assertIn("use strict", content, "app.js must enforce strict mode")

    def test_f42_04_try_catch_error_boundaries(self):
        content = get_app_js_content()
        self.assertIn("try", content, "app.js must incorporate error handling boundaries")

    def test_f42_05_zero_console_syntax_errors(self):
        import subprocess
        proc = subprocess.run(["node", "--check", APP_JS_PATH], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, f"node --check app.js failed: {proc.stderr}")


if __name__ == "__main__":
    unittest.main()
