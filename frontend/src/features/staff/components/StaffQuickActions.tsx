import Link from "next/link";
import {BookOpen,LifeBuoy,ShoppingCart,Sparkles,Zap,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
type Tone="blue"|"green"|"violet"|"amber";
type Shortcut={label:string;href:string;icon:LucideIcon;tone:Tone};
const actions:readonly Shortcut[]=[
 {label:"Support tickets",href:"/staff/tickets",icon:LifeBuoy,tone:"blue"},
 {label:"Provisioning queue",href:"/staff/provisioning",icon:Zap,tone:"green"},
 {label:"Help articles",href:"/staff/knowledge-base",icon:BookOpen,tone:"violet"},
 {label:"Review orders",href:"/staff/orders",icon:ShoppingCart,tone:"amber"}
];
export function StaffQuickActions(){
 return <Panel>
  <h2 className="mb-3 flex items-center gap-2 text-base font-medium text-console-ink">
   <Sparkles aria-hidden="true" className="h-5 w-5 text-console-primary"/>Quick actions
  </h2>
  <WorkspaceGrid variant="quickActions">
   {actions.map(({label,href,icon,tone})=><Link key={href} href={href}
    className="group flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-2 rounded-xl px-2 py-3 text-center transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    <ConsoleIconTile icon={icon} tone={tone} size="lg" className="rounded-full"/>
    <span className="text-[13px] font-medium leading-5 text-console-ink">{label}</span>
   </Link>)}
  </WorkspaceGrid>
 </Panel>;
}
