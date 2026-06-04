#!/usr/bin/env bash
# Human-in-the-loop reproduction loop.
# Copy this file, edit the steps below, and run it.
# The agent runs the script; the human follows prompts in the terminal.
#
# Usage:
#   bash hitl-loop.template.sh
#
# Helpers:
#   step "<instruction>"       shows an instruction and waits for Enter
#   capture VAR "<question>"   captures one answer as VAR=value output

set -euo pipefail

step() {
  printf '\n>>> %s\n' "$1"
  read -r -p "    [Enter when done] " _
}

capture() {
  local var="$1" question="$2" answer
  printf '\n>>> %s\n' "$question"
  read -r -p "    > " answer
  printf -v "$var" '%s' "$answer"
}

# --- edit below ---------------------------------------------------------

step "Open the app and navigate to the screen that fails."

capture REPRODUCED "Did the reported bug reproduce? (y/n)"

capture SYMPTOM "Paste the exact error, wrong output, or visible symptom:"

# --- edit above ---------------------------------------------------------

printf '\n--- Captured ---\n'
printf 'REPRODUCED=%s\n' "$REPRODUCED"
printf 'SYMPTOM=%s\n' "$SYMPTOM"
