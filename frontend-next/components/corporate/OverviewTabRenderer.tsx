"use client";

/**
 * OverviewTabRenderer - Dynamic rendering for overview sub-tabs
 *
 * Replaces hardcoded conditionals with registry-based rendering.
 * Maps tab_key to component_name since database doesn't have component_name yet.
 *
 * TODO: Update EntityTabs seed to include component_name, then remove this mapping.
 */

import * as React from "react";
import { Suspense } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { getTabComponent } from "@/lib/tab-component-registry";
import type { CorporateCompany } from "@/lib/types/corporate";

// Mapping from tab_key to component_name in registry
// SSoT for this mapping should eventually be EntityTabs.component_name
const TAB_KEY_TO_COMPONENT: Record<string, string> = {
  // Company tabs
  "info": "InformationTab",
  "corporate": "CorporateTab",
  "bank-accounts": "BankAccountsTab",
  "directors": "DirectorsTab",
  "shareholdings": "ShareholdingsTab",
  "consolidation": "ConsolidationTab",
  "members": "MembersTab",
  "health": "HealthTab",
  // Trust tabs
  "trustees": "TrusteeTab",
  "beneficiaries": "BeneficiariesTab",
  "appointor": "AppointorTab",
  "trust-deed": "TrustDeedTab",
  "distributions": "DistributionsTab",
  "trusts": "TrustsTab",
  // Activity tab
  "activity": "ActivityTab",
};

interface OverviewTabRendererProps {
  tabKey: string;
  company: CorporateCompany;
  companyId: string;
  onUpdate?: () => void;
  // Special handling for "info" tab which has ATOSetupCard
  renderInfoPrefix?: React.ReactNode;
}

function TabSkeleton() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function MissingComponent({ tabKey, componentName }: { tabKey: string; componentName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-amber-300 rounded-lg bg-amber-50 dark:bg-amber-950/20">
      <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
      <p className="font-medium text-amber-700 dark:text-amber-400">
        Component Not Found
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Tab key: <code className="bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">{tabKey}</code>
        {componentName && (
          <>
            {" → "}
            <code className="bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">{componentName}</code>
          </>
        )}
      </p>
    </div>
  );
}

export function OverviewTabRenderer({
  tabKey,
  company,
  companyId,
  onUpdate,
  renderInfoPrefix,
}: OverviewTabRendererProps) {
  // Get component name from mapping
  const componentName = TAB_KEY_TO_COMPONENT[tabKey];

  if (!componentName) {
    return <MissingComponent tabKey={tabKey} />;
  }

  // Get component from registry
  const Component = getTabComponent(componentName);

  if (!Component) {
    return <MissingComponent tabKey={tabKey} componentName={componentName} />;
  }

  // Build props based on what the component expects
  // Most components take: company, companyId, onUpdate
  const props = {
    company,
    companyId,
    entityId: companyId,
    onUpdate,
  };

  return (
    <>
      {tabKey === "info" && renderInfoPrefix}
      <Suspense fallback={<TabSkeleton />}>
        <Component {...props} />
      </Suspense>
    </>
  );
}

export default OverviewTabRenderer;
