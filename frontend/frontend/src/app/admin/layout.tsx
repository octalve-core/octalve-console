import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowed={["admin"]}>{children}</RoleGuard>;
}