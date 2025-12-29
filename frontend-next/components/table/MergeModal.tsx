"use client";

import { useState, useMemo } from "react";
import { GitMerge, User, Building2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { getEntityTypeLabel, isPerson, isCompany, isTrust } from "@/lib/entity-types";

interface MergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: (string | number)[];
  foundationId: number | string;
  records: Record<string, unknown>[];
  displayColumn?: string; // Which column to show as the record title
  secondaryColumns?: string[]; // Additional columns to show as details
  entityName?: string; // e.g., "Job", "Contact", "Record"
  onMergeComplete: (deletedIds: (string | number)[], primaryId?: string | number) => void; // Pass back which IDs were deleted

  // Extension props for domain-specific customization
  defaultPrimaryId?: string | number; // Pre-select a specific record as primary
  headerContent?: React.ReactNode; // Content above the radio list (warnings, alerts)
  footerContent?: React.ReactNode; // Content below radio list (preview, additional info)
  renderRecordExtra?: (record: Record<string, unknown>, isPrimary: boolean) => React.ReactNode; // Extra content per record
  onMerge?: (primaryId: string | number, secondaryIds: (string | number)[]) => Promise<void>; // Override default API call
  additionalActions?: React.ReactNode; // Extra buttons in dialog footer
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
  // Extension props
  defaultPrimaryId,
  headerContent,
  footerContent,
  renderRecordExtra,
  onMerge,
  additionalActions,
}: MergeModalProps) {
  const [primaryId, setPrimaryId] = useState<string | number | null>(
    defaultPrimaryId ?? selectedIds[0] ?? null
  );
  const [merging, setMerging] = useState(false);

  // Get the actual record objects for the selected IDs
  const selectedRecords = useMemo(() => {
    return records.filter((r) => selectedIds.includes(r.id as string | number));
  }, [records, selectedIds]);

  // Reset primary when modal opens with new selection
  useMemo(() => {
    if (open && selectedIds.length > 0 && !selectedIds.includes(primaryId as string | number)) {
      setPrimaryId(defaultPrimaryId ?? selectedIds[0]);
    }
  }, [open, selectedIds, primaryId, defaultPrimaryId]);

  const handleMergeConfirm = async () => {
    if (!primaryId) return;

    setMerging(true);
    try {
      // Get the secondary IDs (all except primary)
      // Use String() comparison to handle type mismatches (selectedIds may be numbers, primaryId is string from radio)
      const secondaryIds = selectedIds.filter((id) => String(id) !== String(primaryId));

      // Validate we have at least 1 secondary record to merge
      if (secondaryIds.length === 0) {
        toast.error("Select at least 2 records to merge.");
        setMerging(false);
        return;
      }

      // Use custom merge handler if provided, otherwise use generic Foundation API
      if (onMerge) {
        await onMerge(primaryId, secondaryIds);
      } else {
        // Call the generic merge API
        await api.post(
          `/api/v1/foundations/${foundationId}/records/${primaryId}/merge`,
          { secondary_ids: secondaryIds }
        );
      }

      // Show success toast
      toast.success(`Merged ${secondaryIds.length + 1} ${entityName.toLowerCase()}s`);

      // Close modal and pass deleted IDs for optimistic update
      onOpenChange(false);
      onMergeComplete(secondaryIds, primaryId);
    } catch (error) {
      console.error("Failed to merge records:", error);
      toast.error(`Failed to merge ${entityName.toLowerCase()}s. Please try again.`);
    } finally {
      setMerging(false);
    }
  };

  // Get display value for a record
  const getDisplayValue = (record: Record<string, unknown>): string => {
    // Try the specified display column first
    const value = record[displayColumn];
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

        <div className="py-4 space-y-4">
          {/* Custom header content (warnings, alerts) */}
          {headerContent}

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{displayValue}</span>
                      {/* Entity Type Badge */}
                      {typeof record.entity_type === "string" && record.entity_type && (
                        <Badge
                          variant="outline"
                          className={
                            isPerson(record.entity_type)
                              ? "text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800"
                              : isCompany(record.entity_type)
                              ? "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800"
                              : isTrust(record.entity_type)
                              ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800"
                              : "text-gray-600 border-gray-200"
                          }
                        >
                          {isPerson(record.entity_type) && <User className="h-3 w-3 mr-1" />}
                          {(isCompany(record.entity_type) || isTrust(record.entity_type)) && <Building2 className="h-3 w-3 mr-1" />}
                          {getEntityTypeLabel(record.entity_type)}
                        </Badge>
                      )}
                    </div>
                    {secondaryInfo.length > 0 && (
                      <div className="text-sm text-muted-foreground flex gap-4 mt-1 flex-wrap">
                        {secondaryInfo.map((info, idx) => (
                          <span key={idx}>{info}</span>
                        ))}
                      </div>
                    )}
                    {/* Custom extra content per record */}
                    {renderRecordExtra?.(record, String(primaryId) === String(recordId))}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {selectedRecords.length > 1 && primaryId && !footerContent && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Warning:</strong> {selectedRecords.length - 1}{" "}
                {entityName.toLowerCase()}(s) will be deleted after merge. Their
                linked records will be transferred to the primary{" "}
                {entityName.toLowerCase()}.
              </p>
            </div>
          )}

          {/* Custom footer content (preview, additional info) */}
          {footerContent}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Additional custom actions */}
          {additionalActions}
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
                <Spinner size={16} className="mr-2" />
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
