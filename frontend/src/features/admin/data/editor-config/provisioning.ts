import type {AdminEditorConfig} from "./types";
import {statusOptions} from "./status-options";

/** Existing resource editor definition; service authority is unchanged. */
export const provisioningEditorConfig: AdminEditorConfig = {
  key: "provisioning",
  listHref: "/admin/provisioning",
  newHref: "/admin/provisioning/run",
  detailLabel: "Provisioning task",
  createTitle: "Create provisioning task",
  editTitle: "Edit provisioning task",
  description: "Create or update automation tasks for services, domains, providers, and billing actions.",
  fields: [
    { name: "title", label: "Task title", type: "text", placeholder: "Create hosting account", required: true },
    { name: "service", label: "Service", type: "text", placeholder: "Service ID or domain", required: false },
    { name: "provider", label: "Provider", type: "text", placeholder: "DirectAdmin Node 1", required: false },
    { name: "action", label: "Action", type: "text", placeholder: "provision", required: true },
    { name: "priority", label: "Priority", type: "select", required: false, options: [
      { label: "Low", value: "low" },
      { label: "Normal", value: "normal" },
      { label: "High", value: "high" },
    ] },
    { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
  ],
};
