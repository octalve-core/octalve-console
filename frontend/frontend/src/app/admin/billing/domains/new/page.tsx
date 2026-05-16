import { AdminResourceEditorView } from "@/features/admin/views/AdminResourceEditorView";

export default function AdminNewDomainPage() {
  return <AdminResourceEditorView resource="domains" mode="create" />;
}