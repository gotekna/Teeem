"use client";

/**
 * XeroConnectionWithHealth - Connection card + Health Dashboard
 *
 * This wrapper component renders:
 * 1. XeroConnectionCard - OAuth connection management
 * 2. XeroHealthDashboard - Detailed sync status and health metrics (when connected)
 *
 * Used as the "connection" tab component in the entity tabs system.
 */

import * as React from "react";
import { XeroConnectionCard } from "./XeroConnectionCard";
import { XeroHealthDashboard } from "./XeroHealthDashboard";

interface XeroConnectionWithHealthProps {
  companyId: string;
  entityId?: string; // Alias for companyId (from TabComponentProps)
  companyName?: string;
  onSyncComplete?: () => void;
  onConnectionChange?: (connected: boolean) => void;
  onRefresh?: () => Promise<void>;
}

export function XeroConnectionWithHealth({
  companyId,
  entityId,
  companyName,
  onSyncComplete,
  onConnectionChange,
  onRefresh,
}: XeroConnectionWithHealthProps) {
  const [isConnected, setIsConnected] = React.useState(false);

  // Use entityId as fallback for companyId (TabComponentProps compatibility)
  const effectiveCompanyId = companyId || entityId || "";

  const handleConnectionChange = React.useCallback((connected: boolean) => {
    setIsConnected(connected);
    onConnectionChange?.(connected);
  }, [onConnectionChange]);

  const handleSyncComplete = React.useCallback(() => {
    onSyncComplete?.();
    // Trigger refresh to update health data
    onRefresh?.();
  }, [onSyncComplete, onRefresh]);

  return (
    <div className="space-y-6">
      {/* Connection Card */}
      <XeroConnectionCard
        companyId={effectiveCompanyId}
        companyName={companyName}
        onSyncComplete={handleSyncComplete}
        onConnectionChange={handleConnectionChange}
      />

      {/* Health Dashboard - Only show when connected */}
      {isConnected && (
        <XeroHealthDashboard companyId={effectiveCompanyId} />
      )}
    </div>
  );
}

export default XeroConnectionWithHealth;
