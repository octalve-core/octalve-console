import Link from "next/link";
import {KeyRound,LifeBuoy,ShieldCheck,UserCheck} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
export function StaffSecurityOverview(){
 return <div className="space-y-5">
  <section aria-label="Staff access and security" className="grid gap-4 md:grid-cols-3">
   {[
    {title:"Access level",value:"Staff",description:"Your account uses staff-scoped access.",icon:UserCheck},
    {title:"Protected actions",value:"Restricted",description:"Administrator operations remain permission-protected.",icon:ShieldCheck},
    {title:"Account security",value:"Session protected",description:"Sign-in and session checks are handled by Octalve Console.",icon:KeyRound}
   ].map(({title,value,description,icon:Icon})=><Panel key={title}>
    <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
     <Icon className="h-5 w-5"/>
    </span>
    <h2 className="mt-4 text-sm font-medium text-console-muted">{title}</h2>
    <p className="mt-2 text-xl font-medium text-console-ink">{value}</p>
    <p className="mt-3 text-xs leading-5 text-console-muted">{description}</p>
   </Panel>)}
  </section>
  <Panel>
   <h2 className="text-lg font-medium text-console-ink">Security and account support</h2>
   <p className="mt-3 max-w-3xl text-sm leading-7 text-console-muted">
    Access and permissions are checked by the server. If your account needs an access review,
    report it through the support team. This page does not expose administrative permission
    changes, sign-in history, or security settings that have not been connected to verified services.
   </p>
   <Link href="/staff/tickets" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-console-primary hover:underline focus-visible:ring-2 focus-visible:ring-console-primary">
    <LifeBuoy aria-hidden="true" className="h-4 w-4"/>Support tickets
   </Link>
  </Panel>
 </div>;
}
