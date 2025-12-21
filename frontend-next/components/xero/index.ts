/**
 * Xero Components Index
 *
 * This directory contains all reusable Xero integration components.
 * Components are organized by function:
 *
 * Connection & Setup:
 * - XeroConnectionCard: OAuth connection management (connects/disconnects Xero)
 * - XeroSetupWizard: Guides first-time users through Xero setup
 * - XeroConnectionsPopup: Shows Xero connection status in header
 *
 * Overview & Status:
 * - XeroOverviewCard: Connection overview dashboard with quick stats
 *
 * Financial Data:
 * - XeroAccountsCard: Chart of Accounts display with group comparison
 * - XeroProfitLossCard: P&L report display (in XeroFinancialReports)
 * - XeroBalanceSheetCard: Balance Sheet display (in XeroFinancialReports)
 * - XeroBankAccountsCard: Bank accounts with transactions
 *
 * Reports:
 * - XeroReportsPanel: Combined PDF reports panel with inner tabs
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

// Connection & Setup Components
export { XeroSetupWizard } from './XeroSetupWizard';
export { XeroConnectionsPopup } from './XeroConnectionsPopup';
export { XeroConnectionCard } from './XeroConnectionCard';

// Overview & Status Components
export { XeroOverviewCard } from './XeroOverviewCard';

// Financial Data Components
export { XeroAccountsCard } from './XeroAccountsCard';
export { XeroProfitLossCard, XeroBalanceSheetCard } from './XeroFinancialReports';
export { XeroProfitLossMonthly } from './XeroProfitLossMonthly';
export { XeroBankAccountsCard } from './XeroBankAccountsCard';
export { XeroConsolidatedCard } from './XeroConsolidatedCard';

// Group Reports (side-by-side view for company groups)
export { XeroGroupAccountsCard } from './XeroGroupAccountsCard';
export { XeroGroupPLCard } from './XeroGroupPLCard';
export { XeroGroupBalanceSheetCard } from './XeroGroupBalanceSheetCard';

// Reports Components
export { XeroReportsPanel } from './XeroReportsPanel';

// Company-specific Document Sync
export { XeroCompanyDocSyncCard } from './XeroCompanyDocSyncCard';
