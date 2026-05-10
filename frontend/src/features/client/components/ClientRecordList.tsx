import Link from "next/link";
import { ArrowRight, CreditCard, Globe2, Headphones, PackageCheck, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/feedback/EmptyState";
import { formatStatus, getStatusTone } from "@/lib/constants/status";
import type { ClientRecord, ClientResourceKey } from "../data/client-demo-data";

type ClientRecordListProps = {
  records: ClientRecord[];
  resource: ClientResourceKey;
  emptyTitle: string;
  emptyDescription: string;
};

function getIcon(resource: ClientResourceKey) {
  if (resource === "services") return PackageCheck;
  if (resource === "domains") return Globe2;
  if (resource === "invoices") return CreditCard;
  if (resource === "orders") return ShoppingCart;
  return Headphones;
}

function ScoreRing({ score }: { score?: number }) {
  if (!score) return null;

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full border-[7px] border-emerald-500 bg-white text-sm font-semibold text-slate-950">
      {score}
    </div>
  );
}

export function ClientRecordList({
  records,
  resource,
  emptyTitle,
  emptyDescription,
}: ClientRecordListProps) {
  const Icon = getIcon(resource);

  if (records.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="space-y-3">
        {records.map((record, index) => (
          <div
            key={`${record.id}-${index}`}
            className="grid gap-4 rounded-[1.4rem] border border-slate-200 bg-white p-4 transition hover:border-[#0064E0]/25 hover:shadow-sm xl:grid-cols-[1.2fr_0.9fr_0.8fr_auto_auto] xl:items-center"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0064E0]/8 text-[#0064E0]">
                <Icon className="h-6 w-6" />
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
              <p className="mt-1 text-sm text-slate-500">{record.amount || "—"}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-950">{record.date || "—"}</p>
              <div className="mt-1">
                <Badge variant={getStatusTone(record.status)}>{formatStatus(record.status)}</Badge>
              </div>
            </div>

            <ScoreRing score={record.score} />

            <Button href={record.actionHref} variant="primary" className="w-full xl:w-auto">
              Manage
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}