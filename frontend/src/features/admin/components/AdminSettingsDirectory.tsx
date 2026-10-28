import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import styles from "@/components/design-system/WorkspaceGrid.module.css";
import type {AdminSettingsItem} from "../settings/data/admin-settings-config";
export function AdminSettingsDirectory({items}:{items:readonly AdminSettingsItem[]}){
 return <ul aria-label="Administration settings" className={styles.directory}>
  {items.map(item=>{const Icon=item.icon;return <li key={item.key}>
   <Link href={item.href} className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    <Panel className="flex h-full min-h-48 flex-col transition-colors group-hover:border-blue-200 group-hover:bg-blue-50/30">
     <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
      <Icon className="h-6 w-6"/>
     </div>
     <h2 className="mt-5 text-lg font-semibold text-console-ink">{item.title}</h2>
     <p className="mt-2 text-sm leading-6 text-console-muted">{item.description}</p>
     <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-console-primary">
      View section <ArrowRight aria-hidden="true" className="h-4 w-4"/>
     </span>
    </Panel>
   </Link>
  </li>;})}
 </ul>;
}
