import {Settings2} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ActionLink} from "@/components/design-system/ActionLink";

export type SettingsManagementLink = Readonly<{label:string;href:string;description:string}>;
export function AdminSettingsActions({links}:{links:readonly SettingsManagementLink[]}){
 return <Panel className="h-fit">
  <h3 className="flex items-center gap-2 text-lg font-medium text-console-ink">
   <Settings2 aria-hidden="true" className="h-5 w-5 text-console-primary"/>
   {links.length?"Related management":"Configuration access"}
  </h3>
  <p className="mt-3 text-sm leading-6 text-console-muted">
   {links.length
    ?"Open a related management page to review available records. A link does not indicate an integration is active."
    :"A verified configuration editor is not available for this section. No changes can be submitted here."}
  </p>
  {links.length?<ul className="mt-5 space-y-3">{links.map(link=><li key={link.href} className="min-w-0">
   <ActionLink href={link.href} variant="outline" className="w-full">{link.label}</ActionLink>
   <p className="mt-1 text-xs leading-5 text-console-muted">{link.description}</p>
  </li>)}</ul>:null}
 </Panel>;
}
