import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { type AppConfig } from "./config.js";
import { runCommand } from "./process.js";

export type WorktreeInfo = {
  repoRoot: string;
  worktreePath: string;
  branchName: string;
};

export async function getRepoRoot(config: AppConfig, workspacePath: string): Promise<string> {
  const result = await runCommand({
    command: config.gitBin,
    args: ["-C", workspacePath, "rev-parse", "--show-toplevel"]
  });
  if (result.exitCode !== 0) {
    throw new Error(`Not a git repository: ${workspacePath}`);
  }
  return result.stdout.trim();
}

export async function assertCleanRepo(config: AppConfig, repoRoot: string): Promise<void> {
  const result = await runCommand({
    command: config.gitBin,
    args: ["-C", repoRoot, "status", "--porcelain"]
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to inspect git status.");
  }
  if (result.stdout.trim()) {
    throw new Error("Target repository is not clean. Commit, stash, or discard local changes first.");
  }
}

export function makeTaskId(): string {
  return `task_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function makeBranchName(taskId: string, title: string): string {
  return `raw/${taskId}-${slugify(title).slice(0, 40)}`;
}

export function makeWorktreePath(config: AppConfig, repoRoot: string, taskId: string): string {
  return join(config.workRoot, "worktrees", repoSlug(repoRoot), taskId);
}

export async function createWorktree(
  config: AppConfig,
  repoRoot: string,
  taskId: string,
  title: string
): Promise<WorktreeInfo> {
  const branchName = makeBranchName(taskId, title);
  const worktreePath = makeWorktreePath(config, repoRoot, taskId);
  await mkdir(join(config.workRoot, "worktrees", repoSlug(repoRoot)), { recursive: true });
  const result = await runCommand({
    command: config.gitBin,
    args: ["-C", repoRoot, "worktree", "add", "-b", branchName, worktreePath, "HEAD"]
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to create git worktree.");
  }
  return { repoRoot, worktreePath, branchName };
}

export async function hasWorktreeChanges(config: AppConfig, worktreePath: string): Promise<boolean> {
  const result = await runCommand({
    command: config.gitBin,
    args: ["-C", worktreePath, "status", "--porcelain"]
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to inspect worktree status.");
  }
  return Boolean(result.stdout.trim());
}

export async function getDiff(config: AppConfig, worktreePath: string): Promise<string> {
  const result = await runCommand({
    command: config.gitBin,
    args: ["-C", worktreePath, "diff", "--"]
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to read diff.");
  }
  return result.stdout;
}

export async function getDiffOrEmpty(config: AppConfig, worktreePath?: string): Promise<string> {
  if (!worktreePath) return "";
  try {
    return await getDiff(config, worktreePath);
  } catch {
    return "";
  }
}

export async function stageAll(config: AppConfig, worktreePath: string): Promise<void> {
  const result = await runCommand({
    command: config.gitBin,
    args: ["-C", worktreePath, "add", "-A"]
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to stage changes.");
  }
}

export async function getStagedDiff(config: AppConfig, worktreePath: string): Promise<string> {
  const result = await runCommand({
    command: config.gitBin,
    args: ["-C", worktreePath, "diff", "--cached", "--"]
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to read staged diff.");
  }
  return result.stdout;
}

export async function getStagedDiffStat(config: AppConfig, worktreePath: string): Promise<string> {
  const result = await runCommand({
    command: config.gitBin,
    args: ["-C", worktreePath, "diff", "--cached", "--stat", "--"]
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to read staged diff stat.");
  }
  return result.stdout.trim();
}

export async function assertNoUnreviewedChanges(config: AppConfig, worktreePath: string): Promise<void> {
  const unstaged = await runCommand({
    command: config.gitBin,
    args: ["-C", worktreePath, "diff", "--name-only", "--"]
  });
  if (unstaged.exitCode !== 0) {
    throw new Error(unstaged.stderr || unstaged.stdout || "Failed to inspect unstaged changes.");
  }

  const untracked = await runCommand({
    command: config.gitBin,
    args: ["-C", worktreePath, "ls-files", "--others", "--exclude-standard"]
  });
  if (untracked.exitCode !== 0) {
    throw new Error(untracked.stderr || untracked.stdout || "Failed to inspect untracked files.");
  }

  const names = [unstaged.stdout, untracked.stdout].join("\n").trim();
  if (names) {
    throw new Error(`Verification produced unreviewed working tree changes:\n${names}`);
  }
}

export async function getDiffStat(config: AppConfig, worktreePath: string): Promise<string> {
  const result = await runCommand({
    command: config.gitBin,
    args: ["-C", worktreePath, "diff", "--stat", "--"]
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to read diff stat.");
  }
  return result.stdout.trim();
}

export async function commitStaged(config: AppConfig, worktreePath: string, message: string): Promise<string> {
  const commit = await runCommand({
    command: config.gitBin,
    args: ["-C", worktreePath, "commit", "-m", message]
  });
  if (commit.exitCode !== 0) {
    throw new Error(commit.stderr || commit.stdout || "Failed to create commit.");
  }

  const rev = await runCommand({
    command: config.gitBin,
    args: ["-C", worktreePath, "rev-parse", "HEAD"]
  });
  if (rev.exitCode !== 0) {
    throw new Error(rev.stderr || rev.stdout || "Failed to read commit hash.");
  }
  return rev.stdout.trim();
}

function repoSlug(repoRoot: string): string {
  const name = slugify(basename(repoRoot)) || "repo";
  const hash = createHash("sha1").update(repoRoot).digest("hex").slice(0, 8);
  return `${name}-${hash}`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
