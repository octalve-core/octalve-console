import {Settings2} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";
import type {AdminSettingsItem,AdminSettingsKey} from "../settings/data/admin-settings-config";
export function AdminSettingsSectionPanel({item,section}:{item:AdminSettingsItem;section:AdminSettingsKey}){
 const Icon=item.icon;
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
    This overview lists configuration topics, not verified or saved settings values.
    Changes are available only through connected, authorized configuration workflows.
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
    <Settings2 aria-hidden="true" className="h-5 w-5 text-console-primary"/>Available management
   </h3>
   <p className="mt-3 text-sm leading-6 text-console-muted">
    Review connected records and their confirmed operational status before changing settings.
   </p>
   {section==="providers"?<ActionLink href="/admin/servers" variant="outline" className="mt-5 w-full">
    Manage provider connections
   </ActionLink>:null}
   {section==="invoices"?<ActionLink href="/admin/billing/invoices" variant="outline" className="mt-5 w-full">
    View invoices
   </ActionLink>:null}
   {section==="tickets"?<ActionLink href="/admin/support/departments" variant="outline" className="mt-5 w-full">
    Manage support departments
   </ActionLink>:null}
   {section==="notifications"?<ActionLink href="/admin/settings/notifications" variant="outline" className="mt-5 w-full">
    View notification templates
   </ActionLink>:null}
  </Panel>
 </div>;
}
