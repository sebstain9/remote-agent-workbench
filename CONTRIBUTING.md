# Contributing

Remote Agent Workbench is intentionally small and safety-first.

## Local Checks

```bash
npm install
npm run verify
```

## Development Principles

- Keep task execution local-first.
- Preserve the clean-repo and isolated-worktree boundary.
- Do not add push, deploy, or PR creation without a separate approval gate.
- Prefer explicit failure states over silent fallback behavior.
- Add or update tests when changing the orchestration state machine.

## Useful Test Areas

- task creation validation
- dirty repository detection
- worktree and branch naming
- Codex failure handling
- Claude review parsing
- unsafe verification command blocking
- post-review unreviewed-change detection
