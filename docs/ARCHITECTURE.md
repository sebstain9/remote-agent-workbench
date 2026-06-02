# Architecture

Remote Agent Workbench is a local Express + React application.

## Runtime Surfaces

- Web UI: task entry, repository picker, health status, task history, diff, logs, and result panels
- API server: health, workspace discovery, task creation, task detail, and task diff endpoints
- Orchestrator: one task state machine from queued to done or terminal failure
- Agent adapters: Codex implementation and Claude Code review
- Git boundary: clean-repo check, worktree creation, staging, review diff, verification, and local commit
- Local store: task JSON and logs under `RAW_WORK_ROOT`

## Task State Machine

```text
queued
  -> preparing
  -> codex_running
  -> review_running
  -> testing
  -> committing
  -> done
```

Terminal failure states:

```text
codex_failed
review_failed
test_failed
commit_failed
needs_test_command
```

## Safety Boundary

The app only commits locally after these checks:

1. Target repository starts clean.
2. Codex produces a git diff in an isolated worktree.
3. All changed files are staged for review.
4. Claude Code returns a passing structured review.
5. Verification command is selected and passes.
6. No new unreviewed worktree changes appear after review.

V1 intentionally does not push, deploy, open PRs, edit credentials, or send external messages.

## Storage

Task state is stored under:

```text
~/.remote-agent-workbench
```

Override it with:

```bash
RAW_WORK_ROOT=/path/to/state npm run dev
```

## Extension Points

- Replace `RAW_CODEX_BIN` or `RAW_CLAUDE_BIN` with wrapper commands.
- Add stricter test command policy in `src/server/testCommand.ts`.
- Add new reviewer adapters in `src/server/agents.ts`.
- Add task export or cleanup commands around the local store.
