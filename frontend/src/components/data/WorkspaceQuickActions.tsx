"use client";
import Link from "next/link";
import {BookOpen,Boxes,LifeBuoy,PackagePlus,ShoppingCart,TicketCheck,Zap,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import type {DashboardRole} from "@/lib/navigation/dashboard-nav";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {translateNavigationLabel} from "@/lib/i18n/dictionary";
import {navigationIcons} from "@/features/shell/lib/navigation-icons";
type Tone="blue"|"green"|"amber"|"rose"|"violet";
const medallions:Record<Tone,string>={blue:"bg-blue-100",green:"bg-emerald-100",amber:"bg-orange-100",rose:"bg-rose-100",violet:"bg-violet-100"};
type Shortcut={href:string;label:string;icon:LucideIcon;tone:Tone};
const options:Record<DashboardRole,readonly Shortcut[]>={
 admin:[
  {href:"/admin/products",label:"Manage products",icon:Boxes,tone:"blue"},
  {href:"/admin/catalog/workbench",label:"Publish offers",icon:PackagePlus,tone:"green"},
  {href:"/admin/support",label:"Support desk",icon:TicketCheck,tone:"rose"},
  {href:"/admin/orders",label:"Review orders",icon:ShoppingCart,tone:"amber"}],
 client:[
  {href:"/client/order",label:"Order hosting",icon:navigationIcons.server,tone:"blue"},
  {href:"/client/domains/register",label:"Find a domain",icon:navigationIcons.globe2,tone:"violet"},
  {href:"/client/support/new",label:"Open support ticket",icon:navigationIcons.lifeBuoy,tone:"rose"},
  {href:"/client/invoices",label:"View invoices",icon:navigationIcons.receiptText,tone:"amber"}],
 staff:[
  {href:"/staff/tickets",label:"Support tickets",icon:LifeBuoy,tone:"blue"},
  {href:"/staff/provisioning",label:"Provisioning queue",icon:Zap,tone:"green"},
  {href:"/staff/knowledge-base",label:"Help articles",icon:BookOpen,tone:"violet"},
  {href:"/staff/orders",label:"Review orders",icon:ShoppingCart,tone:"amber"}]
};
/** Single Invoice-style Quick Access section shared by all authenticated roles. */
export function WorkspaceQuickActions({role}:{role:DashboardRole}){
 const {locale}=useLocale();
 return <Panel>
  <h2 className="mb-3 flex items-center gap-2 text-base font-medium text-console-ink">
   <Zap aria-hidden="true" className="h-5 w-5 text-orange-600"/>
   {translateNavigationLabel("Quick actions",locale)}
  </h2>
  <WorkspaceGrid variant="quickActions">
   {options[role].map(({href,label,icon,tone})=><Link key={href} href={href}
    className="group flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-2 rounded-xl px-0.5 py-3 text-center transition-colors hover:bg-slate-50 sm:px-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-console-primary">
    <ConsoleIconTile icon={icon} tone={tone} size="lg" className={`!rounded-full ${medallions[tone]}`}/>
    <span className="max-w-full text-center break-words text-[11px] font-medium leading-4 text-console-ink sm:text-[13px]">{translateNavigationLabel(label,locale)}</span>
   </Link>)}
  </WorkspaceGrid>
 </Panel>;
}
