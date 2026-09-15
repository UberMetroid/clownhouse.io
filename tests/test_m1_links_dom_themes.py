#!/usr/bin/env python3
"""
Empirical Test Suite: Milestone M1 Link, DOM & Theme Integrity Challenger
Verifies clownhouse.io index.html and style.css:
- External links, protocol integrity, and security attributes (target/rel)
- In-page navigation anchors & DOM ID resolution
- Complete clean slate (zero legacy theme strings/IDs)
- CSS token completeness for all 7 Omarchy themes
- HTML5 / JSON-LD / CSS parsing and structural invariants
- Double-Run Invariance ($Run_1 == Run_2$)

TestCase classes live in the m1dom/ package (256-line cap); unittest.main()
discovers them via the imports below.
"""

import unittest

from m1dom.links import TestM1LinksAndProtocolIntegrity
from m1dom.anchors import TestM1InPageAnchorResolution
from m1dom.clean_slate import TestM1CleanSlateNegativeAssertion
from m1dom.theme_tokens import TestM1CSSThemeEngineTokens
from m1dom.dock_overlay import TestM1StageSelectDockAndChaosOverlay
from m1dom.invariants import TestM1StructuralInvariantsAndAdversarial
from m1dom.mutation_gate import TestM1AntiVacuityMutationGate

__all__ = [
    "TestM1LinksAndProtocolIntegrity",
    "TestM1InPageAnchorResolution",
    "TestM1CleanSlateNegativeAssertion",
    "TestM1CSSThemeEngineTokens",
    "TestM1StageSelectDockAndChaosOverlay",
    "TestM1StructuralInvariantsAndAdversarial",
    "TestM1AntiVacuityMutationGate",
]


if __name__ == "__main__":
    unittest.main(verbosity=2)
