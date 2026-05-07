// src/lib/api/types.ts

export type ID = string;

export type UserRole = "admin" | "staff" | "client";

export type ResourceStatus =
  | "Active"
  | "Inactive"
  | "Pending"
  | "Suspended"
  | "Cancelled"
  | "Archived"
  | "Planned"
  | "Disabled"
  | "Test"
  | "Paid"
  | "Unpaid"
  | "Draft"
  | "Open"
  | "Closed";

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type User = {
  id: ID;
  name: string;
  email: string;
  role: UserRole;

  // UI compatibility
  avatar_url?: string | null;

  // Django/backend compatibility
  full_name?: string | null;
  username?: string;
  phone_number?: string;
  referral_code?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_active?: boolean;
  date_joined?: string;
  last_login?: string;
};

export type AuthTokenResponse = {
  access: string;
  refresh?: string;
  user?: User;
};

export type AuthSession = {
  access: string;
  refresh?: string;
  user: User;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type SignupPayload = {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  referral_code?: string;
};

export type SignupResponse = {
  id: number | string;
  email: string;
  username?: string;
  full_name?: string;
  phone_number?: string;
};

export type Customer = {
  id: ID;
  name: string;
  email: string;
  phone?: string;
  status: ResourceStatus;
  balance?: string;
};

export type Product = {
  id: ID;
  name: string;
  category: string;
  adapter: string;
  status: ResourceStatus;
  description?: string;
};

export type PlanCycle = {
  label: string;
  price: number;
};

export type Plan = {
  id: ID;
  name: string;
  product: string;
  currency: string;
  price: number;
  cycle: string;
  storage?: string;
  bandwidth?: string;
  websites?: string;
  emails?: string;
  databases?: string;
  ssl?: boolean;
  popular?: boolean;
  adapter: string;
  features: string[];
  cycles: PlanCycle[];
  status?: ResourceStatus;
};

export type Order = {
  id: ID;
  customer: string;
  product: string;
  total: string;
  status: ResourceStatus;
  date: string;
};

export type ServiceUsage = Record<string, number>;

export type Service = {
  id: ID;
  customer: string;
  package: string;
  product: string;
  label: string;
  term: string;
  renews: string;
  status: ResourceStatus;
  adapter: string;
  usage?: ServiceUsage;
};

export type Domain = {
  id: ID;
  domain: string;
  client: string;
  registrar: string;
  price: string;
  renewal: string;
  expiry: string;
  autoRenew: string;
  status: ResourceStatus;
};

export type Invoice = {
  id: ID;
  client: string;
  total: string;
  paid: string;
  due: string;
  date: string;
  dueDate: string;
  status: ResourceStatus;
};

export type Transaction = {
  id: ID;
  client: string;
  type: string;
  amount: string;
  credited: string;
  applied: string;
  reference: string;
  date: string;
  status: ResourceStatus;
};

export type Gateway = {
  id: ID;
  name: string;
  summary: string;
  status: ResourceStatus;
  fields?: string[];
};

export type Provider = {
  id: ID;
  name: string;
  adapter_type: string;
  base_url?: string;
  status: ResourceStatus;
  health_status?: string;
};

export type SupportTicket = {
  id: ID;
  customer: string;
  subject: string;
  department: string;
  priority: string;
  status: ResourceStatus;
  lastReply?: string;
};

export type KnowledgeBaseArticle = {
  id?: ID;
  title: string;
  category: string;
  excerpt: string;
  content?: string;
  views?: number;
  likes?: number;
  status?: ResourceStatus;
};

export type WalletBalance = {
  available: number;
  currency: string;
};

export type AuditLog = {
  time: string;
  actor: string;
  role: string;
  action: string;
  entity: string;
  details: string;
  ip?: string;
};

export type ApiKeyPayload = {
  name: string;
  allowed_ips?: string[];
  permissions: string[];
};

export type GatewayConfigPayload = {
  display_name: string;
  public_key?: string;
  secret_key?: string;
  webhook_secret?: string;
  test_mode?: boolean;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
};

export type ProviderConfigPayload = {
  name: string;
  adapter_type: string;
  base_url?: string;
  username?: string;
  api_key?: string;
  secret?: string;
  metadata?: Record<string, unknown>;
};
