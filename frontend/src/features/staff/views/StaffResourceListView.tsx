"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { LoadingState } from "@/components/feedback/LoadingState";
import { staffResourceConfig } from "../data/staff-resource-config";
import type { StaffRecord, StaffResourceKey } from "../data/staff-demo-data";
import { normalizeStaffRecord, unwrapStaffList } from "../utils/staff-record-normalizer";
import { StaffRecordList } from "../components/StaffRecordList";

type StaffResourceListViewProps = {
  resource: StaffResourceKey;
};

export function StaffResourceListView({ resource }: StaffResourceListViewProps) {
  const config = staffResourceConfig[resource];

  const [records, setRecords] = useState<StaffRecord[]>(config.fallback);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [error, setError] = useState("");

  async function loadRecords() {
    setError("");
    setIsLoading(true);

    try {
      const response = await config.loader();
      const apiRecords = unwrapStaffList(response).map((item) => normalizeStaffRecord(item, config.key));

      if (apiRecords.length > 0) {
        setRecords(apiRecords);
        setIsUsingFallback(false);
      } else {
        setRecords(config.fallback);
        setIsUsingFallback(true);
      }
    } catch {
      setRecords(config.fallback);
      setIsUsingFallback(true);
      setError("Live API data is not available yet. Showing safe demo records for layout continuity.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource]);

  const filteredRecords = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return records;

    return records.filter((record) =>
      [record.title, record.subtitle, record.meta, record.status, record.id]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [query, records]);

  return (
    <DashboardShell
      role="staff"
      title={config.title}
      description={config.description}
    >
      <DashboardPage
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        actions={
          <Button type="button" variant="outline" onClick={loadRecords}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        }
      >
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={config.searchPlaceholder}
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              />
            </div>
          </Card>

          {isUsingFallback ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              {error || "Showing fallback records until the backend returns live data."}
            </div>
          ) : null}

          {isLoading ? (
            <LoadingState title={`Loading ${config.title.toLowerCase()}`} description="Connecting to the Django API." />
          ) : (
            <StaffRecordList
              records={filteredRecords}
              resource={resource}
              emptyTitle={config.emptyTitle}
              emptyDescription={config.emptyDescription}
            />
          )}
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}