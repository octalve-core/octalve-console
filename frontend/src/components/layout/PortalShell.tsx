import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { ReactNode } from "react";

export function PortalShell({ area, children }: { area: "admin" | "client" | "staff"; children: ReactNode }) {
  const label = area === "admin" ? "Admin" : area === "client" ? "Client" : "Staff";
  return (
    <div className="app-shell">
      <Sidebar area={area} />
      <div className="main-frame">
        <Topbar area={label} />
        {children}
      </div>
    </div>
  );
}
