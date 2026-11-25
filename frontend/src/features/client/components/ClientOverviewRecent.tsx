"use client";
import Link from "next/link";
import {MobileRecordCard} from "@/components/design-system/record-directory/MobileRecordCard";
import {navigationIcons} from "@/features/shell/lib/navigation-icons";
import {ArrowRight} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {SectionHeading} from "@/components/design-system/SectionHeading";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import {formatStatus,getStatusTone} from "@/lib/constants/status";
import type {ClientRecord} from "../data/client-demo-data";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages} from "@/lib/i18n/dictionary";
import {displayDate} from "@/lib/i18n/formatters";
export type RecentState="loading"|"ready"|"unavailable";
function tone(status:string):StatusTone{
 const mapped=getStatusTone(status);
 return mapped==="danger"?"error":mapped;
}
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
   {state==="ready"&&records.length>0&&<ul className="space-y-2 lg:hidden">
    {records.slice(0,3).map(record=>{
     const invoice=href==="/client/invoices";
     const Icon=invoice?navigationIcons.receiptText:navigationIcons.packageCheck;
     return <MobileRecordCard key={record.id} row={{id:record.id,title:record.title,
      reference:record.meta!=="—"?record.meta:record.id,amount:record.amount,status:record.status,
      href:record.actionHref,icon:<Icon className="h-5 w-5"/>,
      date:record.date&&/^\d{4}-\d{2}-\d{2}/.test(record.date)?displayDate(record.date.slice(0,10),locale):undefined,
      dateLabel:invoice?"Due":"Created",secondaryDate:record.issuedDate?displayDate(record.issuedDate.slice(0,10),locale):undefined,
      secondaryDateLabel:invoice?"Issued":undefined}}/>;
    })}
   </ul>}
   {state==="ready"&&records.slice(0,3).map(record=><Link key={record.id} href={record.actionHref}
     className="hidden min-w-0 flex-wrap lg:flex items-center justify-between gap-3 rounded-xl border border-console-line bg-slate-50 px-4 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
     <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium text-console-ink">{record.title}</span>
      <span className="mt-1 block truncate text-xs text-console-muted">{record.subtitle}</span>
      {record.date && /^\d{4}-\d{2}-\d{2}/.test(record.date) ? <time title={record.date}
        dateTime={record.date.slice(0,10)} className="mt-1 block text-xs text-console-muted">{displayDate(record.date.slice(0,10),locale)}</time>:null}
     </span>
     <StatusBadge tone={tone(record.status)}>{formatStatus(record.status)}</StatusBadge>
   </Link>)}
  </div>
 </Panel>;
}
