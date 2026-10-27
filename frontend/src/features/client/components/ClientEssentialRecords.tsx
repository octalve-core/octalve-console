"use client";

import {useMemo} from "react";
import {useRouter} from "next/navigation";
import {Globe2,Server} from "lucide-react";
import {ServiceUsageRing} from "./ServiceUsageRing";
import {serviceDate} from "../utils/service-contract";
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
    date:resource==="services"?serviceDate(record.service?.nextDueDate||null):record.date,
    category:resource==="services"?record.service?.serviceType:undefined,
    extra:resource==="services"&&record.service?.usage?
      <ServiceUsageRing label="Disk" used={record.service.usage.diskUsedMb}
        limit={record.service.usage.diskLimitMb} compact/>:undefined,
    status:record.status,
    icon:resource==="domains"?<Globe2 className="h-5 w-5" aria-hidden="true"/>:
      <Server className="h-5 w-5" aria-hidden="true"/>,
    details:{Package:record.service?.planName||record.subtitle,
      Domain:record.service?.domain||record.title,Reference:record.meta},
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
      {key:"package",label:resource==="domains"?"Registration":"Plan",
        render:row=><span className="text-console-muted">
          {records.find(item=>item.id===row.id)?.service?.planName||row.subtitle||"—"}
        </span>},
      {key:"due",label:resource==="domains"?"Expires":"Next due",
        render:row=><span className="text-console-muted">{row.date||"—"}</span>},
      ...(resource==="services"?[{
        key:"usage",label:"Disk usage",
        render:(row:CloudRecord)=>{
          const usage=records.find(item=>item.id===row.id)?.service?.usage;
          return usage?<ServiceUsageRing label="Disk" used={usage.diskUsedMb}
            limit={usage.diskLimitMb} compact/>:
            <span className="text-xs text-console-muted">Unavailable</span>;
        },
      }]:[]),
    ]}
  />;
}
