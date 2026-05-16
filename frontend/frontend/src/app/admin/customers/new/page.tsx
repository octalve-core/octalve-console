import { AdminResourceEditorView } from "@/features/admin/views/AdminResourceEditorView";

export default function AdminNewCustomerPage() {
  return <AdminResourceEditorView resource="customers" mode="create" />;
}