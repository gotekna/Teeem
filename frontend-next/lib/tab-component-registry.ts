/**
 * Tab Component Registry - Single Source of Truth
 *
 * Maps EntityTab.component_name values to React lazy-loaded components.
 * This is THE ONE place to register tab components for dynamic rendering.
 *
 * Usage:
 *   const Component = TAB_COMPONENTS[tab.component_name];
 *   if (Component) {
 *     return <Suspense fallback={<TabSkeleton />}><Component {...props} /></Suspense>;
 *   }
 *
 * Adding a new tab component:
 *   1. Create component in appropriate folder
 *   2. Add entry here with matching component_name from EntityTabs database
 *   3. Ideally component accepts TabComponentProps, but legacy components are allowed during migration
 */

import { lazy, ComponentType } from "react";

// Type for lazy-loaded tab components
// Using `any` during migration to allow legacy component props
// TODO: Tighten to TabComponentProps after all components are migrated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LazyTabComponent = React.LazyExoticComponent<ComponentType<any>>;

/**
 * TAB_COMPONENTS - Maps component_name (from EntityTabs) to React component
 *
 * Naming Convention:
 *   Database component_name should match the component file name (without extension)
 *   e.g., "XeroConnectionCard" maps to "@/components/xero/XeroConnectionCard.tsx"
 */
