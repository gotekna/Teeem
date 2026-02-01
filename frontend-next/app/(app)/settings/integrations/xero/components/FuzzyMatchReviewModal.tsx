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
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  AlertTriangle,
  Building2,
  User,
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

interface FuzzyMatchReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PendingReviewItem | null;
  onReviewed: () => void;
}

export function FuzzyMatchReviewModal({
  open,
  onOpenChange,
  item,
  onReviewed,
}: FuzzyMatchReviewModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [action, setAction] = React.useState<"approve" | "reject" | null>(null);

  const handleApprove = async () => {
    if (!item) return;

    setLoading(true);
    setAction("approve");

    try {
      const response = await api.post<{ success: boolean; message?: string; error?: string }>(
        `/api/v1/contacts/${item.contact_id}/xero_links/${item.id}/approve`
      );

      if (response?.success) {
        toast.success("Match approved! Sync has been enabled.");
        onOpenChange(false);
        onReviewed();
      } else {
        toast.error(response?.error || "Failed to approve match");
      }
    } catch (error) {
      console.error("Error approving match:", error);
      toast.error("Failed to approve match");
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const handleReject = async () => {
    if (!item) return;

    setLoading(true);
    setAction("reject");

    try {
      const response = await api.post<{ success: boolean; message?: string; error?: string }>(
        `/api/v1/contacts/${item.contact_id}/xero_links/${item.id}/reject`
      );

      if (response?.success) {
        toast.success("Match rejected. A new contact will be created on next sync.");
        onOpenChange(false);
        onReviewed();
      } else {
        toast.error(response?.error || "Failed to reject match");
      }
    } catch (error) {
      console.error("Error rejecting match:", error);
      toast.error("Failed to reject match");
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  if (!item) return null;

  const confidencePercent = Math.round((item.match_confidence || 0) * 100);
  const isLowConfidence = confidencePercent < 70;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Review Fuzzy Match
          </DialogTitle>
          <DialogDescription>
            This Xero contact was matched to a TEEEM contact by name similarity.
            Please verify if this match is correct.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Match visualization */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            {/* Xero contact */}
            <div className="flex-1 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 mb-2">
                <Building2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="text-xs text-muted-foreground mb-1">Xero Contact</div>
              <div className="font-medium text-sm">{item.external_contact_name}</div>
              <Badge variant="outline" className="mt-1 text-xs">
                {item.tenant_name}
              </Badge>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <Badge
                className={`mt-1 text-xs ${
                  isLowConfidence
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                }`}
              >
                {confidencePercent}%
              </Badge>
            </div>

            {/* TEEEM contact */}
            <div className="flex-1 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-2">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-xs text-muted-foreground mb-1">TEEEM Contact</div>
              <div className="font-medium text-sm">{item.contact_name || "Unknown"}</div>
            </div>
          </div>

          {/* Warning for low confidence */}
          {isLowConfidence && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Low confidence match.</strong> These contacts may not be the same entity.
                Review carefully before approving.
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Approve:</strong> Links these contacts and enables Xero sync.
              Invoices and data will be shared between them.
            </p>
            <p>
              <strong>Reject:</strong> Removes this match. A new TEEEM contact will be
              created for the Xero contact on the next sync.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={loading}
            className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            {loading && action === "reject" ? (
              <Spinner size={16} className="mr-2" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            Reject Match
          </Button>
          <Button
            onClick={handleApprove}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading && action === "approve" ? (
              <Spinner size={16} className="mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Approve Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
