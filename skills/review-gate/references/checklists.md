# Review Checklists

Use only the sections relevant to the current review target.

## Code Diff

- Does the change satisfy the actual requirement, not just compile?
- Can it break existing paths, default behavior, or edge cases?
- Are empty inputs, partial failures, permissions, and retries handled where relevant?
- Is there a regression test or other objective proof for the changed behavior?
- Are file and line references needed to make the finding actionable?

## Configuration

- Does the config override something important from the current environment?
- Are there duplicated keys, stale values, private paths, or machine-specific assumptions?
- Are secrets, endpoints, auth modes, ports, and trust settings handled safely?
- Will the runtime actually discover this config?
- Can the setup be rerun without corrupting state?

## Setup Or Installation

- Are prerequisites explicit: platform, account state, auth mode, runtime version, package manager, and permissions?
- Is the order correct: install, configure, verify, then optional enhancements?
- Are commands idempotent and easy to verify?
- Is there a recovery path if setup partially succeeds?

## Deployment Or Runbook

- Is there a preflight check?
- Is there an objective success signal after each critical step?
- Is rollback defined and realistic?
- Are risky commands clearly marked and separately approved?
- Are environment-specific assumptions spelled out?

## Prompt, Plan, Or Workflow

- Is the goal precise and measurable?
- Are constraints and stop conditions explicit?
- Are dependencies and approvals clear?
- Is there a definition of done?
- Can another agent follow it without hidden context?

## Final Delivery Gate

- What exactly changed?
- What was verified objectively?
- What remains unverified?
- What can fail next in real usage?
- What is the smallest next action to reduce that risk?
