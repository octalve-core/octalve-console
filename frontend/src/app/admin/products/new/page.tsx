import { redirect } from "next/navigation";

// Supplier-backed catalog mutations are performed by the reviewed workbench.
// Do not submit the obsolete generic plan/product fields to Django.
export default function AdminCatalogCreateRedirect() {
  redirect("/admin/catalog/workbench");
}
