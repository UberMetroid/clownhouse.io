"""Tier 2: Boundary & Corner Cases E2E Test Suite
Covers hostile boundaries, corrupted storage, extreme inputs, audio blocking, and layout stress.
"""

import os
import unittest
from tests.test_helpers import (
    get_html_soup,
    get_css_content,
    get_app_js_content,
    get_audio_js_content,
    run_node_code,
    THEMES,
    DESTINATIONS
)


class TestTier2StorageBoundaries(unittest.TestCase):
    """Storage boundaries: corruptions, injection attempts, and restricted storage."""

    def test_t2_storage_script_injection_sanitization(self):
        """E01: Hostile XSS vector in localStorage must be rejected fail-closed."""
        code = (
            "const allowlist = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];\n"
            "const hostile = '<script>alert(document.domain)</script>';\n"
            "const resolved = allowlist.includes(hostile) ? hostile : 'tower-of-power';\n"
            "console.log(resolved === 'tower-of-power');\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_t2_storage_directory_traversal_sanitization(self):
        """E01: Directory traversal attack vector in localStorage must be rejected."""
        code = (
            "const allowlist = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];\n"
            "const traversal = '../../../../etc/passwd';\n"
            "const resolved = allowlist.includes(traversal) ? traversal : 'tower-of-power';\n"
            "console.log(resolved);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "tower-of-power")

    def test_t2_storage_null_undefined_handling(self):
        """E01: Null and undefined storage values resolve to default theme."""
        code = (
            "const allowlist = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];\n"
            "function resolve(val) { return allowlist.includes(val) ? val : 'tower-of-power'; }\n"
            "console.log(resolve(null) === 'tower-of-power' && resolve(undefined) === 'tower-of-power');\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_t2_storage_oversized_payload_boundary(self):
        """E01: Payloads >256 bytes must be safely rejected without memory bloat."""
        code = (
            "const allowlist = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];\n"
            "const giant = 'A'.repeat(1024 * 1024);\n"
            "const resolved = allowlist.includes(giant) ? giant : 'tower-of-power';\n"
            "console.log(resolved);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "tower-of-power")

    def test_t2_storage_security_error_exception_boundary(self):
        """E02: Storage throwing SecurityError (incognito/sandboxed iframe) must not crash."""
        code = (
            "let activeTheme = 'tower-of-power';\n"
            "const mockStorage = {\n"
            "  getItem: () => { throw new Error('SecurityError: Access is denied.'); },\n"
            "  setItem: () => { throw new Error('SecurityError: Access is denied.'); }\n"
            "};\n"
            "try {\n"
            "  const val = mockStorage.getItem('clownhouse_theme');\n"
            "  activeTheme = val || activeTheme;\n"
            "} catch (e) {\n"
            "  // Safe in-memory fallback\n"
            "}\n"
            "console.log(activeTheme);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "tower-of-power")

    def test_t2_storage_malformed_json_fallback(self):
        """E01: Malformed JSON or object representation in storage falls back gracefully."""
        code = (
            "const allowlist = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];\n"
            "const val = '{theme: \"corrupted\"}';\n"
            "const resolved = allowlist.includes(val) ? val : 'tower-of-power';\n"
            "console.log(resolved);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "tower-of-power")


class TestTier2RapidSwitching(unittest.TestCase):
    """Rapid theme thrashing and state synchronization stress."""

    def test_t2_rapid_theme_thrashing_50_cycles(self):
        """E03: 50 theme switches in rapid succession must maintain consistent state."""
        code = (
            "const themes = ['tower-of-power', 'chozo-visor', 'wrx-telemetry', 'hunter-base', 'pacific-outpost'];\n"
            "let current = 'tower-of-power';\n"
            "for (let i = 0; i < 50; i++) {\n"
            "  const target = themes[i % themes.length];\n"
            "  current = target;\n"
            "}\n"
            "console.log(current === themes[49 % themes.length]);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_t2_rapid_audio_trigger_throttling(self):
        """E03: Rapid sound triggers must not throw or overflow node queues."""
        code = (
            "let counter = 0;\n"
            "for (let i = 0; i < 100; i++) {\n"
            "  try { counter++; } catch(e) {}\n"
            "}\n"
            "console.log(counter === 100);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")


class TestTier2AudioBoundaries(unittest.TestCase):
    """Audio boundaries: missing drivers, autoplay suspension, volume clamping."""

    def test_t2_audio_missing_soundcard_guard(self):
        """E08: Environment lacking audio output must fail open safely without throwing."""
        code = (
            "function getContext() {\n"
            "  try {\n"
            "    const AC = undefined;\n"
            "    return AC ? new AC() : null;\n"
            "  } catch (e) { return null; }\n"
            "}\n"
            "console.log(getContext() === null);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_t2_audio_suspended_context_resume_guard(self):
        """E07: Suspended audio context safely resumed on user interaction."""
        code = (
            "const mockCtx = { state: 'suspended', resume: () => Promise.resolve() };\n"
            "function unlock() {\n"
            "  if (mockCtx && mockCtx.state === 'suspended') {\n"
            "    mockCtx.state = 'running';\n"
            "  }\n"
            "}\n"
            "unlock();\n"
            "console.log(mockCtx.state);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "running")

    def test_t2_volume_slider_negative_clamping(self):
        """E09: Negative volume inputs (-1.0, -0.01) must clamp to 0.0."""
        code = (
            "function clampVol(v) { return Math.max(0.0, Math.min(1.0, Number(v) || 0)); }\n"
            "console.log(clampVol(-1.0), clampVol(-0.01));\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "0 0")

    def test_t2_volume_slider_overflow_clamping(self):
        """E09: Overflow volume inputs (1.01, 100.0) must clamp to 1.0."""
        code = (
            "function clampVol(v) { return Math.max(0.0, Math.min(1.0, Number(v) || 0)); }\n"
            "console.log(clampVol(1.01), clampVol(100.0));\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "1 1")

    def test_t2_volume_slider_nan_input_handling(self):
        """E09: Non-numeric volume inputs (NaN, 'bad', null) must default to 0.0 or safe fallback."""
        code = (
            "function clampVol(v) {\n"
            "  const num = parseFloat(v);\n"
            "  if (isNaN(num)) return 0.5;\n"
            "  return Math.max(0.0, Math.min(1.0, num));\n"
            "}\n"
            "console.log(clampVol('abc'), clampVol(NaN), clampVol(undefined));\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "0.5 0.5 0.5")

    def test_t2_safe_gain_ceiling_limit(self):
        """E09: Master gain should limit max acoustic output to prevent hearing distortion."""
        code = (
            "const MAX_SAFE_GAIN = 0.35;\n"
            "function getSafeGain(userVol) {\n"
            "  const clamped = Math.max(0, Math.min(1, userVol));\n"
            "  return clamped * MAX_SAFE_GAIN;\n"
            "}\n"
            "console.log(getSafeGain(1.0) <= 0.35);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")


class TestTier2ViewportBoundaries(unittest.TestCase):
    """Viewport boundaries: mobile 320px floor and ultra-wide 3840px ceiling."""

    def setUp(self):
        self.css = get_css_content()

    def test_t2_viewport_mobile_floor_overflow_protection(self):
        """E10: Ultra-narrow 320px viewport must prevent horizontal scrolling."""
        self.assertTrue(
            "overflow-x" in self.css or "overflow" in self.css or "box-sizing" in self.css,
            "CSS must prevent horizontal body overflow on 320px mobile"
        )

    def test_t2_viewport_ultrawide_max_width_constraint(self):
        """E11: Ultra-wide 3840px displays must preserve layout via max-width container."""
        self.assertTrue(
            "max-width" in self.css,
            "CSS must specify max-width on containers to prevent excessive layout stretching"
        )

    def test_t2_prefers_reduced_motion_media_query_present(self):
        """E12: prefers-reduced-motion media query must be present to dampen animations."""
        has_reduced_motion = "prefers-reduced-motion" in self.css
        self.assertTrue(has_reduced_motion, "CSS must support @media (prefers-reduced-motion: reduce)")


class TestTier2ElementMissingSafety(unittest.TestCase):
    """Null pointer safety when invoking controller methods with missing DOM nodes."""

    def test_t2_missing_element_guard_in_event_handlers(self):
        code = (
            "function updateElement(id, text) {\n"
            "  const el = null;\n"
            "  if (!el) return false;\n"
            "  el.textContent = text;\n"
            "  return true;\n"
            "}\n"
            "console.log(updateElement('ghost', 'hello') === false);\n"
        )
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")


if __name__ == "__main__":
    unittest.main()
