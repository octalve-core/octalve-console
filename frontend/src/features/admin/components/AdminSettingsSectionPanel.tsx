import {Settings2} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import type {AdminSettingsItem,AdminSettingsKey} from "../settings/data/admin-settings-config";

/**
 * Link only to concrete, role-protected pages. These links offer review of
 * existing records; they do NOT certify provider activation or authorize writes.
 */
export const adminSettingsManagementLinks: Partial<Record<AdminSettingsKey,ReadonlyArray<{
 label:string; href:string; description:string;
}>>> = {
 security: [
  {label:"Review audit logs",href:"/admin/audit-logs",description:"Review recorded security and administrator activity."},
  {label:"View staff accounts",href:"/admin/staff",description:"Review account access without changing privileges."},
 ],
 mail: [
  {label:"View notification templates",href:"/admin/settings/notifications",description:"Review existing message templates; delivery is separate."},
 ],
 providers: [
  {label:"Hosting provider records",href:"/admin/servers",description:"DirectAdmin and WHM supplier connections and inventory."},
  {label:"Payment gateway records",href:"/admin/gateways",description:"Paystack and other recorded payment gateways."},
  {label:"Domain records",href:"/admin/billing/domains",description:"Recorded domains; registrar execution is not connected."},
  {label:"Retail offer workbench",href:"/admin/catalog/workbench",description:"Review server-owned products, packages and retail offer authority."},
 ],
 notifications: [
  {label:"View notification templates",href:"/admin/settings/notifications",description:"Read recorded email templates; unqualified creation is unavailable."},
 ],
 credits: [
  {label:"View billing records",href:"/admin/billing",description:"Review invoices and account billing without applying credits."},
 ],
 "cron-jobs": [
  {label:"Review renewal preflight",href:"/admin/billing/batch",description:"Review eligible renewals without scheduling charges."},
 ],
 invoices: [
  {label:"View invoices",href:"/admin/billing/invoices",description:"Review invoices and their issued documents."},
  {label:"View print queue",href:"/admin/billing/print-queue",description:"Review the print workflow and its current limitations."},
 ],
 tickets: [
  {label:"Review support departments",href:"/admin/support/departments",description:"Review support departments and routing."},
  {label:"Review saved responses",href:"/admin/support/responses",description:"View available ticket response records."},
 ],
};
export function AdminSettingsSectionPanel({item,section}:{item:AdminSettingsItem;section:AdminSettingsKey}){
 const Icon=item.icon,links=adminSettingsManagementLinks[section]??[];
 return <div className="grid min-w-0 gap-5 xl:grid-cols-3">
  <Panel className="xl:col-span-2">
   <div className="flex min-w-0 items-center gap-3">
    <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-console-primary"><Icon className="h-6 w-6"/></span>
    <div className="min-w-0">
     <h2 className="text-lg font-semibold text-console-ink">{item.title}</h2>
     <p className="text-sm text-console-muted">{item.description}</p>
    </div>
   </div>
   <p className="mt-6 text-sm leading-6 text-console-muted">
    This page outlines configuration topics. It does not display live values or confirm that services are enabled.
    Settings can only be changed through independently authorized and connected workflows.
   </p>
   <ul className="mt-5 grid gap-3 sm:grid-cols-2">
    {item.fields.map(field=><li key={field.label}
     className="min-w-0 rounded-xl border border-console-line bg-slate-50 p-4">
     <span className="text-sm font-medium text-console-ink">{field.label}</span>
    </li>)}
   </ul>
  </Panel>
  <Panel className="h-fit">
   <h3 className="flex items-center gap-2 text-lg font-semibold text-console-ink">
    <Settings2 aria-hidden="true" className="h-5 w-5 text-console-primary"/>
    {links.length?"Related management":"Configuration access"}
   </h3>
   <p className="mt-3 text-sm leading-6 text-console-muted">
    {links.length
      ?"Open the corresponding management page to review available records. A linked page does not indicate an integration is active."
      :"A verified configuration editor is not available for this section. No changes can be submitted here."}
   </p>
   {links.length?<ul className="mt-5 space-y-3">{links.map(link=><li key={link.href} className="min-w-0">
    <ActionLink href={link.href} variant="outline" className="w-full">{link.label}</ActionLink>
    <p className="mt-1 text-xs leading-5 text-console-muted">{link.description}</p>
   </li>)}</ul>:null}
  </Panel>
 </div>;
}
