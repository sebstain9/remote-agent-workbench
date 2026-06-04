# Remote Agent Workbench

Remote Agent Workbench is a local-first safety kit for AI coding tasks.

Start small with the downloadable **Safe Agent Worktree** Codex skill. It gives any coding agent one reliable habit: create an isolated git worktree, keep the main checkout clean, review the diff, run verification, and block unreviewed files created after tests.

Use the full Workbench app when you want a local web control surface around the same loop: Codex implements, Claude Code reviews, verification runs, and only then a local commit is created.

## Start With The Skill

Install the skill from this repository:

```bash
git clone https://github.com/sebstain9/remote-agent-workbench.git
mkdir -p ~/.codex/skills
cp -R remote-agent-workbench/skills/safe-agent-worktree ~/.codex/skills/
```

Then ask Codex:

```text
Use $safe-agent-worktree to make this change in an isolated git worktree, review the diff, run npm test, and leave my main checkout untouched.
```

You can also run the bundled helper directly:

```bash
node ~/.codex/skills/safe-agent-worktree/scripts/safe-agent-worktree.mjs start --title "fix login redirect"
```

The skill is intentionally small: Node.js + Git, no server, no account, no cloud queue.

## Full Workbench App

Run the local web workbench directly from GitHub:

```bash
npx github:sebstain9/remote-agent-workbench
```

Then open the printed local URL, usually:

```text
http://localhost:5177
```

Click **Try demo** first if Codex or Claude Code is not installed yet.

## Demo

![Remote Agent Workbench demo](docs/demo/remote-agent-workbench-demo.gif)

## Desktop

![Remote Agent Workbench desktop screenshot](docs/screenshots/desktop.png)

## Why

AI coding agents are useful, but the safest loop is not "ask an agent and hope." A better loop is:

1. Start from a clean repository.
2. Create an isolated worktree.
3. Let the coding agent make the smallest useful change.
4. Review the diff before running post-review checks.
5. Run verification.
6. Block commits when new unreviewed files appear after review.
7. Commit locally only after every gate passes.

Remote Agent Workbench turns that loop into a small local web app.

## What It Does

- ships a downloadable Codex skill for safe worktree-based AI coding tasks
- starts from `npx` without cloning the repository
- lets new users load a complete demo run before installing every agent CLI
- checks local setup with a built-in Setup Doctor
- discovers nearby git repositories and marks dirty repos
- rejects dirty target repositories before starting
- creates a temporary branch and git worktree per task
- runs Codex inside the isolated worktree
- stages the generated diff for review
- asks Claude Code for a structured pass/fail review
- blocks deploy-like or unsafe verification commands
- runs the selected verification command
- blocks commits if verification creates new unreviewed changes
- stores task state, logs, summaries, diffs, and commit hashes locally

## What It Does Not Do

- no git push
- no pull request creation
- no deployment
- no cloud queue
- no team account
- no hidden credential changes
- no automatic execution outside the selected worktree

V1 is intentionally local-first and conservative.

## Requirements

The Safe Agent Worktree skill needs:

- Node.js
- Git
- a git repository with a clean working tree

Demo Mode for the full app only needs Node.js 22+.

Real runs need:

- macOS, Linux, or another Unix-like development machine
- Node.js 22+
- Git
- Codex CLI available as `codex`
- Claude Code CLI available as `claude`

The app still loads without Codex or Claude installed, but the health chips will show missing tools and real task execution will not pass.

## Quick Start

Run the full app directly from GitHub:

```bash
npx github:sebstain9/remote-agent-workbench
```

Then open the printed local URL, usually:

```text
http://localhost:5177
```

Click **Try demo** first if Codex or Claude Code is not installed yet.

Local development:

```bash
npm install
npm run dev
```

Production-style run after cloning:

```bash
npm run build
npm start
```

The package also exposes a full-app CLI entrypoint for npm publishing:

```bash
npx remote-agent-workbench
```

That command works once the package name is published to npm.

## Setup Doctor

The app checks the tools needed for real runs:

- Node.js 22+
- Git
- Codex CLI
- Claude Code CLI

Missing tools are shown in the UI with install commands. Demo Mode still works without Codex or Claude Code, so new users can inspect the workflow before completing setup.

## Verification

```bash
npm run verify
```

`verify` runs:

- TypeScript typecheck
- Vitest unit/integration tests
- public safety scan
- production build

## Configuration

Environment variables:

```bash
RAW_PORT=5177
RAW_HOST=127.0.0.1
RAW_WORK_ROOT=~/.remote-agent-workbench
RAW_GIT_BIN=git
RAW_CODEX_BIN=codex
RAW_CLAUDE_BIN=claude
RAW_TASK_TIMEOUT_MS=600000
RAW_WORKSPACE_ROOTS=~/projects,~/work
```

Use `RAW_WORKSPACE_ROOTS` to narrow repository discovery. Task creation still performs strict git validation.

## Core Safety Gates

The test suite covers the important failure modes:

- dirty target repositories are rejected
- missing test commands stop before commit
- failed Claude review stops before verification and commit
- failed verification stops before commit
- unsafe commands such as `git push` are blocked as verification commands
- generated files created after review are treated as unreviewed and block commit

## Mobile

The UI is responsive enough for quick status checks on a phone, while the main task entry flow is designed for a local workstation.

![Remote Agent Workbench mobile screenshot](docs/screenshots/mobile.png)

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Roadmap

- optional browser-recorded proof for UI tasks
- stronger review schema and retry policy
- configurable reviewer model/CLI adapter
- task export as Markdown
- explicit cleanup command for old worktrees
- optional PR creation only after a separate approval gate

## License

MIT
