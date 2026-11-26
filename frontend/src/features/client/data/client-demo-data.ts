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
  paymentReference?: string;
  status: string;
  amount?: string;
  date?: string;
  actionHref: string;
  score?: number;
  service?: ClientServiceSnapshot;
  invoicePeriods?: {label: string; start: string; end: string; confirmed: boolean; domain: boolean}[];
  invoiceDocuments?: {id: string; number: string; paymentHref?: string}[];
  paymentHref?: string;
  testCheckoutHref?: string;
  issuedDate?: string;
  createdDate?: string;
  dueDate?: string;
  paidDate?: string;
};

export const clientDemo: Record<ClientResourceKey, ClientRecord[]> = {
  services: [],
  domains: [],
  invoices: [],
  orders: [],
  support: [],
};
