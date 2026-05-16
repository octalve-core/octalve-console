import { AdminResourceEditorView } from "@/features/admin/views/AdminResourceEditorView";

export default function AdminNewGatewayPage() {
  return <AdminResourceEditorView resource="gateways" mode="create" />;
}