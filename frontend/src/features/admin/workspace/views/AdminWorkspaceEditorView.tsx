"use client";
import {ArrowLeft,ShieldCheck,ServerCog} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {adminWorkspaceConfig,type AdminWorkspaceKey} from "../data/admin-workspace-config";

/**
 * A generic Workspace configuration has no verified mutation endpoint.
 * Never collect fields or simulate a successful save for unimplemented operations.
 */
export function AdminWorkspaceEditorView({workspace}:{workspace:AdminWorkspaceKey}){
 const config=adminWorkspaceConfig[workspace];
 return <DashboardShell role="admin" title={config.title} description={config.description}>
  <DashboardPage eyebrow={config.eyebrow} title={config.createLabel??config.title}
   description={config.description}>
   <Panel className="mx-auto max-w-3xl">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
     <ServerCog aria-hidden="true" className="h-6 w-6"/>
    </div>
    <h2 className="mt-5 text-xl font-semibold text-console-ink">This operation is not available yet</h2>
    <p className="mt-3 text-sm leading-7 text-console-muted">
     Creating or editing {config.title.toLowerCase()} requires a verified server-side
     workflow. The Console will not display an unconnected Save button or report
     success without a confirmed response from the service.
    </p>
    <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-console-muted">
     <ShieldCheck aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-console-primary"/>
     Existing records and available administration tools can still be reviewed.
    </p>
    <ActionLink href={config.listHref} variant="outline" className="mt-6 w-full sm:w-auto">
     <ArrowLeft aria-hidden="true" className="h-4 w-4"/>Back to {config.title}
    </ActionLink>
   </Panel>
  </DashboardPage>
 </DashboardShell>;
}
