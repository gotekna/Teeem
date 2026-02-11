"use client";

import * as React from "react";
import { AdminConfigSyncTab } from "./AdminConfigSyncTab";
import { TenantSyncPullTab } from "./TenantSyncPullTab";
import { ConfigSyncTab } from "./ConfigSyncTab";
import { api } from "@/lib/api";

/**
 * ConfigSyncSection - SSoT for the config sync UI
 *
 * Used in both:
 * - /settings/connections/sync
 * - /settings/company/warehouse-config/sync
 */
export function ConfigSyncSection() {
  const [syncRefreshKey, setSyncRefreshKey] = React.useState(0);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | null>(null);
  const [lastSyncBy, setLastSyncBy] = React.useState<string | null>(null);

  // Fetch last sync info on mount
  React.useEffect(() => {
    const fetchSyncInfo = async () => {
      try {
        const res = await api.get<{
          success: boolean;
          last_config_sync_at?: string | null;
          last_config_sync_by?: string | null;
        }>("/api/v1/config_sync/tables");
        if (res?.success) {
          setLastSyncAt(res.last_config_sync_at || null);
          setLastSyncBy(res.last_config_sync_by || null);
        }
      } catch { /* non-critical */ }
    };
    fetchSyncInfo();
  }, []);

  const handleSyncComplete = React.useCallback((syncAt: string | null, syncBy: string | null) => {
    setLastSyncAt(syncAt);
    setLastSyncBy(syncBy);
  }, []);

  const formatSyncDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-AU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  return (
    <div className="space-y-8">
      <AdminConfigSyncTab onImportComplete={() => setSyncRefreshKey(k => k + 1)} />

      <div className="border-t pt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Sync from TEEEM</h2>
            <p className="text-sm text-muted-foreground">
              Pull configuration records marked as compulsory or optional from TEEEM master tenant
            </p>
          </div>
          <div className="text-sm text-muted-foreground text-right">
            {lastSyncAt ? (
              <>
                <span>Last sync: {formatSyncDate(lastSyncAt)}</span>
                {lastSyncBy && <span className="block text-xs">by {lastSyncBy}</span>}
              </>
            ) : (
              <span className="italic">Never synced</span>
            )}
          </div>
        </div>
        <TenantSyncPullTab onSyncComplete={handleSyncComplete} />
      </div>

      <div className="border-t pt-8">
        <h2 className="text-lg font-semibold mb-4">Tenant Configuration Overview</h2>
        <ConfigSyncTab refreshKey={syncRefreshKey} />
      </div>
    </div>
  );
}
