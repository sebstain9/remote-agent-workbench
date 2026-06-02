import { homedir } from "node:os";
import { resolve } from "node:path";

function expandHome(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return resolve(homedir(), input.slice(2));
  if (input === "$HOME") return homedir();
  if (input.startsWith("$HOME/")) return resolve(homedir(), input.slice(6));
  return resolve(input);
}

export type AppConfig = {
  port: number;
  host: string;
  appRoot: string;
  launchCwd: string;
  workRoot: string;
  gitBin: string;
  codexBin: string;
  claudeBin: string;
  taskTimeoutMs: number;
};

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.RAW_PORT ?? 5177),
    host: process.env.RAW_HOST ?? "0.0.0.0",
    appRoot: expandHome(process.env.RAW_APP_ROOT ?? process.cwd()),
    launchCwd: expandHome(process.env.RAW_LAUNCH_CWD ?? process.cwd()),
    workRoot: expandHome(process.env.RAW_WORK_ROOT ?? "~/.remote-agent-workbench"),
    gitBin: process.env.RAW_GIT_BIN ?? "git",
    codexBin: process.env.RAW_CODEX_BIN ?? "codex",
    claudeBin: process.env.RAW_CLAUDE_BIN ?? "claude",
    taskTimeoutMs: Number(process.env.RAW_TASK_TIMEOUT_MS ?? 10 * 60 * 1000)
  };
}
