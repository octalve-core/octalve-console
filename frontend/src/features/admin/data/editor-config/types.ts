import type {AdminResourceKey} from "../admin-resource-config";

export type AdminFieldType = "text" | "email" | "number" | "date" | "textarea" | "select" | "password";

export type AdminEditorField = {
  name: string;
  label: string;
  type: AdminFieldType;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
};

export type AdminEditorConfig = {
  key: AdminResourceKey;
  listHref: string;
  newHref?: string;
  detailLabel: string;
  createTitle: string;
  editTitle: string;
  description: string;
  fields: AdminEditorField[];
};
