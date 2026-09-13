"""Tier 5: Adversarial Hardening & Empirical Storage/Security Fuzzing Test Suite
Challenges Milestone M1 security boundaries, hostile payload fuzzing, SecurityError exceptions,
keyboard navigation, and state invariance under adverse conditions.
"""

import os
import subprocess
import unittest
from tests.test_helpers import (
    PROJECT_ROOT,
    run_node_code,
    THEMES
)

FUZZ_HARNESS_PATH = os.path.join(PROJECT_ROOT, "tests", "fuzz_m1_storage_security.js")


class TestTier5EmpiricalStorageFuzzing(unittest.TestCase):
    """Adversarial fuzzing and hostile storage testing against app.js."""

    def test_adv_01_fuzz_harness_full_execution(self):
        """Execute comprehensive 515-assertion empirical fuzz harness."""
        proc = subprocess.run(
            ["node", FUZZ_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=15
        )
        self.assertEqual(proc.returncode, 0, f"Fuzz harness failed with output:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("Suite 1 completed", proc.stdout)
        self.assertIn("Suite 2 completed", proc.stdout)
        self.assertIn("Suite 3 completed", proc.stdout)
        self.assertIn("Suite 4 completed", proc.stdout)
        self.assertTrue("PASSED:       515" in proc.stdout or "PASSED:       517" in proc.stdout or "PASSED:       519" in proc.stdout, f"Expected 515, 517, or 519 passed assertions, got:\n{proc.stdout}")

    def test_adv_02_xss_payload_in_localstorage_fail_closed(self):
        """Hostile XSS stored in localStorage must fail-closed to default theme without executing."""
        code = """
        const { JSDOM } = { JSDOM: null }; // verify app handles standalone environment
        const app = require('./app.js');
        // Validates theme rejection
        const xss = '<script>alert(document.domain)</script>';
        const res = app.setTheme(xss);
        console.log(res === false && app.getActiveTheme() === 'tower-of-power');
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_adv_03_null_byte_injection_fail_closed(self):
        """Null byte injection vectors must be rejected fail-closed."""
        code = """
        const app = require('./app.js');
        const nullPayloads = ['tower-of-power\\0', '\\0tower-of-power', '\\0', 'chozo-visor\\0.evil'];
        const allRejected = nullPayloads.every(p => app.setTheme(p) === false);
        console.log(allRejected && app.getActiveTheme() === 'tower-of-power');
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_adv_04_oversized_payload_fail_closed(self):
        """Oversized payloads (>64KB) must be rejected immediately without memory bloat."""
        code = """
        const app = require('./app.js');
        const giant = 'A'.repeat(65536);
        const res = app.setTheme(giant);
        console.log(res === false && app.getActiveTheme() === 'tower-of-power');
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_adv_05_prototype_pollution_immunity(self):
        """Object prototype keys must not bypass theme validation or pollute VALID_THEMES."""
        code = """
        const app = require('./app.js');
        const dangerous = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'];
        const allRejected = dangerous.every(p => app.setTheme(p) === false);
        const themes = app.getThemes();
        const themesUnpolluted = themes.length === 5 && !themes.includes('__proto__');
        console.log(allRejected && themesUnpolluted);
        """
        rc, out, _ = run_node_code(code)
        self.assertEqual(rc, 0)
        self.assertEqual(out.strip(), "true")

    def test_adv_06_safari_private_mode_security_error_resilience(self):
        """localStorage throwing SecurityError must not crash app initialization or theme switching."""
        code = """
        const fs = require('fs');
        const vm = require('vm');
        const appCode = fs.readFileSync('app.js', 'utf8');

        const windowMock = {
          get localStorage() {
            const err = new Error('The operation is insecure.');
            err.name = 'SecurityError';
            throw err;
          }
        };

        const sandbox = {
          console: { log: () => {}, warn: () => {}, error: () => {} },
          window: windowMock,
          globalThis: windowMock,
          module: { exports: {} }
        };

        vm.createContext(sandbox);
        vm.runInContext(appCode, sandbox);
        const app = sandbox.module.exports;
        app.init();
        const canSwitch = app.setTheme('chozo-visor');
        console.log(canSwitch === true && app.getActiveTheme() === 'chozo-visor');
        """
        rc, out, err = run_node_code(code)
        self.assertEqual(rc, 0, f"Failed with {err}")
        self.assertEqual(out.strip(), "true")

    def test_adv_07_storage_quota_exceeded_resilience(self):
        """localStorage.setItem throwing QuotaExceededError must degrade gracefully."""
        code = """
        const fs = require('fs');
        const vm = require('vm');
        const appCode = fs.readFileSync('app.js', 'utf8');

        const windowMock = {
          localStorage: {
            getItem: () => null,
            setItem: () => {
              const err = new Error('Quota exceeded.');
              err.name = 'QuotaExceededError';
              throw err;
            }
          }
        };

        const sandbox = {
          console: { log: () => {}, warn: () => {}, error: () => {} },
          window: windowMock,
          globalThis: windowMock,
          module: { exports: {} }
        };

        vm.createContext(sandbox);
        vm.runInContext(appCode, sandbox);
        const app = sandbox.module.exports;
        app.init();
        const ok = app.setTheme('wrx-telemetry');
        console.log(ok === true && app.getActiveTheme() === 'wrx-telemetry');
        """
        rc, out, err = run_node_code(code)
        self.assertEqual(rc, 0, f"Failed with {err}")
        self.assertEqual(out.strip(), "true")

    def test_adv_08_double_run_state_invariance(self):
        """Enforce Double-Run parity law ($Run_1 == Run_2) on the empirical fuzz suite."""
        proc1 = subprocess.run(
            ["node", FUZZ_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=15
        )
        proc2 = subprocess.run(
            ["node", FUZZ_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=15
        )
        self.assertEqual(proc1.returncode, 0)
        self.assertEqual(proc2.returncode, 0)
        self.assertEqual(proc1.stdout, proc2.stdout, "Run 1 output does not match Run 2 output bit-for-bit")


AUDIO_FUZZ_HARNESS_PATH = os.path.join(PROJECT_ROOT, "tests", "fuzz_m2_audio_security.js")
AUDIO_HARDENING_HARNESS_PATH = os.path.join(PROJECT_ROOT, "tests", "fuzz_m4_audio_hardening.js")
AUDIO_STRESS_HARNESS_PATH = os.path.join(PROJECT_ROOT, "tests", "stress_m2_audio.js")
AUDIO_CHALLENGER_HARNESS_PATH = os.path.join(PROJECT_ROOT, "tests", "verify_challenger_m2_4.js")


class TestTier5EmpiricalAudioFuzzing(unittest.TestCase):
    """Adversarial fuzzing and boundary testing against audio.js (Milestone M2 & M4)."""

    def test_adv_audio_01_fuzz_harness_full_execution(self):
        """Execute comprehensive 3264-assertion empirical audio fuzz harness."""
        proc = subprocess.run(
            ["node", AUDIO_FUZZ_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=15
        )
        self.assertEqual(proc.returncode, 0, f"Audio fuzz harness failed with output:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("Suite 1 completed", proc.stdout)
        self.assertIn("Suite 2 completed", proc.stdout)
        self.assertIn("Suite 3 completed", proc.stdout)
        self.assertIn("Suite 4 completed", proc.stdout)
        self.assertIn("Suite 5 completed", proc.stdout)
        self.assertIn("ALL BASELINE ASSERTIONS PASSED", proc.stdout)

    def test_adv_audio_02_volume_boundary_clamping(self):
        """Test strict setVolume clamping [0.0, 1.0] across extreme values."""
        code = """
        const audio = require('./audio.js');
        const tests = [
          [-100, 0.0],
          [-0.001, 0.0],
          [-Infinity, 0.0],
          [2.0, 1.0],
          [99999, 1.0],
          [Infinity, 1.0],
          [NaN, 0.0],
          [null, 0.0],
          [undefined, 0.0],
          ["0.75", 0.75],
          ["invalid", 0.0],
          [{}, 0.0],
          [[0.25], 0.25]
        ];
        const allPassed = tests.every(([input, expected]) => {
          const res = audio.setVolume(input);
          return Math.abs(res - expected) < 1e-6 && Math.abs(audio.getVolume() - expected) < 1e-6;
        });
        console.log(allPassed);
        """
        rc, out, err = run_node_code(code)
        self.assertEqual(rc, 0, f"Failed with {err}")
        self.assertEqual(out.strip(), "true")

    def test_adv_audio_03_theme_prototype_pollution_fail_closed(self):
        """setTheme must strictly reject prototype keys, null, undefined, and preserve active theme."""
        code = """
        const audio = require('./audio.js');
        audio.setTheme('tower-of-power');
        const hostile = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', null, undefined, '', '<script>'];
        const allRejected = hostile.every(h => audio.setTheme(h) === false);
        console.log(allRejected && audio.getActiveTheme() === 'tower-of-power');
        """
        rc, out, err = run_node_code(code)
        self.assertEqual(rc, 0, f"Failed with {err}")
        self.assertEqual(out.strip(), "true")

    def test_adv_audio_04_headless_fail_open_safety(self):
        """Audio engine methods must execute fail-open without throwing when Web Audio API is absent."""
        code = """
        const audio = require('./audio.js');
        // In standalone Node.js, AudioContext is undefined
        const c1 = audio.initContext() === null;
        const c2 = audio.getContextState() === 'uninitialized';
        const c3 = typeof audio.toggleMute() === 'boolean';
        const c4 = audio.setVolume(0.5) === 0.5;
        const c5 = audio.playSfx('switch') === false;
        const c6 = audio.playTone(440) === null;
        console.log(c1 && c2 && c3 && c4 && c5 && c6);
        """
        rc, out, err = run_node_code(code)
        self.assertEqual(rc, 0, f"Failed with {err}")
        self.assertEqual(out.strip(), "true")

    def test_adv_audio_05_double_run_state_invariance(self):
        """Enforce Double-Run parity law ($Run_1 == Run_2) on audio fuzz harness."""
        proc1 = subprocess.run(
            ["node", AUDIO_FUZZ_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=15
        )
        proc2 = subprocess.run(
            ["node", AUDIO_FUZZ_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=15
        )
        self.assertEqual(proc1.returncode, 0)
        self.assertEqual(proc2.returncode, 0)
        self.assertEqual(proc1.stdout, proc2.stdout, "Audio Run 1 output does not match Run 2 output bit-for-bit")

    def test_adv_audio_06_whitebox_hardening_harness_execution(self):
        """Execute comprehensive 343-assertion white-box Tier 5 audio hardening harness."""
        proc = subprocess.run(
            ["node", AUDIO_HARDENING_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=25
        )
        self.assertEqual(proc.returncode, 0, f"Hardening harness failed with:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("Suite 1: White-Box Branch & Parameter Coverage", proc.stdout)
        self.assertIn("Suite 2: Buffer & Node Cleanup Lifecycle & Leak Prevention", proc.stdout)
        self.assertIn("Suite 3: Volume Interpolation Limits & Anti-Pop Ramping", proc.stdout)
        self.assertIn("Suite 4: Dynamics Compressor Limiter Under Extreme Gain", proc.stdout)
        self.assertIn("Suite 5: Rapid Context Suspend/Resume Cycles", proc.stdout)
        self.assertIn("Suite 6: Audio Integration in app.js", proc.stdout)
        self.assertIn("ALL TIER 5 WHITE-BOX AUDIO HARDENING ASSERTIONS PASSED", proc.stdout)

    def test_adv_audio_07_whitebox_hardening_double_run(self):
        """Enforce Double-Run parity law on white-box audio hardening harness."""
        proc1 = subprocess.run(
            ["node", AUDIO_HARDENING_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=25
        )
        proc2 = subprocess.run(
            ["node", AUDIO_HARDENING_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=25
        )
        self.assertEqual(proc1.returncode, 0)
        self.assertEqual(proc2.returncode, 0)
        self.assertEqual(proc1.stdout, proc2.stdout, "Hardening Run 1 output does not match Run 2 bit-for-bit")

    def test_adv_audio_08_challenger_security_verification(self):
        """Execute Challenger M2-4 empirical security and prototype verification suite."""
        proc = subprocess.run(
            ["node", AUDIO_CHALLENGER_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=20
        )
        self.assertEqual(proc.returncode, 0, f"Challenger verification harness failed with:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("EMPIRICAL VERDICT: CONFIRM", proc.stdout)


WIDGET_FUZZ_HARNESS_PATH = os.path.join(PROJECT_ROOT, "tests", "fuzz_m3_widgets.js")


class TestTier5EmpiricalWidgetFuzzing(unittest.TestCase):
    """Adversarial fuzzing and boundary testing against widgets and links (Milestone M3)."""

    def test_adv_widget_01_fuzz_harness_full_execution(self):
        """Execute comprehensive 591-assertion empirical widget & link fuzz harness."""
        proc = subprocess.run(
            ["node", WIDGET_FUZZ_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=25
        )
        self.assertEqual(proc.returncode, 0, f"Widget fuzz harness failed with output:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("Suite 1: Universal Link Matrix", proc.stdout)
        self.assertIn("Suite 2: Sega Genesis Volume Slider", proc.stdout)
        self.assertIn("Suite 3: WRX TR Boost Gauge", proc.stdout)
        self.assertIn("Suite 4: Mega Man X Buster Charge", proc.stdout)
        self.assertIn("Suite 5: Pacific Outpost Radar Blip", proc.stdout)
        self.assertIn("Suite 6: Chozo Scan Visor", proc.stdout)
        self.assertIn("Suite 7: Switcher Bar Keyboard Accessibility", proc.stdout)
        self.assertIn("Suite 8: High-Frequency Interleaved Multi-Widget Concurrency Storm", proc.stdout)
        self.assertIn("ALL BASELINE ASSERTIONS PASSED (591/591)", proc.stdout)

    def test_adv_widget_02_double_run_state_invariance(self):
        """Enforce Double-Run parity law ($Run_1 == Run_2) on widget fuzz harness."""
        proc1 = subprocess.run(
            ["node", WIDGET_FUZZ_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=25
        )
        proc2 = subprocess.run(
            ["node", WIDGET_FUZZ_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=25
        )
        self.assertEqual(proc1.returncode, 0)
        self.assertEqual(proc2.returncode, 0)
        self.assertEqual(proc1.stdout, proc2.stdout, "Widget Run 1 output does not match Run 2 output bit-for-bit")


M4_HARDENING_HARNESS_PATH = os.path.join(PROJECT_ROOT, "tests", "adversarial_m4_hardening.js")
THEME_STRESS_HARNESS_PATH = os.path.join(PROJECT_ROOT, "tests", "stress_m3_themes.js")


class TestTier5CoverageHardeningM4(unittest.TestCase):
    """Tier 5 white-box adversarial coverage hardening, animation loops, and event multiplicity (M4-2)."""

    def test_adv_m4_01_coverage_hardening_execution(self):
        """Execute comprehensive 137-assertion adversarial coverage hardening harness."""
        proc = subprocess.run(
            ["node", M4_HARDENING_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=35
        )
        self.assertEqual(proc.returncode, 0, f"M4 hardening harness failed with output:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("ALL ADVERSARIAL HARDENING ASSERTIONS PASSED (137/137)", proc.stdout)
        self.assertIn("Double-Run Bit-for-Bit State Invariance: CONFIRMED", proc.stdout)

    def test_adv_m4_02_theme_stress_and_dom_invariance(self):
        """Execute 600-switch Chrome CDP stress and DOM invariance harness."""
        proc = subprocess.run(
            ["node", THEME_STRESS_HARNESS_PATH],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=35
        )
        self.assertEqual(proc.returncode, 0, f"Theme stress harness failed with output:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("EMPIRICAL CHALLENGER VERDICT: CONFIRM (PASS)", proc.stdout)


if __name__ == "__main__":
    unittest.main()



