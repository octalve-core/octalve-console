import type {AdminEditorConfig} from "./types";
import {statusOptions} from "./status-options";

/** Existing resource editor definition; service authority is unchanged. */
export const productsEditorConfig: AdminEditorConfig = {
  key: "products",
  listHref: "/admin/products",
  newHref: "/admin/products/new",
  detailLabel: "Product profile",
  createTitle: "Add product",
  editTitle: "Edit product",
  description: "Manage a hosting product, adapter, category, and product visibility.",
  fields: [
    { name: "name", label: "Product name", type: "text", placeholder: "Web Hosting", required: true },
    { name: "category", label: "Category", type: "text", placeholder: "Hosting", required: true },
    { name: "adapter", label: "Adapter", type: "text", placeholder: "directadmin", required: true },
    { name: "description", label: "Description", type: "textarea", placeholder: "Describe this product", required: false },
    { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
  ],
};
