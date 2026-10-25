import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { ClientRecord } from "../data/client-demo-data";

type ClientSectionCardProps = {
  title: string;
  description: string;
  href: string;
  records: ClientRecord[];
};

export function ClientSectionCard({ title, description, href, records }: ClientSectionCardProps) {
  return (
    <Card className="border-[#E6EBF2] p-5 shadow-[0_1px_2px_rgba(15,23,42,.035)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
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
            className="flex items-center justify-between gap-4 rounded-xl border border-[#EFF2F6] bg-[#F8F9FB] px-3 py-3 transition hover:border-[#D7E8FC] hover:bg-[#F1F6FF]"
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