import {CalendarDays,ExternalLink,Globe2,PackageCheck,Server,ShieldCheck} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import {formatStatus,getStatusTone} from "@/lib/constants/status";
import type {ClientRecord} from "../data/client-demo-data";
import type {ClientEssentialResource} from "./ClientEssentialRecords";
type DetailAction={label:string;href:string;variant:"primary"|"outline"};
function tone(status:string):StatusTone{
 const mapped=getStatusTone(status);
 return mapped==="danger"?"error":mapped;
}
export function ClientEssentialDetail({record,resource,actions}:{
 record:ClientRecord;resource:ClientEssentialResource;actions:readonly DetailAction[];
}){
 const Icon=resource==="services"?PackageCheck:Globe2;
 const metadata=[
  {title:"Details",value:record.meta,icon:Server},
  {title:"Status",value:formatStatus(record.status),icon:ShieldCheck},
  {title:"Date",value:record.date||"—",icon:CalendarDays},
  {title:"Amount",value:record.amount||"—",icon:ExternalLink}
 ];
 return <div className="min-w-0 space-y-5">
  <Panel padded={false} className="overflow-hidden">
   <div className="bg-console-primary p-5 text-white sm:p-8">
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
     <div className="flex min-w-0 items-start gap-4">
      <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15">
       <Icon className="h-7 w-7"/>
      </span>
      <div className="min-w-0">
       <p className="break-all text-sm text-white/80">{record.id}</p>
       <h2 className="mt-2 break-words text-2xl font-medium tracking-tight sm:text-3xl">{record.title}</h2>
       <p className="mt-2 break-words text-sm leading-6 text-white/85">{record.subtitle}</p>
      </div>
     </div>
     <StatusBadge tone={tone(record.status)}>{formatStatus(record.status)}</StatusBadge>
    </div>
   </div>
   <dl className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
    {metadata.map(item=>{const MetaIcon=item.icon;return <div key={item.title} className="min-w-0 rounded-xl bg-slate-50 p-4">
     <dt className="flex items-center gap-2 text-sm text-console-muted"><MetaIcon aria-hidden="true" className="h-4 w-4"/>{item.title}</dt>
     <dd className="mt-2 break-words text-sm font-medium text-console-ink">{item.value}</dd>
    </div>;})}
   </dl>
  </Panel>
  <div className="grid min-w-0 gap-5 lg:grid-cols-3">
   <Panel className="lg:col-span-2">
    <h3 className="text-lg font-medium text-console-ink">Activity timeline</h3>
    <p className="mt-4 text-sm leading-6 text-console-muted">
     The verified activity event feed is not connected to this detail view. No synthetic payment,
     provisioning, DNS or hosting activity is displayed.
    </p>
   </Panel>
   <Panel>
    <h3 className="text-lg font-medium text-console-ink">Quick actions</h3>
    <div className="mt-4 grid gap-3">
     {actions.map(action=><ActionLink key={action.label} href={action.href} variant={action.variant} className="w-full">
      {action.label}
     </ActionLink>)}
    </div>
   </Panel>
  </div>
 </div>;
}
