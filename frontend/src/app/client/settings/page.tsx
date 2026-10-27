import {Languages,UserRound,ShieldCheck} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {routes} from "@/lib/routes";
import {ClientNoticePreferences} from "@/features/client/components/ClientNoticePreferences";

export default function ClientSettingsPage(){
  return <DashboardShell role="client" title="Settings"
    description="Manage your account preferences.">
    <DashboardPage eyebrow="Account" title="Settings" description="Your account and personal preferences.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <UserRound className="h-6 w-6 text-console-primary" aria-hidden="true"/>
          <h2 className="mt-4 text-lg font-semibold text-console-ink">Account</h2>
          <p className="mt-2 text-sm leading-6 text-console-muted">
            Update your contact information, password and account security.
          </p>
          <ActionLink href={routes.client.profile} variant="outline" className="mt-5">Manage profile</ActionLink>
        </Panel>
        <Panel>
          <Languages className="h-6 w-6 text-console-primary" aria-hidden="true"/>
          <h2 className="mt-4 text-lg font-semibold text-console-ink">Language</h2>
          <p className="mt-2 text-sm leading-6 text-console-muted">
            English is the currently supported language. Additional translations will
            become selectable here after they are reviewed.
          </p>
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-console-ink">
            <ShieldCheck className="h-4 w-4 text-console-primary" aria-hidden="true"/>
            Current language: English
          </p>
        </Panel>
      </div>
      <div className="mt-5"><ClientNoticePreferences/></div>
    </DashboardPage>
  </DashboardShell>;
}
