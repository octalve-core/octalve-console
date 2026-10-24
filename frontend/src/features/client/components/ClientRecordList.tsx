"use client";

import { useRouter } from "next/navigation";
import { CreditCard, Globe2, Headphones, PackageCheck, ShoppingCart } from "lucide-react";
import { CloudRecordDirectory, type CloudRecord } from "@/components/data/CloudRecordDirectory";
import type { ClientRecord, ClientResourceKey } from "../data/client-demo-data";

type Props = {
  records: ClientRecord[];
  resource: ClientResourceKey;
  emptyTitle: string;
  emptyDescription: string;
};
const icons = {
  services: PackageCheck, domains: Globe2, invoices: CreditCard,
  orders: ShoppingCart, support: Headphones,
};
export function ClientRecordList({ records, resource, emptyTitle, emptyDescription }: Props) {
  const router = useRouter();
  const Icon = icons[resource] ?? PackageCheck;
  const byId = new Map<string, ClientRecord>();
  const rows: CloudRecord[] = records.map((record, index) => {
    const id = `${record.id}-${index}`;
    byId.set(id, record);
    return {
      id,
      title: record.title,
      subtitle: record.subtitle,
      reference: record.meta || record.id,
      amount: record.amount,
      date: record.date,
      status: record.status,
      icon: <Icon className="h-4 w-4" />,
    };
  });
  const open = (row: CloudRecord) => {
    const record = byId.get(row.id);
    if (record?.actionHref) router.push(record.actionHref);
  };
  return <CloudRecordDirectory
    label={resource}
    records={rows}
    emptyMessage={records.length === 0 ? `${emptyTitle}. ${emptyDescription}` : "No records match your filters."}
    onOpen={open}
  />;
}
