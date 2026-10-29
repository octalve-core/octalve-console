import {ArrowLeft,ShieldCheck,UsersRound} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
type View="list"|"new"|"detail";
const data={
 list:{title:"Affiliates",heading:"Affiliate records are not available yet",
  description:"Affiliate tracking and commissions are not currently available in the Console."},
 new:{title:"New affiliate",heading:"Affiliate registration is not available yet",
  description:"Affiliate profiles cannot be created until this service is connected."},
 detail:{title:"Affiliate details",heading:"This affiliate record is unavailable",
  description:"We couldn't retrieve a verified affiliate record from the Console."}
};
export function DeferredAdminOperation({view}:{view:View}){
 const item=data[view];
 return <DashboardShell role="admin" title={item.title}
  description="Manage affiliate programmes from one place when available.">
  <DashboardPage eyebrow="Affiliates" title={item.title} description={item.description}>
   <Panel className="mx-auto max-w-3xl p-6 sm:p-9">
    <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
     <UsersRound className="h-6 w-6"/>
    </div>
    <h2 className="mt-5 text-xl font-medium text-console-ink sm:text-2xl">{item.heading}</h2>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-console-muted">
     No customer, referral or commission record will be shown or changed without a verified service response.
    </p>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
     <ActionLink href="/admin/customers" variant="outline" className="w-full sm:w-auto">
      <ShieldCheck aria-hidden="true" className="h-4 w-4"/>View customers
     </ActionLink>
     {view!=="list"?<ActionLink href="/admin/affiliates" variant="outline" className="w-full sm:w-auto">
      <ArrowLeft aria-hidden="true" className="h-4 w-4"/>Back to affiliates
     </ActionLink>:null}
    </div>
   </Panel>
  </DashboardPage>
 </DashboardShell>;
}
