import { PortalShell } from "@/components/layout/PortalShell";
import type { ReactNode } from "react";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return <PortalShell area="client">{children}</PortalShell>;
}
