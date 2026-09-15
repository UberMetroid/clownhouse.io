"""M1 verification module — see tests/test_m1_links_dom_themes.py."""

import unittest

from m1dom._common import *  # noqa: F401,F403


class TestM1CSSThemeEngineTokens(unittest.TestCase):
    """Verifies CSS definitions and token completeness for all 7 Omarchy themes."""

    EXPECTED_THEMES = [
        "tokyo-night",
        "catppuccin",
        "gruvbox",
        "nord",
        "rose-pine",
        "ethereal",
        "vantablack"
    ]

    MANDATORY_PROPERTIES = [
        "--bg-primary",
        "--accent",
        "--border",
        "--text-primary"
    ]

    HEX_COLOR_REGEX = re.compile(r"^#(?:[0-9a-fA-F]{3}){1,2}$")

    @classmethod
    def setUpClass(cls):
        cls.css_content = load_css()

        # Parse [data-theme="..."] rules
        theme_pattern = re.compile(r"\[data-theme=[\"\x27]?([a-zA-Z0-9_-]+)[\"\x27]?\]\s*\{([^}]+)\}", re.MULTILINE)
        matches = theme_pattern.findall(cls.css_content)

        cls.themes = {}
        for theme_name, block in matches:
            props = {}
            for line in block.split(";"):
                line = line.strip()
                if ":" in line:
                    k, v = line.split(":", 1)
                    props[k.strip()] = v.strip()
            cls.themes[theme_name] = props

    def test_all_7_themes_defined_in_css(self):
        """Assert all 7 Omarchy themes are defined via [data-theme='...'] in style.css."""
        for theme_name in self.EXPECTED_THEMES:
            self.assertIn(
                theme_name,
                self.themes,
                f"Theme '{theme_name}' is missing from style.css"
            )

    def test_mandatory_css_properties_defined(self):
        """Assert all 7 themes define --bg-primary, --accent, --border, and --text-primary."""
        for theme_name in self.EXPECTED_THEMES:
            props = self.themes.get(theme_name, {})
            for prop in self.MANDATORY_PROPERTIES:
                self.assertIn(
                    prop,
                    props,
                    f"Theme '{theme_name}' is missing mandatory CSS token '{prop}'"
                )
                val = props[prop]
                self.assertTrue(
                    self.HEX_COLOR_REGEX.match(val),
                    f"Theme '{theme_name}' property '{prop}' value '{val}' is not a valid hex color code"
                )

    def test_extended_theme_token_completeness(self):
        """Assert all 7 themes define complete 14-token design system palette."""
        extended_tokens = [
            "--bg-primary", "--bg-secondary", "--bg-surface", "--bg-surface-2",
            "--text-primary", "--text-secondary", "--text-muted",
            "--accent", "--accent-ink", "--border", "--border-hover",
            "--selection-bg", "--field-bg", "color-scheme"
        ]
        for theme_name in self.EXPECTED_THEMES:
            props = self.themes.get(theme_name, {})
            for token in extended_tokens:
                self.assertIn(
                    token,
                    props,
                    f"Theme '{theme_name}' missing extended token '{token}'"
                )

    def test_color_scheme_invariance(self):
        """Assert rose-pine specifies light color-scheme while other 6 themes specify dark."""
        for theme_name in self.EXPECTED_THEMES:
            props = self.themes[theme_name]
            expected_scheme = "light" if theme_name == "rose-pine" else "dark"
            self.assertEqual(
                props.get("color-scheme"),
                expected_scheme,
                f"Theme '{theme_name}' should have color-scheme '{expected_scheme}'"
            )

    def test_root_default_tokens_match_tokyo_night(self):
        """Assert :root block defines default variables matching tokyo-night."""
        # Strip comments first
        clean_css = re.sub(r"/\*.*?\*/", "", self.css_content, flags=re.DOTALL)
        root_pattern = re.compile(r":root\s*\{([^}]+)\}", re.MULTILINE)
        match = root_pattern.search(clean_css)
        self.assertIsNotNone(match, ":root selector not found in style.css")
        root_block = match.group(1)

        root_props = {}
        for line in root_block.split(";"):
            line = line.strip()
            if ":" in line:
                k, v = line.split(":", 1)
                root_props[k.strip()] = v.strip()

        for prop in self.MANDATORY_PROPERTIES:
            self.assertIn(prop, root_props, f":root missing default property '{prop}'")
            tokyo_night_val = self.themes["tokyo-night"][prop]
            self.assertEqual(
                root_props[prop],
                tokyo_night_val,
                f":root default for '{prop}' ({root_props[prop]}) does not match tokyo-night ({tokyo_night_val})"
            )


