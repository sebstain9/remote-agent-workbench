import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { type WorkspaceCandidate } from "../shared/types.js";
import { type AppConfig } from "./config.js";
import { getRepoRoot } from "./git.js";
import { runCommand } from "./process.js";
import { type TaskStore } from "./store.js";

const SKIPPED_DIRS = new Set([
  ".Trash",
  ".cache",
  ".codex",
  ".local",
  ".npm",
  "Applications",
  "Library",
  "Movies",
  "Music",
  "Pictures",
  "node_modules",
  "dist"
]);

export async function discoverWorkspaces(
  config: AppConfig,
  store: TaskStore,
  roots = defaultWorkspaceRoots(),
  limit = 24
): Promise<WorkspaceCandidate[]> {
  const candidates = new Map<string, WorkspaceCandidate>();

  for (const task of await store.listTasks().catch(() => [])) {
    await addCandidate(config, candidates, task.workspacePath, "recent", task.createdAt);
  }

  for (const root of roots) {
    await addCandidate(config, candidates, root, "detected");
    for (const path of await findGitDirectories(root, 2)) {
      await addCandidate(config, candidates, path, "detected");
    }
  }

  return [...candidates.values()]
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === "recent" ? -1 : 1;
      if (a.clean !== b.clean) return a.clean ? -1 : 1;
      return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function defaultWorkspaceRoots(): string[] {
  const envRoots = (process.env.RAW_WORKSPACE_ROOTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return unique([process.cwd(), dirname(process.cwd()), homedir(), ...envRoots].map((path) => resolve(path)));
}

async function addCandidate(
  config: AppConfig,
  candidates: Map<string, WorkspaceCandidate>,
  inputPath: string,
  source: WorkspaceCandidate["source"],
  lastUsedAt?: string
): Promise<void> {
  try {
    const repoRoot = await getRepoRoot(config, inputPath);
    if (source === "recent" && isTemporaryPath(repoRoot)) return;
    const existing = candidates.get(repoRoot);
    const next: WorkspaceCandidate = {
      name: basename(repoRoot),
      path: repoRoot,
      repoRoot,
      clean: await isClean(config, repoRoot),
      source: existing?.source === "recent" ? "recent" : source,
      lastUsedAt: latestDate(existing?.lastUsedAt, lastUsedAt)
    };
    candidates.set(repoRoot, next);
  } catch {
    // Discovery is best effort; task creation still performs strict validation.
  }
}

async function findGitDirectories(root: string, maxDepth: number): Promise<string[]> {
  const found: string[] = [];
  await walk(resolve(root), maxDepth, found);
  return found;
}

async function walk(directory: string, depth: number, found: string[]): Promise<void> {
  if (depth < 0 || shouldSkip(directory)) return;

  let directoryStat;
  try {
    directoryStat = await stat(directory);
  } catch {
    return;
  }
  if (!directoryStat.isDirectory()) return;

  if (await hasGitMetadata(directory)) {
    found.push(directory);
    return;
  }

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => walk(join(directory, entry.name), depth - 1, found))
  );
}

async function hasGitMetadata(directory: string): Promise<boolean> {
  try {
    await stat(join(directory, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function isClean(config: AppConfig, repoRoot: string): Promise<boolean> {
  const result = await runCommand({
    command: config.gitBin,
    args: ["-C", repoRoot, "status", "--porcelain"]
  });
  if (result.exitCode !== 0) return false;
  return !result.stdout.trim();
}

function shouldSkip(directory: string): boolean {
  const name = basename(directory);
  return SKIPPED_DIRS.has(name) || (name.startsWith(".") && name !== ".");
}

function isTemporaryPath(path: string): boolean {
  return path.startsWith("/tmp/") || path.startsWith("/private/tmp/");
}

function latestDate(first?: string, second?: string): string | undefined {
  if (!first) return second;
  if (!second) return first;
  return first > second ? first : second;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
