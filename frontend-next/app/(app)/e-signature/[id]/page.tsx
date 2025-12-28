"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BackButton } from "@/components/ui/back-button";
import {
  Send,
  XCircle,
  CheckCircle2,
  Clock,
  FileText,
  Users,
  AlertCircle,
  Loader2,
  Mail,
  Calendar,
  Shield,
  Download,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { format, formatDistanceToNow } from "date-fns";

interface Signer {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  signing_order: number;
  notified_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  can_sign: boolean;
}

interface ESignatureRequest {
  id: number;
  request_number: string;
  title: string;
  description: string;
  status: string;
  signing_order: number;
  progress: number;
  signed_count: number;
  total_signers: number;
  sent_at: string | null;
  expires_at: string | null;
  completed_at: string | null;
  created_at: string;
  created_by: string;
  signers: Signer[];
  has_positioned_fields: boolean;
  has_certificate: boolean;
  message_to_signers: string;
  send_reminders: boolean;
}

interface ESignatureResponse {
  success: boolean;
  e_signature_request: ESignatureRequest;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: <FileText className="h-4 w-4" /> },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: <Send className="h-4 w-4" /> },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <Clock className="h-4 w-4" /> },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle2 className="h-4 w-4" /> },
  declined: { label: "Declined", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle className="h-4 w-4" /> },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", icon: <AlertCircle className="h-4 w-4" /> },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", icon: <XCircle className="h-4 w-4" /> },
};

const SIGNER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600" },
  notified: { label: "Notified", color: "bg-blue-100 text-blue-600" },
  viewed: { label: "Viewed", color: "bg-amber-100 text-amber-600" },
  signed: { label: "Signed", color: "bg-green-100 text-green-600" },
  declined: { label: "Declined", color: "bg-red-100 text-red-600" },
};

export default function ESignatureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [showCancelDialog, setShowCancelDialog] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["e-signature-request", id],
    queryFn: async () => {
      const response = await api.get<ESignatureResponse>(`/api/v1/e_signature_requests/${id}`);
      return response;
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/api/v1/e_signature_requests/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["e-signature-request", id] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      return api.post(`/api/v1/e_signature_requests/${id}/cancel`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["e-signature-request", id] });
      setShowCancelDialog(false);
    },
  });

  const request = data?.e_signature_request;
  const statusConfig = request ? STATUS_CONFIG[request.status] || STATUS_CONFIG.draft : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p>Failed to load e-signature request</p>
        <BackButton fallbackHref="/e-signature" label="Back to List" variant="outline" className="mt-4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Header */}
      <div className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton fallbackHref="/e-signature" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{request.title}</h1>
                <Badge className={`${statusConfig?.color} gap-1`} variant="secondary">
                  {statusConfig?.icon}
                  {statusConfig?.label}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">{request.request_number}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>

            {request.status === "draft" && (
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending || request.signers.length === 0}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send for Signing
              </Button>
            )}

            {["draft", "sent", "in_progress"].includes(request.status) && (
              <Button variant="destructive" onClick={() => setShowCancelDialog(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}

            {request.status === "completed" && request.has_certificate && (
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Certificate
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Signing Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${request.progress}%` }}
                  />
                </div>
                <span className="text-lg font-semibold">
                  {request.signed_count} / {request.total_signers}
                </span>
              </div>

              <div className="space-y-3">
                {request.signers.map((signer, index) => {
                  const signerStatus = SIGNER_STATUS_CONFIG[signer.status] || SIGNER_STATUS_CONFIG.pending;

                  return (
                    <div
                      key={signer.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{signer.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {signer.email}
                            {signer.role && (
                              <span className="ml-2 text-xs">({signer.role})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {signer.signed_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(signer.signed_at), "MMM d, yyyy h:mm a")}
                          </span>
                        )}
                        <Badge className={signerStatus.color} variant="secondary">
                          {signerStatus.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {request.description && (
                <div>
                  <div className="text-sm text-muted-foreground">Description</div>
                  <div>{request.description}</div>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created
                  </div>
                  <div>{format(new Date(request.created_at), "MMM d, yyyy h:mm a")}</div>
                </div>

                {request.sent_at && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      Sent
                    </div>
                    <div>{format(new Date(request.sent_at), "MMM d, yyyy h:mm a")}</div>
                  </div>
                )}

                {request.expires_at && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires
                    </div>
                    <div>{format(new Date(request.expires_at), "MMM d, yyyy h:mm a")}</div>
                  </div>
                )}

                {request.completed_at && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </div>
                    <div>{format(new Date(request.completed_at), "MMM d, yyyy h:mm a")}</div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-muted-foreground">Created By</div>
                  <div>{request.created_by}</div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Signing Mode
                  </div>
                  <div>
                    {request.has_positioned_fields ? "Positioned Fields" : "Standard Signature"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel E-Signature Request</DialogTitle>
            <DialogDescription>
              This will cancel the signature request and notify all signers. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for cancellation (optional)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Request
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate(cancelReason)}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Cancel Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
