"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, MapPin, DollarSign, CheckCircle, XCircle, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { ProposalApprovalDialog } from "./proposal-approval-dialog";
import { EmailProposal } from "@/app/(app)/leads/page";
import { formatCurrencyWhole } from "@/utils/formatters";

interface EmailProposalCardProps {
  proposal: EmailProposal;
  onApproved?: (jobId: number) => void;
  onRejected?: () => void;
  onPricedUp?: () => void;
}

export function EmailProposalCard({ proposal, onApproved, onRejected, onPricedUp }: EmailProposalCardProps) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [priceInput, setPriceInput] = useState<string>("");

  const email = proposal.email || { from_email: "", subject: "", has_attachments: false };
  const data = proposal.extracted_data || {};
  const customer = data.customer || {};

  const handleApprove = () => {
    setShowApprovalDialog(true);
  };

  const handleApproveWithEdits = async (proposalId: number, userEdits: Record<string, unknown>) => {
    try {
      setProcessing(true);
      const response = await api.post<{ success: boolean; job: { id: number } }>(
        `/api/v1/email_job_proposals/${proposalId}/approve`,
        { user_edits: userEdits }
      );

      if (response?.success) {
        setShowApprovalDialog(false);
        if (response?.job?.id) {
          onApproved?.(response.job.id);
        }
        onPricedUp?.();
      }
    } catch (error) {
      console.error("Failed to approve proposal:", error);
      toast({ title: "Error", description: "Failed to approve proposal", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return;

    try {
      setProcessing(true);
      await api.post(`/api/v1/email_job_proposals/${proposal.id}/reject`, {
        rejection_reason: reason,
      });
      onRejected?.();
    } catch (error) {
      console.error("Failed to reject proposal:", error);
      toast({ title: "Error", description: "Failed to reject proposal", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const confidenceScore = data.confidence_score || 0;
  const confidencePercent = Math.round(confidenceScore * 100);
  const confidenceColor = confidencePercent >= 80
    ? "text-green-600"
    : confidencePercent >= 60
    ? "text-yellow-600"
    : "text-orange-600";

  return (
    <>
      <Card className="cursor-pointer hover:shadow-md transition-shadow w-full border-yellow-300 bg-yellow-50/50 dark:bg-yellow-900/10">
        <CardContent className="p-3 space-y-2">
          {/* Header with Mail icon badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-status-warning text-status-warning-foreground border-yellow-300 text-[10px] px-1.5">
                <Mail className="h-3 w-3 mr-1" />
                Email
              </Badge>
              <span className={`text-[10px] flex items-center gap-0.5 ${confidenceColor}`}>
                <Sparkles className="h-3 w-3" />
                {confidencePercent}%
              </span>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-medium text-sm line-clamp-2">
            {data.job_title || email.subject || "Untitled Proposal"}
          </h3>

          {/* Customer name */}
          <p className="text-xs text-muted-foreground">
            {customer.name || email.from_email || "Unknown"}
          </p>

          {/* Address if available */}
          {data.property_address && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{data.property_address}</span>
            </div>
          )}

          {/* Value if available */}
          {data.contract_value && (
            <div className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <DollarSign className="h-3 w-3" />
              {formatCurrencyWhole(data.contract_value)}
            </div>
          )}

          {/* Price input (optional override) */}
          <div className="relative">
            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter price (optional)"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="h-7 text-xs pl-6 pr-2"
              disabled={processing}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-1">
            <Button
              size="sm"
              className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={processing}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs"
              onClick={handleReject}
              disabled={processing}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      {showApprovalDialog && (
        <ProposalApprovalDialog
          proposal={proposal}
          open={showApprovalDialog}
          onOpenChange={setShowApprovalDialog}
          onApprove={handleApproveWithEdits}
          processing={processing}
          priceOverride={priceInput}
        />
      )}
    </>
  );
}
