import type {AdminSettingsItem,AdminSettingsKey} from "../settings/data/admin-settings-config";
import {AdminSettingsTopics} from "../settings/components/AdminSettingsTopics";
import {AdminSettingsActions} from "../settings/components/AdminSettingsActions";
import {OperationalSettingsStatus} from "../settings/components/OperationalSettingsStatus";

/** Routes are reviews only, never proof that integration or issuance is enabled. */
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
  {label:"Browse Integration Store",href:"/admin/integrations",description:"Review vendor-specific requirements and official connection guides."},
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
  {label:"Review invoice designs",href:"/admin/invoice-designer",description:"Open approved read-only invoice layouts and sample PDFs; issuance and edits are separate."},
  {label:"View invoices",href:"/admin/billing/invoices",description:"Review invoices and their issued documents."},
  {label:"View print queue",href:"/admin/billing/print-queue",description:"Review the print workflow and its current limitations."},
 ],
 tickets: [
  {label:"Review support departments",href:"/admin/support/departments",description:"Review support departments and routing."},
  {label:"Review saved responses",href:"/admin/support/responses",description:"View available ticket response records."},
 ],
};

export function AdminSettingsSectionPanel({item,section}:{item:AdminSettingsItem;section:AdminSettingsKey}){
 if(section==="other")return <div className="grid min-w-0 gap-5 xl:grid-cols-3"><OperationalSettingsStatus section={section}/></div>;
 const links=adminSettingsManagementLinks[section]??[];
 return <div className="grid min-w-0 gap-5 xl:grid-cols-3">
  <AdminSettingsTopics item={item}/>
  <AdminSettingsActions links={links}/>
 </div>;
}
