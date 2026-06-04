#!/usr/bin/env node
import { readFileSync } from "node:fs";

const input = readStdin();
const command = extractCommand(input);

const dangerousPatterns = [
  { name: "git push", regex: /\bgit\s+push\b/i },
  { name: "git reset --hard", regex: /\bgit\s+reset\s+--hard\b/i },
  { name: "git clean -f", regex: /\bgit\s+clean\s+-[A-Za-z]*f[A-Za-z]*\b/i },
  { name: "git branch -D", regex: /\bgit\s+branch\s+-D\b/i },
  { name: "git checkout .", regex: /\bgit\s+checkout\s+(?:--\s+)?\.(?:\s|$)/i },
  { name: "git restore .", regex: /\bgit\s+restore\s+(?:--\s+)?\.(?:\s|$)/i },
  { name: "rm -rf protected root", regex: /\brm\s+-rf\s+(?:\/|~|\$HOME)(?:\s|$)/i }
];

for (const pattern of dangerousPatterns) {
  if (pattern.regex.test(command)) {
    console.error(`BLOCKED: command matches dangerous pattern "${pattern.name}": ${command}`);
    process.exit(2);
  }
}

process.exit(0);

function readStdin() {
  try {
    return readFileSync(0, "utf8").trim();
  } catch {
    return "";
  }
}

function extractCommand(rawInput) {
  if (!rawInput) return "";

  try {
    const payload = JSON.parse(rawInput);
    const candidates = [
      payload?.tool_input?.command,
      payload?.toolInput?.command,
      payload?.input?.command,
      payload?.command
    ];
    const match = candidates.find((value) => typeof value === "string");
    if (match) return match;
  } catch {
    // Plain command text is supported.
  }

  return rawInput;
}
