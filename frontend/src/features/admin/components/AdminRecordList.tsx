import Link from "next/link";
import { ArrowRight, Globe2, Server } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/feedback/EmptyState";
import { formatStatus, getStatusTone } from "@/lib/constants/status";
import type { AdminRecord } from "../data/admin-demo-data";

type AdminRecordListProps = {
  records: AdminRecord[];
  emptyTitle: string;
  emptyDescription: string;
};

export function AdminRecordList({ records, emptyTitle, emptyDescription }: AdminRecordListProps) {
  if (records.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="space-y-3">
        {records.map((record, index) => (
          <div
            key={`${record.id}-${index}`}
            className="grid gap-4 rounded-[1.4rem] border border-slate-200 bg-white p-4 transition hover:border-[#0064E0]/25 hover:shadow-sm lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto] lg:items-center"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0064E0]/8 text-[#0064E0]">
                {record.title.includes(".") ? <Globe2 className="h-6 w-6" /> : <Server className="h-6 w-6" />}
              </div>

              <div className="min-w-0">
                <Link
                  href={record.actionHref}
                  className="truncate text-base font-medium text-slate-950 transition hover:text-[#0064E0]"
                >
                  {record.title}
                </Link>
                <p className="mt-1 truncate text-sm text-slate-500">{record.subtitle}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-950">{record.meta}</p>
              <p className="mt-1 text-sm text-slate-500">{record.amount ?? "—"}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-950">{record.date ?? "—"}</p>
              <div className="mt-1">
                <Badge variant={getStatusTone(record.status)}>{formatStatus(record.status)}</Badge>
              </div>
            </div>

            <Button href={record.actionHref} variant="primary" className="w-full lg:w-auto">
              Manage
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}