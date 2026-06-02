import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

const textExtensions = new Set([
  "",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml"
]);

const allowedPaths = new Set(["scripts/public-scan.mjs"]);

const files = listCandidateFiles()
  .filter((file) => !allowedPaths.has(file))
  .filter((file) => textExtensions.has(extname(file)))
  .filter((file) => existsSync(file) && statSync(file).isFile());

const patterns = [
  { name: "apollo-home-path", regex: /\/Users\/apollo/ },
  { name: "private-env-file-reference", regex: /(?:^|\/)\.env(?:\.|$)/ },
  { name: "codex-private-run-state", regex: /\.codex-autonomy/ },
  { name: "openai-api-key", regex: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "github-token", regex: /gh[opsu]_[A-Za-z0-9_]{20,}/ },
  { name: "private-key-block", regex: /BEGIN (RSA|OPENSSH|PRIVATE) KEY/ },
  { name: "auth-json", regex: /auth\.json/ }
];

const findings = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const pattern of patterns) {
    if (file === ".gitignore" && pattern.name === "private-env-file-reference") continue;
    if (file === ".gitignore" && pattern.name === "codex-private-run-state") continue;
    if (pattern.regex.test(text)) findings.push(`${file}: ${pattern.name}`);
  }
}

if (findings.length) {
  console.error("Public scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Public scan passed for ${files.length} text files.`);

function listCandidateFiles() {
  try {
    const tracked = execSync("git ls-files", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .filter(Boolean);
    if (tracked.length) return tracked;
  } catch {
    // Fallback below is used before the first git commit.
  }

  return execSync(
    "find . -type f -not -path './node_modules/*' -not -path './dist/*' -not -path './.git/*' -not -path './ui-*.png'",
    { encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)
    .map((file) => file.replace(/^\.\//, ""));
}
