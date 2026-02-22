"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Download, Send, RotateCcw, Check, XCircle, ArrowLeft, ArrowLeftRight, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { pollPdfGeneration } from "@/lib/pdf-generation";
import { TenderVersionHistory } from "@/components/tenders/TenderVersionHistory";
import type { TenderDocumentSummary } from "@/components/tenders/TenderVersionHistory";
import { TenderDocumentView } from "@/components/tenders/TenderDocumentView";
import type { TenderDocumentData } from "@/components/tenders/TenderDocumentView";
import { TenderDiffView } from "@/components/tenders/TenderDiffView";
import type { DiffSection } from "@/components/tenders/TenderDiffView";
import { useToast } from "@/components/ui/use-toast";

interface JobTenderTabProps {
  jobId: number | string;
}

type ViewMode = "list" | "detail" | "diff";

export default function JobTenderTab({ jobId }: JobTenderTabProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = React.useState<TenderDocumentSummary[]>([]);
  const [selectedDoc, setSelectedDoc] = React.useState<TenderDocumentData | null>(null);
  const [diffData, setDiffData] = React.useState<{ sections: DiffSection[]; vA: number; vB: number } | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [revisionDialogOpen, setRevisionDialogOpen] = React.useState(false);
  const [revisionNotes, setRevisionNotes] = React.useState("");

  // Fetch all tender documents for this job
  const fetchDocuments = React.useCallback(async () => {
    try {
      setFetchError(null);
      const response = await api.get<{ success: boolean; data: { tender_documents: TenderDocumentSummary[]; total_count: number } }>(
        `/api/v1/jobs/${jobId}/tender_documents`
      );
      if (response?.success) {
        setDocuments(response.data.tender_documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch tender documents:", err);
      setFetchError("Failed to load tender documents. Please try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Select and load a specific document
  const handleSelectDocument = React.useCallback(
    async (id: number) => {
      setActionLoading("loading");
      try {
        const response = await api.get<{ success: boolean; data: TenderDocumentData }>(
          `/api/v1/tender_documents/${id}`
        );
        if (response?.success) {
          setSelectedDoc(response.data);
          setViewMode("detail");
        }
      } catch {
        toast({ title: "Error", description: "Failed to load tender document.", variant: "destructive" });
      } finally {
        setActionLoading(null);
      }
    },
    [toast]
  );

  // Create new tender
  const handleCreate = React.useCallback(async () => {
    setActionLoading("create");
    try {
      const response = await api.post<{ success: boolean; data: TenderDocumentData }>(
        `/api/v1/jobs/${jobId}/tender_documents`,
        {}
      );
      if (response?.success) {
        toast({ title: "Tender Created", description: `Version ${response.data.version} created. POs have been locked.` });
        setSelectedDoc(response.data);
        setViewMode("detail");
        fetchDocuments();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to create tender.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [jobId, toast, fetchDocuments]);

  // Generate PDF
  const handleGeneratePdf = React.useCallback(async () => {
    if (!selectedDoc) return;
    setActionLoading("pdf");
    try {
      const response = await api.post<{
        success: boolean;
        data: { pdf_generation_id: number };
      }>(`/api/v1/tender_documents/${selectedDoc.id}/generate_pdf`, {});

      if (response?.success) {
        const result = await pollPdfGeneration(response.data.pdf_generation_id, {
          onProgress: () => {},
        });
        if (result.status === "completed" && result.downloadUrl) {
          window.open(result.downloadUrl, "_blank");
          toast({ title: "PDF Generated", description: "Your tender PDF is ready." });
          fetchDocuments();
        } else {
          toast({ title: "PDF Failed", description: result.error || "PDF generation failed.", variant: "destructive" });
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [selectedDoc, toast, fetchDocuments]);

  // Send to client
  const handleSend = React.useCallback(async () => {
    if (!selectedDoc) return;
    setActionLoading("send");
    try {
      const response = await api.post<{ success: boolean }>(`/api/v1/tender_documents/${selectedDoc.id}/send_to_client`, {});
      if (response?.success) {
        toast({ title: "Tender Sent", description: "Marked as sent to client." });
        fetchDocuments();
        handleSelectDocument(selectedDoc.id);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to send.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [selectedDoc, toast, fetchDocuments, handleSelectDocument]);

  // Request revision
  const handleRequestRevision = React.useCallback(async () => {
    if (!selectedDoc) return;
    setActionLoading("revision");
    try {
      const response = await api.post<{ success: boolean }>(`/api/v1/tender_documents/${selectedDoc.id}/request_revision`, {
        reason: revisionNotes,
      });
      if (response?.success) {
        toast({ title: "Revision Requested", description: "POs have been unlocked for changes." });
        setRevisionDialogOpen(false);
        setRevisionNotes("");
        setSelectedDoc(null);
        setViewMode("list");
        fetchDocuments();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to request revision.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [selectedDoc, revisionNotes, toast, fetchDocuments]);

  // Accept
  const handleAccept = React.useCallback(async () => {
    if (!selectedDoc) return;
    setActionLoading("accept");
    try {
      const response = await api.post<{ success: boolean }>(`/api/v1/tender_documents/${selectedDoc.id}/accept`, {});
      if (response?.success) {
        toast({ title: "Tender Accepted", description: "The tender has been accepted." });
        fetchDocuments();
        handleSelectDocument(selectedDoc.id);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to accept.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [selectedDoc, toast, fetchDocuments, handleSelectDocument]);

  // Decline
  const handleDecline = React.useCallback(async () => {
    if (!selectedDoc) return;
    setActionLoading("decline");
    try {
      const response = await api.post<{ success: boolean }>(`/api/v1/tender_documents/${selectedDoc.id}/decline`, {});
      if (response?.success) {
        toast({ title: "Tender Declined", description: "The tender has been declined." });
        fetchDocuments();
        handleSelectDocument(selectedDoc.id);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to decline.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [selectedDoc, toast, fetchDocuments, handleSelectDocument]);

  // Compare two versions
  const handleCompare = React.useCallback(
    async (docId: number, otherDocId: number) => {
      setActionLoading("diff");
      try {
        const response = await api.get<{
          success: boolean;
          data: { sections: DiffSection[]; version_a: number; version_b: number };
        }>(`/api/v1/tender_documents/${docId}/diff/${otherDocId}`);
        if (response?.success) {
          setDiffData({
            sections: response.data.sections,
            vA: response.data.version_a,
            vB: response.data.version_b,
          });
          setViewMode("diff");
        }
      } catch {
        toast({ title: "Error", description: "Failed to load comparison.", variant: "destructive" });
      } finally {
        setActionLoading(null);
      }
    },
    [toast]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  // Diff view
  if (viewMode === "diff" && diffData) {
    return (
      <div className="space-y-4 p-4">
        <Button variant="ghost" size="sm" onClick={() => setViewMode("list")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
        </Button>
        <TenderDiffView
          versionA={diffData.vA}
          versionB={diffData.vB}
          sections={diffData.sections}
        />
      </div>
    );
  }

  // Detail view
  if (viewMode === "detail" && selectedDoc) {
    const canSend = selectedDoc.status === "locked";
    const canRevise = selectedDoc.status === "sent" || selectedDoc.status === "locked";
    const canAcceptDecline = selectedDoc.status === "sent";

    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setViewMode("list"); setSelectedDoc(null); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGeneratePdf}
              disabled={!!actionLoading}
            >
              {actionLoading === "pdf" ? <Spinner className="h-4 w-4 mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              PDF
            </Button>
            {canSend && (
              <Button size="sm" onClick={handleSend} disabled={!!actionLoading}>
                {actionLoading === "send" ? <Spinner className="h-4 w-4 mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Send to Client
              </Button>
            )}
            {canRevise && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevisionDialogOpen(true)}
                disabled={!!actionLoading}
              >
                <RotateCcw className="h-4 w-4 mr-1" /> Request Revision
              </Button>
            )}
            {canAcceptDecline && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleAccept}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "accept" ? <Spinner className="h-4 w-4 mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDecline}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "decline" ? <Spinner className="h-4 w-4 mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                  Decline
                </Button>
              </>
            )}
          </div>
        </div>
        <TenderDocumentView document={selectedDoc} />

        {/* Revision Dialog */}
        <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Revision</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will unlock all purchase orders for this job so you can make changes.
              After making changes, create a new tender to generate the next version.
            </p>
            <Textarea
              placeholder="Reason for revision (optional)"
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevisionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRequestRevision}
                disabled={actionLoading === "revision"}
              >
                {actionLoading === "revision" ? <Spinner className="h-4 w-4 mr-1" /> : null}
                Unlock POs & Request Revision
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // List view (default)
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Tender Documents
        </h3>
        <Button onClick={handleCreate} disabled={!!actionLoading} size="sm">
          {actionLoading === "create" ? (
            <Spinner className="h-4 w-4 mr-1" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          Create Tender
        </Button>
      </div>

      {fetchError ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-destructive">{fetchError}</p>
            <Button variant="outline" onClick={fetchDocuments} className="mt-4" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No tender documents yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first tender to snapshot purchase orders and generate a professional PDF.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Version list */}
          <div>
            <TenderVersionHistory
              documents={documents}
              selectedId={null}
              onSelect={handleSelectDocument}
            />
          </div>

          {/* Compare panel (when 2+ versions exist) */}
          {documents.length >= 2 && (
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="py-6">
                  <p className="text-sm text-muted-foreground mb-3">Compare versions</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {documents.length >= 2 &&
                      documents.slice(0, -1).map((doc, idx) => {
                        const next = documents[idx + 1];
                        if (!next) return null;
                        return (
                          <Button
                            key={`${doc.id}-${next.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => handleCompare(doc.id, next.id)}
                            disabled={!!actionLoading}
                          >
                            <ArrowLeftRight className="h-4 w-4 mr-1" />
                            v{doc.version} vs v{next.version}
                          </Button>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
