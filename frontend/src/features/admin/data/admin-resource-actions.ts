import { adminApi } from "@/lib/api/endpoints";
import { schemaApi } from "@/lib/api/schema-api";
import { toAdminResourcePayload } from "@/lib/api/payload-mappers";
import type { AdminResourceKey } from "./admin-resource-config";

export type AdminSaveMode = "create" | "edit";

export async function saveAdminResourceRecord(
  resource: AdminResourceKey,
  mode: AdminSaveMode,
  payload: Record<string, string>,
  id?: string,
) {
  if (mode === "edit" && !id) {
    throw new Error("Missing record ID for update.");
  }

  if(resource==="customers" && ["balance","wallet_balance","wallet","role","is_superuser","is_staff"].some(key=>key in payload)){
    throw new Error("Wallet balances and role grants cannot be edited through customer profiles.");
  }
  const apiPayload = toAdminResourcePayload(resource, payload) as any;

  switch (resource) {
    case "customers":
      return mode === "create"
        ? adminApi.createCustomer(apiPayload)
        : adminApi.updateCustomer(id as string, apiPayload);

    case "products":
      return mode === "create"
        ? adminApi.createProduct(apiPayload)
        : adminApi.updateProduct(id as string, apiPayload);

    case "plans":
      return mode === "create"
        ? adminApi.createPlan(apiPayload)
        : adminApi.updatePlan(id as string, apiPayload);

    case "orders":
      return mode === "create"
        ? schemaApi.orders.createOrder(apiPayload)
        : schemaApi.orders.updateOrder(id as string, apiPayload);

    case "invoices":
      return mode === "create"
        ? schemaApi.billing.createInvoice(apiPayload)
        : schemaApi.billing.updateInvoice(id as string, apiPayload);

    case "domains":
      return mode === "create"
        ? schemaApi.domains.createDomain(apiPayload)
        : schemaApi.domains.updateDomain(id as string, apiPayload);

    case "gateways":
      return mode === "create"
        ? schemaApi.payments.createGateway(apiPayload)
        : schemaApi.payments.updateGateway(id as string, apiPayload);

    case "providers":
      return mode === "create"
        ? schemaApi.providers.createProvider(apiPayload)
        : schemaApi.providers.updateProvider(id as string, apiPayload);

    case "provisioning":
      return mode === "create"
        ? schemaApi.provisioning.createTask(apiPayload)
        : schemaApi.provisioning.updateTask(id as string, apiPayload);

    default:
      throw new Error("Unsupported admin resource.");
  }
}