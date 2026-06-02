import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { type AgentRun, type ReviewResult, type Task } from "../shared/types.js";
import { type AppConfig } from "./config.js";
import { runCommand } from "./process.js";

export type AgentAdapters = {
  codexImplement(task: Task, worktreePath: string, taskDir: string): Promise<AgentRun>;
  claudeReview(task: Task, diff: string, taskDir: string): Promise<ReviewResult>;
};

export function createProductionAgents(config: AppConfig): AgentAdapters {
  return {
    codexImplement: async (task, worktreePath, taskDir) => {
      await mkdir(taskDir, { recursive: true });
      const finalMessagePath = join(taskDir, "codex-final.md");
      const prompt = buildCodexPrompt(task);
      const result = await runCommand({
        command: config.codexBin,
        args: [
          "exec",
          "-C",
          worktreePath,
          "-s",
          "workspace-write",
          "--ignore-user-config",
          "--skip-git-repo-check",
          "--output-last-message",
          finalMessagePath,
          "-"
        ],
        input: prompt,
        timeoutMs: config.taskTimeoutMs
      });

      let summary = result.stdout.trim();
      try {
        summary = (await readFile(finalMessagePath, "utf8")).trim() || summary;
      } catch {
        // stdout is good enough when Codex does not write the final-message file.
      }

      return { ...result, summary };
    },
    claudeReview: async (task, diff) => {
      const prompt = buildClaudeReviewPrompt(task, diff);
      const result = await runCommand({
        command: config.claudeBin,
        args: ["-p", "--output-format", "json", "--no-session-persistence", prompt],
        timeoutMs: config.taskTimeoutMs
      });
      if (result.exitCode !== 0) {
        return {
          verdict: "fail",
          summary: result.stderr || result.stdout || "Claude review failed.",
          risks: ["Claude Code exited with a non-zero status."],
          raw: result.stdout || result.stderr
        };
      }
      return parseClaudeReview(result.stdout);
    }
  };
}

function buildCodexPrompt(task: Task): string {
  return [
    "You are implementing a local Remote Agent Workbench task inside an isolated git worktree.",
    "",
    "Hard rules:",
    "- Make the smallest code change that satisfies the task.",
    "- Do not commit, push, create a PR, deploy, send external messages, or modify credentials.",
    "- Do not edit outside the current worktree.",
    "- If the task is impossible, stop and explain why in the final response.",
    "",
    `Task title: ${task.title}`,
    "",
    "User request:",
    task.prompt
  ].join("\n");
}

function buildClaudeReviewPrompt(task: Task, diff: string): string {
  return [
    "Review this git diff for correctness, regressions, missing tests, and unsafe behavior.",
    "Do not modify files. Return only a JSON object with this shape:",
    '{"verdict":"pass"|"fail","summary":"short review summary","risks":["risk 1"]}',
    "",
    `Task title: ${task.title}`,
    "Task prompt:",
    task.prompt,
    "",
    "Diff:",
    diff
  ].join("\n");
}

export function parseClaudeReview(output: string): ReviewResult {
  const maybeJson = extractJson(output);
  if (!maybeJson) {
    return {
      verdict: "fail",
      summary: "Claude review did not return parseable JSON.",
      risks: ["Unparseable review output."],
      raw: output
    };
  }

  const verdict = maybeJson.verdict === "pass" ? "pass" : "fail";
  return {
    verdict,
    summary: typeof maybeJson.summary === "string" ? maybeJson.summary : "No summary provided.",
    risks: Array.isArray(maybeJson.risks)
      ? maybeJson.risks.filter((risk): risk is string => typeof risk === "string")
      : [],
    raw: output
  };
}

function extractJson(output: string): Record<string, unknown> | undefined {
  const outer = safeParse(output);
  const text =
    outer && typeof outer.result === "string"
      ? outer.result
      : output.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const direct = safeParse(text);
  if (direct) return direct;
  const match = text.match(/\{[\s\S]*\}/);
  return match ? safeParse(match[0]) : undefined;
}

function safeParse(input: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(input) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
