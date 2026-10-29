"use client";
import Link from "next/link";
import {BookOpen,Boxes,Globe2,LifeBuoy,PackagePlus,ReceiptText,ShoppingCart,Sparkles,TicketCheck,Zap,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import type {DashboardRole} from "@/lib/navigation/dashboard-nav";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {translateNavigationLabel} from "@/lib/i18n/dictionary";
type Tone="blue"|"green"|"amber"|"rose"|"violet";
type Shortcut={href:string;label:string;icon:LucideIcon;tone:Tone};
const options:Record<DashboardRole,readonly Shortcut[]>={
 admin:[
  {href:"/admin/products",label:"Manage products",icon:Boxes,tone:"blue"},
  {href:"/admin/catalog/workbench",label:"Publish offers",icon:PackagePlus,tone:"green"},
  {href:"/admin/support",label:"Support desk",icon:TicketCheck,tone:"rose"},
  {href:"/admin/orders",label:"Review orders",icon:ShoppingCart,tone:"amber"}],
 client:[
  {href:"/client/order",label:"Order hosting",icon:PackagePlus,tone:"blue"},
  {href:"/client/domains/register",label:"Find a domain",icon:Globe2,tone:"green"},
  {href:"/client/support/new",label:"Open support ticket",icon:LifeBuoy,tone:"rose"},
  {href:"/client/invoices",label:"View invoices",icon:ReceiptText,tone:"amber"}],
 staff:[
  {href:"/staff/tickets",label:"Support tickets",icon:LifeBuoy,tone:"blue"},
  {href:"/staff/provisioning",label:"Provisioning queue",icon:Zap,tone:"green"},
  {href:"/staff/knowledge-base",label:"Help articles",icon:BookOpen,tone:"violet"},
  {href:"/staff/orders",label:"Review orders",icon:ShoppingCart,tone:"amber"}]
};
/** Single Invoice-style Quick Access section shared by all authenticated roles. */
export function WorkspaceQuickActions({role}:{role:DashboardRole}){
 const {locale}=useLocale();
 return <Panel className="shadow-[0_2px_12px_rgba(0,25,62,0.035)]">
  <h2 className="mb-3 flex items-center gap-2 text-base font-medium text-console-ink">
   <Sparkles aria-hidden="true" className="h-5 w-5 text-console-primary"/>
   {translateNavigationLabel("Quick actions",locale)}
  </h2>
  <WorkspaceGrid variant="quickActions">
   {options[role].map(({href,label,icon,tone})=><Link key={href} href={href}
    className="group flex min-h-[100px] min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-transparent px-2 py-3 text-center transition-colors hover:border-blue-100 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-console-primary">
    <ConsoleIconTile icon={icon} tone={tone} size="lg" className="rounded-full transition-transform group-hover:scale-105"/>
    <span className="max-w-full text-center text-[12px] font-medium leading-5 text-console-ink sm:text-[13px]">{translateNavigationLabel(label,locale)}</span>
   </Link>)}
  </WorkspaceGrid>
 </Panel>;
}
