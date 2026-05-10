import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "src");

function walkFiles(dir) {
  const output = [];

  if (!fs.existsSync(dir)) return output;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      output.push(...walkFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx)$/.test(item.name)) {
      output.push(fullPath);
    }
  }

  return output;
}

const bannedMarkers = [
  "brandde.com",
  "Brandde Studio",
  "DataArena Labs",
  "admin@octalve.cloud",
  "staff@octalve.cloud",
  "client@octalve.cloud",
  "password123",
  "demo-access",
  "demo-refresh",
  "SVC-HOST-001",
  "INV-001",
  "ORD-001",
  "TKT-001",
  "KB-001",
];

const allowedFiles = new Set([
  path.normalize("scripts/custom-data-audit.mjs"),
]);

const findings = [];

for (const file of walkFiles(srcRoot)) {
  const relative = path.normalize(path.relative(root, file));

  if (allowedFiles.has(relative)) continue;

  const content = fs.readFileSync(file, "utf8");

  for (const marker of bannedMarkers) {
    if (content.includes(marker)) {
      findings.push(`${relative}: custom/demo marker found: ${marker}`);
    }
  }
}

if (findings.length) {
  console.error("\nCustom data audit failed.\n");

  for (const finding of findings) {
    console.error(`- ${finding}`);
  }

  process.exit(1);
}

console.log("Custom data audit passed.");
console.log("No old demo/customer/service/order records found in src.");