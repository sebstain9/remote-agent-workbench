import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type AgentAdapters } from "./agents.js";
import { type AppConfig } from "./config.js";
import { createDemoTask } from "./demo.js";
import { getHealth } from "./health.js";
import { TaskOrchestrator } from "./orchestrator.js";
import { runCommand } from "./process.js";
import { TaskStore } from "./store.js";
import { defaultWorkspaceRoots, discoverWorkspaces } from "./workspaces.js";
import { getDiffOrEmpty } from "./git.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Remote Agent Workbench core loop", () => {
  it("detects missing agent binaries in health check", async () => {
    const config = await makeConfig();
    const health = await getHealth({
      ...config,
      codexBin: "raw-missing-codex",
      claudeBin: "raw-missing-claude"
    });

    expect(health.ok).toBe(false);
    expect(health.appOk).toBe(true);
    expect(health.demoOk).toBe(true);
    expect(health.checks.find((check) => check.name === "node")?.ok).toBe(true);
    expect(health.checks.find((check) => check.name === "git")?.ok).toBe(true);
    expect(health.checks.find((check) => check.name === "codex")?.ok).toBe(false);
    expect(health.checks.find((check) => check.name === "claude")?.ok).toBe(false);
  });

  it("creates a complete demo run without agent binaries or a target repo", async () => {
    const config = await makeConfig();
    const store = new TaskStore(config.workRoot);

    const task = await createDemoTask(store);
    const detail = await store.getTaskDetail(task.id);

    expect(task.mode).toBe("demo");
    expect(task.status).toBe("done");
    expect(task.codex?.exitCode).toBe(0);
    expect(task.review?.verdict).toBe("pass");
    expect(task.test?.exitCode).toBe(0);
    expect(task.diff).toContain("loadSavedFilters");
    expect(detail?.logs.join("\n")).toContain("Mock local commit");
  });

  it("rejects dirty target repositories before creating a task", async () => {
    const repo = await createRepo({ scripts: { typecheck: "node -e \"process.exit(0)\"" } });
    await appendFile(join(repo, "index.txt"), "\ndirty");
    const { orchestrator } = await makeHarness(passingAgents());

    await expect(
      orchestrator.createTask({
        workspacePath: repo,
        title: "Dirty repo",
        prompt: "Change the file"
      })
    ).rejects.toThrow(/not clean/i);
  });

  it("normalizes task titles before branch and commit message use", async () => {
    const repo = await createRepo({ scripts: { typecheck: "node -e \"process.exit(0)\"" } });
    const { orchestrator } = await makeHarness(passingAgents());
    const task = await orchestrator.createTask({
      workspacePath: repo,
      title: "  Title\nwith   spacing  ",
      prompt: "Append a note"
    });

    expect(task.title).toBe("Title with spacing");
  });

  it("discovers candidate repositories and marks dirty repos", async () => {
    const cleanRepo = await createRepo({ scripts: { typecheck: "node -e \"process.exit(0)\"" } });
    const dirtyRepo = await createRepo({ scripts: { typecheck: "node -e \"process.exit(0)\"" } });
    await appendFile(join(dirtyRepo, "index.txt"), "\ndirty");
    const config = await makeConfig();
    const store = new TaskStore(config.workRoot);

    const candidates = await discoverWorkspaces(config, store, [cleanRepo, dirtyRepo]);

    expect(candidates.find((candidate) => candidate.name === basename(cleanRepo))?.clean).toBe(true);
    expect(candidates.find((candidate) => candidate.name === basename(dirtyRepo))?.clean).toBe(false);
  });

  it("uses RAW_WORKSPACE_ROOTS as an explicit discovery scope", () => {
    const previous = process.env.RAW_WORKSPACE_ROOTS;
    process.env.RAW_WORKSPACE_ROOTS = "/tmp/raw-one,/tmp/raw-two";
    try {
      expect(defaultWorkspaceRoots("/tmp/ignored")).toEqual(["/tmp/raw-one", "/tmp/raw-two"]);
    } finally {
      if (previous === undefined) {
        delete process.env.RAW_WORKSPACE_ROOTS;
      } else {
        process.env.RAW_WORKSPACE_ROOTS = previous;
      }
    }
  });

  it("creates a worktree, reviews, verifies, and commits when all gates pass", async () => {
    const repo = await createRepo({ scripts: { typecheck: "node -e \"process.exit(0)\"" } });
    const { orchestrator, store } = await makeHarness(passingAgents());
    const task = await orchestrator.createTask({
      workspacePath: repo,
      title: "Add implementation note",
      prompt: "Append a note to index.txt"
    });

    const done = await orchestrator.processTask(task.id);
    const detail = await store.getTaskDetail(task.id);
    const mainFile = await readFile(join(repo, "index.txt"), "utf8");

    expect(done.status).toBe("done");
    expect(done.branchName).toMatch(/^raw\//);
    expect(done.worktreePath).toContain(task.id);
    expect(done.commitHash).toMatch(/[0-9a-f]{40}/);
    expect(done.diff).toContain("implemented by fake codex");
    expect(detail?.logs.join("\n")).toContain("Creating local commit");
    expect(mainFile).not.toContain("implemented by fake codex");
  });

  it("includes newly created files in the reviewed diff before committing", async () => {
    const repo = await createRepo({ scripts: { typecheck: "node -e \"process.exit(0)\"" } });
    let reviewedDiff = "";
    const { orchestrator } = await makeHarness({
      codexImplement: async (_task, worktreePath) => {
        await writeFile(join(worktreePath, "new-file.txt"), "new content\n", "utf8");
        return {
          exitCode: 0,
          stdout: "created new-file.txt",
          stderr: "",
          summary: "Created new-file.txt.",
          durationMs: 5
        };
      },
      claudeReview: async (_task, diff) => {
        reviewedDiff = diff;
        return {
          verdict: "pass",
          summary: "New file is visible in review.",
          risks: [],
          raw: "{}"
        };
      }
    });
    const task = await orchestrator.createTask({
      workspacePath: repo,
      title: "Create a file",
      prompt: "Create new-file.txt"
    });

    const result = await orchestrator.processTask(task.id);

    expect(result.status).toBe("done");
    expect(reviewedDiff).toContain("new-file.txt");
    expect(reviewedDiff).toContain("new content");
  });

  it("stops without committing when no test command can be found", async () => {
    const repo = await createRepo({ scripts: {} });
    const { orchestrator } = await makeHarness(passingAgents());
    const task = await orchestrator.createTask({
      workspacePath: repo,
      title: "No tests",
      prompt: "Append a note"
    });

    const result = await orchestrator.processTask(task.id);

    expect(result.status).toBe("needs_test_command");
    expect(result.commitHash).toBeUndefined();
  });

  it("stops without committing when Claude review fails", async () => {
    const repo = await createRepo({ scripts: { typecheck: "node -e \"process.exit(0)\"" } });
    const { orchestrator } = await makeHarness({
      ...passingAgents(),
      claudeReview: async () => ({
        verdict: "fail",
        summary: "The change is unsafe.",
        risks: ["unsafe change"],
        raw: "{}"
      })
    });
    const task = await orchestrator.createTask({
      workspacePath: repo,
      title: "Unsafe change",
      prompt: "Append a note"
    });

    const result = await orchestrator.processTask(task.id);

    expect(result.status).toBe("review_failed");
    expect(result.commitHash).toBeUndefined();
  });

  it("stops without committing when verification fails", async () => {
    const repo = await createRepo({ scripts: { typecheck: "node -e \"process.exit(1)\"" } });
    const { orchestrator } = await makeHarness(passingAgents());
    const task = await orchestrator.createTask({
      workspacePath: repo,
      title: "Failing tests",
      prompt: "Append a note"
    });

    const result = await orchestrator.processTask(task.id);

    expect(result.status).toBe("test_failed");
    expect(result.commitHash).toBeUndefined();
  });

  it("does not commit files generated after review during verification", async () => {
    const repo = await createRepo({
      scripts: {
        typecheck: "node -e \"require('fs').writeFileSync('generated.txt','generated after review')\""
      }
    });
    const { orchestrator } = await makeHarness(passingAgents());
    const task = await orchestrator.createTask({
      workspacePath: repo,
      title: "Generated artifact",
      prompt: "Append a note"
    });

    const result = await orchestrator.processTask(task.id);

    expect(result.status).toBe("commit_failed");
    expect(result.error).toContain("unreviewed");
    expect(result.commitHash).toBeUndefined();
  });

  it("blocks unsafe verification commands before they run", async () => {
    const repo = await createRepo({ scripts: { typecheck: "node -e \"process.exit(0)\"" } });
    const { orchestrator } = await makeHarness(passingAgents());
    const task = await orchestrator.createTask({
      workspacePath: repo,
      title: "Unsafe command",
      prompt: "Append a note",
      testCommand: "git push origin main"
    });

    const result = await orchestrator.processTask(task.id);

    expect(result.status).toBe("test_failed");
    expect(result.error).toContain("Unsafe test command");
    expect(result.commitHash).toBeUndefined();
  });

  it("marks Codex failures and does not continue", async () => {
    const repo = await createRepo({ scripts: { typecheck: "node -e \"process.exit(0)\"" } });
    const { orchestrator } = await makeHarness({
      ...passingAgents(),
      codexImplement: async () => ({
        exitCode: 124,
        stdout: "",
        stderr: "Process timed out after 1ms.",
        summary: "Timed out.",
        durationMs: 1
      })
    });
    const task = await orchestrator.createTask({
      workspacePath: repo,
      title: "Timeout",
      prompt: "Append a note"
    });

    const result = await orchestrator.processTask(task.id);

    expect(result.status).toBe("codex_failed");
    expect(result.commitHash).toBeUndefined();
  });

  it("returns an empty diff for missing stale worktrees", async () => {
    const config = await makeConfig();

    await expect(getDiffOrEmpty(config, join(config.workRoot, "missing-worktree"))).resolves.toBe("");
  });
});

