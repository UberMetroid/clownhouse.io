#!/usr/bin/env bash
# ==============================================================================
# clownhouse.io Master Automated Test Runner
#
# Executes all test suites across:
#   - Syntax & Structural Integrity (node --check, Python compilation)
#   - M1: Foundation, DOM, Links & 7-Theme Engine (Unit, Mutation & Stress)
#   - M2: Procedural Web Audio Engine & 4 Ambient Modes (Synthesis, EQ, Volume)
#   - M3: Command Palette, Fuzzy Search & Keyboard Navigation
# Enforces Double-Run State Invariance ($Run_1 == Run_2$).
#
# Usage:
#   bash tests/run_tests.sh                # Run all test suites
#   bash tests/run_tests.sh --audit        # Fast structural & syntax audit
#   bash tests/run_tests.sh --no-double-run # Single run only
# ==============================================================================

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

AUDIT_ONLY=0
DOUBLE_RUN=1

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --audit)
      AUDIT_ONLY=1
      shift
      ;;
    --no-double-run)
      DOUBLE_RUN=0
      shift
      ;;
    --help|-h)
      echo "clownhouse.io Automated Test Runner"
      echo "Usage: $0 [--audit] [--no-double-run]"
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

echo -e "${BOLD}${CYAN}==============================================================${RESET}"
echo -e "${BOLD}${CYAN}   CLOWNHOUSE.IO // AUTOMATED TEST SUITE RUNNER               ${RESET}"
echo -e "${BOLD}${CYAN}==============================================================${RESET}"
echo -e "Project Root: ${PROJECT_ROOT}"
echo -e "Timestamp:    $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# ------------------------------------------------------------------------------
# 1. Structural Syntax & Integrity Check
# ------------------------------------------------------------------------------
echo -e "${BOLD}${BLUE}[1/3] Verifying JavaScript & Python Syntax Integrity...${RESET}"

NODE_SYNTAX_FAIL=0
if node --check app.js >/dev/null 2>&1; then
  echo -e "  ${GREEN}[PASS]${RESET} app.js syntax validation (node --check)"
else
  echo -e "  ${RED}[FAIL]${RESET} app.js syntax validation failed"
  NODE_SYNTAX_FAIL=1
fi

if [[ -f "audio.js" ]]; then
  if node --check audio.js >/dev/null 2>&1; then
    echo -e "  ${GREEN}[PASS]${RESET} audio.js syntax validation (node --check)"
  else
    echo -e "  ${RED}[FAIL]${RESET} audio.js syntax validation failed"
    NODE_SYNTAX_FAIL=1
  fi
fi

if python3 -m py_compile tests/test_m1_links_dom_themes.py >/dev/null 2>&1; then
  echo -e "  ${GREEN}[PASS]${RESET} Python test suites compiled without syntax errors"
else
  echo -e "  ${RED}[FAIL]${RESET} Python compilation error in test scripts"
  NODE_SYNTAX_FAIL=1
fi

if [[ ${NODE_SYNTAX_FAIL} -ne 0 ]]; then
  echo -e "${RED}Syntax validation failed. Halting.${RESET}"
  exit 1
fi

if [[ ${AUDIT_ONLY} -eq 1 ]]; then
  echo ""
  echo -e "${BOLD}${GREEN}Audit completed successfully.${RESET}"
  exit 0
fi

