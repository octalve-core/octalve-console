import { PortalShell } from "@/components/layout/PortalShell";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <PortalShell area="admin">{children}</PortalShell>;
}
