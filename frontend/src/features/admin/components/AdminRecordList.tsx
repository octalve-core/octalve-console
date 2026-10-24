"use client";
import { useRouter } from "next/navigation";
import { Globe2, Server } from "lucide-react";
import { CloudRecordDirectory, type CloudRecord } from "@/components/data/CloudRecordDirectory";
import type { AdminRecord } from "../data/admin-demo-data";

type Props = { records: AdminRecord[]; emptyTitle: string; emptyDescription: string };
export function AdminRecordList({records,emptyTitle,emptyDescription}:Props) {
  const router=useRouter();
  const destinations=new Map<string,string>();
  const rows:CloudRecord[]=records.map((record,index)=>{
    const id=`${record.id}-${index}`;
    destinations.set(id,record.actionHref);
    return {id,title:record.title,subtitle:record.subtitle,reference:record.meta,
      amount:record.amount,date:record.date,status:record.status,
      icon:record.title.includes(".")?<Globe2 className="h-4 w-4"/>:<Server className="h-4 w-4"/>};
  });
  return <CloudRecordDirectory label="Records" records={rows}
    emptyMessage={`${emptyTitle}. ${emptyDescription}`}
    onOpen={record=>{const href=destinations.get(record.id);if(href)router.push(href);}}/>;
}
