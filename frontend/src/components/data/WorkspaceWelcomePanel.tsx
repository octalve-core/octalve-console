import {Cloud, ShieldCheck, Headphones, type LucideIcon} from "lucide-react";
type Audience = "client" | "staff" | "admin";
type Content = {eyebrow:string; description:string; icon:LucideIcon};
const copy:Record<Audience,Content> = {
 client: {eyebrow:"Your Octalve Cloud workspace",description:"Manage your services, domains, invoices, wallet and support in one place.",icon:Cloud},
 admin: {eyebrow:"Your Octalve Cloud administration",description:"Keep track of customers, hosting services, invoices, domains and provisioning.",icon:ShieldCheck},
 staff: {eyebrow:"Your Octalve Cloud workspace",description:"Follow customer requests, orders, support cases and provisioning.",icon:Headphones},
};
/** Deliberately light/legible independent of legacy CSS background rules. */
export function WorkspaceWelcomePanel({name,audience}:{name:string;audience:Audience}){
 const data=copy[audience],Icon=data.icon;
 return <section aria-label="Workspace welcome" className="relative overflow-hidden rounded-2xl border border-slate-200 border-t-4 border-t-blue-600 bg-white px-6 py-6 text-slate-950 shadow-sm sm:px-8 sm:py-8">
  <div className="relative flex items-start justify-between gap-5">
   <div className="min-w-0 max-w-3xl">
    <p className="text-xs font-bold uppercase tracking-widest text-blue-700">{data.eyebrow}</p>
    <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
      Welcome {name} <span role="img" aria-label="hello">👋</span>
    </h2>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">{data.description}</p>
   </div>
   <span aria-hidden="true" className="hidden shrink-0 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-blue-700 sm:flex">
     <Icon className="h-7 w-7"/>
   </span>
  </div>
 </section>;
}
