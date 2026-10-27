"use client";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {StaffSecurityOverview} from "../components/StaffSecurityOverview";

export function StaffSecurityView(){
 return <DashboardShell role="staff" title="Security" description="Review your account access and protected operations.">
  <DashboardPage eyebrow="Security" title="Staff security"
   description="Understand how staff permissions and protected services are handled.">
   <StaffSecurityOverview/>
  </DashboardPage>
 </DashboardShell>;
}
