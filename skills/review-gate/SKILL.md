---
name: review-gate
description: Audit code changes, setup steps, plans, prompts, runbooks, or generated artifacts before delivery. Use when an AI agent should find concrete risks, missing validation, unsafe assumptions, regressions, and release blockers before saying work is done.
---

# Review Gate

Use this skill as a skeptical pre-delivery audit. The job is to prove whether the work is safe to accept, not to make the output sound finished.

## When To Use

Use `review-gate` before:

- merging or committing generated code
- running a setup or deployment runbook
- accepting a plan, prompt, spec, or document
- handing a result back to a user as "done"

Pair it naturally with `safe-agent-worktree`: isolate the work first, then review the diff before verification and delivery.

## Core Workflow

1. Identify the review target: code diff, config, commands, plan, prompt, document, or artifact.
2. Restate the intended outcome and what must be true for the result to be acceptable.
3. Gather evidence from files, diffs, logs, commands, screenshots, or generated output before judging.
4. Review by failure mode: correctness, requirement mismatch, missing validation, operational risk, security, rollback, maintainability, and user-visible regressions.
5. Report findings first, ordered by severity.
6. Decide one of: `pass`, `revise`, or `hold`.

## Output Contract

Use this structure:

```md
## Findings

- [P1/P2/P3] Title
  Evidence:
  Impact:
  Minimum fix:

## Verification Checked

- ...

## Residual Risk

- ...

## Decision

pass / revise / hold
```

If there are no important findings, say that clearly and still list what remains unverified.

## Severity

- `P1`: can cause data loss, security exposure, failed release, broken core behavior, or misleading delivery.
- `P2`: likely bug, missing required behavior, brittle setup, or important unverified path.
- `P3`: useful improvement, maintainability issue, or lower-risk gap.

## Rules

- Findings must be concrete. Prefer file paths, commands, logs, screenshots, or exact observed behavior.
- Do not bury blockers under a summary.
- Distinguish observed facts from inferred risk.
- Do not request broad rewrites when a small fix addresses the failure.
- Do not pass a review only because tests ran; compare the result to the intended behavior.

## Reference

For target-specific prompts, read `references/checklists.md` only when useful.
