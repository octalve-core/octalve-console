"use client";
import Link from "next/link";
import {Globe2,LifeBuoy,PackagePlus,ReceiptText,Sparkles,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {SectionHeading} from "@/components/design-system/SectionHeading";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages,translateNavigationLabel} from "@/lib/i18n/dictionary";

type Shortcut={href:string;label:string;icon:LucideIcon;iconColor:string};
const shortcuts:readonly Shortcut[]=[
 {href:"/client/order",label:"Order hosting",icon:PackagePlus,iconColor:"bg-blue-50 text-console-primary"},
 {href:"/client/domains#domain-search",label:"Find a domain",icon:Globe2,iconColor:"bg-emerald-50 text-emerald-700"},
 {href:"/client/support/new",label:"Open support ticket",icon:LifeBuoy,iconColor:"bg-rose-50 text-rose-700"},
 {href:"/client/invoices",label:"View invoices",icon:ReceiptText,iconColor:"bg-amber-50 text-amber-700"}
];
export function ClientOverviewActions(){
 const {locale}=useLocale(),m=messages(locale);
 return <Panel>
  <div className="mb-5 flex items-center gap-2">
   <Sparkles aria-hidden="true" className="h-5 w-5 text-console-primary"/>
   <SectionHeading title={m.quickActions}/>
  </div>
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
   {shortcuts.map(({href,label,icon:Icon,iconColor})=><Link key={href} href={href}
    className="group flex min-h-32 min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-console-line bg-slate-50/70 px-3 py-5 text-center transition-colors hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    <span className={"flex h-12 w-12 items-center justify-center rounded-full "+iconColor}>
     <Icon aria-hidden="true" className="h-6 w-6"/>
    </span>
    <span className="text-sm font-semibold leading-5 text-console-ink">{translateNavigationLabel(label,locale)}</span>
   </Link>)}
  </div>
 </Panel>;
}
