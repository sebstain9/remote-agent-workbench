#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const command = args.shift();

if (!command || command === "--help" || command === "-h") {
  usage(0);
}

try {
  if (command === "start") {
    start(parseOptions(args));
  } else if (command === "verify") {
    verify(parseOptions(args));
  } else if (command === "status") {
    status(parseOptions(args));
  } else {
    fail(`Unknown command: ${command}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

function start(options) {
  const repoInput = options.repo ?? process.cwd();
  const title = options.title ?? "agent-task";
  const repoRoot = git(["-C", repoInput, "rev-parse", "--show-toplevel"]).trim();
  const statusText = git(["-C", repoRoot, "status", "--porcelain"]).trim();
  if (statusText) {
    throw new Error(
      `Target repository is not clean. Commit, stash, or discard local changes first:\n${statusText}`
    );
  }

  const stamp = timestamp();
  const shortTitle = slugify(title).slice(0, 44) || "agent-task";
  const branchName = options.branch ?? `agent/${stamp}-${shortTitle}`;
  const workRoot = expandHome(options["work-root"] ?? process.env.SAFE_AGENT_WORKTREE_ROOT ?? process.env.RAW_WORK_ROOT ?? "~/.remote-agent-workbench");
  const worktreeRoot = join(workRoot, "skill-worktrees", repoSlug(repoRoot));
  const worktreePath = resolve(worktreeRoot, `${stamp}-${shortTitle}`);

  if (existsSync(worktreePath)) {
    throw new Error(`Worktree path already exists: ${worktreePath}`);
  }

  mkdirSync(worktreeRoot, { recursive: true });
  git(["-C", repoRoot, "worktree", "add", "-b", branchName, worktreePath, "HEAD"], { stdio: "inherit" });
  writeFileSync(
    `${worktreePath}.json`,
    `${JSON.stringify({ repoRoot, branchName, worktreePath, title, createdAt: new Date().toISOString() }, null, 2)}\n`
  );

  console.log("");
  console.log("Safe agent worktree created.");
  console.log(`Source repo: ${repoRoot}`);
  console.log(`Branch:      ${branchName}`);
  console.log(`Worktree:    ${worktreePath}`);
  console.log("");
  console.log("Next:");
  console.log(`  cd ${shellQuote(worktreePath)}`);
  console.log("  git status --short");
}

function verify(options) {
  const worktreePath = requireOption(options, "worktree");
  const verifyCommand = requireOption(options, "command");
  assertSafeVerifyCommand(verifyCommand);
  ensureGitWorktree(worktreePath);

  const staged = git(["-C", worktreePath, "diff", "--cached", "--name-only", "--"]).trim();
  if (!staged) {
    throw new Error("No staged changes to verify. Stage and review the diff before running verification.");
  }

  const preUnstaged = git(["-C", worktreePath, "diff", "--name-only", "--"]).trim();
  const preUntracked = git(["-C", worktreePath, "ls-files", "--others", "--exclude-standard"]).trim();
  const preUnreviewed = [preUnstaged, preUntracked].filter(Boolean).join("\n");
  if (preUnreviewed) {
    throw new Error(`Unstaged or untracked changes exist before verification. Review and stage them first:\n${preUnreviewed}`);
  }

  console.log(`Running verification in ${worktreePath}`);
  const result = spawnSync(verifyCommand, {
    cwd: worktreePath,
    shell: true,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const unstaged = git(["-C", worktreePath, "diff", "--name-only", "--"]).trim();
  const untracked = git(["-C", worktreePath, "ls-files", "--others", "--exclude-standard"]).trim();
  const unreviewed = [unstaged, untracked].filter(Boolean).join("\n");
  if (unreviewed) {
    throw new Error(`Verification produced unreviewed working tree changes:\n${unreviewed}`);
  }

  const stat = git(["-C", worktreePath, "diff", "--cached", "--stat", "--"]).trim();
  console.log("");
  console.log("Verification passed. No unreviewed files appeared after review.");
  if (stat) {
    console.log("");
    console.log(stat);
  }
}

function status(options) {
  const worktreePath = requireOption(options, "worktree");
  ensureGitWorktree(worktreePath);
  const branch = git(["-C", worktreePath, "branch", "--show-current"]).trim();
  const statusText = git(["-C", worktreePath, "status", "--short"]).trim();
  const stat = git(["-C", worktreePath, "diff", "--stat", "--"]).trim();
  console.log(`Worktree: ${resolve(worktreePath)}`);
  console.log(`Branch:   ${branch || "(detached)"}`);
  console.log("");
  console.log(statusText || "Clean working tree.");
  if (stat) {
    console.log("");
    console.log(stat);
  }
}

function ensureGitWorktree(path) {
  git(["-C", path, "rev-parse", "--show-toplevel"]);
}

function assertSafeVerifyCommand(value) {
  const blocked = [
    /\bgit\s+push\b/i,
    /\bnpm\s+publish\b/i,
    /\bpnpm\s+publish\b/i,
    /\byarn\s+npm\s+publish\b/i,
    /\bvercel\b/i,
    /\bnetlify\s+deploy\b/i,
    /\bwrangler\s+deploy\b/i,
    /\bfirebase\s+deploy\b/i,
    /\bgh\s+release\b/i,
    /\brm\s+-rf\s+\/(?:\s|$)/i
  ];
  if (blocked.some((pattern) => pattern.test(value))) {
    throw new Error(`Blocked unsafe verification command: ${value}`);
  }
}

function git(gitArgs, options = {}) {
  const result = spawnSync("git", gitArgs, {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${gitArgs.join(" ")} failed`);
  }
  return result.stdout ?? "";
}

function parseOptions(rawArgs) {
  const options = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const item = rawArgs[i];
    if (!item.startsWith("--")) {
      fail(`Unexpected argument: ${item}`);
    }
    const key = item.slice(2);
    const value = rawArgs[i + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for --${key}`);
    }
    options[key] = value;
    i += 1;
  }
  return options;
}

function requireOption(options, key) {
  const value = options[key];
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function repoSlug(repoRoot) {
  const name = slugify(basename(repoRoot)) || "repo";
  const hash = createHash("sha1").update(repoRoot).digest("hex").slice(0, 8);
  return `${name}-${hash}`;
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

function expandHome(path) {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function usage(code) {
  console.log(`safe-agent-worktree

Usage:
  safe-agent-worktree start --title "task title" [--repo <path>] [--work-root <path>]
  safe-agent-worktree verify --worktree <path> --command "npm test"
  safe-agent-worktree status --worktree <path>
`);
  process.exit(code);
}

function fail(message) {
  console.error(`[safe-agent-worktree] ${message}`);
  process.exit(1);
}
