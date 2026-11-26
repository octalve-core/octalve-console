"use client";
import {useMemo} from "react";
import {CreditCard,Download,ShoppingCart,ReceiptText,FileText} from "lucide-react";
import {RecordDirectory} from "@/components/design-system/record-directory/RecordDirectory";
import type {DirectoryColumn,DirectoryRow} from "@/components/design-system/record-directory/types";
import type {ClientRecord} from "../../data/client-demo-data";
import {invoiceDownloadHref,invoiceHref} from "./invoice-links";
import {serviceDate} from "../../utils/service-contract";
export type BillingResource="orders"|"invoices";
const cols:DirectoryColumn[]=[
 {key:"item",label:"Purchase",render:r=>r.title},
 {key:"reference",label:"Payment reference",render:r=>r.reference||"—"},
 {key:"total",label:"Amount",render:r=>r.amount||"—"},
 {key:"date",label:"Order / due date",render:r=>r.date||"—"},
];
/** Customer purchase history: one shared accessible table, status/filter sheet, mobile cards and row actions. */
export function BillingRecordDirectory({resource,records,emptyTitle,emptyDescription}:{
 resource:BillingResource;records:readonly ClientRecord[];emptyTitle:string;emptyDescription:string;
}){
 const Icon=resource==="orders"?ShoppingCart:ReceiptText;
 const rows=useMemo<DirectoryRow[]>(()=>records.map(r=>{
  const date=resource==="invoices"?r.dueDate:r.createdDate||r.date;
  return {
   id:r.id,title:r.title,subtitle:r.subtitle,
   reference:r.paymentReference||"—",
   amount:r.amount,status:r.status,date:date?serviceDate(date):undefined,
   secondaryDate:resource==="invoices"&&r.issuedDate?serviceDate(r.issuedDate):undefined,
   secondaryDateLabel:resource==="invoices"?"Issued":undefined,dateLabel:resource==="invoices"?"Due":"Ordered",
   dateISO:date&&/^\d{4}-\d{2}-\d{2}/.test(date)?date.slice(0,10):undefined,
   href:r.actionHref,
   icon:<Icon aria-hidden="true" className="h-5 w-5"/>,
   searchTerms:[r.id,r.meta,r.subtitle,r.paymentReference||""]
  };
 }),[records,Icon,resource]);
 const linkedInvoice = (id:string) => records.find(record=>record.id===id)?.invoiceDocuments?.[0];
 const paymentHref = (id:string) => {
  const record=records.find(item=>item.id===id);
  return resource==="invoices"?record?.paymentHref:record?.invoiceDocuments?.find(invoice=>invoice.paymentHref)?.paymentHref;
 };
 const payAction={key:"pay-invoice",label:"Pay now",icon:CreditCard,available:(row:DirectoryRow)=>!!paymentHref(row.id),href:(row:DirectoryRow)=>paymentHref(row.id)};
 return <RecordDirectory label={resource==="orders"?"Orders":"Invoices"} rows={rows} columns={cols}
  actions={resource==="invoices"?[payAction,{key:"invoice-pdf",label:"Download invoice PDF",icon:Download,href:row=>invoiceDownloadHref(row.id)}]:[
   payAction,
   {key:"view-invoice",label:"View latest invoice",icon:FileText,available:row=>!!linkedInvoice(row.id),href:row=>{
    const invoice=linkedInvoice(row.id);return invoice?invoiceHref(invoice.id):undefined;
   }},
  ]}
  emptyMessage={emptyTitle+" — "+emptyDescription}/>;
}
