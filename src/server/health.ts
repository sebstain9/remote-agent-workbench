import { type HealthCheck, type HealthResponse } from "../shared/types.js";
import { type AppConfig } from "./config.js";
import { runCommand } from "./process.js";

export async function getHealth(config: AppConfig): Promise<HealthResponse> {
  const checks = await Promise.all([
    checkNode(),
    checkBinary("git", "Git", config.gitBin, ["--version"], "app", "brew install git"),
    checkBinary("codex", "Codex CLI", config.codexBin, ["--version"], "real-run", "npm install -g @openai/codex"),
    checkBinary("claude", "Claude Code", config.claudeBin, ["--version"], "real-run", "npm install -g @anthropic-ai/claude-code")
  ]);
  const appOk = checks.filter((check) => check.requiredFor === "app").every((check) => check.ok);
  return {
    appOk,
    demoOk: checks.find((check) => check.name === "node")?.ok ?? false,
    ok: checks.every((check) => check.ok),
    checks
  };
}

async function checkNode(): Promise<HealthCheck> {
  const version = process.versions.node;
  const major = Number(version.split(".")[0] ?? 0);
  return {
    name: "node",
    label: "Node.js 22+",
    ok: major >= 22,
    requiredFor: "app",
    path: process.execPath,
    version: `v${version}`,
    error: major >= 22 ? undefined : `Node.js ${version} is below the required 22.x runtime.`,
    installCommand: "brew install node@22"
  };
}

async function checkBinary(
  name: HealthCheck["name"],
  label: string,
  bin: string,
  versionArgs: string[],
  requiredFor: HealthCheck["requiredFor"],
  installCommand: string
): Promise<HealthCheck> {
  const located = await runCommand({ command: "sh", args: ["-lc", `command -v ${shellQuote(bin)}`] });
  if (located.exitCode !== 0) {
    return { name, label, ok: false, requiredFor, error: `${bin} not found`, installCommand };
  }

  const version = await runCommand({ command: bin, args: versionArgs, timeoutMs: 5000 });
  return {
    name,
    label,
    ok: version.exitCode === 0,
    requiredFor,
    path: located.stdout.trim(),
    version: (version.stdout || version.stderr).trim().split("\n")[0],
    error: version.exitCode === 0 ? undefined : version.stderr || version.stdout,
    installCommand
  };
}

function shellQuote(input: string): string {
  return `'${input.replaceAll("'", "'\\''")}'`;
}
