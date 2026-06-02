import { type Task } from "../shared/types.js";
import { type TaskStore } from "./store.js";

export async function createDemoTask(store: TaskStore): Promise<Task> {
  const now = new Date().toISOString();
  const id = `demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const task: Task = {
    id,
    mode: "demo",
    title: "Demo: Add saved filters",
    prompt: "Persist table filters between reloads and keep the change behind the existing settings module.",
    workspacePath: "~/projects/example-repo",
    testCommand: "npm run typecheck",
    status: "done",
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: new Date(Date.now() + 15_000).toISOString(),
    repoRoot: "~/projects/example-repo",
    worktreePath: "~/.remote-agent-workbench/worktrees/example-repo/task_demo_saved_filters",
    branchName: "raw/demo-add-saved-filters",
    codex: {
      exitCode: 0,
      stdout: "Updated src/filters.ts and src/filters.test.ts",
      stderr: "",
      summary: "Implemented persisted table filters and restored saved state on reload.",
      durationMs: 6200
    },
    review: {
      verdict: "pass",
      summary: "The diff is focused, state restoration is covered, and no unsafe behavior was introduced.",
      risks: ["Demo output only; no repository was modified."],
      raw: '{"verdict":"pass","summary":"Demo review passed."}'
    },
    test: {
      command: "npm run typecheck",
      exitCode: 0,
      stdout: "> typecheck\n> tsc -p tsconfig.json --noEmit\n\npassed",
      stderr: "",
      durationMs: 1800
    },
    diffStat: "src/filters.ts | 18 +++++++++++++++---\nsrc/filters.test.ts | 24 ++++++++++++++++++++++++\n2 files changed, 40 insertions(+), 2 deletions(-)",
    diff: [
      "diff --git a/src/filters.ts b/src/filters.ts",
      "index 4f12592..6f8b91a 100644",
      "--- a/src/filters.ts",
      "+++ b/src/filters.ts",
      "@@ -1,5 +1,20 @@",
      "+const STORAGE_KEY = \"table.filters\";",
      "+",
      "+export function loadSavedFilters() {",
      "+  const raw = window.localStorage.getItem(STORAGE_KEY);",
      "+  return raw ? JSON.parse(raw) : {};",
      "+}",
      "+",
      "+export function saveFilters(filters) {",
      "+  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));",
      "+}",
      " export function applyFilters(rows, filters) {",
      "   return rows.filter((row) => matches(row, filters));",
      " }"
    ].join("\n"),
    commitHash: "5f3a9b24d82ef94c7a741fcb0b84db65c12d9a11"
  };

  await store.insertTask(task);
  await store.appendLog(id, "demo", "Created a complete demo run without touching a repository.");
  await store.appendLog(id, "codex_running", "Mock Codex implemented persisted filters.");
  await store.appendLog(id, "review_running", "Mock Claude review passed the staged diff.");
  await store.appendLog(id, "testing", "Mock verification completed with exit code 0.");
  await store.appendLog(id, "committing", "Mock local commit recorded.");
  return task;
}
