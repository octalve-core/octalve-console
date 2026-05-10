import { adminApi } from "@/lib/api/endpoints";
import { schemaApi } from "@/lib/api/schema-api";
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

  switch (resource) {
    case "customers":
      return mode === "create"
        ? adminApi.createCustomer(payload)
        : adminApi.updateCustomer(id as string, payload);

    case "products":
      return mode === "create"
        ? adminApi.createProduct(payload)
        : adminApi.updateProduct(id as string, payload);

    case "plans":
      return mode === "create"
        ? adminApi.createPlan(payload)
        : adminApi.updatePlan(id as string, payload);

    case "orders":
      return mode === "create"
        ? schemaApi.orders.createOrder(payload)
        : schemaApi.orders.updateOrder(id as string, payload);

    case "invoices":
      return mode === "create"
        ? schemaApi.billing.createInvoice(payload)
        : schemaApi.billing.updateInvoice(id as string, payload);

    case "domains":
      return mode === "create"
        ? schemaApi.domains.createDomain(payload)
        : schemaApi.domains.updateDomain(id as string, payload);

    case "gateways":
      return mode === "create"
        ? schemaApi.payments.createGateway(payload)
        : schemaApi.payments.updateGateway(id as string, payload);

    case "providers":
      return mode === "create"
        ? schemaApi.providers.createProvider(payload)
        : schemaApi.providers.updateProvider(id as string, payload);

    case "provisioning":
      return mode === "create"
        ? schemaApi.provisioning.createTask(payload)
        : schemaApi.provisioning.updateTask(id as string, payload);

    default:
      throw new Error("Unsupported admin resource.");
  }
}