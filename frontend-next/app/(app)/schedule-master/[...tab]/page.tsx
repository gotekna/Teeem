/**
 * Catch-all route for Schedule Master subtabs
 *
 * Re-exports parent page to handle URL-based tab navigation.
 * ScheduleMasterTab reads tab state from URL path segments.
 *
 * Examples:
 *   /schedule-master/gantt → Gantt tab
 *   /schedule-master/tasks → Tasks tab
 */
export { default } from "../page";
