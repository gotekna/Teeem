import { redirect } from "next/navigation";

/**
 * Schedule Master Root - redirects to default tab (data-view)
 */
export default function ScheduleMasterRootPage() {
  redirect("/admin/system/schedule-master/data-view");
}
