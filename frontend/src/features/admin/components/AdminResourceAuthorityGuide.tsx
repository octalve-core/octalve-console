import {ShieldCheck} from "lucide-react";
import {ActionLink} from "@/components/design-system/ActionLink";
import {Panel} from "@/components/design-system/Panel";
import type {AdminResourceKey} from "../data/admin-resource-config";
import {blockedAdminResourceWrites,isAdminMutationDisabled} from "../data/admin-action-policy";

export function AdminResourceAuthorityGuide({resource}:{resource:AdminResourceKey}){
 if(!isAdminMutationDisabled(resource))return null;
 const policy=blockedAdminResourceWrites[resource];
 return <Panel className="min-w-0">
  <div className="flex items-start gap-3">
   <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-console-primary"/>
   <div className="min-w-0">
    <h2 className="text-sm font-semibold text-console-ink">Review available records</h2>
    <p className="mt-2 text-sm leading-6 text-console-muted">{policy.reason}</p>
    <div className="mt-4 flex flex-wrap gap-2">
     {resource==="plans"||resource==="products"?<ActionLink href="/admin/catalog/workbench" size="sm" variant="outline">Manage in Catalogue</ActionLink>:null}
     {resource==="invoices"?<ActionLink href="/admin/invoice-designer" size="sm" variant="outline">Invoice designs</ActionLink>:null}
     {resource==="invoices"?<ActionLink href="/admin/settings/invoices" size="sm" variant="outline">Invoice policies</ActionLink>:null}
     {resource==="gateways"||resource==="domains"?<ActionLink href="/admin/integrations" size="sm" variant="outline">Integration Store</ActionLink>:null}
     {resource==="provisioning"?<ActionLink href="/admin/servers" size="sm" variant="outline">Provider records</ActionLink>:null}
    </div>
   </div>
  </div>
 </Panel>;
}
