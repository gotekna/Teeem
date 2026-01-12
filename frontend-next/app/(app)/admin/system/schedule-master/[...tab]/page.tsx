import { ScheduleMasterTab } from "../../components/ScheduleMasterTab";

/**
 * Schedule Master Page
 *
 * Routes:
 * - /admin/system/schedule-master/data-view
 * - /admin/system/schedule-master/data-view/{viewSlug}
 * - /admin/system/schedule-master/tables
 * - /admin/system/schedule-master/tables/{tableId}
 * - /admin/system/schedule-master/gantt-preview
 * - /admin/system/schedule-master/settings
 *
 * The ScheduleMasterTab component handles all tab routing internally via usePathname()
 */
export default function ScheduleMasterPage() {
  return <ScheduleMasterTab />;
}
