"use client";

import { useState, useMemo } from "react";
import { GitMerge, Loader } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api } from "@/lib/api";

interface MergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: (string | number)[];
  foundationId: number | string;
  records: Record<string, unknown>[];
  displayColumn?: string; // Which column to show as the record title
  secondaryColumns?: string[]; // Additional columns to show as details
  entityName?: string; // e.g., "Job", "Contact", "Record"
  onMergeComplete: () => void;
}

/**
 * Shared MergeModal component for merging records across all tables
 *
 * This is the SINGLE implementation used by all tables via TeeemTableView.
 * Change here → applies everywhere.
 */
export function MergeModal({
  open,
  onOpenChange,
  selectedIds,
  foundationId,
  records,
  displayColumn = "name",
  secondaryColumns = [],
  entityName = "Record",
  onMergeComplete,
}: MergeModalProps) {
  const [primaryId, setPrimaryId] = useState<string | number | null>(
    selectedIds[0] ?? null
  );
  const [merging, setMerging] = useState(false);

  // Get the actual record objects for the selected IDs
  const selectedRecords = useMemo(() => {
    return records.filter((r) => selectedIds.includes(r.id as string | number));
  }, [records, selectedIds]);

  // Reset primary when modal opens with new selection
  useMemo(() => {
    if (open && selectedIds.length > 0 && !selectedIds.includes(primaryId as string | number)) {
      setPrimaryId(selectedIds[0]);
    }
  }, [open, selectedIds, primaryId]);

  const handleMergeConfirm = async () => {
    if (!primaryId) return;

    setMerging(true);
    try {
      // Get the secondary IDs (all except primary)
      const secondaryIds = selectedIds.filter((id) => id !== primaryId);

      // Call the generic merge API
      await api.post(
        `/api/v1/foundations/${foundationId}/records/${primaryId}/merge`,
        { secondary_ids: secondaryIds }
      );

      // Close modal and refresh data
      onOpenChange(false);
      onMergeComplete();
    } catch (error) {
      console.error("Failed to merge records:", error);
      alert(`Failed to merge ${entityName.toLowerCase()}s. Please try again.`);
    } finally {
      setMerging(false);
    }
  };

  // Get display value for a record
  const getDisplayValue = (record: Record<string, unknown>): string => {
    // Try the specified display column first
    let value = record[displayColumn];
    if (value && typeof value === "object" && "display" in value) {
      return String((value as { display: string }).display);
    }
    if (value) return String(value);

    // Fallback: try common name columns
    const nameColumns = ["display_name", "name", "title", "label"];
    for (const col of nameColumns) {
      const fallback = record[col];
      if (fallback && typeof fallback === "object" && "display" in fallback) {
        return String((fallback as { display: string }).display);
      }
      if (fallback) return String(fallback);
    }

    return `${entityName} #${record.id}`;
  };

  // Get secondary info for a record
  const getSecondaryInfo = (record: Record<string, unknown>): string[] => {
    return secondaryColumns
      .map((col) => {
        const value = record[col];
        if (!value) return null;
        if (typeof value === "object" && "display" in value) {
          return String((value as { display: string }).display);
        }
        return String(value);
      })
      .filter(Boolean) as string[];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Merge {entityName}s
          </DialogTitle>
          <DialogDescription>
            Select the primary {entityName.toLowerCase()}. All data from the other{" "}
            {entityName.toLowerCase()}s will be merged into it, and the other{" "}
            {entityName.toLowerCase()}s will be deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label className="text-sm font-medium mb-3 block">
            Select Primary {entityName} ({selectedRecords.length}{" "}
            {entityName.toLowerCase()}s selected)
          </Label>
          <RadioGroup
            value={String(primaryId)}
            onValueChange={(value) => setPrimaryId(value)}
            className="space-y-3"
          >
            {selectedRecords.map((record) => {
              const recordId = record.id as string | number;
              const displayValue = getDisplayValue(record);
              const secondaryInfo = getSecondaryInfo(record);

              return (
                <div
                  key={recordId}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer ${
                    primaryId === recordId
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setPrimaryId(recordId)}
                >
                  <RadioGroupItem
                    value={String(recordId)}
                    id={`record-${recordId}`}
                  />
                  <Label
                    htmlFor={`record-${recordId}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium">{displayValue}</div>
                    {secondaryInfo.length > 0 && (
                      <div className="text-sm text-muted-foreground flex gap-4 mt-1 flex-wrap">
                        {secondaryInfo.map((info, idx) => (
                          <span key={idx}>{info}</span>
                        ))}
                      </div>
                    )}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {selectedRecords.length > 1 && primaryId && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Warning:</strong> {selectedRecords.length - 1}{" "}
                {entityName.toLowerCase()}(s) will be deleted after merge. Their
                linked records will be transferred to the primary{" "}
                {entityName.toLowerCase()}.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={merging}
          >
            Cancel
          </Button>
          <Button onClick={handleMergeConfirm} disabled={!primaryId || merging}>
            {merging ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4 mr-2" />
                Merge {entityName}s
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
