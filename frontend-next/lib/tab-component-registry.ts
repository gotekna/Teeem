/**
 * Tab Component Registry - Single Source of Truth
 *
 * Maps WarehouseFolder.component_name values to React lazy-loaded components.
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
 *   2. Add entry here with matching component_name from WarehouseFolders database
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
  "XeroConnectionWithHealth": lazy(() => import("@/components/xero/XeroConnectionWithHealth")), // Connection + Health Dashboard
  "XeroOverviewCard": lazy(() => import("@/components/xero/XeroOverviewCard")),
  "XeroHealthDashboard": lazy(() => import("@/components/xero/XeroHealthDashboard")), // Standalone health dashboard
  "XeroTab": lazy(() => import("@/components/xero/XeroOverviewCard")), // Alias for legacy name

  // Accounts
  "XeroAccountsCard": lazy(() => import("@/components/xero/XeroAccountsCard")),
  "XeroAccounts": lazy(() => import("@/components/xero/XeroAccountsCard")), // Alias

  // Bank Accounts & Statement
  "XeroBankAccountsCard": lazy(() => import("@/components/xero/XeroBankAccountsCard")),
  "XeroBankAccounts": lazy(() => import("@/components/xero/XeroBankAccountsCard")), // Alias
  "XeroBankStatement": lazy(() => import("@/components/corporate/XeroStatementView").then(m => ({ default: m.XeroStatementView }))), // Bank statement view
  "XeroStatementView": lazy(() => import("@/components/corporate/XeroStatementView").then(m => ({ default: m.XeroStatementView }))), // Alias
  "XeroBankStatementReportView": lazy(() => import("@/components/xero/XeroBankStatementReportView")), // Bank statement PDF reports

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
  "XeroGroupAccountsCard": lazy(() => import("@/components/xero/XeroAccountsCard")), // XeroAccountsCard shows group view

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
  "CorporateTab": lazy(() => import("@/components/tabs/CorporateTab")),
  "ActivityTab": lazy(() => import("@/components/tabs/ActivityTab")),
  "DirectorsTab": lazy(() => import("@/components/tabs/DirectorsTab")),
  "TrustDeedTab": lazy(() => import("@/components/tabs/TrustDeedTab")),
  "DistributionsTab": lazy(() => import("@/components/tabs/DistributionsTab")),
  "TrusteeTab": lazy(() => import("@/components/tabs/TrusteeTab")),
  "BeneficiariesTab": lazy(() => import("@/components/tabs/BeneficiariesTab")),
  "AppointorTab": lazy(() => import("@/components/tabs/AppointorTab")),
  "ShareholdingsTab": lazy(() => import("@/components/tabs/ShareholdingsTab")),
  "MembersTab": lazy(() => import("@/components/tabs/MembersTab")),
  "BankAccountsTab": lazy(() => import("@/components/tabs/BankAccountsTab")),
  "HealthTab": lazy(() => import("@/components/tabs/HealthTab")),
  "TrustsTab": lazy(() => import("@/components/tabs/TrustsTab")),
  "ConsolidationTab": lazy(() => import("@/components/tabs/ConsolidationTab")),

  // ============================================
  // CORPORATE COMPONENTS - /components/corporate/
  // ============================================

  // CorporateStructureTab - Corporate structure visualization with chart/table view
  "CorporateStructureTab": lazy(() => import("@/components/corporate/CorporateStructureTab")),

  // CompanyDocumentsTab - extracted component for corporate documents
  // Note: Used directly in page.tsx, not via registry (accepts company prop)
  // "CompanyDocumentsTab": lazy(() => import("@/components/corporate/CompanyDocumentsTab")),

  // ============================================
  // CASE COMPONENTS - /components/cases/
  // ============================================

  // Case tab components (extracted from cases/[id]/page.tsx)
  "CaseOverviewTab": lazy(() => import("@/components/cases/CaseOverviewTab")),
  "CaseEntitiesTab": lazy(() => import("@/components/cases/CaseEntitiesTab")),
  "CaseDocumentsTab": lazy(() => import("@/components/cases/CaseDocumentsTab")),
  "CaseTimelineTab": lazy(() => import("@/components/cases/CaseTimelineTab")),
  "CaseWarehouseTab": lazy(() => import("@/components/cases/CaseWarehouseTab")),
  "CaseQATab": lazy(() => import("@/components/cases/CaseQATab")),
  "CaseProposalsTab": lazy(() => import("@/components/cases/case-proposals-tab").then(m => ({ default: m.CaseProposalsTab }))),
  "CaseRelationshipChart": lazy(() => import("@/components/cases/CaseRelationshipChart")),

  // ============================================
  // CONTACT COMPONENTS - /app/(app)/contacts/[id]/components/
  // ============================================

  // Contact tab components (co-located with page, named exports)
  "ContactOverviewTab": lazy(() => import("@/app/(app)/contacts/[id]/components/ContactOverviewTab").then(m => ({ default: m.ContactOverviewTab }))),
  "ContactCorporateTab": lazy(() => import("@/app/(app)/contacts/[id]/components/ContactCorporateTab").then(m => ({ default: m.ContactCorporateTab }))),
  "ContactFinancialTab": lazy(() => import("@/app/(app)/contacts/[id]/components/ContactFinancialTab").then(m => ({ default: m.ContactFinancialTab }))),
  "ContactCasesTab": lazy(() => import("@/app/(app)/contacts/[id]/components/ContactCasesTab").then(m => ({ default: m.ContactCasesTab }))),
  "ContactEmailsTab": lazy(() => import("@/app/(app)/contacts/[id]/components/ContactEmailsTab").then(m => ({ default: m.ContactEmailsTab }))),
  "ContactDirectorshipsTab": lazy(() => import("@/app/(app)/contacts/[id]/components/ContactDirectorshipsTab").then(m => ({ default: m.ContactDirectorshipsTab }))),

  // ============================================
  // JOB COMPONENTS - /components/jobs/
  // ============================================

  // Job tab components (named exports)
  "JobActivityTab": lazy(() => import("@/components/jobs/JobActivityTab").then(m => ({ default: m.JobActivityTab }))),
  "JobBudgetTab": lazy(() => import("@/components/jobs/JobBudgetTab").then(m => ({ default: m.JobBudgetTab }))),
  "JobClaimStagesTab": lazy(() => import("@/components/jobs/JobClaimStagesTab").then(m => ({ default: m.JobClaimStagesTab }))),
  "JobCommunicationsTab": lazy(() => import("@/components/jobs/JobCommunicationsTab").then(m => ({ default: m.JobCommunicationsTab }))),
  "JobContractTab": lazy(() => import("@/components/jobs/JobContractTab").then(m => ({ default: m.JobContractTab }))),
  "JobDocumentsTab": lazy(() => import("@/components/jobs/JobDocumentsTab").then(m => ({ default: m.JobDocumentsTab }))),
  "JobEstimatorTab": lazy(() => import("@/components/jobs/JobEstimatorTab").then(m => ({ default: m.JobEstimatorTab }))),
  "JobPeopleTab": lazy(() => import("@/components/jobs/JobPeopleTab").then(m => ({ default: m.JobPeopleTab }))),
  "JobPlansTab": lazy(() => import("@/components/jobs/JobPlansTab").then(m => ({ default: m.JobPlansTab }))),
  "JobProfitTab": lazy(() => import("@/components/jobs/JobProfitTab").then(m => ({ default: m.JobProfitTab }))),
  "JobPurchaseOrdersTab": lazy(() => import("@/components/jobs/JobPurchaseOrdersTab").then(m => ({ default: m.JobPurchaseOrdersTab }))),
  "RainLogTab": lazy(() => import("@/components/jobs/RainLogTab").then(m => ({ default: m.RainLogTab }))),

  // ============================================
  // NOTEBOOK COMPONENTS - /components/notebooks/
  // ============================================

  // EntityNotesPanel - Notes tab for Jobs, Contacts, etc.
  "EntityNotesPanel": lazy(() => import("@/components/notebooks/EntityNotesPanel").then(m => ({ default: m.EntityNotesPanel }))),
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
