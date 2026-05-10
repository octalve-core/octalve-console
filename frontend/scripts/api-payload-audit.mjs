import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "src/lib/api/payload-mappers.ts",
  "src/features/admin/data/admin-resource-actions.ts",
  "src/features/client/views/ClientCheckoutView.tsx",
  "src/features/client/views/ClientSupportTicketEditorView.tsx",
  "src/features/admin/operations/views/AdminOperationEditorView.tsx",
];

const requiredMapperFunctions = [
  "toAdminResourcePayload",
  "toAdminOperationPayload",
  "toClientOrderPayload",
  "toClientSupportPayload",
  "toPasswordResetConfirmPayload",
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));

const mapperPath = path.join(root, "src/lib/api/payload-mappers.ts");
const mapperContent = fs.existsSync(mapperPath) ? fs.readFileSync(mapperPath, "utf8") : "";

const missingFunctions = requiredMapperFunctions.filter((fn) => !mapperContent.includes(`function ${fn}`));

if (missingFiles.length || missingFunctions.length) {
  console.error("\nAPI payload audit failed.\n");

  if (missingFiles.length) {
    console.error("Missing files:");
    for (const file of missingFiles) console.error(`- ${file}`);
  }

  if (missingFunctions.length) {
    console.error("\nMissing mapper functions:");
    for (const fn of missingFunctions) console.error(`- ${fn}`);
  }

  process.exit(1);
}

console.log("API payload audit passed.");
console.log("Payload mapper layer is present.");
console.log(`Checked ${requiredFiles.length} files and ${requiredMapperFunctions.length} mapper functions.`);