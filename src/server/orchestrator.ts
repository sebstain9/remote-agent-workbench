import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  type CreateTaskInput,
  type Task,
  type TaskStatus,
  createTaskSchema,
  isTerminalStatus
} from "../shared/types.js";
import { type AgentAdapters } from "./agents.js";
import { type AppConfig } from "./config.js";
import {
  assertCleanRepo,
  assertNoUnreviewedChanges,
  commitStaged,
  createWorktree,
  getRepoRoot,
  getStagedDiff,
  getStagedDiffStat,
  hasWorktreeChanges,
  makeTaskId,
  stageAll
} from "./git.js";
import { runShell } from "./process.js";
import { TaskStore } from "./store.js";
import { determineTestCommand } from "./testCommand.js";

export class TaskOrchestrator {
  constructor(
    private readonly config: AppConfig,
    private readonly store: TaskStore,
    private readonly agents: AgentAdapters,
    private readonly autoRun = true
  ) {}

  async createTask(input: CreateTaskInput): Promise<Task> {
    const parsed = createTaskSchema.parse(input);
    const repoRoot = await getRepoRoot(this.config, parsed.workspacePath);
    await assertCleanRepo(this.config, repoRoot);

    const now = new Date().toISOString();
    const task: Task = {
      id: makeTaskId(),
      title: parsed.title,
      prompt: parsed.prompt,
      workspacePath: parsed.workspacePath,
      testCommand: parsed.testCommand?.trim() || undefined,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      repoRoot
    };
    await this.store.insertTask(task);
    if (this.autoRun) void this.processTask(task.id);
    return task;
  }

  async processTask(taskId: string): Promise<Task> {
    const initial = await this.store.getTask(taskId);
    if (!initial) throw new Error(`Task not found: ${taskId}`);
    if (isTerminalStatus(initial.status)) return initial;

    let status: TaskStatus = initial.status;
    const taskDir = join(this.config.workRoot, "tasks", taskId);
    await mkdir(taskDir, { recursive: true });

    try {
      status = "preparing";
      let task = await this.patch(taskId, {
        status,
        startedAt: initial.startedAt ?? new Date().toISOString(),
        error: undefined
      });
      await this.log(taskId, status, "Creating isolated git worktree.");
      const worktree = await createWorktree(this.config, task.repoRoot!, task.id, task.title);
      task = await this.patch(taskId, {
        worktreePath: worktree.worktreePath,
        branchName: worktree.branchName,
        repoRoot: worktree.repoRoot
      });

      status = "codex_running";
      task = await this.patch(taskId, { status });
      await this.log(taskId, status, "Starting Codex implementation.");
      const codex = await this.agents.codexImplement(task, worktree.worktreePath, taskDir);
      await this.patch(taskId, { codex });
      if (codex.exitCode !== 0) {
        return await this.fail(taskId, "codex_failed", codex.stderr || codex.stdout || "Codex failed.");
      }
      if (!(await hasWorktreeChanges(this.config, worktree.worktreePath))) {
        return await this.fail(taskId, "codex_failed", "Codex finished without producing any git diff.");
      }

      await stageAll(this.config, worktree.worktreePath);
      const diff = await getStagedDiff(this.config, worktree.worktreePath);
      const diffStat = await getStagedDiffStat(this.config, worktree.worktreePath);
      if (!diff.trim()) {
        return await this.fail(taskId, "codex_failed", "Codex changes could not be staged for review.");
      }
      await this.patch(taskId, { diff, diffStat });

      status = "review_running";
      task = await this.patch(taskId, { status });
      await this.log(taskId, status, "Starting Claude Code review.");
      const review = await this.agents.claudeReview(task, diff, taskDir);
      await this.patch(taskId, { review });
      if (review.verdict !== "pass") {
        return await this.fail(taskId, "review_failed", review.summary);
      }

      status = "testing";
      task = await this.patch(taskId, { status });
      const testCommand = await determineTestCommand(worktree.worktreePath, task.testCommand);
      if (!testCommand) {
        return await this.fail(taskId, "needs_test_command", "No test command found. Provide testCommand.");
      }
      await this.log(taskId, status, `Running verification: ${testCommand}`);
      const test = await runShell(testCommand, worktree.worktreePath, this.config.taskTimeoutMs);
      await this.patch(taskId, { test: { command: testCommand, ...test } });
      if (test.exitCode !== 0) {
        return await this.fail(taskId, "test_failed", test.stderr || test.stdout || "Verification failed.");
      }

      status = "committing";
      await this.patch(taskId, { status });
      await assertNoUnreviewedChanges(this.config, worktree.worktreePath);
      await this.log(taskId, status, "Creating local commit.");
      const commitHash = await commitStaged(this.config, worktree.worktreePath, buildCommitMessage(task));

      return await this.patch(taskId, {
        status: "done",
        commitHash,
        completedAt: new Date().toISOString(),
        error: undefined
      });
    } catch (error) {
      const terminalStatus = mapFailureStatus(status);
      return await this.fail(taskId, terminalStatus, error instanceof Error ? error.message : String(error));
    }
  }

  private async fail(taskId: string, status: TaskStatus, error: string): Promise<Task> {
    await this.log(taskId, status, error);
    return await this.patch(taskId, {
      status,
      error,
      completedAt: new Date().toISOString()
    });
  }

  private async patch(taskId: string, patch: Partial<Task>): Promise<Task> {
    return await this.store.updateTask(taskId, patch);
  }

  private async log(taskId: string, phase: string, message: string): Promise<void> {
    await this.store.appendLog(taskId, phase, message);
  }
}

function mapFailureStatus(status: TaskStatus): TaskStatus {
  if (status === "review_running") return "review_failed";
  if (status === "testing") return "test_failed";
  if (status === "committing") return "commit_failed";
  return "codex_failed";
}

function buildCommitMessage(task: Task): string {
  return [
    `RAW: ${task.title}`,
    "",
    "Generated by Remote Agent Workbench.",
    "Codex implemented the change; Claude Code reviewed it; verification passed."
  ].join("\n");
}
