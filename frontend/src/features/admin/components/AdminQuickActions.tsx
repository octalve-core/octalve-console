import Link from "next/link";
import {Boxes,PackagePlus,ShoppingCart,Sparkles,TicketCheck,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
type Shortcut={href:string;label:string;icon:LucideIcon;accent:string};
const actions:readonly Shortcut[]=[
 {href:"/admin/products",label:"Manage products",icon:Boxes,accent:"bg-blue-50 text-console-primary"},
 {href:"/admin/catalog/workbench",label:"Publish offers",icon:PackagePlus,accent:"bg-emerald-50 text-emerald-800"},
 {href:"/admin/support",label:"Support desk",icon:TicketCheck,accent:"bg-rose-50 text-rose-800"},
 {href:"/admin/orders",label:"Review orders",icon:ShoppingCart,accent:"bg-amber-50 text-amber-800"}
];
export function AdminQuickActions(){
 return <Panel>
  <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-console-ink">
   <Sparkles aria-hidden="true" className="h-5 w-5 text-console-primary"/>Quick actions
  </h2>
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
   {actions.map(({href,label,icon:Icon,accent})=><Link key={href} href={href}
    className="group flex min-h-32 min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-console-line bg-slate-50 px-3 py-5 text-center hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    <span className={"flex h-12 w-12 items-center justify-center rounded-full "+accent}>
     <Icon aria-hidden="true" className="h-6 w-6"/>
    </span>
    <span className="text-sm font-semibold leading-5 text-console-ink">{label}</span>
   </Link>)}
  </div>
 </Panel>;
}
