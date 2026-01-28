"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface PendingReviewItem {
  id: number;
  contact_id: number;
  contact_name: string;
  tenant_id: string;
  tenant_name: string;
  external_contact_id: string;
  external_contact_name: string;
  match_type: string;
  match_confidence: number;
  created_at: string;
}

interface FuzzyMatchReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => void;
}

export function FuzzyMatchReviewSheet({
  open,
  onOpenChange,
  onReviewed,
}: FuzzyMatchReviewSheetProps) {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<PendingReviewItem[]>([]);
  const [processingId, setProcessingId] = React.useState<number | null>(null);

  const fetchPendingReviews = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        pending_count: number;
        links: PendingReviewItem[];
      }>("/api/v1/xero_links/pending_review");

      if (response?.success) {
        setItems(response.links || []);
      }
    } catch (error) {
      console.error("Failed to fetch pending reviews:", error);
      toast.error("Failed to load pending reviews");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchPendingReviews();
    }
  }, [open, fetchPendingReviews]);

  const handleApprove = async (item: PendingReviewItem) => {
    setProcessingId(item.id);
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/contacts/${item.contact_id}/xero_links/${item.id}/approve`
      );

      if (response?.success) {
        toast.success(`Approved: ${item.external_contact_name}`);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        onReviewed();
      } else {
        toast.error(response?.error || "Failed to approve");
      }
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Failed to approve match");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (item: PendingReviewItem) => {
    setProcessingId(item.id);
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/contacts/${item.contact_id}/xero_links/${item.id}/reject`
      );

      if (response?.success) {
        toast.success(`Rejected: ${item.external_contact_name}`);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        onReviewed();
      } else {
        toast.error(response?.error || "Failed to reject");
      }
    } catch (error) {
      console.error("Error rejecting:", error);
      toast.error("Failed to reject match");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Review Fuzzy Matches ({items.length})
          </SheetTitle>
          <SheetDescription>
            These Xero contacts were matched by name similarity. Approve correct matches or reject incorrect ones.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner size={32} className="text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">
                No more fuzzy matches need review.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-3 pr-4">
                {items.map((item) => {
                  const confidencePercent = Math.round((item.match_confidence || 0) * 100);
                  const isLowConfidence = confidencePercent < 70;
                  const isProcessing = processingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 border rounded-lg ${
                        isLowConfidence
                          ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
                          : "border-border bg-card"
                      }`}
                    >
                      {/* Match visualization */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground mb-1">Xero</div>
                          <div className="font-medium text-sm truncate">
                            {item.external_contact_name}
                          </div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {item.tenant_name}
                          </Badge>
                        </div>

                        <div className="flex flex-col items-center px-2">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Badge
                            className={`text-xs mt-1 ${
                              isLowConfidence
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            }`}
                          >
                            {confidencePercent}%
                          </Badge>
                        </div>

                        <div className="flex-1 min-w-0 text-right">
                          <div className="text-xs text-muted-foreground mb-1">TEEEM</div>
                          <div className="font-medium text-sm truncate">
                            {item.contact_name || "Unknown"}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(item)}
                          disabled={isProcessing}
                          className="flex-1 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                        >
                          {isProcessing ? (
                            <Spinner size={14} className="mr-1" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-1" />
                          )}
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(item)}
                          disabled={isProcessing}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isProcessing ? (
                            <Spinner size={14} className="mr-1" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                          )}
                          Approve
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {!loading && items.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={fetchPendingReviews}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
