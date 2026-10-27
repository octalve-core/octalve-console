import {redirect} from "next/navigation";
/** Legacy provider create/edit is retired until the hardened connection manager is qualified. */
export default function OldProviderEditor(){redirect("/admin/integrations");}
