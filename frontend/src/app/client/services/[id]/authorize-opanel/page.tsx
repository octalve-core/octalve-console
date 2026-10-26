import { Suspense } from "react";
import { OPanelAuthorization } from "@/features/client/views/OPanelAuthorization";

export const dynamic = "force-dynamic";
export const metadata = { title: "Authorize OPanel | Octalve Cloud", referrer: "no-referrer" as const };

export default function OPanelAuthorizationPage() {
  return <Suspense fallback={<p role="status">Preparing secure hosting access…</p>}>
    <OPanelAuthorization />
  </Suspense>;
}
