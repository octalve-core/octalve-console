import Link from "next/link";
import { BookOpen, Boxes, CreditCard, Globe2, LifeBuoy, ListChecks, PackagePlus, ReceiptText, ShieldCheck, ShoppingCart, TicketCheck, Zap, type LucideIcon } from "lucide-react";
type Role = "client"|"admin"|"staff";
type Shortcut={href:string;label:string;icon:LucideIcon;accent:string};
const options:Record<Role,Shortcut[]>={
  client:[
    {href:"/client/order",label:"Order hosting",icon:PackagePlus,accent:"bg-[#EAF3FF] text-[#0064E0]"},
    {href:"/client/domains#domain-search",label:"Find a domain",icon:Globe2,accent:"bg-emerald-50 text-emerald-600"},
    {href:"/client/support/new",label:"Open support ticket",icon:LifeBuoy,accent:"bg-rose-50 text-rose-600"},
    {href:"/client/invoices",label:"View invoices",icon:ReceiptText,accent:"bg-amber-50 text-amber-600"}
  ],
  admin:[
    {href:"/admin/products",label:"Manage products",icon:Boxes,accent:"bg-[#EAF3FF] text-[#0064E0]"},
    {href:"/admin/catalog/workbench",label:"Publish offers",icon:PackagePlus,accent:"bg-emerald-50 text-emerald-600"},
    {href:"/admin/support",label:"Support desk",icon:TicketCheck,accent:"bg-rose-50 text-rose-600"},
    {href:"/admin/orders",label:"Review orders",icon:ShoppingCart,accent:"bg-amber-50 text-amber-600"}
  ],
  staff:[
    {href:"/staff/tickets",label:"Support tickets",icon:LifeBuoy,accent:"bg-[#EAF3FF] text-[#0064E0]"},
    {href:"/staff/provisioning",label:"Provisioning",icon:Zap,accent:"bg-emerald-50 text-emerald-600"},
    {href:"/staff/knowledge-base",label:"Help articles",icon:BookOpen,accent:"bg-violet-50 text-violet-600"},
    {href:"/staff/orders",label:"Review orders",icon:ShoppingCart,accent:"bg-amber-50 text-amber-600"}
  ]
};
/** Single responsive Quick Actions module for all three authenticated workspaces. */
export function WorkspaceQuickActions({role}:{role:Role}){
  return <section className="overflow-hidden rounded-[24px] border border-[#E5EBF3] bg-white p-4 shadow-[0_2px_12px_rgba(0,25,62,.03)] sm:p-6">
    <div className="mb-5 flex items-center gap-2">
      <span className="text-base text-amber-500">✦</span>
      <h2 className="text-base font-bold tracking-tight text-[#142A43]">Quick actions</h2>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {options[role].map(({href,label,icon:Icon,accent})=><Link key={href} href={href}
        className="group flex min-h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-transparent p-3 text-center transition hover:border-blue-100 hover:bg-[#F6F9FD] focus-visible:border-[#0064E0] focus-visible:outline-none">
        <span className={`flex h-14 w-14 items-center justify-center rounded-full transition group-hover:scale-105 ${accent}`}>
          <Icon className="h-6 w-6" aria-hidden="true"/>
        </span>
        <span className="text-[13px] font-semibold leading-5 text-[#24364D]">{label}</span>
      </Link>)}
    </div>
  </section>;
}