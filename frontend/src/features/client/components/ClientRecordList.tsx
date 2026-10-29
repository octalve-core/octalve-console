"use client";
import { useRouter } from "next/navigation";
import { CreditCard, Globe2, Headphones, PackageCheck, ShoppingCart } from "lucide-react";
import { CloudRecordDirectory, type CloudRecord } from "@/components/data/CloudRecordDirectory";
import type { ClientRecord, ClientResourceKey } from "../data/client-demo-data";

type Props = { records: ClientRecord[]; resource: ClientResourceKey; emptyTitle: string; emptyDescription: string };
const icons = { services: PackageCheck, domains: Globe2, invoices: CreditCard, orders: ShoppingCart, support: Headphones };
type DirectoryColumn = { key: string; label: string; render: (record: CloudRecord) => React.ReactNode };

/** Each business record has its own header; never use invoice amounts for domains or tickets. */
const columnsFor = (resource: ClientResourceKey): DirectoryColumn[] => {
  const name = (label: string): DirectoryColumn => ({
    key: "name", label, render: r => <span className="font-medium text-[#10233A]">{r.title}</span>,
  });
  const reference: DirectoryColumn = { key: "reference", label: "Reference",
    render: r => <span className="font-medium text-[#0064E0]">{r.reference || r.id}</span> };
  const date = (label: string): DirectoryColumn => ({ key: "date", label, render: r => r.date || "—" });
  const amount: DirectoryColumn = { key: "amount", label: "Amount",
    render: r => <span className="font-medium text-[#10233A]">{r.amount || "—"}</span> };
  if (resource === "services") return [name("Service"), { key: "package", label: "Package", render: r => r.subtitle || "—" }, date("Next due")];
  if (resource === "domains") return [name("Domain name"), { key: "registration", label: "Registration", render: r => r.subtitle || "—" }, date("Expires")];
  if (resource === "invoices") return [reference, name("Invoice"), amount, date("Due / issued")];
  if (resource === "orders") return [reference, name("Order"), amount, date("Ordered")];
  return [reference, name("Subject"), { key: "topic", label: "Department", render: r => r.subtitle || "—" }, date("Updated")];
};

export function ClientRecordList({ records, resource, emptyTitle, emptyDescription }: Props) {
  const router = useRouter();
  const Icon = icons[resource];
  const byId = new Map<string, ClientRecord>();
  const rows: CloudRecord[] = records.map((record, index) => {
    const id = `${record.id}-${index}`;
    byId.set(id, record);
    return { id, title: record.title, subtitle: record.subtitle, reference: record.meta !== "—" ? record.meta : record.id,
      amount: record.amount, date: record.date, status: record.status, icon: <Icon className="h-4 w-4" /> };
  });
  return <CloudRecordDirectory label={resource} records={rows}
    columns={columnsFor(resource)}
    emptyMessage={records.length === 0 ? `${emptyTitle}. ${emptyDescription}` : "No records match your filters."}
    onOpen={row => { const record = byId.get(row.id); if (record?.actionHref) router.push(record.actionHref); }}
  />;
}
