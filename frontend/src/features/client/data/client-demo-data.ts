import type {ClientServiceSnapshot} from "../utils/service-contract";

export type ClientResourceKey =
  | "services"
  | "domains"
  | "invoices"
  | "orders"
  | "support";

export type ClientRecord = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  amount?: string;
  date?: string;
  actionHref: string;
  score?: number;
  service?: ClientServiceSnapshot;
};

export const clientDemo: Record<ClientResourceKey, ClientRecord[]> = {
  services: [],
  domains: [],
  invoices: [],
  orders: [],
  support: [],
};