export const TAB_COMPONENTS: Record<string, LazyTabComponent> = {
  // ============================================
  // XERO COMPONENTS - /components/xero/
  // ============================================

  // Connection & Overview
  "XeroConnectionCard": lazy(() => import("@/components/xero/XeroConnectionCard")),
  "XeroConnectionStatus": lazy(() => import("@/components/xero/XeroConnectionCard")), // Alias
  "XeroOverviewCard": lazy(() => import("@/components/xero/XeroOverviewCard")),
  "XeroTab": lazy(() => import("@/components/xero/XeroOverviewCard")), // Alias for legacy name

  // Accounts
  "XeroAccountsCard": lazy(() => import("@/components/xero/XeroAccountsCard")),
  "XeroAccounts": lazy(() => import("@/components/xero/XeroAccountsCard")), // Alias

  // Bank Accounts
  "XeroBankAccountsCard": lazy(() => import("@/components/xero/XeroBankAccountsCard")),
  "XeroBankAccounts": lazy(() => import("@/components/xero/XeroBankAccountsCard")), // Alias

  // Profit & Loss
  "XeroProfitLossMonthly": lazy(() => import("@/components/xero/XeroProfitLossMonthly")),
  "XeroPLStatementView": lazy(() => import("@/components/xero/XeroPLStatementView")),
  "XeroProfitLoss": lazy(() => import("@/components/xero/XeroProfitLossMonthly")), // Alias
  "XeroProfitLossCard": lazy(() => import("@/components/xero/XeroProfitLossMonthly")), // Alias
  "XeroProfitLossStatement": lazy(() => import("@/components/xero/XeroPLStatementView")), // Alias

  // Balance Sheet
  "XeroBalanceSheetStatementView": lazy(() => import("@/components/xero/XeroBalanceSheetStatementView")),
  "XeroBalanceSheet": lazy(() => import("@/components/xero/XeroBalanceSheetStatementView")), // Alias
  "XeroBalanceSheetCard": lazy(() => import("@/components/xero/XeroBalanceSheetStatementView")), // Alias
  "XeroBalanceSheetStatement": lazy(() => import("@/components/xero/XeroBalanceSheetStatementView")), // Alias

  // Group Reports (consolidated across companies)
  "XeroGroupPLCard": lazy(() => import("@/components/xero/XeroGroupPLCard")),
  "XeroGroupBalanceSheetCard": lazy(() => import("@/components/xero/XeroGroupBalanceSheetCard")),
  // Note: XeroGroupAccountsCard is referenced in EntityTabs but component doesn't exist yet

  // Contacts
  "XeroContactsTable": lazy(() => import("@/components/xero/XeroContactsTable")),
  "XeroContacts": lazy(() => import("@/components/xero/XeroContactsTable")), // Alias

  // Invoices & Bills
  "XeroInvoicesCard": lazy(() => import("@/components/xero/XeroInvoicesCard")),
  "XeroInvoices": lazy(() => import("@/components/xero/XeroInvoicesCard")), // Alias
  "XeroBillsCard": lazy(() => import("@/components/xero/XeroBillsCard")),
  "XeroBills": lazy(() => import("@/components/xero/XeroBillsCard")), // Alias

  // Other Xero Components
  "XeroConsolidatedCard": lazy(() => import("@/components/xero/XeroConsolidatedCard")),
  "XeroCompanyDocSyncCard": lazy(() => import("@/components/xero/XeroCompanyDocSyncCard")),
  "XeroFinancialReports": lazy(() => import("@/components/xero/XeroFinancialReports")),
  "XeroReportsPanel": lazy(() => import("@/components/xero/XeroReportsPanel")),
  "XeroSetupWizard": lazy(() => import("@/components/xero/XeroSetupWizard")),

  // ============================================
  // OVERVIEW TAB COMPONENTS - /components/tabs/
  // Extracted from corporate page.tsx
  // ============================================

  // Extracted components (ready to use)
  "InformationTab": lazy(() => import("@/components/tabs/InformationTab")),
  "ActivityTab": lazy(() => import("@/components/tabs/ActivityTab")),
  "DirectorsTab": lazy(() => import("@/components/tabs/DirectorsTab")),
  "TrustDeedTab": lazy(() => import("@/components/tabs/TrustDeedTab")),
  "DistributionsTab": lazy(() => import("@/components/tabs/DistributionsTab")),
  "TrusteeTab": lazy(() => import("@/components/tabs/TrusteeTab")),
  "BeneficiariesTab": lazy(() => import("@/components/tabs/BeneficiariesTab")),

  // TODO: Extract remaining components from corporate page.tsx
  // "CorporateTab": lazy(() => import("@/components/tabs/CorporateTab")),
  // "ShareholdingsTab": lazy(() => import("@/components/tabs/ShareholdingsTab")),
  // "BankAccountsTab": lazy(() => import("@/components/tabs/BankAccountsTab")),
  // "HealthTab": lazy(() => import("@/components/tabs/HealthTab")),
  // "TrustsTab": lazy(() => import("@/components/tabs/TrustsTab")),
  // "AppointorTab": lazy(() => import("@/components/tabs/AppointorTab")),
  // "MembersTab": lazy(() => import("@/components/tabs/MembersTab")),
  // "ConsolidationTab": lazy(() => import("@/components/tabs/ConsolidationTab")),
  // "DataTab": lazy(() => import("@/components/tabs/DataTab")),
  // "DocumentsTab": lazy(() => import("@/components/tabs/DocumentsTab")),

  // ============================================
  // DOCUMENT TAB COMPONENTS
  // ============================================

  // SharePoint folder view (for document tabs)
  // "SharePointFolderView": lazy(() => import("@/components/tabs/SharePointFolderView")),
};

/**
 * Get a tab component by name
 * Returns undefined if component is not registered (graceful degradation)
 */
export function getTabComponent(componentName: string | null | undefined): LazyTabComponent | undefined {
  if (!componentName) return undefined;
  return TAB_COMPONENTS[componentName];
}

/**
 * Check if a component is registered
 * Useful for validation and debugging
 */
export function isTabComponentRegistered(componentName: string | null | undefined): boolean {
  if (!componentName) return false;
  return componentName in TAB_COMPONENTS;
}

/**
 * Get all registered component names
 * Useful for admin/debug views
 */
export function getRegisteredComponentNames(): string[] {
  return Object.keys(TAB_COMPONENTS);
}

/**
 * Validate that all EntityTabs component_name values have registered components
 * Call this in development to catch missing registrations
 */
export function validateTabRegistry(componentNames: string[]): { valid: string[]; missing: string[] } {
  const valid: string[] = [];
  const missing: string[] = [];

  for (const name of componentNames) {
    if (isTabComponentRegistered(name)) {
      valid.push(name);
    } else {
      missing.push(name);
    }
  }

  return { valid, missing };
}
