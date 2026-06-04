---
name: safe-agent-worktree
description: Run AI coding tasks in an isolated git worktree before touching the main checkout. Use when the user asks Codex or another AI coding agent to edit a repository safely, keep the main branch clean, create a disposable implementation branch, review the diff, run verification, or prevent unreviewed files from being committed after tests.
---

# Safe Agent Worktree

## Overview

Use this skill to make AI coding changes without dirtying the user's main checkout. It creates a clean git worktree, keeps implementation work isolated, and verifies that tests did not create new unreviewed changes.

This is the small downloadable skill version of Remote Agent Workbench: useful even when the full local web app is not installed.

## Workflow

### 1. Start From A Clean Repo

From the target repository, run:

```bash
node <skill-dir>/scripts/safe-agent-worktree.mjs start --title "short task title"
```

Use `--repo <path>` when starting outside the repository. The script refuses to continue if the target repo has uncommitted changes.

The command prints:

- source repository path
- new branch name
- worktree path
- next `cd` command

Move all coding work into the printed worktree path.

### 2. Implement Only In The Worktree

Before editing, confirm:

```bash
git status --short
```

The source checkout should remain untouched. If the user asks for risky operations, deployment, credential changes, or destructive git commands, stop and ask.

### 3. Review The Diff Before Verification

When the implementation is ready:

```bash
git add -A
git diff --cached --stat
git diff --cached
```

Use a review skill or a separate reviewer when available. Do not run verification until the staged diff has been reviewed, because verification can generate files that must not be silently included.

### 4. Verify Without Accepting New Files

Run:

```bash
node <skill-dir>/scripts/safe-agent-worktree.mjs verify --worktree <path> --command "npm test"
```

The verifier:

- requires a staged reviewed diff
- blocks deploy-like commands
- runs the verification command
- fails if verification creates new unstaged or untracked files
- prints the staged diff stat when the worktree is safe to commit

### 5. Commit Locally Only After Approval

This skill does not push, publish, deploy, or create a pull request. If the user wants a commit, create it locally only after review and verification pass:

```bash
git commit -m "Short task summary"
```

## Safety Rules

- Never start from a dirty target repo.
- Never edit the source checkout after creating the worktree.
- Never run `git push`, deploy, publish, or credential-changing commands as verification.
- Treat files created after review as unreviewed until they are inspected and staged intentionally.
- If verification fails, fix inside the worktree and re-run the verifier.

## Useful Commands

```bash
# Create an isolated worktree from the current repo
node <skill-dir>/scripts/safe-agent-worktree.mjs start --title "fix login redirect"

# Create from another repo
node <skill-dir>/scripts/safe-agent-worktree.mjs start --repo ~/projects/app --title "add CSV import"

# Check status
node <skill-dir>/scripts/safe-agent-worktree.mjs status --worktree ~/.remote-agent-workbench/skill-worktrees/...

# Verify
node <skill-dir>/scripts/safe-agent-worktree.mjs verify --worktree <path> --command "npm run verify"
```

## Stop Conditions

Stop and ask the user before:

- destructive git operations
- deleting user data
- changing secrets or auth
- deployment, external publication, or paid API use
- continuing when the repo is dirty and the user has not approved stashing or cleanup
