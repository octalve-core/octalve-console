import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { AdminRecord } from "../data/admin-demo-data";

type AdminSectionCardProps = {
  title: string;
  description: string;
  href: string;
  records: AdminRecord[];
};

export function AdminSectionCard({ title, description, href, records }: AdminSectionCardProps) {
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