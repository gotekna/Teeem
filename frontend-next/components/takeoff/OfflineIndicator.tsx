"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
  useOfflineStorage,
  type SyncStatus,
  type OfflineMeasurement,
  type OfflinePageScale,
} from "./useOfflineStorage";

// =============================================================================
// Types
// =============================================================================

interface OfflineIndicatorProps {
  planId?: string;
  docsortItemId?: string;
  pdfUrl?: string | null;
  onSyncComplete?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function OfflineIndicator({
  planId,
  docsortItemId,
  pdfUrl,
  onSyncComplete,
}: OfflineIndicatorProps) {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isCachingPdf, setIsCachingPdf] = React.useState(false);
  const [isPdfCached, setIsPdfCached] = React.useState(false);

  const {
    isOnline,
    syncStatus,
    isReady,
    getUnsyncedItems,
    markMeasurementSynced,
    recordSyncAttempt,
    cachePdf,
    isPdfCached: checkPdfCached,
  } = useOfflineStorage({ planId, docsortItemId });

  // Check if PDF is cached on mount
  React.useEffect(() => {
    checkPdfCached().then(setIsPdfCached);
  }, [checkPdfCached]);

  // Sync pending items when coming back online
  const handleSync = React.useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const { measurements, scales } = await getUnsyncedItems();

      let syncedMeasurements = 0;
      let syncedScales = 0;
      let errors = 0;

      // Sync page scales first (measurements depend on calibration)
      for (const scale of scales) {
        try {
          const endpoint = scale.plan_id
            ? `/api/v1/pdf_takeoff/plans/${scale.plan_id}/calibrate`
            : `/api/v1/pdf_takeoff/document_inbox/${scale.docsort_item_id}/calibrate`;

          const response = await api.post<{ success: boolean; data?: { id: number } }>(
            endpoint,
            {
              page_number: scale.page_number,
              reference_length_mm: scale.reference_length_mm,
              line_start_x: scale.calibration_line.x1,
              line_start_y: scale.calibration_line.y1,
              line_end_x: scale.calibration_line.x2,
              line_end_y: scale.calibration_line.y2,
              canvas_width: scale.canvas_width,
              canvas_height: scale.canvas_height,
            }
          );

          if (response?.success && response.data?.id) {
            syncedScales++;
          }
        } catch (err) {
          console.error("Failed to sync scale:", err);
          errors++;
        }
      }

      // Sync measurements
      for (const measurement of measurements) {
        try {
          const endpoint = measurement.plan_id
            ? `/api/v1/pdf_takeoff/plans/${measurement.plan_id}/measurements`
            : `/api/v1/pdf_takeoff/document_inbox/${measurement.docsort_item_id}/measurements`;

          const response = await api.post<{ success: boolean; data?: { id: number } }>(
            endpoint,
            {
              measurement: {
                measurement_type: measurement.measurement_type,
                value: measurement.value,
                unit: measurement.unit,
                category: measurement.category,
                page_number: measurement.page_number,
                display_label: measurement.display_label,
                color: measurement.color,
                is_deduction: measurement.is_deduction,
                geometry_data: measurement.geometry_data,
                takeoff_layer_id: measurement.layer_id,
                pricebook_item_id: measurement.pricebook_item_id,
              },
              pixel_value: measurement.pixel_value,
            }
          );

          if (response?.success && response.data?.id) {
            await markMeasurementSynced(measurement.id, response.data.id);
            syncedMeasurements++;
          }
        } catch (err) {
          console.error("Failed to sync measurement:", err);
          errors++;
        }
      }

      recordSyncAttempt(errors === 0);

