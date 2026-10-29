import Link from "next/link";
import {Boxes,PackagePlus,ShoppingCart,Sparkles,TicketCheck,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
type Tone="blue"|"green"|"rose"|"amber";
type Shortcut={href:string;label:string;icon:LucideIcon;tone:Tone};
const actions:readonly Shortcut[]=[
 {href:"/admin/products",label:"Manage products",icon:Boxes,tone:"blue"},
 {href:"/admin/catalog/workbench",label:"Publish offers",icon:PackagePlus,tone:"green"},
 {href:"/admin/support",label:"Support desk",icon:TicketCheck,tone:"rose"},
 {href:"/admin/orders",label:"Review orders",icon:ShoppingCart,tone:"amber"}
];
export function AdminQuickActions(){
 return <Panel>
  <h2 className="mb-3 flex items-center gap-2 text-base font-medium text-console-ink">
   <Sparkles aria-hidden="true" className="h-5 w-5 text-console-primary"/>Quick actions
  </h2>
  <WorkspaceGrid variant="quickActions">
   {actions.map(({href,label,icon,tone})=><Link key={href} href={href}
    className="group flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-2 rounded-xl px-2 py-3 text-center transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    <ConsoleIconTile icon={icon} tone={tone} size="lg" className="rounded-full"/>
    <span className="text-[13px] font-medium leading-5 text-console-ink">{label}</span>
   </Link>)}
  </WorkspaceGrid>
 </Panel>;
}
