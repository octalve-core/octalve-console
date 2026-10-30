"use client";
import {useMemo} from "react";
import {RecordDirectory} from "@/components/design-system/record-directory/RecordDirectory";
import type {DirectoryColumn,DirectoryRow} from "@/components/design-system/record-directory/types";
import {Archive,UserRound,ReceiptText,ServerCog,ClipboardList, type LucideIcon} from "lucide-react";
export type AdminDirectoryRecord={id:string;title:string;subtitle:string;meta:string;status:string;date?:string;amount?:string;actionHref:string};
const icons:Record<string,LucideIcon>={staff:UserRound,transactions:ReceiptText,"service billing":ServerCog,"audit logs":ClipboardList};
const cols:DirectoryColumn[]=[
 {key:"name",label:"Record",render:r=>r.title},
 {key:"details",label:"Details",render:r=>r.subtitle||"—"},
 {key:"reference",label:"Reference",render:r=>r.reference||"—"},
 {key:"amount",label:"Amount",render:r=>r.amount||"—",wideOnly:true},
 {key:"date",label:"Updated",render:r=>r.date||"—"},
];
/** Legacy workspace adapter deliberately delegates all presentation/filtering to the one shared directory. */
export function AdminGenericDirectory({label,records,emptyTitle,emptyDescription,allowDetails=true}:{
 label:string;records:readonly AdminDirectoryRecord[];emptyTitle:string;emptyDescription:string;allowDetails?:boolean;
}){
 const Icon=icons[label.toLowerCase()]||Archive;
 const rows=useMemo<DirectoryRow[]>(()=>records.map(r=>({
  id:r.id,title:r.title,subtitle:r.subtitle,reference:r.meta!=="—"?r.meta:r.id,
  status:r.status,date:r.date,amount:r.amount,icon:<Icon aria-hidden="true" className="h-5 w-5"/>,
  href:allowDetails?r.actionHref:undefined,
  searchTerms:[r.meta,r.id]
 })),[records,Icon,allowDetails]);
 return <RecordDirectory label={label} rows={rows} columns={cols}
  emptyMessage={emptyTitle+" — "+emptyDescription}/>;
}
