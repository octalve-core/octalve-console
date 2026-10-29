import Link from "next/link";
import {ArrowRight,BookOpen,CheckCircle2,CreditCard,FileText,Globe2,Server,ShieldCheck,Users} from "lucide-react";
import type {LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import type {AdminWorkspaceKey} from "../data/admin-workspace-config";

const billingModules:readonly {label:string;href:string;icon:LucideIcon;description:string}[]=[
 {label:"Invoices",href:"/admin/billing/invoices",icon:FileText,description:"Issued invoices and outstanding balances"},
 {label:"Transactions",href:"/admin/billing/transactions",icon:CreditCard,description:"Server-reported payment transactions"},
 {label:"Billable services",href:"/admin/billing/services",icon:Server,description:"Service billing and renewals"},
 {label:"Domains",href:"/admin/billing/domains",icon:Globe2,description:"Domain records and billing status"},
 {label:"Payment gateways",href:"/admin/gateways",icon:ShieldCheck,description:"Configured gateway records"},
 {label:"Support",href:"/admin/support",icon:BookOpen,description:"Billing support conversations"}
];
function RelatedLink({href,label}:{href:string;label:string}){
 return <Link href={href} className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-console-line bg-white px-4 text-sm font-medium text-console-primary hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary sm:w-auto">
  {label}<ArrowRight aria-hidden="true" className="h-4 w-4"/>
 </Link>;
}
export function AdminWorkspaceConnectionStatus({workspace,title}:{workspace:AdminWorkspaceKey;title:string}){
 if(workspace==="billing")return <section aria-label="Billing management" className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
  {billingModules.map(({label,href,icon:Icon,description})=><Link key={href} href={href}
   className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
   <Panel className="flex h-full min-h-40 flex-col transition-colors group-hover:border-blue-200 group-hover:bg-blue-50/40">
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
     <Icon aria-hidden="true" className="h-5 w-5"/>
    </div>
    <h3 className="mt-4 text-base font-medium text-console-ink">{label}</h3>
    <p className="mt-2 text-sm leading-6 text-console-muted">{description}</p>
    <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-medium text-console-primary">
     Open section<ArrowRight aria-hidden="true" className="h-4 w-4"/>
    </span>
   </Panel>
  </Link>)}
 </section>;
 const staff=workspace==="staff";
 const related=staff?{href:"/admin/support/departments",label:"Support departments"}:
  ["quotes","billing-batch","print-queue","invoice-designer"].includes(workspace)?
  {href:"/admin/billing/invoices",label:"Invoice management"}:
  {href:"/admin",label:"Admin overview"};
 return <Panel className="mx-auto max-w-3xl">
  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-console-primary">
   {staff?<Users aria-hidden="true" className="h-6 w-6"/>:<ShieldCheck aria-hidden="true" className="h-6 w-6"/>}
  </div>
  <h2 className="mt-5 text-xl font-medium text-console-ink">{title} is not connected yet</h2>
  <p className="mt-3 max-w-2xl text-sm leading-7 text-console-muted">
   This section does not currently have a verified record service. No items, balances,
   permissions or operational results are being shown as though they were returned by the server.
  </p>
  <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-console-muted">
   <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-console-primary"/>
   Existing connected Console features remain available using the links below.
  </p>
  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
   <RelatedLink href={related.href} label={related.label}/>
  </div>
 </Panel>;
}
