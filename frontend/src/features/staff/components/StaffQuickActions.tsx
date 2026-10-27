import Link from "next/link";
import {BookOpen,LifeBuoy,ShoppingCart,Sparkles,Zap,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
type Shortcut={label:string;href:string;icon:LucideIcon;accent:string};
const actions:readonly Shortcut[]=[
 {label:"Support tickets",href:"/staff/tickets",icon:LifeBuoy,accent:"bg-blue-50 text-console-primary"},
 {label:"Provisioning queue",href:"/staff/provisioning",icon:Zap,accent:"bg-emerald-50 text-emerald-800"},
 {label:"Help articles",href:"/staff/knowledge-base",icon:BookOpen,accent:"bg-violet-50 text-violet-800"},
 {label:"Review orders",href:"/staff/orders",icon:ShoppingCart,accent:"bg-amber-50 text-amber-800"}
];
export function StaffQuickActions(){
 return <Panel>
  <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-console-ink">
   <Sparkles aria-hidden="true" className="h-5 w-5 text-console-primary"/>Quick actions
  </h2>
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
   {actions.map(({label,href,icon:Icon,accent})=><Link key={href} href={href}
    className="group flex min-h-32 min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-console-line bg-slate-50 px-3 py-5 text-center hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    <span className={"flex h-12 w-12 items-center justify-center rounded-full "+accent}><Icon aria-hidden="true" className="h-6 w-6"/></span>
    <span className="text-sm font-semibold leading-5 text-console-ink">{label}</span>
   </Link>)}
  </div>
 </Panel>;
}
