"use client";
import { useRouter } from "next/navigation";
import { BookOpen, LifeBuoy, ShoppingCart, Users, Zap } from "lucide-react";
import { CloudRecordDirectory, type CloudRecord } from "@/components/data/CloudRecordDirectory";
import type { StaffRecord, StaffResourceKey } from "../data/staff-demo-data";

type Props={records:StaffRecord[];resource:StaffResourceKey;emptyTitle:string;emptyDescription:string};
const icons={customers:Users,orders:ShoppingCart,provisioning:Zap,tickets:LifeBuoy,knowledgeBase:BookOpen};
export function StaffRecordList({records,resource,emptyTitle,emptyDescription}:Props){
  const router=useRouter();
  const Icon=icons[resource];
  const destinations=new Map<string,string>();
  const rows:CloudRecord[]=records.map((record,index)=>{
    const id=`${record.id}-${index}`;
    destinations.set(id,record.actionHref);
    return {id,title:record.title,subtitle:record.subtitle,reference:record.meta,
      date:record.date,status:record.status,icon:<Icon className="h-4 w-4"/>};
  });
  const identity={key:"identity",label:resource==="customers"?"Customer":resource==="orders"?"Order":resource==="provisioning"?"Task":resource==="tickets"?"Subject":"Guide",
    render:(r:CloudRecord)=><span className="font-medium text-[#142A43]">{r.title}</span>};
  const context={key:"context",label:resource==="tickets"?"Department":resource==="knowledgeBase"?"Category":"Details",
    render:(r:CloudRecord)=>r.subtitle||"—"};
  const updated={key:"updated",label:"Last updated",render:(r:CloudRecord)=>r.date||"—"};
  const reference={key:"reference",label:"Reference",render:(r:CloudRecord)=><span className="font-medium text-[#0064E0]">{r.reference||r.id}</span>};
  const columns=resource==="tickets"?[reference,identity,context,updated]:[identity,context,updated];
  return <CloudRecordDirectory label={resource} records={rows} columns={columns}
    emptyMessage={`${emptyTitle}. ${emptyDescription}`}
    onOpen={record=>{const href=destinations.get(record.id);if(href)router.push(href);}}/>;
}
