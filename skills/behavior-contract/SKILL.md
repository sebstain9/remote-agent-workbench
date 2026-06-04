---
name: behavior-contract
description: Turn a vague coding or product request into a small behavior contract before implementation. Use when an AI agent needs clear goals, non-goals, scenarios, acceptance criteria, and verification steps before changing code.
---

# Behavior Contract

Use this skill before non-trivial implementation. The goal is not heavy process; the goal is to prevent the agent from building the wrong thing.

## When To Use

Use `behavior-contract` when the request includes:

- vague requirements such as "improve", "fix", "make it smarter", or "add support"
- feature work with edge cases, permissions, data changes, files, payments, publishing, or migration
- bug fixes where the expected behavior is not yet crisp
- work that will later pass through `review-gate` or `safe-agent-worktree`

For tiny mechanical edits, apply it lightly.

## Contract Template

Write a compact contract:

```md
## Behavior Contract

### Goal
One sentence describing the user-visible result.

### Non-goals
- What this change will not do.

### Actors / Inputs / Outputs
- Actor:
- Inputs:
- Outputs:

### Scenarios

Scenario 1: happy path
Given ...
When ...
Then ...

Scenario 2: important edge case
Given ...
When ...
Then ...

Scenario 3: failure or safety case
Given ...
When ...
Then ...

### Acceptance Criteria
- [ ] Observable pass/fail condition 1
- [ ] Observable pass/fail condition 2
- [ ] Observable pass/fail condition 3

### Verification Plan
- Tests, commands, screenshots, logs, sample files, database checks, or manual flow.

### Assumptions
- Assumptions the agent will proceed with unless the user corrects them.
```

## Workflow

1. Restate the request as behavior, not implementation.
2. Find ambiguity around actor, input source, output, old behavior, edge cases, and failure modes.
3. Ask only blocking questions. If a reasonable default is safe, state it as an assumption and continue.
4. Write at least one happy path and one important edge case. Add a safety scenario for destructive, public, paid, credentialed, or data-changing work.
5. Turn scenarios into objective verification.
6. Implement only the behavior covered by the contract.
7. Before delivery, compare the result to the acceptance criteria.

## Stop And Ask

Stop before implementation when:

- the same request has multiple incompatible meanings
- the change can delete, overwrite, migrate, publish, charge money, or message people
- success cannot be objectively checked
- the tradeoff between speed, accuracy, cost, compatibility, and safety is material

## Good Contract Style

- Use the user's domain words.
- Keep each scenario focused.
- Make every `Then` observable.
- Avoid "the system works correctly" as an acceptance criterion.
- Keep the contract short enough to guide implementation, not replace it.
