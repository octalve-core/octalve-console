import type { AdminResourceKey } from "@/features/admin/data/admin-resource-config";

export type FormPayload = Record<string, string>;
export type ApiPayload = Record<string, unknown>;

function cleanString(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function compactPayload(payload: ApiPayload): ApiPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
}

function numberOrUndefined(value: unknown) {
  const cleaned = cleanString(value).replace(/[₦,\s]/g, "");

  if (!cleaned) return undefined;

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanFromString(value: unknown) {
  const cleaned = cleanString(value).toLowerCase();

  if (["true", "yes", "1", "enabled", "active", "live"].includes(cleaned)) return true;
  if (["false", "no", "0", "disabled", "inactive", "test"].includes(cleaned)) return false;

  return undefined;
}

function splitLines(value: unknown) {
  const cleaned = cleanString(value);

  if (!cleaned) return [];

  return cleaned
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normaliseStatus(value: unknown) {
  const cleaned = cleanString(value);

  if (!cleaned) return undefined;

  return cleaned;
}

export function toLoginPayload(payload: FormPayload): ApiPayload {
  return compactPayload({
    email: cleanString(payload.email).toLowerCase(),
    password: payload.password,
  });
}

export function toRegisterPayload(payload: FormPayload): ApiPayload {
  return compactPayload({
    full_name: cleanString(payload.full_name || payload.name),
    email: cleanString(payload.email).toLowerCase(),
    username: cleanString(payload.username) || cleanString(payload.email).split("@")[0],
    phone_number: cleanString(payload.phone || payload.phone_number),
    referral_code: cleanString(payload.referral_code),
    password: payload.password,
    re_password: payload.re_password || payload.password,
  });
}

export function toPasswordResetRequestPayload(email: string): ApiPayload {
  return compactPayload({
    email: cleanString(email).toLowerCase(),
  });
}

export function toPasswordResetConfirmPayload(uid: string, token: string, password: string): ApiPayload {
  return compactPayload({
    uid: cleanString(uid),
    token: cleanString(token),
    new_password: password,
    re_new_password: password,
  });
}

export function toAdminResourcePayload(resource: AdminResourceKey, payload: FormPayload): ApiPayload {
  switch (resource) {
    case "customers":
      // Never accept wallet, role or authentication flags as profile writes.
      return compactPayload({
        full_name: cleanString(payload.full_name),
        email: cleanString(payload.email).toLowerCase(),
        username: cleanString(payload.username),
        password: payload.password,
        phone_number: cleanString(payload.phone_number),
        company_name: cleanString(payload.company_name),
        address: cleanString(payload.address),
        city: cleanString(payload.city),
        state: cleanString(payload.state),
        country: cleanString(payload.country),
        postal_code: cleanString(payload.postal_code),
        tax_id: cleanString(payload.tax_id),
        status: normaliseStatus(payload.status),
        notes: cleanString(payload.notes),
      });

    case "products":
      return compactPayload({
        name: cleanString(payload.name),
        category: cleanString(payload.category),
        adapter: cleanString(payload.adapter),
        description: cleanString(payload.description),
        status: normaliseStatus(payload.status),
      });

    case "plans":
      return compactPayload({
        name: cleanString(payload.name),
        product: cleanString(payload.product),
        currency: cleanString(payload.currency),
        price: numberOrUndefined(payload.price),
        cycle: cleanString(payload.cycle),
        storage: cleanString(payload.storage),
        bandwidth: cleanString(payload.bandwidth),
        websites: cleanString(payload.websites),
        emails: cleanString(payload.emails),
        databases: cleanString(payload.databases),
        adapter: cleanString(payload.adapter),
        ssl: booleanFromString(payload.ssl),
        features: splitLines(payload.features),
        status: normaliseStatus(payload.status),
      });

    case "orders":
      return compactPayload({
        customer: cleanString(payload.customer),
        product: cleanString(payload.product),
        total: numberOrUndefined(payload.total),
        status: normaliseStatus(payload.status),
        date: cleanString(payload.date),
      });

    case "invoices":
      return compactPayload({
        client: cleanString(payload.client || payload.customer),
        total: numberOrUndefined(payload.total),
        paid: numberOrUndefined(payload.paid),
        due: numberOrUndefined(payload.due),
        date: cleanString(payload.date),
        due_date: cleanString(payload.dueDate || payload.due_date),
        status: normaliseStatus(payload.status),
      });

    case "domains":
      return compactPayload({
        domain: cleanString(payload.domain),
        client: cleanString(payload.client || payload.customer),
        registrar: cleanString(payload.registrar),
        price: numberOrUndefined(payload.price),
        renewal: cleanString(payload.renewal),
        expiry: cleanString(payload.expiry || payload.expiry_date),
        auto_renew: booleanFromString(payload.autoRenew || payload.auto_renew),
        status: normaliseStatus(payload.status),
      });

    case "gateways":
      return compactPayload({
        name: cleanString(payload.name),
        display_name: cleanString(payload.display_name),
        public_key: cleanString(payload.public_key),
        secret_key: cleanString(payload.secret_key),
        webhook_secret: cleanString(payload.webhook_secret),
        test_mode: booleanFromString(payload.test_mode),
        enabled: booleanFromString(payload.enabled || payload.status),
        summary: cleanString(payload.summary),
        status: normaliseStatus(payload.status),
      });

    case "providers":
      return compactPayload({
        name: cleanString(payload.name),
        adapter_type: cleanString(payload.adapter_type),
        ...(cleanString(payload.fulfillment_model)
          ? { config: { fulfillment_model: cleanString(payload.fulfillment_model) } }
          : {}),
        server_group: cleanString(payload.server_group),
        base_url: cleanString(payload.base_url),
        username: cleanString(payload.username),
        api_key: cleanString(payload.api_key),
        secret: cleanString(payload.secret),
        status: normaliseStatus(payload.status),
      });

    case "provisioning":
      return compactPayload({
        title: cleanString(payload.title),
        service: cleanString(payload.service),
        provider: cleanString(payload.provider),
        action: cleanString(payload.action),
        priority: cleanString(payload.priority),
        status: normaliseStatus(payload.status),
      });

    default:
      return compactPayload(payload);
  }
}

export function toAdminOperationPayload(
  operation: "support" | "knowledge-base" | "notifications",
  payload: FormPayload,
): ApiPayload {
  if (operation === "support") {
    return compactPayload({
      subject: cleanString(payload.subject),
      department: cleanString(payload.department),
      priority: cleanString(payload.priority || "Normal"),
      message: cleanString(payload.message),
      status: normaliseStatus(payload.status),
    });
  }

  if (operation === "knowledge-base") {
    return compactPayload({
      title: cleanString(payload.title),
      category: cleanString(payload.category),
      excerpt: cleanString(payload.excerpt),
      content: cleanString(payload.content),
      status: normaliseStatus(payload.status || "Draft"),
    });
  }

  return compactPayload({
    name: cleanString(payload.name),
    event: cleanString(payload.event),
    subject: cleanString(payload.subject),
    body: cleanString(payload.body),
    status: normaliseStatus(payload.status || "Active"),
  });
}

export function toClientSupportPayload(payload: FormPayload): ApiPayload {
  return compactPayload({
    subject: cleanString(payload.subject),
    department: cleanString(payload.department),
    priority: cleanString(payload.priority || "Normal"),
    message: cleanString(payload.message),
  });
}

export function toClientOrderPayload(payload: FormPayload): ApiPayload {
  return compactPayload({
    plan_id: cleanString(payload.plan_id),
    product: cleanString(payload.product),
    domain: cleanString(payload.domain),
    payment_method: cleanString(payload.payment_method),
    total: numberOrUndefined(payload.total),
  });
}

export function toWorkspacePayload(payload: FormPayload): ApiPayload {
  return compactPayload({
    ...payload,
    amount: numberOrUndefined(payload.amount),
    total: numberOrUndefined(payload.total),
    price: numberOrUndefined(payload.price),
    status: normaliseStatus(payload.status),
  });
}