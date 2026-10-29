"use client";
import {useMemo} from "react";
import {Users,ReceiptText,ShoppingCart,Globe2,PackageCheck,Server,LifeBuoy,Layers3, type LucideIcon} from "lucide-react";
import {RecordDirectory} from "@/components/design-system/record-directory/RecordDirectory";
import type {DirectoryColumn,DirectoryCreate,DirectoryRow} from "@/components/design-system/record-directory/types";
import type {AdminResourceKey} from "../data/admin-resource-config";
import type {AdminRecord} from "../data/admin-demo-data";
const icons:Record<AdminResourceKey,LucideIcon>={
 customers:Users,products:PackageCheck,plans:Layers3,orders:ShoppingCart,
 invoices:ReceiptText,domains:Globe2,gateways:LifeBuoy,providers:Server,provisioning:Server
};
const generic:DirectoryColumn[]=[
 {key:"name",label:"Record",render:r=>r.title},
 {key:"details",label:"Details",render:r=>r.subtitle||"—"},
 {key:"reference",label:"Reference / category",render:r=>r.reference||r.category||"—"},
 {key:"amount",label:"Amount",render:r=>r.amount||"—",wideOnly:true},
 {key:"date",label:"Created / updated",render:r=>r.date||"—"}
];
const customerColumns:DirectoryColumn[]=[
 {key:"name",label:"Customer",render:r=>r.title},
 {key:"email",label:"Email",render:r=>r.subtitle||"—"},
 {key:"company",label:"Company",render:r=>r.category||"—"},
 {key:"wallet",label:"Wallet balance",render:r=>r.amount||"—",wideOnly:true},
 {key:"date",label:"Joined",render:r=>r.date||"—"}
];
export function AdminResourceDirectory({resource,records,emptyTitle,emptyDescription,detailEnabled=true,
 create}:{resource:AdminResourceKey;records:readonly AdminRecord[];emptyTitle:string;
 emptyDescription:string;detailEnabled?:boolean;create?:DirectoryCreate}){
 const Icon=icons[resource];
 const rows=useMemo<DirectoryRow[]>(()=>records.map(r=>({
  id:r.id,title:r.title,subtitle:r.subtitle,reference:r.reference||undefined,
  category:resource==="customers"?r.companyName:r.meta,amount:r.amount||undefined,
  amountLabel:resource==="customers"?"Wallet balance":"Amount",
  date:r.date,dateISO:r.dateISO,dateLabel:resource==="customers"?"Joined":"Created",
  status:r.status,icon:<Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden="true"/>,
  href:detailEnabled?r.actionHref:undefined,
  searchTerms:resource==="customers"?[r.companyName||"",r.subtitle]:[r.meta]
 })),[records,resource,detailEnabled,Icon]);
 return <RecordDirectory label={resource==="customers"?"Customers":resource.charAt(0).toUpperCase()+resource.slice(1)}
  rows={rows} columns={resource==="customers"?customerColumns:generic} create={create}
  emptyMessage={emptyTitle+" — "+emptyDescription}/>;
}
