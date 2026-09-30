// PostToolUse (Write|Edit) hook: lints the just-edited file with eslint if it's
// a frontend/**/*.ts(x) file. Exits 0 (no-op) for anything else.
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const filePath = payload.tool_input && payload.tool_input.file_path;
  if (!filePath) return;

  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/^(.*)\/frontend\/(.+\.tsx?)$/);
  if (!match) return;

  const [, repoRoot, relPath] = match;
  const frontendDir = `${repoRoot}/frontend`;
  const eslintBin = path.join(frontendDir, "node_modules", "eslint", "bin", "eslint.js");
  if (!fs.existsSync(eslintBin)) return;

  try {
    const output = execFileSync(process.execPath, [eslintBin, relPath], {
      cwd: frontendDir,
      encoding: "utf8",
    });
    if (output.trim()) process.stdout.write(output);
  } catch (err) {
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
  }
});
