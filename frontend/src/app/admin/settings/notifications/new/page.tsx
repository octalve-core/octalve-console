import {redirect} from "next/navigation";

/**
 * Legacy deep links must not open the unqualified notification editor.
 * The existing backend requires key, category, body_html and body_text,
 * which the old form did not provide. No partial or misleading Save.
 */
export default function AdminNewNotificationPage(){
 redirect("/admin/settings/notifications");
}
