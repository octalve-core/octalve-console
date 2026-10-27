"use client";
import {ArrowLeft} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {ActionLink} from "@/components/design-system/ActionLink";
import {AdminSettingsSectionPanel} from "../../components/AdminSettingsSectionPanel";
import {getAdminSettingsItem,type AdminSettingsKey} from "../data/admin-settings-config";
export function AdminSettingsSectionView({section}:{section:AdminSettingsKey}){
 const item=getAdminSettingsItem(section);
 return <DashboardShell role="admin" title={item.title} description={item.description}
  actions={<ActionLink href="/admin/settings" variant="outline">
   <ArrowLeft aria-hidden="true" className="h-4 w-4"/>Settings
  </ActionLink>}>
  <DashboardPage eyebrow="Settings" title={item.title} description={item.description}>
   <AdminSettingsSectionPanel item={item} section={section}/>
  </DashboardPage>
 </DashboardShell>;
}
