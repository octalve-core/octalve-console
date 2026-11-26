import {CalendarDays,CreditCard,FileText,ReceiptText,ShieldCheck} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import {formatStatus,getStatusTone} from "@/lib/constants/status";
import type {ClientRecord} from "../../data/client-demo-data";
import type {BillingResource} from "./BillingRecordDirectory";
import {serviceDate} from "../../utils/service-contract";
import {invoiceDownloadHref,invoiceHref} from "./invoice-links";
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
     {key:"Payment reference",value:record.paymentReference||"—",icon:FileText},
     {key:"Status",value:formatStatus(record.status),icon:ShieldCheck},
     {key:resource==="orders"?"Ordered":"Due date",value:serviceDate(record.date||null),icon:CalendarDays},
     ...(resource==="invoices"?[{key:"Issued",value:serviceDate(record.issuedDate||null),icon:CalendarDays},
      {key:"Paid on",value:record.paidDate?serviceDate(record.paidDate):"—",icon:CalendarDays}]:[]),
     {key:"Amount",value:record.amount||"—",icon:CreditCard}
    ].map(item=>{const Meta=item.icon;return <div key={item.key} className="min-w-0 rounded-xl bg-slate-50 p-4">
     <dt className="flex items-center gap-2 text-sm text-console-muted"><Meta aria-hidden="true" className="h-4 w-4"/>{item.key}</dt>
     <dd className="mt-2 break-words text-sm font-medium text-console-ink">{item.value}</dd>
    </div>;})}
   </dl>
  </Panel>
  {resource==="invoices" && !!record.invoicePeriods?.length && <Panel>
   <h3 className="text-lg font-medium text-console-ink">Invoice items</h3>
   <div className="mt-4 divide-y divide-slate-200">
    {record.invoicePeriods.map((item,index)=><div key={index} className="py-3">
     <p className="break-words text-sm font-medium">{item.label}</p>
     <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-console-muted">{item.domain?"Registration date":item.confirmed?"Service start":"Billing period start"}</dt><dd>{serviceDate(item.start)}</dd></div>
      <div><dt className="text-xs text-console-muted">{item.domain?"Expiry date":item.confirmed?"Service period end":"Billing period end"}</dt><dd>{serviceDate(item.end)}</dd></div>
     </dl>
    </div>)}
   </div>
  </Panel>}
  <div>
   <Panel>
    <h3 className="text-lg font-medium text-console-ink">Quick actions</h3>
    <div className="mt-4 grid gap-3">
     {resource==="invoices" && record.testCheckoutHref && <ActionLink href={record.testCheckoutHref} variant="outline">View test registration status</ActionLink>}
     {resource==="invoices" && record.paymentHref && <ActionLink href={record.paymentHref} variant="primary">Pay now</ActionLink>}
     {resource==="invoices" && <a href={invoiceDownloadHref(record.id)} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-console-primary px-4 text-sm font-medium text-white">Download invoice PDF</a>}
     {resource==="orders" && record.invoiceDocuments?.map(invoice=><div key={invoice.id} className="grid gap-2 rounded-lg border border-console-line p-3 text-sm">
      <ActionLink href={invoiceHref(invoice.id)} variant="primary">View invoice {invoice.number}</ActionLink>
      {invoice.paymentHref && <ActionLink href={invoice.paymentHref} variant="outline">Pay now</ActionLink>}
      <a href={invoiceDownloadHref(invoice.id)} className="inline-flex min-h-11 items-center justify-center font-medium text-console-primary">Download invoice PDF</a>
     </div>)}
     {actions.map(action=><ActionLink key={action.label} href={action.href}
      variant={action.variant} className="w-full">{action.label}</ActionLink>)}
    </div>
   </Panel>
  </div>
 </div>;
}
