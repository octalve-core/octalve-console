import { AdminResourceEditorView } from "@/features/admin/views/AdminResourceEditorView";

export default function AdminNewInvoicePage() {
  return <AdminResourceEditorView resource="invoices" mode="create" />;
}