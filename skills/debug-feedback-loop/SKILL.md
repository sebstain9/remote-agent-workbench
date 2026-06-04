---
name: debug-feedback-loop
description: Debug hard bugs and performance regressions by first building a fast, repeatable feedback loop. Use when an AI agent must reproduce, minimize, hypothesize, instrument, fix, and regression-test instead of guessing.
---

# Debug Feedback Loop

Use this skill when something is broken and guessing would be expensive. The core rule is simple: build a reliable pass/fail loop before trying to fix the bug.

## Core Principle

If you have a fast, deterministic loop that reproduces the user's symptom, debugging becomes evidence-driven. If you do not, the agent is mostly staring at code and guessing.

Spend disproportionate effort on the loop.

## Workflow

### 1. Build The Loop

Create the smallest repeatable trigger that shows the bug:

- failing unit, integration, or end-to-end test
- CLI command with fixture input and expected output
- HTTP request or curl script against a dev server
- browser automation that checks DOM, console, and network behavior
- replayed payload, trace, event log, or sample file
- small harness that calls the real failing code path
- repeated stress loop for flakes or timing bugs
- bisection command when the bug appeared between two known commits

For human-only reproduction, copy and edit `scripts/hitl-loop.template.sh` so the human steps still produce captured evidence.

### 2. Reproduce

Run the loop until it shows the same symptom the user reported. Capture the error, wrong output, timing, screenshot, or log snippet that proves it.

Do not continue if the loop shows a different bug.

### 3. Hypothesize

Write 3 to 5 ranked hypotheses before changing code.

Use falsifiable predictions:

```text
If <cause> is true, then <probe/change> should make <observable signal> change.
```

### 4. Instrument

Probe one hypothesis at a time. Prefer a debugger or focused inspection over broad logging. If adding temporary logs, tag them with a unique prefix and remove them before delivery.

For performance issues, measure first: establish baseline timing, profiles, query plans, or repeated benchmark output before changing code.

### 5. Fix And Lock It Down

When the cause is proven:

1. Add a regression test or durable check at the seam that actually catches the bug.
2. Watch it fail before the fix when practical.
3. Apply the smallest fix.
4. Watch the regression check pass.
5. Re-run the original loop.

If there is no good test seam, state that as a finding and explain the remaining risk.

### 6. Cleanup

Before claiming done:

- original repro no longer reproduces
- regression check passes or missing seam is documented
- temporary debug logs are removed
- throwaway harnesses are deleted or clearly marked
- final explanation names the confirmed cause, not just the patch

## Stop And Ask

Stop when no reliable loop can be built with available access. Report what was tried and ask for one of: logs, a trace, a sample input, a screen recording, access to the failing environment, or permission to add temporary instrumentation.
