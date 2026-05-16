export type StaffResourceKey =
  | "customers"
  | "orders"
  | "provisioning"
  | "tickets"
  | "knowledgeBase";

export type StaffRecord = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  date?: string;
  actionHref: string;
};

export const staffDemo: Record<StaffResourceKey, StaffRecord[]> = {
  customers: [],
  orders: [],
  provisioning: [],
  tickets: [],
  knowledgeBase: [],
};