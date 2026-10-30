"use client";
import {useMemo} from "react";
import {ShoppingCart,ReceiptText} from "lucide-react";
import {RecordDirectory} from "@/components/design-system/record-directory/RecordDirectory";
import type {DirectoryColumn,DirectoryRow} from "@/components/design-system/record-directory/types";
import type {ClientRecord} from "../../data/client-demo-data";
export type BillingResource="orders"|"invoices";
const cols:DirectoryColumn[]=[
 {key:"item",label:"Purchase",render:r=>r.title},
 {key:"reference",label:"Reference",render:r=>r.reference||"—"},
 {key:"total",label:"Amount",render:r=>r.amount||"—"},
 {key:"date",label:"Order / due date",render:r=>r.date||"—"},
];
/** Customer purchase history: one shared accessible table, status/filter sheet, mobile cards and row actions. */
export function BillingRecordDirectory({resource,records,emptyTitle,emptyDescription}:{
 resource:BillingResource;records:readonly ClientRecord[];emptyTitle:string;emptyDescription:string;
}){
 const Icon=resource==="orders"?ShoppingCart:ReceiptText;
 const rows=useMemo<DirectoryRow[]>(()=>records.map(r=>({
  id:r.id,title:r.title,subtitle:r.subtitle,
  reference:r.meta!=="—"?r.meta:r.id,
  amount:r.amount,status:r.status,date:r.date,
  dateISO:r.date&&/^\d{4}-\d{2}-\d{2}/.test(r.date)?r.date.slice(0,10):undefined,
  href:r.actionHref,
  icon:<Icon aria-hidden="true" className="h-5 w-5"/>,
  searchTerms:[r.id,r.meta,r.subtitle]
 })),[records,Icon]);
 return <RecordDirectory label={resource==="orders"?"Orders":"Invoices"} rows={rows} columns={cols}
  emptyMessage={emptyTitle+" — "+emptyDescription}/>;
}
