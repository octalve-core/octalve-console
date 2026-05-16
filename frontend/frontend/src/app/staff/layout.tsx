import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowed={["staff"]}>{children}</RoleGuard>;
}