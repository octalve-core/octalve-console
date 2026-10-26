import type {ReactNode} from "react";
import {DashboardShell} from "./DashboardShell";
import type {DashboardRole} from "@/lib/navigation/dashboard-nav";

/** Compatibility entry point; active role pages share a single TypeScript/Tailwind shell. */
export function PortalShell({area,children}:{area:DashboardRole;children:ReactNode}){
 return <DashboardShell role={area} title="Octalve Console">{children}</DashboardShell>;
}
