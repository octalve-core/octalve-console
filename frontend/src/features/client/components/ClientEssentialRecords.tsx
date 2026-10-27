"use client";

import {useMemo} from "react";
import {useRouter} from "next/navigation";
import {Globe2,Server} from "lucide-react";
import {CloudRecordDirectory,type CloudRecord} from "@/components/data/CloudRecordDirectory";
import type {ClientRecord} from "../data/client-demo-data";

export type ClientEssentialResource="services"|"domains";

/** One canonical desktop table / mobile card / action sheet, fed by verified API records. */
export function ClientEssentialRecords({resource,records,emptyTitle,emptyDescription}:{
  resource:ClientEssentialResource;records:readonly ClientRecord[];
  emptyTitle:string;emptyDescription:string;
}){
  const router=useRouter();
  const rows=useMemo<CloudRecord[]>(()=>records.map(record=>({
    id:record.id,
    title:record.title,
    subtitle:record.subtitle,
    reference:record.meta==="—"?"":record.meta,
    amount:record.amount,
    date:record.date,
    status:record.status,
    icon:resource==="domains"?<Globe2 className="h-5 w-5" aria-hidden="true"/>:
      <Server className="h-5 w-5" aria-hidden="true"/>,
    details:{Package:record.subtitle,Reference:record.meta},
  })),[records,resource]);

  function openDetails(row:CloudRecord){
    const verified=records.find(item=>item.id===row.id);
    if(verified?.actionHref)router.push(verified.actionHref);
  }

  return <CloudRecordDirectory
    label={resource==="domains"?"Domains":"Services"}
    records={rows}
    onOpen={openDetails}
    emptyMessage={records.length===0?emptyTitle+" — "+emptyDescription:"No matching records. Try another filter."}
    columns={[
      {key:"name",label:resource==="domains"?"Domain name":"Service",
        render:row=><span className="block min-w-0 truncate font-semibold text-console-ink">{row.title}</span>},
      {key:"package",label:resource==="domains"?"Registration":"Package",
        render:row=><span className="text-console-muted">{row.subtitle||"—"}</span>},
      {key:"due",label:resource==="domains"?"Expires":"Next due",
        render:row=><span className="text-console-muted">{row.date||"—"}</span>},
    ]}
  />;
}
