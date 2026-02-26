"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
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
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import {
  Send,
  XCircle,
  CheckCircle2,
  Clock,
  FileText,
  Users,
  AlertCircle,
  Mail,
  Calendar,
  Shield,
  Download,
  RefreshCw,
  Eye,
  PenLine,
  Save,
  History,
  SendHorizonal,
} from "lucide-react";
import { api } from "@/lib/api";
import { format, formatDistanceToNow } from "date-fns";
import { DATETIME_MEDIUM_12H } from "@/lib/constants/date-formats";
import type {
  Signer as EditorSigner,
  SignatureField,
} from "@/components/ui/pdf-editor/types";
import { SIGNER_COLORS } from "@/components/ui/pdf-editor/types";

// Dynamic import for ESignaturePdfEditor (uses react-pdf which needs browser APIs)
const ESignaturePdfEditor = dynamic(
  () =>
    import("@/components/e-signature/e-signature-pdf-editor").then(
      (mod) => mod.ESignaturePdfEditor
    ),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96"><Spinner size={32} /></div> }
);

interface BackendSigner {
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

interface BackendField {
  id: number;
  field_type: string;
  page_number: number;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  label: string | null;
  required: boolean;
  date_format: string | null;
  placeholder: string | null;
  completed: boolean;
  signer_id: number;
  signer_email: string;
}

interface ESignatureEvent {
  id: number;
  event_type: string;
  description: string;
  occurred_at: string;
  actor_type: string | null;
  actor_name: string | null;
  signer_name: string | null;
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
  signers: BackendSigner[];
  fields: BackendField[];
  has_positioned_fields: boolean;
  has_certificate: boolean;
  has_document: boolean;
  message_to_signers: string;
  send_reminders: boolean;
  document_type_id: number | null;
  document_type_name: string | null;
  events?: ESignatureEvent[];
}

interface ESignatureResponse {
  success: boolean;
  e_signature_request: ESignatureRequest;
}

/** Map backend signers to the Signer type expected by ESignaturePdfEditor */
function mapSignersToEditor(signers: BackendSigner[]): EditorSigner[] {
  return signers.map((s, i) => ({
    id: String(s.id),
    email: s.email,
    name: s.name,
    color: SIGNER_COLORS[i % SIGNER_COLORS.length],
    order: s.signing_order,
  }));
}

/** Map backend fields to the SignatureField type expected by ESignaturePdfEditor */
function mapFieldsToEditor(fields: BackendField[], editorSigners: EditorSigner[]): SignatureField[] {
  return fields.map((f) => {
    const signer = editorSigners.find((s) => s.id === String(f.signer_id));
    return {
      id: `field-${f.id}`,
      type: f.field_type as SignatureField["type"],
      pageId: `page-${f.page_number}`,
      pageNumber: f.page_number,
      signerId: String(f.signer_id),
      signerEmail: f.signer_email,
      signerColor: signer?.color || SIGNER_COLORS[0],
      xPercent: f.x_percent,
      yPercent: f.y_percent,
      widthPercent: f.width_percent,
      heightPercent: f.height_percent,
      label: f.label || undefined,
      required: f.required,
      dateFormat: f.date_format || undefined,
      placeholder: f.placeholder || undefined,
    };
  });
}

/** Convert editor fields to the format expected by the backend PUT /fields endpoint */
function mapFieldsToBackend(fields: SignatureField[], editorSigners: EditorSigner[]): any[] {
  return fields.map((f) => {
    const signerIndex = editorSigners.findIndex((s) => s.id === f.signerId);
    return {
      field_type: f.type,
      page_number: f.pageNumber,
      x_percent: f.xPercent,
      y_percent: f.yPercent,
      width_percent: f.widthPercent,
      height_percent: f.heightPercent,
      label: f.label || null,
      required: f.required,
      date_format: f.dateFormat || null,
      placeholder: f.placeholder || null,
      signer_index: signerIndex >= 0 ? signerIndex : 0,
    };
  });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "bg-muted text-foreground dark:bg-card dark:text-muted-foreground", icon: <FileText className="h-4 w-4" /> },
  sent: { label: "Sent", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400", icon: <Send className="h-4 w-4" /> },
  in_progress: { label: "In Progress", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 dark:bg-amber-900/30 dark:text-amber-400", icon: <Clock className="h-4 w-4" /> },
  completed: { label: "Completed", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle2 className="h-4 w-4" /> },
  declined: { label: "Declined", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300", icon: <XCircle className="h-4 w-4" /> },
  expired: { label: "Expired", color: "bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground", icon: <AlertCircle className="h-4 w-4" /> },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground", icon: <XCircle className="h-4 w-4" /> },
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  created: "text-muted-foreground",
  sent: "text-blue-600 dark:text-blue-400",
  notified: "text-blue-600 dark:text-blue-400",
  notification_failed: "text-red-600 dark:text-red-400",
  viewed: "text-amber-600 dark:text-amber-400",
  verified: "text-green-600 dark:text-green-400",
  verification_failed: "text-red-600 dark:text-red-400",
  signed: "text-green-600 dark:text-green-400",
  declined: "text-red-600 dark:text-red-400",
  completed: "text-green-600 dark:text-green-400",
  expired: "text-muted-foreground",
  cancelled: "text-red-600 dark:text-red-400",
  field_completed: "text-muted-foreground",
};

const SIGNER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground" },
  notified: { label: "Notified", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300" },
  viewed: { label: "Viewed", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300" },
  signed: { label: "Signed", color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300" },
  declined: { label: "Declined", color: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300" },
};

export default function ESignatureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [showCancelDialog, setShowCancelDialog] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");

  // Field editor state
  const [editingFields, setEditingFields] = React.useState(false);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = React.useState(false);
  const [editorFields, setEditorFields] = React.useState<SignatureField[]>([]);
  const [selectedEditorSigner, setSelectedEditorSigner] = React.useState<EditorSigner | null>(null);

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

  const resendMutation = useMutation({
    mutationFn: async (signerId: number) => {
      return api.post(`/api/v1/e_signature_requests/${id}/signers/${signerId}/resend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["e-signature-request", id] });
    },
  });

  const [resendingAll, setResendingAll] = React.useState(false);
  const handleResendAll = async () => {
    if (!request) return;
    setResendingAll(true);
    try {
      const pendingSigners = request.signers.filter(
        (s) => ["pending", "notified", "viewed"].includes(s.status)
      );
      for (const signer of pendingSigners) {
        await api.post(`/api/v1/e_signature_requests/${id}/signers/${signer.id}/resend`);
      }
      queryClient.invalidateQueries({ queryKey: ["e-signature-request", id] });
    } catch {
      // Individual failures handled silently
    } finally {
      setResendingAll(false);
    }
  };

  const saveFieldsMutation = useMutation({
    mutationFn: async (fields: SignatureField[]) => {
      const editorSigners = mapSignersToEditor(data?.e_signature_request?.signers || []);
      const backendFields = mapFieldsToBackend(fields, editorSigners);
      return api.put(`/api/v1/e_signature_requests/${id}/fields`, { fields: backendFields });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["e-signature-request", id] });
      setEditingFields(false);
      // Clean up blob URL
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    },
  });

  const handleViewDocument = async () => {
    try {
      const blob = await api.getBlob(`/api/v1/e_signature_requests/${id}/document`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error("[ESignatureDetail] view document error:", err);
    }
  };

  const handleOpenEditor = async () => {
    if (!data?.e_signature_request) return;
    setLoadingPdf(true);
    try {
      const blob = await api.getBlob(`/api/v1/e_signature_requests/${id}/document`);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);

      // Initialize editor fields from existing backend fields
      const editorSigners = mapSignersToEditor(data.e_signature_request.signers);
      const existingFields = mapFieldsToEditor(
        data.e_signature_request.fields || [],
        editorSigners
      );
      setEditorFields(existingFields);

      // Auto-select first signer
      if (editorSigners.length > 0) {
        setSelectedEditorSigner(editorSigners[0]);
      }

      setEditingFields(true);
    } catch (err) {
      console.error("[ESignatureDetail] open editor error:", err);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleCloseEditor = () => {
    setEditingFields(false);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setEditorFields([]);
    setSelectedEditorSigner(null);
  };

  // Clean up blob URL on unmount
  React.useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const request = data?.e_signature_request;
  const statusConfig = request ? STATUS_CONFIG[request.status] || STATUS_CONFIG.draft : null;
  const editorSigners = request ? mapSignersToEditor(request.signers) : [];

  if (isLoading) {
    return (
      <LoadingOverlay />
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

  // If editing fields, show the full-page editor
  if (editingFields && pdfUrl) {
    return (
      <div className="flex flex-col h-full -mx-4">
        {/* Editor Header */}
        <div className="px-6 py-3 border-b shrink-0 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleCloseEditor}>
                Cancel
              </Button>
              <div>
                <h2 className="text-lg font-semibold">Place Signature Fields</h2>
                <p className="text-sm text-muted-foreground">
                  Select a signer, choose a field type, then click on the PDF to place it
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {editorFields.length} field{editorFields.length !== 1 ? "s" : ""} placed
              </span>
              <Button
                onClick={() => saveFieldsMutation.mutate(editorFields)}
                disabled={saveFieldsMutation.isPending || editorFields.length === 0}
              >
                {saveFieldsMutation.isPending ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Fields
              </Button>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-hidden">
          <ESignaturePdfEditor
            url={pdfUrl}
            signers={editorSigners}
            selectedSigner={selectedEditorSigner}
            onSelectSigner={setSelectedEditorSigner}
            fields={editorFields}
            onFieldsChange={setEditorFields}
          />
        </div>
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

            {request.status === "draft" && request.has_document && (
              <Button
                variant="outline"
                onClick={handleOpenEditor}
                disabled={loadingPdf}
              >
                {loadingPdf ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <PenLine className="h-4 w-4 mr-2" />
                )}
                {request.has_positioned_fields ? "Edit Fields" : "Place Fields"}
              </Button>
            )}

            {request.status === "draft" && (
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending || request.signers.length === 0 || !request.has_positioned_fields}
              >
                {sendMutation.isPending ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send for Signing
              </Button>
            )}

            {["sent", "in_progress"].includes(request.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendAll}
                disabled={resendingAll || !request.signers.some((s) => ["pending", "notified", "viewed"].includes(s.status))}
              >
                {resendingAll ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <SendHorizonal className="h-4 w-4 mr-2" />
                )}
                Resend All
              </Button>
            )}

            {["draft", "sent", "in_progress"].includes(request.status) && (
              <Button variant="destructive" onClick={() => setShowCancelDialog(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}

            {request.has_document && (
              <Button variant="outline" onClick={handleViewDocument}>
                <Eye className="h-4 w-4 mr-2" />
                View Document
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

          {/* Place Fields Prompt - shown for draft requests without fields */}
          {request.status === "draft" && !request.has_positioned_fields && request.has_document && (
            <Card className="border-dashed border-2 border-primary/30">
              <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <PenLine className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Place Signature Fields</h3>
                  <p className="text-muted-foreground mt-1 max-w-md">
                    Open the PDF editor to place signature, initials, and date fields where each signer needs to sign.
                  </p>
                </div>
                <Button onClick={handleOpenEditor} disabled={loadingPdf}>
                  {loadingPdf ? (
                    <Spinner size={16} className="mr-2" />
                  ) : (
                    <PenLine className="h-4 w-4 mr-2" />
                  )}
                  Open Editor
                </Button>
              </CardContent>
            </Card>
          )}

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

              <div className="space-y-4">
                {request.signers.map((signer, index) => {
                  const signerStatus = SIGNER_STATUS_CONFIG[signer.status] || SIGNER_STATUS_CONFIG.pending;

                  // Build timeline events for this signer
                  const timelineEvents: { label: string; date: string | null; icon: React.ReactNode; done: boolean; color: string }[] = [
                    {
                      label: "Notified",
                      date: signer.notified_at,
                      icon: <Send className="h-3 w-3" />,
                      done: !!signer.notified_at,
                      color: "text-blue-600 dark:text-blue-400",
                    },
                    {
                      label: "Viewed",
                      date: signer.viewed_at,
                      icon: <Eye className="h-3 w-3" />,
                      done: !!signer.viewed_at,
                      color: "text-amber-600 dark:text-amber-400",
                    },
                    ...(signer.declined_at
                      ? [{
                          label: "Declined",
                          date: signer.declined_at,
                          icon: <XCircle className="h-3 w-3" />,
                          done: true,
                          color: "text-red-600 dark:text-red-400",
                        }]
                      : [{
                          label: "Signed",
                          date: signer.signed_at,
                          icon: <CheckCircle2 className="h-3 w-3" />,
                          done: !!signer.signed_at,
                          color: "text-green-600 dark:text-green-400",
                        }]
                    ),
                  ];

                  return (
                    <div
                      key={signer.id}
                      className="p-4 rounded-lg border bg-muted/30"
                    >
                      {/* Signer header */}
                      <div className="flex items-center justify-between mb-3">
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
                        <div className="flex items-center gap-2">
                          {["sent", "in_progress"].includes(request.status) &&
                            ["notified", "viewed"].includes(signer.status) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => resendMutation.mutate(signer.id)}
                              disabled={resendMutation.isPending}
                            >
                              {resendMutation.isPending ? (
                                <Spinner size={12} className="mr-1" />
                              ) : (
                                <Send className="h-3 w-3 mr-1" />
                              )}
                              Resend
                            </Button>
                          )}
                          <Badge className={signerStatus.color} variant="secondary">
                            {signerStatus.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="ml-11 flex items-center gap-0">
                        {timelineEvents.map((event, i) => (
                          <React.Fragment key={event.label}>
                            {/* Step */}
                            <div className="flex items-center gap-1.5">
                              <div className={`flex items-center justify-center w-5 h-5 rounded-full border ${
                                event.done
                                  ? `${event.color} border-current bg-current/10`
                                  : "text-muted-foreground/40 border-muted-foreground/30"
                              }`}>
                                {event.done ? event.icon : <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />}
                              </div>
                              <div className={event.done ? "" : "opacity-40"}>
                                <span className={`text-xs font-medium ${event.done ? event.color : "text-muted-foreground"}`}>
                                  {event.label}
                                </span>
                                {event.date && (
                                  <span className="text-[11px] text-muted-foreground ml-1">
                                    {format(new Date(event.date), "MMM d, h:mm a")}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Connector line */}
                            {i < timelineEvents.length - 1 && (
                              <div className={`flex-1 h-px mx-2 min-w-4 ${
                                timelineEvents[i + 1].done ? "bg-muted-foreground/40" : "bg-muted-foreground/20"
                              }`} />
                            )}
                          </React.Fragment>
                        ))}
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
                  <div>{format(new Date(request.created_at), DATETIME_MEDIUM_12H)}</div>
                </div>

                {request.sent_at && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      Sent
                    </div>
                    <div>{format(new Date(request.sent_at), DATETIME_MEDIUM_12H)}</div>
                  </div>
                )}

                {request.expires_at && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires
                    </div>
                    <div>{format(new Date(request.expires_at), DATETIME_MEDIUM_12H)}</div>
                  </div>
                )}

                {request.completed_at && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </div>
                    <div>{format(new Date(request.completed_at), DATETIME_MEDIUM_12H)}</div>
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

                {request.document_type_name && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Document Type
                    </div>
                    <div>{request.document_type_name}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Activity Log */}
          {request.events && request.events.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Activity Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {request.events.map((event, index) => {
                    const isFirst = index === 0;
                    const eventColor = EVENT_TYPE_COLORS[event.event_type] || "text-muted-foreground";
                    return (
                      <div key={event.id} className="flex gap-3 py-2">
                        {/* Timeline dot + line */}
                        <div className="flex flex-col items-center pt-1">
                          <div className={`w-2 h-2 rounded-full ${isFirst ? "bg-primary" : "bg-muted-foreground/40"}`} />
                          {index < request.events!.length - 1 && (
                            <div className="w-px flex-1 bg-muted-foreground/20 mt-1" />
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm font-medium ${eventColor}`}>
                              {event.description}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(event.occurred_at), "MMM d, h:mm a")}
                            </span>
                          </div>
                          {event.actor_name && (
                            <span className="text-xs text-muted-foreground">
                              by {event.actor_name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
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
                <Spinner size={16} className="mr-2" />
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
