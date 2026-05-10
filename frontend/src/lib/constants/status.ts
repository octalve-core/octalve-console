export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const successStatuses = [
  "active",
  "paid",
  "completed",
  "fulfilled",
  "open",
  "resolved",
];
const warningStatuses = [
  "pending",
  "draft",
  "planned",
  "processing",
  "queued",
  "unpaid",
];
const dangerStatuses = [
  "failed",
  "cancelled",
  "suspended",
  "disabled",
  "inactive",
  "closed",
];
const infoStatuses = ["test", "archived", "review", "needs_review"];

export function getStatusTone(status?: string | null): StatusTone {
  const value = String(status ?? "")
    .trim()
    .toLowerCase();

  if (successStatuses.includes(value)) return "success";
  if (warningStatuses.includes(value)) return "warning";
  if (dangerStatuses.includes(value)) return "danger";
  if (infoStatuses.includes(value)) return "info";

  return "neutral";
}

export function formatStatus(status?: string | null) {
  if (!status) return "Unknown";

  return String(status)
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
