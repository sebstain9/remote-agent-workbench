import { spawn } from "node:child_process";

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type RunCommandOptions = {
  command: string;
  args?: string[];
  cwd?: string;
  input?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

export function runCommand(options: RunCommandOptions): Promise<CommandResult> {
  const startedAt = Date.now();
  const args = options.args ?? [];

  return new Promise((resolve, reject) => {
    const child = spawn(options.command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let killTimer: NodeJS.Timeout | undefined;
    const timeout =
      options.timeoutMs && options.timeoutMs > 0
        ? setTimeout(() => {
            stderr += `\nProcess timed out after ${options.timeoutMs}ms.`;
            child.kill("SIGTERM");
            killTimer = setTimeout(() => child.kill("SIGKILL"), 2000);
          }, options.timeoutMs)
        : undefined;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      const durationMs = Date.now() - startedAt;
      const exitCode = code ?? (signal ? 124 : 1);
      resolve({ exitCode, stdout, stderr, durationMs });
    });

    child.stdin.end(options.input ?? "");
  });
}

export function runShell(command: string, cwd: string, timeoutMs?: number): Promise<CommandResult> {
  return runCommand({
    command: "sh",
    args: ["-lc", command],
    cwd,
    timeoutMs
  });
}
