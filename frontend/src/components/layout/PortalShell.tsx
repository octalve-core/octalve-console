"use client";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { ReactNode } from "react";
import { useState } from "react";

export function PortalShell({
  area,
  children
}: {
  area: "admin" | "client" | "staff";
  children: ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="oct-console-shell">
      <Sidebar
        area={area}
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="oct-main-frame">
        <Topbar area={area} onMenuClick={() => setMobileSidebarOpen(true)} />
        <div className="oct-page-scroll">{children}</div>
      </div>
    </div>
  );
}
