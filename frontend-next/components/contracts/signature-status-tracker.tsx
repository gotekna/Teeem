"use client";

import { Contract, ESIGN_STATUS_CONFIG } from "@/types/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Clock,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Mail,
} from "lucide-react";

interface SignatureStatusTrackerProps {
  contract: Contract;
  onResend?: (signerId: string) => void;
  onRefresh?: () => void;
}

const STATUS_ICONS = {
  pending: Clock,
  sent: Send,
  viewed: Eye,
  signed: CheckCircle,
  declined: XCircle,
  expired: AlertCircle,
};

export function SignatureStatusTracker({
  contract,
  onResend,
  onRefresh,
}: SignatureStatusTrackerProps) {
  const signers = contract.signers || [];


  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate overall progress
  const signedCount = signers.filter((s) => s.status === "signed").length;
  const totalSigners = signers.length;
  const progressPercent = totalSigners > 0 ? (signedCount / totalSigners) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Signature Status</CardTitle>
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {signedCount} of {totalSigners} signed
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Signers List */}
        <div className="space-y-3">
          {signers.map((signer) => {
            const statusConfig = ESIGN_STATUS_CONFIG[signer.status];
            const Icon = STATUS_ICONS[signer.status];

            return (
              <div
                key={signer.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      signer.status === "signed"
                        ? "bg-green-100 dark:bg-green-900/30"
                        : signer.status === "declined"
                        ? "bg-red-100 dark:bg-red-900/30"
                        : signer.status === "viewed"
                        ? "bg-yellow-100 dark:bg-yellow-900/30"
                        : "bg-muted"
                    )}
                  >
                    <Icon
                      className={cn("h-4 w-4", statusConfig.color)}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{signer.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        ({signer.role})
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {signer.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        statusConfig.color
                      )}
                    >
                      {statusConfig.label}
                    </span>
                    {signer.signed_at && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(signer.signed_at)}
                      </p>
                    )}
                  </div>
                  {onResend &&
                    ["pending", "sent", "viewed"].includes(signer.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResend(signer.id)}
                        title="Resend reminder"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {signers.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No signers configured yet
          </div>
        )}

        {/* Sent Timestamp */}
        {contract.sent_for_signature_at && (
          <p className="text-xs text-muted-foreground text-center">
            Sent for signature on{" "}
            {formatDate(contract.sent_for_signature_at)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
