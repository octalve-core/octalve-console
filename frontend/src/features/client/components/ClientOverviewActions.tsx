"use client";
import Link from "next/link";
import {Globe2,LifeBuoy,PackagePlus,ReceiptText,Sparkles,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
import {SectionHeading} from "@/components/design-system/SectionHeading";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages,translateNavigationLabel} from "@/lib/i18n/dictionary";

type Shortcut={href:string;label:string;icon:LucideIcon;tone:"blue"|"green"|"rose"|"amber"};
const shortcuts:readonly Shortcut[]=[
 {href:"/client/order",label:"Order hosting",icon:PackagePlus,tone:"blue"},
 {href:"/client/domains/register",label:"Find a domain",icon:Globe2,tone:"green"},
 {href:"/client/support/new",label:"Open support ticket",icon:LifeBuoy,tone:"rose"},
 {href:"/client/invoices",label:"View invoices",icon:ReceiptText,tone:"amber"}
];
export function ClientOverviewActions(){
 const {locale}=useLocale(),m=messages(locale);
 return <Panel>
  <div className="mb-5 flex items-center gap-2">
   <Sparkles aria-hidden="true" className="h-5 w-5 text-console-primary"/>
   <SectionHeading title={m.quickActions}/>
  </div>
  <WorkspaceGrid variant="quickActions">
   {shortcuts.map(({href,label,icon:Icon,tone})=><Link key={href} href={href}
    className="group flex min-h-32 min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-console-line bg-slate-50/70 px-3 py-5 text-center transition-colors hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    <ConsoleIconTile icon={Icon} tone={tone} size="lg"/>
    <span className="text-sm font-semibold leading-5 text-console-ink">{translateNavigationLabel(label,locale)}</span>
   </Link>)}
  </WorkspaceGrid>
 </Panel>;
}
