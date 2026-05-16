"use client";

import Link from "next/link";
import { Activity, CheckCircle2, Code2, ExternalLink, Route, Server, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { MetricCard } from "@/components/data/MetricCard";
import { ResponsiveGrid } from "@/components/data/ResponsiveGrid";
import { apiContractSections, getApiContractSummary } from "@/lib/api/contract-registry";
import { getRuntimeChecks } from "@/lib/config/runtime";
import { getRouteAccessSummary, routeAccessItems } from "@/lib/navigation/route-access";
import { productionReadinessChecks, type ProductionReadinessCheck } from "../data/production-readiness";

function readinessTone(status: ProductionReadinessCheck["status"]) {
  if (status === "Ready") return "success";
  if (status === "Review") return "warning";
  return "neutral";
}

function contractTone(status: "Aligned" | "Needs backend confirmation" | "Fallback-ready") {
  if (status === "Aligned") return "success";
  if (status === "Needs backend confirmation") return "warning";
  return "info";
}

export function ProductionReadinessView() {
  const apiSummary = getApiContractSummary();
  const routeSummary = getRouteAccessSummary();
  const runtimeChecks = getRuntimeChecks();

  const readyChecks = productionReadinessChecks.filter((item) => item.status === "Ready").length;
  const reviewChecks = productionReadinessChecks.filter((item) => item.status === "Review").length;
  const missingRuntime = runtimeChecks.filter((item) => !item.ready).length;

  return (
    <DashboardShell
      role="admin"
      title="Production readiness"
      description="Final frontend audit for API alignment, route access, environment setup, and release readiness."
    >
      <DashboardPage
        eyebrow="Production Readiness"
        title="Frontend release audit"
        description="Use this page before merging into main or deploying to production."
      >
        <div className="space-y-6">
          <ResponsiveGrid columns="4">
            <MetricCard
              label="API sections"
              value={String(apiSummary.sections)}
              description={`${apiSummary.endpoints} tracked endpoints`}
              icon={<Server className="h-5 w-5" />}
            />
            <MetricCard
              label="Aligned endpoints"
              value={String(apiSummary.aligned)}
              description={`${apiSummary.fallbackReady} fallback-ready`}
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <MetricCard
              label="Routes audited"
              value={String(routeSummary.total)}
              description={`${routeSummary.migrated} migrated routes`}
              icon={<Route className="h-5 w-5" />}
            />
            <MetricCard
              label="Readiness checks"
              value={`${readyChecks}/${productionReadinessChecks.length}`}
              description={reviewChecks ? `${reviewChecks} need review` : "All clear"}
              icon={<Activity className="h-5 w-5" />}
            />
          </ResponsiveGrid>

          {missingRuntime ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              {missingRuntime} runtime setting{missingRuntime === 1 ? "" : "s"} need attention before production deployment.
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
              Runtime configuration has the required public values.
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
            <Card>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Runtime environment</h2>
                  <p className="mt-1 text-sm text-slate-500">Public environment values needed by the frontend.</p>
                </div>

                <Badge variant={missingRuntime ? "warning" : "success"}>
                  {missingRuntime ? "Review" : "Ready"}
                </Badge>
              </div>

              <div className="mt-5 grid gap-3">
                {runtimeChecks.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-950">{item.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
                      </div>

                      <Badge variant={item.ready ? "success" : "warning"}>
                        {item.ready ? "Ready" : "Missing"}
                      </Badge>
                    </div>

                    <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
                <ShieldCheck className="h-6 w-6" />
              </div>

              <h3 className="mt-5 text-lg font-medium tracking-[-0.03em] text-slate-950">Release rule</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Before pushing to main, run typecheck, production build, and the frontend smoke checker.
              </p>

              <div className="mt-5 rounded-2xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-200">
                <p>pnpm exec tsc --noEmit --pretty false</p>
                <p>pnpm run build</p>
                <p>node ./scripts/frontend-production-check.mjs</p>
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Readiness checklist</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {productionReadinessChecks.map((item) => (
                <div key={`${item.group}-${item.label}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.group}</p>
                      <p className="mt-2 text-sm font-medium text-slate-950">{item.label}</p>
                    </div>

                    <Badge variant={readinessTone(item.status)}>{item.status}</Badge>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-500">{item.description}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium tracking-[-0.03em] text-slate-950">API contract alignment</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Main frontend API modules and backend endpoint paths.
                </p>
              </div>

              <Badge variant={apiSummary.needsConfirmation ? "warning" : "success"}>
                {apiSummary.needsConfirmation ? "Review needed" : "Aligned"}
              </Badge>
            </div>

            <div className="mt-5 space-y-4">
              {apiContractSections.map((section) => (
                <div key={section.area} className="rounded-[1.4rem] border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-950">{section.area}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{section.description}</p>
                    </div>

                    <Badge variant="neutral">{section.module}</Badge>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                      <tbody className="divide-y divide-slate-100">
                        {section.endpoints.map((endpoint) => (
                          <tr key={`${section.area}-${endpoint.label}`}>
                            <td className="py-3 pr-4 text-sm font-medium text-slate-950">{endpoint.label}</td>
                            <td className="py-3 pr-4 font-mono text-xs text-slate-500">{endpoint.method}</td>
                            <td className="py-3 pr-4 font-mono text-xs text-slate-500">{endpoint.path}</td>
                            <td className="py-3">
                              <Badge variant={contractTone(endpoint.status)}>{endpoint.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Route access snapshot</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Quick view of protected and migrated routes.
                </p>
              </div>

              <Badge variant="info">{routeSummary.total} routes</Badge>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {routeAccessItems.slice(0, 18).map((item) => (
                <Link
                  key={`${item.area}-${item.path}`}
                  href={item.path}
                  className="rounded-2xl border border-slate-200 p-4 transition hover:border-[#0064E0]/30 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-950">{item.label}</p>
                      <p className="mt-1 truncate font-mono text-xs text-slate-500">{item.path}</p>
                    </div>

                    <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <TriangleAlert className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Backend coordination note</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  The frontend is now structured, typed, modular, responsive, and API-ready. The next backend-facing task is to compare
                  each create/edit payload with Django serializers and adjust only the small API action mapping files where needed.
                </p>

                <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                  <Code2 className="h-4 w-4" />
                  Ready for final schema-to-UI payload pass
                </div>
              </div>
            </div>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}