import { AdminResourceEditorView } from "@/features/admin/views/AdminResourceEditorView";

export default function AdminNewOrderPage() {
  return <AdminResourceEditorView resource="orders" mode="create" />;
}