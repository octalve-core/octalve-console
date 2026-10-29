"use client";
import {useMemo} from "react";
import {ShoppingCart,Server,Users} from "lucide-react";
import {RecordDirectory} from "@/components/design-system/record-directory/RecordDirectory";
import type {DirectoryColumn,DirectoryRow} from "@/components/design-system/record-directory/types";
import type {StaffRecord,StaffResourceKey} from "../data/staff-demo-data";
type OperationalResource=Extract<StaffResourceKey,"customers"|"orders"|"provisioning">;
const columns:DirectoryColumn[]=[
 {key:"title",label:"Record",render:r=>r.title},
 {key:"details",label:"Details",render:r=>r.subtitle||"—"},
 {key:"reference",label:"Reference / category",render:r=>r.reference||r.category||"—"},
 {key:"date",label:"Updated",render:r=>r.date||"—"},
];
export function StaffOperationalDirectory({resource,records,emptyTitle,emptyDescription}:{
 resource:OperationalResource;records:readonly StaffRecord[];emptyTitle:string;emptyDescription:string;
}){
 const rows=useMemo<DirectoryRow[]>(()=>records.map(r=>({
  id:r.id,title:r.title,subtitle:r.subtitle,
  reference:r.meta&&r.meta!=="—"?r.meta:undefined,status:r.status,date:r.date,
  icon:resource==="customers"?<Users className="h-5 w-5"/>:resource==="orders"?
   <ShoppingCart className="h-5 w-5"/>:<Server className="h-5 w-5"/>,
  // Staff list URLs are not advertised as verified detail capabilities here.
  searchTerms:[r.meta]
 })),[records,resource]);
 return <RecordDirectory label={resource} rows={rows} columns={columns}
  emptyMessage={emptyTitle+" — "+emptyDescription}/>;
}
