"use client";

import * as React from "react";
import { AdminConfigSyncTab } from "./AdminConfigSyncTab";
import { TenantSyncPullTab } from "./TenantSyncPullTab";
import { ConfigSyncTab } from "./ConfigSyncTab";

/**
 * ConfigSyncSection - SSoT for the config sync UI
 *
 * Used in both:
 * - /settings/connections/sync
 * - /settings/company/warehouse-config/sync
 */
export function ConfigSyncSection() {
  const [syncRefreshKey, setSyncRefreshKey] = React.useState(0);

  return (
    <div className="space-y-8">
      <AdminConfigSyncTab onImportComplete={() => setSyncRefreshKey(k => k + 1)} />

      <div className="border-t pt-8">
        <h2 className="text-lg font-semibold mb-4">Sync from TEEEM</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Pull configuration records marked as compulsory or optional from TEEEM master tenant
        </p>
        <TenantSyncPullTab />
      </div>

      <div className="border-t pt-8">
        <h2 className="text-lg font-semibold mb-4">Tenant Configuration Overview</h2>
        <ConfigSyncTab refreshKey={syncRefreshKey} />
      </div>
    </div>
  );
}
