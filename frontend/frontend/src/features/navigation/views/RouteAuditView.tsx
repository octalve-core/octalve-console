"use client";

import { useMemo, useState } from "react";
import { Filter, Route, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { MetricCard } from "@/components/data/MetricCard";
import { ResponsiveGrid } from "@/components/data/ResponsiveGrid";
import {
  getRouteAccessSummary,
  routeAccessItems,
  type RouteAccessArea,
  type RouteAccessRole,
  type RouteAccessItem,
} from "@/lib/navigation/route-access";

const areaOptions: Array<RouteAccessArea | "All"> = ["All", "Auth", "Admin", "Client", "Staff", "System"];
const roleOptions: Array<RouteAccessRole | "All"> = ["All", "public", "admin", "client", "staff"];

function getRoleTone(role: RouteAccessRole) {
  if (role === "admin") return "danger";
  if (role === "client") return "info";
  if (role === "staff") return "purple";
  return "neutral";
}

function getStatusTone(status: RouteAccessItem["status"]) {
  if (status === "Migrated") return "success";
  if (status === "Protected") return "info";
  if (status === "Utility") return "purple";
  return "neutral";
}

export function RouteAuditView() {
  const summary = getRouteAccessSummary();
  const [area, setArea] = useState<RouteAccessArea | "All">("All");
  const [role, setRole] = useState<RouteAccessRole | "All">("All");

  const filteredRoutes = useMemo(() => {
    return routeAccessItems.filter((item) => {
      const areaMatches = area === "All" || item.area === area;
      const roleMatches = role === "All" || item.role === role;

      return areaMatches && roleMatches;
    });
  }, [area, role]);

  return (
    <DashboardShell
      role="admin"
      title="Route audit"
      description="Review navigation, route protection, and role-access mapping across Octalve Console."
    >
      <DashboardPage
        eyebrow="Navigation Audit"
        title="Route and role-access audit"
        description="A central view of public, admin, client, and staff routes. Use this to confirm that migrated pages are protected and easy to maintain."
      >
        <div className="space-y-6">
          <ResponsiveGrid columns="4">
            <MetricCard
              label="Total routes"
              value={String(summary.total)}
              description="Registered in audit map"
              icon={<Route className="h-5 w-5" />}
            />
            <MetricCard
              label="Admin routes"
              value={String(summary.admin)}
              description="Admin-only protected routes"
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <MetricCard
              label="Client routes"
              value={String(summary.client)}
              description="Client-only protected routes"
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <MetricCard
              label="Staff routes"
              value={String(summary.staff)}
              description="Staff-only protected routes"
              icon={<ShieldCheck className="h-5 w-5" />}
            />
          </ResponsiveGrid>

          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Filter className="h-4 w-4 text-slate-400" />
                Filters
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={area}
                  onChange={(event) => setArea(event.target.value as RouteAccessArea | "All")}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#0064E0] focus:ring-4 focus:ring-[#0064E0]/10"
                >
                  {areaOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>

                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as RouteAccessRole | "All")}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-[#0064E0] focus:ring-4 focus:ring-[#0064E0]/10"
                >
                  {roleOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Route
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Area
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Role
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Status
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Notes
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRoutes.map((item) => (
                    <tr key={`${item.area}-${item.path}`} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-950">{item.label}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{item.path}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{item.area}</td>
                      <td className="px-5 py-4">
                        <Badge variant={getRoleTone(item.role)}>{item.role}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={getStatusTone(item.status)}>{item.status}</Badge>
                      </td>
                      <td className="max-w-md px-5 py-4 text-sm leading-6 text-slate-500">
                        {item.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}