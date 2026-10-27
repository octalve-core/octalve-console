/** Stable compatibility entry point; each resource owns its own editor schema. */
import type {AdminResourceKey} from "./admin-resource-config";
import type {AdminEditorConfig} from "./editor-config/types";
import {customersEditorConfig} from "./editor-config/customers";
import {productsEditorConfig} from "./editor-config/products";
import {plansEditorConfig} from "./editor-config/plans";
import {ordersEditorConfig} from "./editor-config/orders";
import {invoicesEditorConfig} from "./editor-config/invoices";
import {domainsEditorConfig} from "./editor-config/domains";
import {gatewaysEditorConfig} from "./editor-config/gateways";
import {providersEditorConfig} from "./editor-config/providers";
import {provisioningEditorConfig} from "./editor-config/provisioning";
export type {AdminFieldType,AdminEditorField,AdminEditorConfig} from "./editor-config/types";
export {statusOptions} from "./editor-config/status-options";

export const adminEditorConfig: Record<AdminResourceKey,AdminEditorConfig> = {
  customers: customersEditorConfig,
  products: productsEditorConfig,
  plans: plansEditorConfig,
  orders: ordersEditorConfig,
  invoices: invoicesEditorConfig,
  domains: domainsEditorConfig,
  gateways: gatewaysEditorConfig,
  providers: providersEditorConfig,
  provisioning: provisioningEditorConfig,
};
