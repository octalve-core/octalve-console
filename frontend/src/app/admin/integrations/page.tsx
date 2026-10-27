import {Suspense} from "react";
import {IntegrationStore} from "@/features/admin/integrations/IntegrationStore";
export default function AdminIntegrationsPage(){return <Suspense fallback={<p className="p-6 text-sm text-console-muted">Opening integrations…</p>}><IntegrationStore/></Suspense>;}