      if (syncedMeasurements > 0 || syncedScales > 0) {
        toast({
          title: "Sync Complete",
          description: `Synced ${syncedMeasurements} measurement${syncedMeasurements !== 1 ? "s" : ""}, ${syncedScales} scale${syncedScales !== 1 ? "s" : ""}${errors > 0 ? ` (${errors} error${errors !== 1 ? "s" : ""})` : ""}`,
        });
        onSyncComplete?.();
      } else if (errors > 0) {
        toast({
          title: "Sync Failed",
          description: `${errors} item${errors !== 1 ? "s" : ""} failed to sync`,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Sync failed:", err);
      recordSyncAttempt(false);
      toast({
        title: "Sync Error",
        description: "Failed to sync offline changes",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, getUnsyncedItems, markMeasurementSynced, recordSyncAttempt, toast, onSyncComplete]);

  // Auto-sync when coming online with pending items
  React.useEffect(() => {
    if (isOnline && (syncStatus.pendingMeasurements > 0 || syncStatus.pendingScales > 0)) {
      handleSync();
    }
  }, [isOnline, syncStatus.pendingMeasurements, syncStatus.pendingScales]);

  // Cache PDF for offline use
  const handleCachePdf = React.useCallback(async () => {
    if (!pdfUrl || isCachingPdf) return;

    setIsCachingPdf(true);
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      await cachePdf(pdfUrl, blob);
      setIsPdfCached(true);
      toast({
        title: "PDF Cached",
        description: "PDF is now available offline",
      });
    } catch (err) {
      console.error("Failed to cache PDF:", err);
      toast({
        title: "Cache Failed",
        description: "Failed to save PDF for offline use",
        variant: "destructive",
      });
    } finally {
      setIsCachingPdf(false);
    }
  }, [pdfUrl, isCachingPdf, cachePdf, toast]);

  // Don't render until database is ready
  if (!isReady) return null;

  const hasPendingItems = syncStatus.pendingMeasurements > 0 || syncStatus.pendingScales > 0;
  const totalPending = syncStatus.pendingMeasurements + syncStatus.pendingScales;

  return (
    <TooltipProvider delayDuration={300}>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`gap-2 ${!isOnline ? "text-amber-500" : hasPendingItems ? "text-blue-500" : ""}`}
              >
                {isOnline ? (
                  hasPendingItems ? (
                    <Cloud className="h-4 w-4" />
                  ) : (
                    <Wifi className="h-4 w-4 text-green-500" />
                  )
                ) : (
                  <WifiOff className="h-4 w-4" />
                )}
                {hasPendingItems && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {totalPending}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {isOnline
              ? hasPendingItems
                ? `${totalPending} item${totalPending !== 1 ? "s" : ""} pending sync`
                : "Online - All synced"
              : "Offline mode - Changes saved locally"}
          </TooltipContent>
        </Tooltip>

        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-amber-500" />
                )}
                <span className="font-medium">
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
              {isOnline && hasPendingItems && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="gap-1"
                >
                  {isSyncing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Sync
                </Button>
              )}
            </div>

            {/* Pending Items */}
            {hasPendingItems && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Pending measurements</span>
                  <Badge variant="outline">{syncStatus.pendingMeasurements}</Badge>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Pending calibrations</span>
                  <Badge variant="outline">{syncStatus.pendingScales}</Badge>
                </div>
              </div>
            )}

            {/* All synced indicator */}
            {isOnline && !hasPendingItems && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Check className="h-4 w-4" />
                <span>All changes synced</span>
              </div>
            )}

            {/* Offline mode info */}
            {!isOnline && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/20 rounded-md p-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500" />
                <span>
                  Changes are saved locally and will sync when you're back online.
                </span>
              </div>
            )}

            {/* PDF Cache */}
            {pdfUrl && (
              <>
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      {isPdfCached ? (
                        <>
                          <Check className="h-4 w-4 text-green-500" />
                          <span>PDF available offline</span>
                        </>
                      ) : (
                        <>
                          <CloudOff className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">PDF not cached</span>
                        </>
                      )}
                    </div>
                    {!isPdfCached && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCachePdf}
                        disabled={isCachingPdf}
                        className="gap-1"
                      >
                        {isCachingPdf ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        Cache
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Last sync info */}
            {syncStatus.lastSuccessfulSync && (
              <div className="text-xs text-muted-foreground border-t pt-2">
                Last synced: {new Date(syncStatus.lastSuccessfulSync).toLocaleString()}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
