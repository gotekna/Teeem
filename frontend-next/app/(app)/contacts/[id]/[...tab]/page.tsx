/**
 * Catch-all route for contact detail tabs
 *
 * Handles path-based tab navigation:
 * - /contacts/123/overview
 * - /contacts/123/financial/bank
 * - /contacts/123/corporate/identity
 * - /contacts/123/edit (triggers edit modal)
 *
 * Re-exports the main ContactDetailPage which parses the path segments.
 */
export { default } from "../page";
