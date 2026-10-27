"use client";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {AdminSettingsDirectory} from "../../components/AdminSettingsDirectory";
import {adminSettingsItems} from "../data/admin-settings-config";
export function AdminSettingsHubView(){
 return <DashboardShell role="admin" title="Settings" description="Review administration and platform configuration.">
  <DashboardPage eyebrow="Configuration" title="Settings"
   description="Choose a section to view available settings and connected management tools.">
   <AdminSettingsDirectory items={adminSettingsItems}/>
  </DashboardPage>
 </DashboardShell>;
}
