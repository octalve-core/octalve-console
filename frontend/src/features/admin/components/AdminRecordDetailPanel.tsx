import {CalendarDays,Database,ExternalLink,Server,ShieldCheck} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import {formatStatus,getStatusTone} from "@/lib/constants/status";
import type {AdminRecord} from "../data/admin-demo-data";
type DetailAction={href:string;label:string;variant:"primary"|"outline"};
function tone(status:string):StatusTone{const x=getStatusTone(status);return x==="danger"?"error":x;}
export function AdminRecordDetailPanel({record,actions}:{record:AdminRecord;actions:readonly DetailAction[]}){
 const details=[{label:"Reference",value:record.id,icon:Database},
 {label:"Status",value:formatStatus(record.status),icon:ShieldCheck},
 {label:"Date",value:record.date||"—",icon:CalendarDays},
 {label:"Amount",value:record.amount||"—",icon:ExternalLink}];
 return <div className="min-w-0 space-y-5">
  <Panel padded={false} className="overflow-hidden">
   <div className="bg-console-primary p-5 text-white sm:p-8">
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
     <div className="flex min-w-0 items-start gap-4">
      <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15">
       <Server className="h-6 w-6"/></span>
      <div className="min-w-0">
       <p className="break-all text-xs text-white/80">{record.id}</p>
       <h2 className="mt-2 break-words text-2xl font-medium tracking-tight sm:text-3xl">{record.title}</h2>
       <p className="mt-2 break-words text-sm leading-6 text-white/85">{record.subtitle}</p>
      </div>
     </div>
     <StatusBadge tone={tone(record.status)}>{formatStatus(record.status)}</StatusBadge>
    </div>
   </div>
   <dl className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
    {details.map(item=>{const Icon=item.icon;return <div key={item.label} className="min-w-0 rounded-xl bg-slate-50 p-4">
     <dt className="flex items-center gap-2 text-sm text-console-muted">
      <Icon aria-hidden="true" className="h-4 w-4"/>{item.label}</dt>
     <dd className="mt-2 break-words text-sm font-medium text-console-ink">{item.value}</dd>
    </div>;})}
   </dl>
  </Panel>
  <div className="grid min-w-0 gap-5 lg:grid-cols-3">
   <Panel className="lg:col-span-2">
    <h3 className="text-lg font-medium text-console-ink">Record information</h3>
    <p className="mt-3 text-sm leading-6 text-console-muted">
     Details shown above come from the authorized record response. Payment settlement,
     hosting activation, domain changes and other operations require independent server verification.
    </p>
   </Panel>
   <Panel>
    <h3 className="text-lg font-medium text-console-ink">Available actions</h3>
    <div className="mt-4 grid gap-3">
     {actions.map(action=><ActionLink key={action.href} href={action.href}
      variant={action.variant} className="w-full">{action.label}</ActionLink>)}
    </div>
   </Panel>
  </div>
 </div>;
}
