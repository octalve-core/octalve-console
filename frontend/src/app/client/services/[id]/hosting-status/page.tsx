import { OPanelServiceOverview } from "@/features/client/views/OPanelServiceOverview";

// Console-only read-only hosting status. This is NOT independent OPanel SSO.
// Retain the existing OPanel prototype as an implementation reference until
// the separate OPanel repository and Console launch contract are accepted.
export default function ConsoleHostingStatusPage() {
  return <OPanelServiceOverview />;
}
