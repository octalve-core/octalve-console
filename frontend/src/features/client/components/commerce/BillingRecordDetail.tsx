import {CalendarDays,CreditCard,FileText,ReceiptText,ShieldCheck} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import {formatStatus,getStatusTone} from "@/lib/constants/status";
import type {ClientRecord} from "../../data/client-demo-data";
import type {BillingResource} from "./BillingRecordDirectory";
type LinkAction={label:string;href:string;variant:"primary"|"outline"};
function tone(status:string):StatusTone{const value=getStatusTone(status);return value==="danger"?"error":value;}
export function BillingRecordDetail({record,resource,actions}:{
 record:ClientRecord;resource:BillingResource;actions:readonly LinkAction[];
}){
 const Icon=resource==="orders"?FileText:ReceiptText;
 return <div className="space-y-5">
  <Panel padded={false} className="overflow-hidden">
   <div className="bg-console-primary p-5 text-white sm:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
     <div className="flex min-w-0 items-start gap-4">
      <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15">
       <Icon className="h-6 w-6"/>
      </span>
      <div className="min-w-0">
       <p className="break-words text-sm text-white/80">{record.meta!=="—"?record.meta:record.id}</p>
       <h2 className="mt-2 break-words text-2xl font-medium sm:text-3xl">{record.title}</h2>
       <p className="mt-2 break-words text-sm text-white/85">{record.subtitle}</p>
      </div>
     </div>
     <StatusBadge tone={tone(record.status)}>{formatStatus(record.status)}</StatusBadge>
    </div>
   </div>
   <dl className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
    {[
     {key:"Reference",value:record.meta!=="—"?record.meta:record.id,icon:FileText},
     {key:"Status",value:formatStatus(record.status),icon:ShieldCheck},
     {key:resource==="orders"?"Ordered":"Due / issued",value:record.date||"—",icon:CalendarDays},
     {key:"Amount",value:record.amount||"—",icon:CreditCard}
    ].map(item=>{const Meta=item.icon;return <div key={item.key} className="min-w-0 rounded-xl bg-slate-50 p-4">
     <dt className="flex items-center gap-2 text-sm text-console-muted"><Meta aria-hidden="true" className="h-4 w-4"/>{item.key}</dt>
     <dd className="mt-2 break-words text-sm font-medium text-console-ink">{item.value}</dd>
    </div>;})}
   </dl>
  </Panel>
  <div className="grid gap-5 lg:grid-cols-3">
   <Panel className="lg:col-span-2">
    <h3 className="text-lg font-medium text-console-ink">Activity</h3>
    <p className="mt-3 text-sm leading-6 text-console-muted">
     Verified transaction and activity events are not connected to this record view. Payment,
     invoice settlement and provisioning are confirmed independently by Octalve Cloud.
    </p>
   </Panel>
   <Panel>
    <h3 className="text-lg font-medium text-console-ink">Quick actions</h3>
    <div className="mt-4 grid gap-3">
     {actions.map(action=><ActionLink key={action.label} href={action.href}
      variant={action.variant} className="w-full">{action.label}</ActionLink>)}
    </div>
   </Panel>
  </div>
 </div>;
}
