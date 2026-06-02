#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const binDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(binDir, "..");
const packageJson = JSON.parse(readFileSync(resolve(appRoot, "package.json"), "utf8"));
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Remote Agent Workbench ${packageJson.version}

Usage:
  remote-agent-workbench
  RAW_PORT=5180 remote-agent-workbench

Environment:
  RAW_PORT              Local server port, default 5177
  RAW_HOST              Local bind host, default 0.0.0.0
  RAW_WORK_ROOT         Local task state, default ~/.remote-agent-workbench
  RAW_WORKSPACE_ROOTS   Extra comma-separated repository roots
  RAW_CODEX_BIN         Codex CLI command, default codex
  RAW_CLAUDE_BIN        Claude Code CLI command, default claude
`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(packageJson.version);
  process.exit(0);
}

const tsxBin = resolve(appRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const serverEntry = resolve(appRoot, "src/server/index.ts");
const env = {
  ...process.env,
  RAW_APP_ROOT: process.env.RAW_APP_ROOT ?? appRoot,
  RAW_LAUNCH_CWD: process.env.RAW_LAUNCH_CWD ?? process.cwd()
};

const child = spawn(tsxBin, [serverEntry], {
  cwd: appRoot,
  env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
