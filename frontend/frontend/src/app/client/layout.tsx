import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowed={["client"]}>{children}</RoleGuard>;
}