/**
 * Xero Components Index
 *
 * This directory contains all reusable Xero integration components.
 * Components are organized by function:
 *
 * Extracted Components (in this directory):
 * - XeroSetupWizard: Guides first-time users through Xero setup
 * - XeroConnectionsPopup: Shows Xero connection status in header
 *
 * Inline Components (still in company page, to be extracted):
 * - XeroConnectionCard: OAuth connection management (600+ LOC)
 * - XeroAccountsCard: Chart of Accounts display (325 LOC)
 * - XeroProfitLossCard: P&L report display (143 LOC)
 * - XeroBalanceSheetCard: Balance Sheet display (159 LOC)
 * - XeroBankAccountsCard: Bank accounts + transactions (294 LOC)
 * - XeroOverviewCard: Connection overview dashboard
 * - XeroReportsPanel: Combined PDF reports
 *
 * Contact Linking Components (in /components/contacts/):
 * - LinkXeroContactModal: Link TEEEM contact to Xero
 * - TransferXeroLinkModal: Transfer link between contacts
 * - XeroSyncSection: Main sync management hub
 * - PendingXeroReviewPanel: Review auto-matched links
 * - XeroDuplicateReviewPanel: Handle duplicates
 */

// Types
export * from './types';

// Components
export { XeroSetupWizard } from './XeroSetupWizard';
export { XeroConnectionsPopup } from './XeroConnectionsPopup';
