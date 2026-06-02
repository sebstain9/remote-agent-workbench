import { z } from "zod";

export const taskStatuses = [
  "queued",
  "preparing",
  "codex_running",
  "review_running",
  "testing",
  "committing",
  "done",
  "codex_failed",
  "review_failed",
  "test_failed",
  "commit_failed",
  "needs_test_command"
] as const;

export const taskStatusSchema = z.enum(taskStatuses);

export const createTaskSchema = z.object({
  workspacePath: z.string().min(1),
  title: z.string().min(1).max(120).transform((value) => value.replace(/\s+/g, " ").trim()),
  prompt: z.string().min(1),
  testCommand: z.string().trim().optional()
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export type AgentRun = {
  exitCode: number;
  stdout: string;
  stderr: string;
  summary: string;
  durationMs: number;
};

export type ReviewResult = {
  verdict: "pass" | "fail";
  summary: string;
  risks: string[];
  raw: string;
};

export type TestResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type Task = {
  id: string;
  title: string;
  prompt: string;
  workspacePath: string;
  testCommand?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  repoRoot?: string;
  worktreePath?: string;
  branchName?: string;
  codex?: AgentRun;
  review?: ReviewResult;
  test?: TestResult;
  diff?: string;
  diffStat?: string;
  commitHash?: string;
  error?: string;
};

export type TaskDetail = Task & {
  logs: string[];
};

export type HealthCheck = {
  name: "git" | "codex" | "claude";
  ok: boolean;
  path?: string;
  version?: string;
  error?: string;
};

export type HealthResponse = {
  ok: boolean;
  checks: HealthCheck[];
};

export type WorkspaceCandidate = {
  name: string;
  path: string;
  repoRoot: string;
  clean: boolean;
  source: "recent" | "detected";
  lastUsedAt?: string;
};

export const terminalStatuses: TaskStatus[] = [
  "done",
  "codex_failed",
  "review_failed",
  "test_failed",
  "commit_failed",
  "needs_test_command"
];

export function isTerminalStatus(status: TaskStatus): boolean {
  return terminalStatuses.includes(status);
}
