"use client";
import Link from "next/link";
import {MobileRecordCard} from "@/components/design-system/record-directory/MobileRecordCard";
import {cloudRecordRows} from "@/components/data/CloudRecordDirectory";
import {billingRecordRows} from "./commerce/BillingRecordDirectory";
import {essentialRecords} from "./ClientEssentialRecords";
import {ArrowRight} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {SectionHeading} from "@/components/design-system/SectionHeading";
import type {ClientRecord} from "../data/client-demo-data";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages} from "@/lib/i18n/dictionary";
export type RecentState="loading"|"ready"|"unavailable";

export function ClientOverviewRecent({title,description,href,records,state}:{
 title:string;description:string;href:string;records:readonly ClientRecord[];state:RecentState;
}){
 const {locale}=useLocale(),m=messages(locale);
 const visible=records.slice(0,3);
 const rows=href==="/client/invoices"?billingRecordRows("invoices",visible):cloudRecordRows(essentialRecords("services",visible));
 return <Panel>
  <SectionHeading title={title} description={description}
   actions={<Link href={href} className="inline-flex min-h-10 items-center gap-1 rounded-lg text-sm font-medium text-console-primary hover:underline focus-visible:ring-2 focus-visible:ring-console-primary">
    {m.viewAll} <ArrowRight aria-hidden="true" className="h-4 w-4"/>
   </Link>}/>
  <div className="mt-5 space-y-3" aria-busy={state==="loading"}>
   {state==="loading"?<p role="status" className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-console-muted">{m.updating}</p>:null}
   {state==="unavailable"?<p role="status" className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-console-muted">{m.unavailable}</p>:null}
   {state==="ready"&&records.length===0?<p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-console-muted">{m.empty}</p>:null}
   {state==="ready"&&records.length>0&&<ul className="space-y-2">
    {rows.map(row=><MobileRecordCard key={row.id} row={row}/>)}
   </ul>}
  </div>
 </Panel>;
}
