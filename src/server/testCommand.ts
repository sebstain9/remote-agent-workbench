import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function determineTestCommand(
  worktreePath: string,
  explicitCommand?: string
): Promise<string | undefined> {
  const trimmed = explicitCommand?.trim();
  if (trimmed) return assertSafeTestCommand(trimmed);

  try {
    const raw = await readFile(join(worktreePath, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    if (pkg.scripts?.typecheck) return assertSafeTestCommand("npm run typecheck");
    if (pkg.scripts?.test) return assertSafeTestCommand("npm test");
  } catch {
    return undefined;
  }

  return undefined;
}

export function assertSafeTestCommand(command: string): string {
  const blockedPatterns = [
    /\bgit\s+push\b/i,
    /\b(?:npm|pnpm|yarn)\s+(?:run\s+)?deploy\b/i,
    /\bdeploy\b/i,
    /\bcurl\b.*\|\s*(?:sh|bash)\b/i,
    /\bwget\b.*\|\s*(?:sh|bash)\b/i,
    /\brm\s+-rf\s+(?:\/|\$HOME|~)\b/i,
    /\bgh\s+pr\s+create\b/i,
    /\bgh\s+repo\b/i
  ];
  const blocked = blockedPatterns.find((pattern) => pattern.test(command));
  if (blocked) {
    throw new Error(`Unsafe test command is blocked by V1 policy: ${command}`);
  }
  return command;
}
