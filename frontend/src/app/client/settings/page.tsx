"use client";
import {UserRound} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {routes} from "@/lib/routes";
import {ClientNoticePreferences} from "@/features/client/components/ClientNoticePreferences";
import {ClientLanguagePreferences} from "@/features/client/components/ClientLanguagePreferences";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {messages} from "@/lib/i18n/dictionary";

export default function ClientSettingsPage(){
 const {locale}=useLocale(),m=messages(locale);
  return <DashboardShell role="client" title={m.settings}
    description={m.settingsIntro}>
    <DashboardPage eyebrow={m.account} title={m.settings} description={m.settingsIntro}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <UserRound className="h-6 w-6 text-console-primary" aria-hidden="true"/>
          <h2 className="mt-4 text-lg font-medium text-console-ink">{m.account}</h2>
          <p className="mt-2 text-sm leading-6 text-console-muted">
            {m.accountIntro}
          </p>
          <ActionLink href={routes.client.profile} variant="outline" className="mt-5">{m.manageProfile}</ActionLink>
        </Panel>
        <ClientLanguagePreferences/>
      </div>
      <div className="mt-5"><ClientNoticePreferences/></div>
    </DashboardPage>
  </DashboardShell>;
}
