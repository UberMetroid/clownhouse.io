#!/usr/bin/env bash
# ==============================================================================
# clownhouse.io Master E2E Automated Test Runner
#
# Executes test suites across Tier 1 (Feature Coverage F01-F42),
# Tier 2 (Boundary & Corner Cases), Tier 3 (Cross-Feature Pairwise),
# Tier 4 (Real-World Scenarios), and Tier 5 (Adversarial Hardening).
# Enforces Double-Run State Invariance ($Run_1 == Run_2$).
#
# Usage:
#   bash tests/run_tests.sh                # Run all test suites
#   bash tests/run_tests.sh --tier 1       # Run specific tier
#   bash tests/run_tests.sh --audit        # Fast structural & syntax audit
#   bash tests/run_tests.sh --verbose      # Verbose unittest output
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

TARGET_TIER=""
VERBOSE=0
AUDIT_ONLY=0
DOUBLE_RUN=1

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier|-t)
      TARGET_TIER="$2"
      shift 2
      ;;
    --verbose|-v)
      VERBOSE=1
      shift
      ;;
    --audit)
      AUDIT_ONLY=1
      shift
      ;;
    --no-double-run)
      DOUBLE_RUN=0
      shift
      ;;
    --help|-h)
      echo "clownhouse.io E2E Test Suite Runner"
      echo "Usage: $0 [--tier 1|2|3|4|5] [--verbose] [--audit] [--no-double-run]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${BOLD}${CYAN}==============================================================${RESET}"
echo -e "${BOLD}${CYAN}   CLOWNHOUSE.IO // E2E AUTOMATED TEST SUITE RUNNER           ${RESET}"
echo -e "${BOLD}${CYAN}==============================================================${RESET}"
echo -e "Project Root: ${PROJECT_ROOT}"
echo -e "Timestamp:    $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# ------------------------------------------------------------------------------
# 1. Structural Syntax & Audit Check
# ------------------------------------------------------------------------------
echo -e "${BOLD}${BLUE}[1/3] Verifying JavaScript Syntax & Test Suite Integrity...${RESET}"

NODE_SYNTAX_FAIL=0
if node --check app.js >/dev/null 2>&1; then
  echo -e "  [PASS] app.js syntax validation (node --check)"
else
  echo -e "  [FAIL] app.js syntax validation failed"
  NODE_SYNTAX_FAIL=1
fi

if [[ -f "audio.js" ]]; then
  if node --check audio.js >/dev/null 2>&1; then
    echo -e "  [PASS] audio.js syntax validation (node --check)"
  else
    echo -e "  [FAIL] audio.js syntax validation failed"
    NODE_SYNTAX_FAIL=1
  fi
fi

# Verify Python test files compile
python3 -m py_compile tests/test_helpers.py tests/test_tier1_features.py tests/test_tier2_boundary.py tests/test_tier3_pairwise.py tests/test_tier4_scenarios.py tests/test_tier5_adversarial.py >/dev/null 2>&1
PY_COMPILE_STATUS=$?
if [[ ${PY_COMPILE_STATUS} -eq 0 ]]; then
  echo -e "  [PASS] All test suite scripts compiled without syntax errors"
else
  echo -e "  [FAIL] Python compilation error in test scripts"
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
run_single_suite() {
  local tier_num="$1"
  local script_path="$2"
  local tier_name="$3"

  echo ""
  echo -e "${BOLD}${CYAN}--- Running Tier ${tier_num}: ${tier_name} ---${RESET}"

  local verbosity_flag=""
  if [[ ${VERBOSE} -eq 1 ]]; then
    verbosity_flag="-v"
  fi

  local out_file
  out_file=$(mktemp)
  python3 -m unittest "${script_path}" ${verbosity_flag} >"${out_file}" 2>&1
  local exit_code=$?

  if [[ ${VERBOSE} -eq 1 || ${exit_code} -ne 0 ]]; then
    cat "${out_file}"
  else
    # Extract test count summary
    tail -n 2 "${out_file}"
  fi
  rm -f "${out_file}"

  return ${exit_code}
}

execute_all_suites() {
  local total_fails=0

  if [[ -z "${TARGET_TIER}" || "${TARGET_TIER}" == "1" ]]; then
    run_single_suite "1" "tests/test_tier1_features.py" "Feature Coverage (F01-F42)" || total_fails=$((total_fails + 1))
  fi

  if [[ -z "${TARGET_TIER}" || "${TARGET_TIER}" == "2" ]]; then
    run_single_suite "2" "tests/test_tier2_boundary.py" "Boundary & Corner Cases" || total_fails=$((total_fails + 1))
  fi

  if [[ -z "${TARGET_TIER}" || "${TARGET_TIER}" == "3" ]]; then
    run_single_suite "3" "tests/test_tier3_pairwise.py" "Cross-Feature Pairwise Combinations" || total_fails=$((total_fails + 1))
  fi

  if [[ -z "${TARGET_TIER}" || "${TARGET_TIER}" == "4" ]]; then
    run_single_suite "4" "tests/test_tier4_scenarios.py" "Real-World Application Scenarios" || total_fails=$((total_fails + 1))
  fi

  if [[ -z "${TARGET_TIER}" || "${TARGET_TIER}" == "5" ]]; then
    run_single_suite "5" "tests/test_tier5_adversarial.py" "Adversarial Hardening" || total_fails=$((total_fails + 1))
  fi

  return ${total_fails}
}

# ------------------------------------------------------------------------------
# 3. Test Suite Execution (Run 1)
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${BLUE}[2/3] Executing Test Suite (Run 1)...${RESET}"
execute_all_suites
RUN1_STATUS=$?

# ------------------------------------------------------------------------------
# 4. Double-Run Verification (Run 2: Invariance Law)
# ------------------------------------------------------------------------------
RUN2_STATUS=0
if [[ ${DOUBLE_RUN} -eq 1 && ${RUN1_STATUS} -eq 0 ]]; then
  echo ""
  echo -e "${BOLD}${BLUE}[3/3] Enforcing Double-Run Law (\$Run_1 == \$Run_2)...${RESET}"
  execute_all_suites
  RUN2_STATUS=$?
  if [[ ${RUN1_STATUS} -ne ${RUN2_STATUS} ]]; then
    echo -e "${RED}[ERROR] Double-Run Violation: Run 1 status (${RUN1_STATUS}) != Run 2 status (${RUN2_STATUS})${RESET}"
    exit 1
  fi
  echo -e "${GREEN}  [PASS] Double-run state invariance confirmed (${RUN1_STATUS} == ${RUN2_STATUS})${RESET}"
fi

# ------------------------------------------------------------------------------
# Final Report
# ------------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${CYAN}==============================================================${RESET}"
echo -e "${BOLD}${CYAN}   TEST EXECUTION SUMMARY                                     ${RESET}"
echo -e "${BOLD}${CYAN}==============================================================${RESET}"

if [[ ${RUN1_STATUS} -eq 0 && ${NODE_SYNTAX_FAIL} -eq 0 ]]; then
  echo -e "${BOLD}${GREEN}ALL TESTS PASSED WITH EXIT CODE 0${RESET}"
  exit 0
else
  echo -e "${BOLD}${RED}TEST SUITE ENCOUNTERED FAILURES (Exit Code 1)${RESET}"
  echo -e "${YELLOW}Note: Failures reflect pending feature implementations from Milestones M1-M3.${RESET}"
  exit 1
fi
