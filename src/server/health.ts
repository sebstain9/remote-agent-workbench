import { type HealthCheck, type HealthResponse } from "../shared/types.js";
import { type AppConfig } from "./config.js";
import { runCommand } from "./process.js";

export async function getHealth(config: AppConfig): Promise<HealthResponse> {
  const checks = await Promise.all([
    checkBinary("git", config.gitBin, ["--version"]),
    checkBinary("codex", config.codexBin, ["--version"]),
    checkBinary("claude", config.claudeBin, ["--version"])
  ]);
  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

async function checkBinary(
  name: HealthCheck["name"],
  bin: string,
  versionArgs: string[]
): Promise<HealthCheck> {
  const located = await runCommand({ command: "sh", args: ["-lc", `command -v ${shellQuote(bin)}`] });
  if (located.exitCode !== 0) {
    return { name, ok: false, error: `${bin} not found` };
  }

  const version = await runCommand({ command: bin, args: versionArgs, timeoutMs: 5000 });
  return {
    name,
    ok: version.exitCode === 0,
    path: located.stdout.trim(),
    version: (version.stdout || version.stderr).trim().split("\n")[0],
    error: version.exitCode === 0 ? undefined : version.stderr || version.stdout
  };
}

function shellQuote(input: string): string {
  return `'${input.replaceAll("'", "'\\''")}'`;
}
