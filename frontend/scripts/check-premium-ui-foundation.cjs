"use strict";
const fs = require("node:fs");
const path = require("node:path");
const front = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(front, relative), "utf8");

// This guard protects the *additive* foundation. It does not certify browser
// parity or authorize broad deletion of the compatibility stylesheet.
if (fs.existsSync(path.join(front, "postcss.config.js"))) {
  throw new Error("Retired duplicate PostCSS config returned");
}
const postcss = read("postcss.config.mjs");
if (!postcss.includes("tailwindcss: {}") || !postcss.includes("autoprefixer: {}")) {
  throw new Error("Tailwind v3 PostCSS setup changed unexpectedly");
}
const css = read("src/app/globals.css");
if (!css.startsWith("@tailwind base;\n@tailwind components;\n@tailwind utilities;")) {
  throw new Error("Tailwind v3 directives missing");
}
if(css.split("\n").length>300)throw Error("CSS retirement line cap exceeded");
for(const old of [".grid {",".button {",".card {",".table {",".page-container {"])
 if(css.includes(old))throw Error("Legacy global collision returned: "+old);
// One completed ownership migration: the old metric card no longer requires
// its three dedicated global selectors; .stat-icon is deliberately retained
// for the independently-owned AdminToolPage until its migration qualifies.
for (const retired of ["stat-card", "stat-label", "stat-value"]) {
  if (new RegExp("\\." + retired + "\\s*\\{").test(css)) {
    throw new Error("Retired StatCard selector returned: " + retired);
  }
}
if (/\\.stat-icon\\s*\\{/.test(css)) throw new Error("Retired shared stat icon rule returned");
if (read("src/components/modules/AdminToolPage.tsx").includes('className="stat-icon"')) {
  throw new Error("Legacy Admin tool stat icon consumer returned");
}
const migratedStat = read("src/components/ui/StatCard.tsx");
for (const token of ["rounded-console-card", "border-console-line", "text-console-muted", "text-console-ink"]) {
  if (!migratedStat.includes(token)) throw new Error("StatCard migration lost " + token);
}
for (const retired of ["stat-card", "stat-label", "stat-value", "stat-icon"]) {
  if (new RegExp("className=.{0,140}" + retired + "(?![A-Za-z0-9_-])").test(migratedStat)) {
    throw new Error("StatCard still owns legacy class: " + retired);
  }
}
const config = read("tailwind.config.ts");
for (const token of [
  '"page-gutter": "clamp(1rem, 2vw, 2rem)"',
  '"section": "2rem"',
  '"section-lg": "3rem"',
  '"console-content": "97.5rem"',
  '"console-reading": "48rem"',
  '"console-card": "1.5rem"',
  '"console-control": "0.875rem"',
]) {
  if (!config.includes(token)) throw new Error("Layout foundation token missing: " + token);
}
const layout = read("src/components/design-system/WorkspaceLayout.tsx");
for (const token of ["export function WorkspaceContainer", "export function WorkspaceSection",
  "max-w-console-content", "px-page-gutter", "py-section", "md:py-section-lg"]) {
  if (!layout.includes(token)) throw new Error("Opt-in layout component missing: " + token);
}
if (/\bfetch\s*\(|\baxios\b|\blocalStorage\b/.test(layout)) {
  throw new Error("Presentational foundation must not own business state");
}
if (!read("src/app/layout.tsx").includes('import "./globals.css"')) throw Error("Tailwind CSS entrypoint missing");
if (process.argv.includes("--built")) {
  const folder = path.join(front, ".next/static"), cssAssets = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (full.endsWith(".css")) cssAssets.push(full);
    }
  }
  walk(folder);
  if (!cssAssets.length) throw new Error("Next did not emit CSS");
  const emitted = cssAssets.map(name => fs.readFileSync(name, "utf8")).join("\n");
  for (const rule of [".px-page-gutter", ".max-w-console-content",
    ".py-section", ".md\\:py-section-lg", ".bg-console-primary",
    "]) {
    if (!emitted.includes(rule)) throw new Error("Emitted CSS missing: " + rule);
  }
}
console.log("PASS: Tailwind v3, layout tokens and retired global CSS confirmed.");
console.log("PENDING: 135 routes / 810 authenticated viewport cases and role-specific evidence before further CSS retirement.");
