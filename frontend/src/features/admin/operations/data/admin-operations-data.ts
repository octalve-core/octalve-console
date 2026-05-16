export type AdminOperationKey =
  | "support"
  | "departments"
  | "responses"
  | "knowledge-base"
  | "audit-logs"
  | "reports"
  | "notifications";

export type AdminOperationRecord = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  date?: string;
  actionHref: string;
};

export const adminOperationsDemo: Record<AdminOperationKey, AdminOperationRecord[]> = {
  support: [],
  departments: [],
  responses: [],
  "knowledge-base": [],
  "audit-logs": [],
  reports: [],
  notifications: [],
};