async function makeHarness(agents: AgentAdapters) {
  const config = await makeConfig();
  const store = new TaskStore(config.workRoot);
  const orchestrator = new TaskOrchestrator(config, store, agents, false);
  return { config, store, orchestrator };
}

async function makeConfig(): Promise<AppConfig> {
  const root = await mkdtemp(join(tmpdir(), "raw-work-"));
  tempRoots.push(root);
  return {
    port: 0,
    host: "127.0.0.1",
    appRoot: process.cwd(),
    launchCwd: process.cwd(),
    workRoot: join(root, "state"),
    gitBin: "git",
    codexBin: "codex",
    claudeBin: "claude",
    taskTimeoutMs: 5000
  };
}

function passingAgents(): AgentAdapters {
  return {
    codexImplement: async (_task, worktreePath) => {
      await appendFile(join(worktreePath, "index.txt"), "\nimplemented by fake codex\n");
      return {
        exitCode: 0,
        stdout: "changed index.txt",
        stderr: "",
        summary: "Changed index.txt.",
        durationMs: 5
      };
    },
    claudeReview: async () => ({
      verdict: "pass",
      summary: "Diff is acceptable for the requested task.",
      risks: [],
      raw: '{"verdict":"pass"}'
    })
  };
}

async function createRepo(input: { scripts: Record<string, string> }): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), "raw-repo-"));
  tempRoots.push(repo);
  await runOk("git", ["init"], repo);
  await runOk("git", ["config", "user.email", "test@example.com"], repo);
  await runOk("git", ["config", "user.name", "RAW Test"], repo);
  await writeFile(
    join(repo, "package.json"),
    `${JSON.stringify({ scripts: input.scripts }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(join(repo, "index.txt"), "initial\n", "utf8");
  await runOk("git", ["add", "-A"], repo);
  await runOk("git", ["commit", "-m", "initial"], repo);
  return repo;
}

async function runOk(command: string, args: string[], cwd: string): Promise<void> {
  const result = await runCommand({ command, args, cwd });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  }
}
