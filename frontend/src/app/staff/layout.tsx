import { PortalShell } from "@/components/layout/PortalShell";
import type { ReactNode } from "react";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <PortalShell area="staff">{children}</PortalShell>;
}
