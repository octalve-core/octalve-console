import type {ResourceStatus} from "@/lib/api/types";

export const statusOptions: Array<{ label: ResourceStatus | string; value: ResourceStatus | string }> = [
  { label: "active", value: "Active" },
  // { label: "Pending", value: "Pending" },
  { label: "Inactive", value: "Inactive" },
  // { label: "Suspended", value: "Suspended" },
  // { label: "Cancelled", value: "Cancelled" },
  // { label: "Draft", value: "Draft" },
  // { label: "Paid", value: "Paid" },
  // { label: "Unpaid", value: "Unpaid" },
  // { label: "Planned", value: "Planned" },
  { label: "Test Mode", value: "test" },
];
