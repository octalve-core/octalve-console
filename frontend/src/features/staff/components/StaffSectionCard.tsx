import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { StaffRecord } from "../data/staff-demo-data";

type StaffSectionCardProps = {
  title: string;
  description: string;
  href: string;
  records: StaffRecord[];
};

export function StaffSectionCard({ title, description, href, records }: StaffSectionCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>

        <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-[#0064E0]">
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {records.length === 0 ? <p className="rounded-xl border border-slate-100 p-4 text-sm text-slate-500">Open this section to review your current records.</p> : null}
        {records.slice(0, 3).map((record) => (
          <Link
            href={record.actionHref}
            key={record.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-[#0064E0]/30 hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-950">{record.title}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{record.subtitle}</p>
            </div>

            <Badge tone={record.status}>{record.status}</Badge>
          </Link>
        ))}
      </div>
    </Card>
  );
}