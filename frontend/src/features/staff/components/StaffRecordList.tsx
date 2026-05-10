import Link from "next/link";
import { ArrowRight, BookOpen, LifeBuoy, ShoppingCart, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/feedback/EmptyState";
import { formatStatus, getStatusTone } from "@/lib/constants/status";
import type { StaffRecord, StaffResourceKey } from "../data/staff-demo-data";

type StaffRecordListProps = {
  records: StaffRecord[];
  resource: StaffResourceKey;
  emptyTitle: string;
  emptyDescription: string;
};

function getIcon(resource: StaffResourceKey) {
  if (resource === "customers") return Users;
  if (resource === "orders") return ShoppingCart;
  if (resource === "provisioning") return Zap;
  if (resource === "tickets") return LifeBuoy;
  return BookOpen;
}

export function StaffRecordList({ records, resource, emptyTitle, emptyDescription }: StaffRecordListProps) {
  const Icon = getIcon(resource);

  if (records.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="space-y-3">
        {records.map((record) => (
          <div
            key={record.id}
            className="grid gap-4 rounded-[1.4rem] border border-slate-200 bg-white p-4 transition hover:border-[#0064E0]/25 hover:shadow-sm lg:grid-cols-[1fr_0.7fr_0.6fr_auto] lg:items-center"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0064E0]/8 text-[#0064E0]">
                <Icon className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <Link href={record.actionHref} className="truncate text-base font-medium text-slate-950 transition hover:text-[#0064E0]">
                  {record.title}
                </Link>
                <p className="mt-1 truncate text-sm text-slate-500">{record.subtitle}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">{record.meta}</p>

            <div>
              <p className="mb-1 text-sm text-slate-500">{record.date || "—"}</p>
              <Badge variant={getStatusTone(record.status)}>{formatStatus(record.status)}</Badge>
            </div>

            <Button href={record.actionHref} className="w-full lg:w-auto">
              Open
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}