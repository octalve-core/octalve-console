import {ArrowLeft,ShieldCheck} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {ActionLink} from "@/components/design-system/ActionLink";
import {Panel} from "@/components/design-system/Panel";
import {blockedAdminResourceWrites,type BlockedAdminResourceKey} from "../data/admin-action-policy";

export function AdminRestrictedActionView({resource}:{resource:BlockedAdminResourceKey}){
 const policy=blockedAdminResourceWrites[resource];
 const title=resource==="provisioning"?"Provisioning execution":resource==="gateways"?"Gateway configuration":
 resource==="domains"?"Domain registration":resource==="orders"?"Manual order creation":"Invoice issuance";
 return <DashboardShell role="admin" title={title} description={policy.reason}>
  <DashboardPage eyebrow="Administration" title={title} description="Review the available records and approved management workflow.">
   <Panel className="mx-auto max-w-3xl">
    <ShieldCheck aria-hidden="true" className="h-10 w-10 text-console-primary"/>
    <h2 className="mt-4 text-lg font-medium text-console-ink">This operation is not available</h2>
    <p className="mt-3 text-sm leading-7 text-console-muted">{policy.reason}</p>
    <p className="mt-3 text-sm text-console-muted">No changes have been submitted.</p>
    <div className="mt-6 flex flex-wrap gap-3">
     <ActionLink href={policy.listHref} variant="outline"><ArrowLeft className="h-4 w-4" aria-hidden="true"/>View records</ActionLink>
     {resource==="invoices"?<ActionLink href="/admin/invoice-designer">Review invoice designs</ActionLink>:null}
     {resource==="gateways"?<ActionLink href="/admin/integrations">Browse integrations</ActionLink>:null}
     {resource==="provisioning"?<ActionLink href="/admin/servers">Review providers</ActionLink>:null}
    </div>
   </Panel>
  </DashboardPage>
 </DashboardShell>;
}