# ------------------------------------------------------------------------------
# 2. Execution Function
# ------------------------------------------------------------------------------
execute_all_suites() {
  local fails=0

  echo ""
  echo -e "${BOLD}${CYAN}--- Suite 1: Milestone M1 DOM, Links & Themes (Python) ---${RESET}"
  python3 tests/test_m1_links_dom_themes.py || fails=$((fails + 1))

  echo ""
  echo -e "${BOLD}${CYAN}--- Suite 2: Milestone M1 Theme Engine Stress & CD/ViewTransition (Node) ---${RESET}"
  node tests/challenger_m1_theme_stress.js || fails=$((fails + 1))

  echo ""
  echo -e "${BOLD}${CYAN}--- Suite 2b: Milestone M1 Challenger 2 Invariants & Edge Cases (Node) ---${RESET}"
  node tests/challenger2_m1_edge_cases.js || fails=$((fails + 1))

  echo ""
  echo -e "${BOLD}${CYAN}--- Suite 2c: Milestone M1 Challenger 1 Triple-Tap & Burst Stress (Node) ---${RESET}"
  node tests/challenger_m1_triple_tap_stress.js || fails=$((fails + 1))

  echo ""
  echo -e "${BOLD}${CYAN}--- Suite 3: Milestone M2 Audio Engine & Chrono Trigger Streams (Node) ---${RESET}"
  node tests/test_m2_audio_engine.js || fails=$((fails + 1))

  echo ""
  echo -e "${BOLD}${CYAN}--- Suite 4: Milestone M3 Command Palette & Fuzzy Search (Node) ---${RESET}"
  node tests/test_m3_command_palette.js || fails=$((fails + 1))

  echo ""
  echo -e "${BOLD}${CYAN}--- Suite 5: Milestone M1/R3 Stage Select Dock & Audio Stress (Node) ---${RESET}"
  node tests/challenger_m1_r3_stress.js || fails=$((fails + 1))

  echo ""
  echo -e "${BOLD}${CYAN}--- Suite 6: Milestone M1 Stage Dock Geometry & Collision (Node) ---${RESET}"
  node tests/test_m1_challenger2_stage_dock_collision.js || fails=$((fails + 1))

  echo ""
  echo -e "${BOLD}${CYAN}--- Suite 7: Milestone M2 Chaos Engine Anomaly Suite (Node) ---${RESET}"
  node tests/test_m2_chaos_engine.js || fails=$((fails + 1))

  echo ""
  echo -e "${BOLD}${CYAN}--- Suite 8: Milestone M3 Dual-Trigger Theme Randomizer (Node) ---${RESET}"
  node tests/test_m3_theme_randomizer.js || fails=$((fails + 1))

  return ${fails}
}

# ------------------------------------------------------------------------------
# 3. Test Execution Run 1
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${BLUE}[2/3] Executing All Verification Suites (Run 1)...${RESET}"
execute_all_suites
RUN1_STATUS=$?

# ------------------------------------------------------------------------------
# 4. Double-Run Verification (Run 2: Invariance Law)
# ------------------------------------------------------------------------------
RUN2_STATUS=0
if [[ ${DOUBLE_RUN} -eq 1 && ${RUN1_STATUS} -eq 0 ]]; then
  echo ""
  echo -e "${BOLD}${BLUE}[3/3] Enforcing Double-Run State Invariance Law (\$Run_1 == \$Run_2 = 0)...${RESET}"
  execute_all_suites
  RUN2_STATUS=$?
  if [[ ${RUN1_STATUS} -ne ${RUN2_STATUS} || ${RUN1_STATUS} -ne 0 ]]; then
    echo -e "${RED}[ERROR] Double-Run Violation: Run 1 status (${RUN1_STATUS}) != Run 2 status (${RUN2_STATUS})${RESET}"
    exit 1
  fi
  echo -e "${GREEN}  [PASS] Double-run state invariance confirmed (${RUN1_STATUS} == ${RUN2_STATUS} == 0)${RESET}"
fi

# ------------------------------------------------------------------------------
# Final Report
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${CYAN}==============================================================${RESET}"
echo -e "${BOLD}${CYAN}   TEST EXECUTION SUMMARY                                     ${RESET}"
echo -e "${BOLD}${CYAN}==============================================================${RESET}"

if [[ ${RUN1_STATUS} -eq 0 && ${RUN2_STATUS} -eq 0 ]]; then
  echo -e "${BOLD}${GREEN}ALL TESTS PASSED WITH EXIT CODE 0 (100% SUCCESS)${RESET}"
  exit 0
else
  echo -e "${BOLD}${RED}TEST SUITE ENCOUNTERED FAILURES (Exit Code 1)${RESET}"
  exit 1
fi
