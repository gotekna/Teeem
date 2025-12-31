"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Download, AlertTriangle, Check } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Difference {
  field: string;
  label: string;
  teeem_value: string | null;
  xero_value: string;
}

interface Comparison {
  link_id: number;
  contact_id: number;
  teeem_name: string;
  xero_name?: string;
  xero_id?: string;
  has_differences?: boolean;
  differences?: Difference[];
  error?: string;
}

interface XeroSyncFromModalProps {
  isOpen: boolean;
  onClose: () => void;
  xeroLinkIds: (string | number)[];
  onSyncComplete: () => void;
}

export function XeroSyncFromModal({
  isOpen,
  onClose,
  xeroLinkIds,
  onSyncComplete,
}: XeroSyncFromModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [comparisons, setComparisons] = React.useState<Comparison[]>([]);
  const [selectedFields, setSelectedFields] = React.useState<
    Record<number, Record<string, boolean>>
  >({});

  // Fetch comparisons when modal opens
  React.useEffect(() => {
    if (isOpen && xeroLinkIds.length > 0) {
      fetchComparisons();
    }
  }, [isOpen, xeroLinkIds]);

  const fetchComparisons = async () => {
    setLoading(true);
    try {
      const response = await api.post<{
        success: boolean;
        data: {
          total: number;
          with_differences: number;
          comparisons: Comparison[];
        };
      }>("/api/v1/xero/pull_contact_details", {
        xero_link_ids: xeroLinkIds,
      });

      if (response?.success && response?.data?.comparisons) {
        setComparisons(response.data.comparisons);

        // Pre-select all fields with differences
        const preselected: Record<number, Record<string, boolean>> = {};
        response.data.comparisons.forEach((comp) => {
          if (comp.has_differences && comp.differences) {
            preselected[comp.contact_id] = {};
            comp.differences.forEach((diff) => {
              preselected[comp.contact_id][diff.field] = true;
            });
          }
        });
        setSelectedFields(preselected);
      }
    } catch (error) {
      console.error("Failed to fetch comparisons:", error);
      toast.error("Failed to fetch Xero contact details");
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (contactId: number, field: string) => {
    setSelectedFields((prev) => ({
      ...prev,
      [contactId]: {
        ...prev[contactId],
        [field]: !prev[contactId]?.[field],
      },
    }));
  };

  const handleApply = async () => {
    // Build updates array from selected fields
    const updates: Array<{ contact_id: number; fields: Record<string, string> }> = [];

    comparisons.forEach((comp) => {
      if (!comp.has_differences || !comp.differences) return;

      const selectedForContact = selectedFields[comp.contact_id] || {};
      const fieldsToUpdate: Record<string, string> = {};

      comp.differences.forEach((diff) => {
        if (selectedForContact[diff.field]) {
          fieldsToUpdate[diff.field] = diff.xero_value;
        }
      });

      if (Object.keys(fieldsToUpdate).length > 0) {
        updates.push({
          contact_id: comp.contact_id,
          fields: fieldsToUpdate,
        });
      }
    });

    if (updates.length === 0) {
      toast.info("No fields selected to update");
      return;
    }

    setApplying(true);
    try {
      const response = await api.post<{
        success: boolean;
        data: { success: number; failed: number };
      }>("/api/v1/xero/apply_xero_updates", { updates });

      if (response?.success) {
        const { success: successCount, failed: failedCount } = response.data;
        if (failedCount === 0) {
          toast.success(`Updated ${successCount} contact${successCount !== 1 ? "s" : ""}`);
        } else {
          toast.warning(`Updated ${successCount}, failed ${failedCount}`);
        }
        onSyncComplete();
        onClose();
      }
    } catch (error) {
      console.error("Failed to apply updates:", error);
      toast.error("Failed to apply updates");
    } finally {
      setApplying(false);
    }
  };

  const totalSelected = Object.values(selectedFields).reduce(
    (acc, fields) => acc + Object.values(fields).filter(Boolean).length,
    0
  );

  const contactsWithDifferences = comparisons.filter((c) => c.has_differences);
  const contactsWithErrors = comparisons.filter((c) => c.error);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-500" />
            Sync from Xero
          </DialogTitle>
          <DialogDescription>
            Compare and update TEEEM contacts with data from Xero
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={32} />
            <span className="ml-3 text-muted-foreground">
              Fetching Xero contact details...
            </span>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex gap-4 mb-4">
              <Badge variant="outline" className="text-sm">
                {comparisons.length} contact{comparisons.length !== 1 ? "s" : ""} checked
              </Badge>
              {contactsWithDifferences.length > 0 && (
                <Badge variant="secondary" className="text-sm bg-amber-100 text-amber-800">
                  {contactsWithDifferences.length} with differences
                </Badge>
              )}
              {contactsWithErrors.length > 0 && (
                <Badge variant="destructive" className="text-sm">
                  {contactsWithErrors.length} error{contactsWithErrors.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6 max-h-[50vh]">
              {contactsWithDifferences.length === 0 && contactsWithErrors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Check className="h-12 w-12 text-green-500 mb-3" />
                  <p className="text-lg font-medium">All contacts are in sync!</p>
                  <p className="text-sm">No differences found between TEEEM and Xero</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comparisons.map((comp) => {
                    if (comp.error) {
                      return (
                        <div
                          key={comp.link_id}
                          className="p-3 border rounded-lg bg-red-50 dark:bg-red-950/30"
                        >
                          <div className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="font-medium">{comp.teeem_name}</span>
                          </div>
                          <p className="text-sm text-red-600 mt-1">{comp.error}</p>
                        </div>
                      );
                    }

                    if (!comp.has_differences || !comp.differences?.length) {
                      return null;
                    }

                    return (
                      <div
                        key={comp.link_id}
                        className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/30"
                      >
                        <div className="font-medium mb-3">{comp.teeem_name}</div>
                        <div className="space-y-2">
                          {comp.differences.map((diff) => {
                            const isSelected = selectedFields[comp.contact_id]?.[diff.field];
                            return (
                              <div
                                key={diff.field}
                                className={cn(
                                  "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                                  isSelected
                                    ? "bg-blue-100 dark:bg-blue-900/50"
                                    : "hover:bg-muted/50"
                                )}
                                onClick={() => toggleField(comp.contact_id, diff.field)}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onClick={(e) => e.stopPropagation()}
                                  onCheckedChange={() =>
                                    toggleField(comp.contact_id, diff.field)
                                  }
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    {diff.label}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-red-600 line-through truncate max-w-[200px]">
                                      {diff.teeem_value || "(empty)"}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-green-600 font-medium truncate max-w-[200px]">
                                      {diff.xero_value}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {contactsWithDifferences.length > 0 && (
                <Button
                  onClick={handleApply}
                  disabled={applying || totalSelected === 0}
                >
                  {applying ? (
                    <>
                      <Spinner size={14} className="mr-2" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Apply {totalSelected} Change{totalSelected !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
