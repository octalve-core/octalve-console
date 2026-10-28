import {Panel} from "@/components/design-system/Panel";
import type {AdminSettingsItem} from "../data/admin-settings-config";

export function AdminSettingsTopics({item}:{item:AdminSettingsItem}){
 const Icon=item.icon;
 return <Panel className="xl:col-span-2">
  <div className="flex min-w-0 items-center gap-3">
   <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
    <Icon className="h-6 w-6"/>
   </span>
   <div className="min-w-0">
    <h2 className="text-lg font-semibold text-console-ink">{item.title}</h2>
    <p className="text-sm text-console-muted">{item.description}</p>
   </div>
  </div>
  <p className="mt-6 text-sm leading-6 text-console-muted">
   This page outlines configuration topics. It does not display live values or confirm that services are enabled.
   Settings can only be changed through independently authorized and connected workflows.
  </p>
  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
   {item.fields.map(field=><li key={field.label}
    className="min-w-0 rounded-xl border border-console-line bg-slate-50 p-4">
    <span className="text-sm font-medium text-console-ink">{field.label}</span>
   </li>)}
  </ul>
 </Panel>;
}
