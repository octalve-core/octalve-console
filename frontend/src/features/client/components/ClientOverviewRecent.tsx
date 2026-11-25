"use client";
import Link from "next/link";
import {MobileRecordCard} from "@/components/design-system/record-directory/MobileRecordCard";
import {navigationIcons} from "@/features/shell/lib/navigation-icons";
import {ArrowRight} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {SectionHeading} from "@/components/design-system/SectionHeading";
import type {ClientRecord} from "../data/client-demo-data";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages} from "@/lib/i18n/dictionary";
import {displayDate} from "@/lib/i18n/formatters";
export type RecentState="loading"|"ready"|"unavailable";

export function ClientOverviewRecent({title,description,href,records,state}:{
 title:string;description:string;href:string;records:readonly ClientRecord[];state:RecentState;
}){
 const {locale}=useLocale(),m=messages(locale);
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
    {records.slice(0,3).map(record=>{
     const invoice=href==="/client/invoices";
     const date=invoice?record.dueDate:record.createdDate;
     const Icon=invoice?navigationIcons.receiptText:navigationIcons.packageCheck;
     return <MobileRecordCard key={record.id} row={{id:record.id,title:record.title,
      reference:record.meta!=="—"?record.meta:record.id,amount:record.amount,status:record.status,
      href:record.actionHref,icon:<Icon className="h-5 w-5"/>,
      date:date?displayDate(date.slice(0,10),locale):undefined,
      dateLabel:invoice?"Due":"Created",secondaryDate:record.issuedDate?displayDate(record.issuedDate.slice(0,10),locale):undefined,
      secondaryDateLabel:invoice?"Issued":undefined}}/>;
    })}
   </ul>}
  </div>
 </Panel>;
}
