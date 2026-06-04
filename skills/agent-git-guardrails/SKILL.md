---
name: agent-git-guardrails
description: Install a local guardrail hook that blocks dangerous git commands from AI coding agents before they execute. Use when a user wants to prevent accidental git push, hard reset, forced cleanup, branch deletion, or whole-tree restore during agent runs.
---

# Agent Git Guardrails

Use this skill to add a small local command filter around AI coding agents. It blocks dangerous git commands before they run.

This is a guardrail, not a permission system. It reduces accidental damage from agent commands, but humans should still review diffs and use `safe-agent-worktree` for risky changes.

## What It Blocks

The bundled script blocks command strings matching:

- `git push`
- `git reset --hard`
- `git clean -f` or `git clean -fd`
- `git branch -D`
- `git checkout .`
- `git restore .`
- obviously destructive `rm -rf /`, `rm -rf ~`, or `rm -rf $HOME`

You can edit the pattern list in `scripts/block-dangerous-git.mjs` for stricter or looser local policy.

## Install For Claude Code

Project-local install:

```bash
mkdir -p .claude/hooks
cp ~/.codex/skills/agent-git-guardrails/scripts/block-dangerous-git.mjs .claude/hooks/block-dangerous-git.mjs
chmod +x .claude/hooks/block-dangerous-git.mjs
```

Add this hook to `.claude/settings.json`, merging with existing hooks if the file already exists:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous-git.mjs"
          }
        ]
      }
    ]
  }
}
```

Global install uses the same script path under `~/.claude/hooks/` and the command `~/.claude/hooks/block-dangerous-git.mjs`.

## Generic Use

Any agent runner that can pipe a JSON payload or command text into a pre-command hook can use the script:

```bash
echo '{"tool_input":{"command":"git push origin main"}}' | node ~/.codex/skills/agent-git-guardrails/scripts/block-dangerous-git.mjs
```

Blocked commands exit with code `2`. Allowed commands exit with code `0`.

## Verify

After install, run:

```bash
echo '{"tool_input":{"command":"git push origin main"}}' | node .claude/hooks/block-dangerous-git.mjs
```

Expected result: exit code `2` and a `BLOCKED` message on stderr.

Then run:

```bash
echo '{"tool_input":{"command":"git status --short"}}' | node .claude/hooks/block-dangerous-git.mjs
```

Expected result: exit code `0`.

## Stop And Ask

Stop before installing when:

- the user has not chosen project-local or global scope
- an existing hook file would be overwritten
- the hook target belongs to a shared or production machine
- the requested policy would allow destructive commands by default
