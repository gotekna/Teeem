/**
 * Settings Users View Page
 *
 * Handles /settings/users/view/[slug] URLs for saved views.
 * Re-exports the same UsersSettingsPage component - TeeemTableView
 * reads the view slug from the URL via useViewFromPath.
 *
 * SSoT: Same pattern as /jobs/view/[slug] and /contacts/view/[slug]
 */
export { default } from "../../page";
