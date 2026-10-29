"use client";
import { useRouter } from "next/navigation";
import { Globe2, Server } from "lucide-react";
import { CloudRecordDirectory, type CloudRecord } from "@/components/data/CloudRecordDirectory";
import type { AdminRecord } from "../data/admin-demo-data";
import type { AdminResourceKey } from "../data/admin-resource-config";

type Props = { records: AdminRecord[]; resource: AdminResourceKey; emptyTitle: string; emptyDescription: string };
export function AdminRecordList({records,resource,emptyTitle,emptyDescription}:Props) {
  const router=useRouter();
  const destinations=new Map<string,string>();
  const rows:CloudRecord[]=records.map((record,index)=>{
    const id=`${record.id}-${index}`;
    destinations.set(id,record.actionHref);
    return {id,title:record.title,subtitle:record.subtitle,reference:record.meta,
      amount:record.amount,date:record.date,status:record.status,
      icon:record.title.includes(".")?<Globe2 className="h-4 w-4"/>:<Server className="h-4 w-4"/>};
  });
  const primary={key:"item",label:resource==="domains"?"Domain":resource==="customers"?"Customer":resource==="plans"?"Plan":resource==="products"?"Product":resource==="providers"?"Provider":"Record",
    render:(r:CloudRecord)=><span className="font-medium text-[#142A43]">{r.title}</span>};
  const reference={key:"reference",label:"Reference",render:(r:CloudRecord)=><span className="font-medium text-[#0064E0]">{r.reference||r.id}</span>};
  const date={key:"date",label:"Updated / created",render:(r:CloudRecord)=>r.date||"—"};
  const amount={key:"amount",label:"Amount",render:(r:CloudRecord)=><strong>{r.amount||"—"}</strong>};
  const metadata={key:"detail",label:resource==="domains"?"Registration details":resource==="providers"?"Adapter":resource==="plans"?"Product":resource==="customers"?"Contact":"Details",
    render:(r:CloudRecord)=>r.subtitle||"—"};
  const columns = resource==="invoices"||resource==="orders" ? [reference,primary,amount,date]
    : resource==="domains" ? [primary,metadata,date]
    : resource==="provisioning" ? [reference,primary,date]
    : resource==="gateways" ? [primary,metadata,date]
    : [primary,metadata,date];
  return <CloudRecordDirectory label={resource} records={rows} columns={columns}
    emptyMessage={`${emptyTitle}. ${emptyDescription}`}
    onOpen={record=>{const href=destinations.get(record.id);if(href)router.push(href);}}/>;
}
