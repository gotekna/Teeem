"use client";

import { useState } from "react";
import { Scan, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { XeroDuplicateReviewPanel } from "@/components/contacts/XeroDuplicateReviewPanel";
import { api } from "@/lib/api";

export default function DuplicatesPage() {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSummary, setScanSummary] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleScan = async () => {
    setScanning(true);
    setScanError(null);
    setScanSummary(null);

    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        summary?: any;
      }>("/api/v1/xero_duplicates/scan");

      if (response?.success) {
        setScanSummary(response.summary);
        // Refresh the review panel
        setRefreshKey((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Failed to scan for duplicates:", err);
      setScanError(err instanceof Error ? err.message : "Failed to scan for duplicates");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Duplicate Contacts</h1>
          <p className="text-muted-foreground mt-1">
            Review and merge duplicate contacts from Xero
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanning}>
          {scanning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Scan className="h-4 w-4 mr-2" />
              Scan for Duplicates
            </>
          )}
        </Button>
      </div>

      {/* Scan error */}
      {scanError && (
        <Alert variant="destructive">
          <AlertDescription>{scanError}</AlertDescription>
        </Alert>
      )}

      {/* Scan summary */}
      {scanSummary && (
        <Alert className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
          <AlertDescription>
            <div className="font-medium mb-2">Scan complete!</div>
            <div className="text-sm space-y-1">
              <div>Total groups: {scanSummary.total_groups}</div>
              <div>Pending review: {scanSummary.pending}</div>
              <div>High confidence: {scanSummary.high_confidence}</div>
              <div>Medium confidence: {scanSummary.medium_confidence}</div>
              {scanSummary.groups_created > 0 && (
                <div className="mt-2 font-medium">New groups created: {scanSummary.groups_created}</div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Review panel */}
      <XeroDuplicateReviewPanel
        key={refreshKey}
        batchSize={5}
        onReviewComplete={() => {
          // Optionally refresh or update UI
        }}
      />
    </div>
  );
}
