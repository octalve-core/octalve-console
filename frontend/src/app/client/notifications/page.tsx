import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {ClientNoticeInbox} from "@/features/client/components/ClientNoticeInbox";
export default function ClientNotificationsPage(){
  return <DashboardShell role="client" title="Notifications"
    description="Your account payment and domain reminders.">
    <DashboardPage eyebrow="Account" title="Notifications"
      description="Follow up on invoices and domains that may need your attention.">
      <ClientNoticeInbox/>
    </DashboardPage>
  </DashboardShell>;
}
