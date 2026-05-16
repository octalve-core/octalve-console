import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "src/lib/api/validation.ts",
  "src/components/feedback/ApiFormError.tsx",
  "src/components/forms/FieldError.tsx",
  "src/features/admin/views/AdminResourceEditorView.tsx",
];

const requiredStrings = [
  "parseApiValidationError",
  "getApiFieldError",
  "ApiFormError",
  "FieldError",
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));

const combinedContent = requiredFiles
  .filter((file) => fs.existsSync(path.join(root, file)))
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");

const missingStrings = requiredStrings.filter((text) => !combinedContent.includes(text));

if (missingFiles.length || missingStrings.length) {
  console.error("\nValidation audit failed.\n");

  if (missingFiles.length) {
    console.error("Missing files:");
    for (const file of missingFiles) console.error(`- ${file}`);
  }

  if (missingStrings.length) {
    console.error("\nMissing validation markers:");
    for (const text of missingStrings) console.error(`- ${text}`);
  }

  process.exit(1);
}

console.log("Validation audit passed.");
console.log("API validation parser and field-level error components are present.");