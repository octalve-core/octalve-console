"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ErrorState } from "@/components/feedback/ErrorState";
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

  const [records, setRecords] = useState<StaffRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecords() {
    setError("");
    setIsLoading(true);

    try {
      const response = await config.loader();
      const apiRecords = unwrapStaffList(response).map((item) => normalizeStaffRecord(item, config.key));

      setRecords(apiRecords);
    } catch {
      setRecords([]);
      setError("We couldn’t load your records. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource]);


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
          {isLoading ? (
            <LoadingState title={`Loading ${config.title.toLowerCase()}`} description="Preparing your records…" />
          ) : error ? (
            <ErrorState description={error} />
          ) : (
            <StaffRecordList
              records={records}
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