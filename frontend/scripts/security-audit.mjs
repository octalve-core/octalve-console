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

const files = walkFiles(srcRoot);

const bannedAuthMarkers = [
  "demo-access",
  "demo-refresh",
  "demoUsers",
  "password123",
  "createDemoLoginSession",
  "createDemoSignupSession",
];

const suspiciousPatterns = [
  {
    label: "Password appears inside router navigation",
    regex: /router\.(push|replace)\([^)]*password/ims,
  },
  {
    label: "Password appears inside URLSearchParams.set/append",
    regex: /URLSearchParams[\s\S]{0,400}\.(set|append)\(["'`]password/ims,
  },
  {
    label: "Console logging password",
    regex: /console\.(log|debug|info)\([^)]*password/ims,
  },
  {
    label: "Console logging token",
    regex: /console\.(log|debug|info)\([^)]*token/ims,
  },
  {
    label: "Frontend token stored in localStorage",
    regex: /localStorage\.setItem\([^)]*(access|refresh|token)/ims,
  },
];

const findings = [];

for (const file of files) {
  const relative = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");

  for (const marker of bannedAuthMarkers) {
    if (content.includes(marker)) {
      findings.push(`${relative}: banned demo auth marker found: ${marker}`);
    }
  }

  for (const pattern of suspiciousPatterns) {
    if (pattern.regex.test(content)) {
      findings.push(`${relative}: ${pattern.label}`);
    }
  }
}

if (findings.length) {
  console.error("\nSecurity audit failed.\n");

  for (const finding of findings) {
    console.error(`- ${finding}`);
  }

  process.exit(1);
}

console.log("Security audit passed.");
console.log("No demo auth markers, password-in-URL navigation, credential console logs, or token localStorage writes found.");