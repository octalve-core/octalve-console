"use client";
import {ArrowLeft} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {ActionLink} from "@/components/design-system/ActionLink";
import {AdminSettingsSectionPanel} from "../../components/AdminSettingsSectionPanel";
import {ConsolePolicyEditor} from "../components/ConsolePolicyEditor";
import {MailTemplateWorkbench} from "../components/MailTemplateWorkbench";
import {ConsoleTaxEditor} from "../components/ConsoleTaxEditor";
import {OperationalSettingsStatus} from "../components/OperationalSettingsStatus";
import {getAdminSettingsItem,type AdminSettingsKey} from "../data/admin-settings-config";
export function AdminSettingsSectionView({section}:{section:AdminSettingsKey}){
 const item=getAdminSettingsItem(section);
 return <DashboardShell role="admin" title={item.title} description={item.description}>
  <div className="mb-4"><ActionLink href="/admin/settings" variant="outline">
   <ArrowLeft aria-hidden="true" className="h-4 w-4"/>Back to settings
  </ActionLink></div>
  <DashboardPage eyebrow="Settings" title={item.title} description={item.description}>
   <div className="grid min-w-0 gap-5 xl:grid-cols-3">
    {["general","theme","invoices","mail"].includes(section)?
      <ConsolePolicyEditor section={section}/>:
      section==="tax"?<ConsoleTaxEditor/>:section==="notifications"?null:section==="other"?<AdminSettingsSectionPanel item={item} section={section}/>:<OperationalSettingsStatus section={section}/>}
    {(section==="mail"||section==="notifications")?<MailTemplateWorkbench/>:null}
   </div>
  </DashboardPage>
 </DashboardShell>;
}
