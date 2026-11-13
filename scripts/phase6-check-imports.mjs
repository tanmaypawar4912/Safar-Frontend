/** Check every relative import in frontend/src resolves to a file. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const sourceRoot = path.join(frontendRoot, "src");
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".svg", ".png", ".jpg", ".jpeg", ".webp"];
const ignoredDirs = new Set(["node_modules", "dist", ".git"]);
const issues = [];
let importsChecked = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(path.join(directory, entry.name));
      continue;
    }
    if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) inspectFile(path.join(directory, entry.name));
  }
}

function resolvesImport(fromFile, specifier) {
  const rawTarget = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [rawTarget];
  if (!path.extname(rawTarget)) {
    for (const extension of sourceExtensions) candidates.push(`${rawTarget}${extension}`);
    for (const extension of sourceExtensions) candidates.push(path.join(rawTarget, `index${extension}`));
  }
  return candidates.some((candidate) => {
    try { return fs.statSync(candidate).isFile(); } catch { return false; }
  });
}

function inspectFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const pattern = /\b(?:from\s*|import\s*)["']([^"']+)["']/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    importsChecked += 1;
    if (!resolvesImport(filePath, specifier)) {
      const line = source.slice(0, match.index).split("\n").length;
      issues.push(`${path.relative(frontendRoot, filePath)}:${line} -> ${specifier}`);
    }
  }
}

if (!fs.existsSync(sourceRoot)) {
  console.error(`Source directory not found: ${sourceRoot}`);
  process.exit(2);
}

walk(sourceRoot);
if (issues.length) {
  console.error(`Found ${issues.length} unresolved relative import(s) after checking ${importsChecked} import(s):`);
  for (const issue of issues) console.error(`  FAIL  ${issue}`);
  process.exit(1);
}
console.log(`PASS  ${importsChecked} relative imports resolve within frontend/src.`);
