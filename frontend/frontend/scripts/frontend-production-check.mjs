import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "src/lib/api/schema-api.ts",
  "src/lib/api/paths.ts",
  "src/lib/api/contract-registry.ts",
  "src/lib/config/runtime.ts",
  "src/components/layout/DashboardShell.tsx",
  "src/components/layout/RoleGuard.tsx",
  "src/context/AuthContext.tsx",
  "src/features/auth/views/LoginView.tsx",
  "src/features/admin/views/AdminOverviewView.tsx",
  "src/features/client/views/ClientDashboardView.tsx",
  "src/features/staff/views/StaffDashboardView.tsx",
  "src/features/system/views/ProductionReadinessView.tsx",
  "src/app/admin/layout.tsx",
  "src/app/client/layout.tsx",
  "src/app/staff/layout.tsx",
];

function walkFiles(dir) {
  const output = [];

  if (!fs.existsSync(dir)) return output;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      output.push(...walkFiles(fullPath));
    } else {
      output.push(fullPath);
    }
  }

  return output;
}

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));

const srcFiles = walkFiles(path.join(root, "src"));
const forbiddenBackupFiles = srcFiles.filter((file) => {
  const name = path.basename(file);
  return (
    /\.bak\.(ts|tsx|js|jsx)$/i.test(name) ||
    /\.before.*\.(ts|tsx|js|jsx)$/i.test(name)
  );
});

if (missingFiles.length || forbiddenBackupFiles.length) {
  console.error("\nFrontend production check failed.\n");

  if (missingFiles.length) {
    console.error("Missing required files:");
    for (const file of missingFiles) {
      console.error(`- ${file}`);
    }
  }

  if (forbiddenBackupFiles.length) {
    console.error("\nBackup files found inside src. Move or delete them:");
    for (const file of forbiddenBackupFiles) {
      console.error(`- ${path.relative(root, file)}`);
    }
  }

  process.exit(1);
}

console.log("Frontend production check passed.");
console.log(`Checked ${requiredFiles.length} required files.`);
console.log("No forbidden backup files found inside src.");