"use client";

import { useState, useEffect, useCallback, useRef, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Mail,
  CheckCircle,
  Plus,
  Upload,
  X,
  MoreHorizontal,
  Sparkles,
  Pencil,
  ExternalLink,
  FolderOpen,
  Download,
  ArrowLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, getApiBaseUrl } from "@/lib/api";
import { cachePdf, getCachedPdf } from "@/lib/pdf-cache";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { uploadPhoto } from "@/lib/storage-upload";
import { uploadFile } from "@/lib/upload-utils";
import { UI_ANIMATION_STANDARD_MS, POLLING_DELAY_MS } from "@/lib/constants/timeout-constants";
import { EmailPlansModal } from "@/components/plans/EmailPlansModal";
import { PlanProcessingModal, OperationType } from "@/components/jobs/PlanProcessingModal";
import { useToast } from "@/components/ui/use-toast";
import { DocumentListView, RevisionHistoryItem } from "@/components/ui/document-list-view";
import { Spinner } from "@/components/ui/spinner";
// Layout mode is handled by parent page wrapper (TabbedDetailPage)
// This tab uses EdgeToEdgeTabContent for internal padding

interface Revision {
  id: number;
  job_plan_id: number;
  revision: string;
  revision_label: string;
  revision_date: string | null;
  issued_date: string | null;
  is_on_issue: boolean;
  has_file: boolean;
  storage_item_id?: string | null;
  storage_file_id: string | null;
  storage_web_url: string | null;
  file_name: string | null;
  file_size: number | null;
  formatted_file_size: string | null;
  notes: string | null;
  issued_by: { id: number; name: string } | null;
  // Thumbnail for instant preview
  thumbnail_url: string | null;
  thumbnail_file_id: string | null;
  // Inline base64 micro thumbnail for instant display (no network request)
  micro_thumbnail_base64: string | null;
}

interface JobPlan {
  id: number;
  job_id: number;
  job_plan_tab_id: number | null;
  variant_suffix: string | null;
  display_name: string;
  current_revision: Revision | null;
  revision_count: number;
}

interface JobPlansTabProps {
  jobId: number;
  jobCode: string;
  jobTitle: string;
}

export function JobPlansTab({ jobId, jobCode, jobTitle }: JobPlansTabProps) {
  const { toast } = useToast();
  const router = useRouter();

  // Plans tab ALWAYS runs in fullscreen mode to maximize plan viewing area
  // This hides the parent tabs and gives full screen real estate for plans
  const isFullscreenTab = true;

  // Lock body scroll when in fullscreen tab mode
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  const [plans, setPlans] = useState<JobPlan[]>([]);

  // MASTERPIECE: Pagination state for infinite scroll
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<JobPlan | null>(null);
  const handlePlanSelect = useCallback((plan: JobPlan | null) => {
    setSelectedPlan(plan);
  }, []);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  // Add Plan Dialog State
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Adjust Revision dialog state
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionValue, setRevisionValue] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [savingRevision, setSavingRevision] = useState(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Unified processing modal state (all batch operations)
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>("plan_upload");
  const [operationId, setOperationId] = useState<number | null>(null);

  // MASTERPIECE: Fetch plans with cursor-based pagination
  const fetchPlans = useCallback(async (cursor?: number | null, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        // Reset pagination state on fresh load
        setPlans([]);
        setNextCursor(null);
        setHasMore(false);
      }

      const params = new URLSearchParams({ per_page: "50" });
      if (cursor) {
        params.set("cursor", cursor.toString());
      }

      const response = (await api.get(`/api/v1/jobs/${jobId}/job_plans?${params}`)) as {
        success: boolean;
        data?: JobPlan[];
        pagination?: {
          has_more: boolean;
          next_cursor: number | null;
          total_count: number | null;
          per_page: number;
        };
        error?: string;
      };

      if (response.success) {
        const newPlans = response.data || [];

        if (append) {
          // Append to existing plans
          setPlans(prev => [...prev, ...newPlans]);
        } else {
          // Replace plans (fresh load)
          setPlans(newPlans);
          // Only set total count on first load
          if (response.pagination?.total_count != null) {
            setTotalCount(response.pagination.total_count);
          }
        }

        // Update pagination state
        setHasMore(response.pagination?.has_more ?? false);
        setNextCursor(response.pagination?.next_cursor ?? null);
      }
    } catch (err) {
      console.error("Error fetching plans:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [jobId]);

  // MASTERPIECE: Load more function for infinite scroll
  const loadMorePlans = useCallback(() => {
    if (hasMore && nextCursor && !loadingMore) {
      fetchPlans(nextCursor, true);
    }
  }, [fetchPlans, hasMore, nextCursor, loadingMore]);


  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Preload ALL PDFs in background for instant navigation
  // When first plan is selected, start preloading entire plan set
  useEffect(() => {
    if (!selectedPlan || plans.length === 0) return;

    // Get all plans except the currently selected one (it's already loading)
    const plansToPreload = plans.filter(p => p.id !== selectedPlan.id);
    if (plansToPreload.length === 0) return;

    let cancelled = false;

    // Preload function for a single plan
    const preloadPlan = async (plan: JobPlan): Promise<boolean> => {
      if (cancelled) return false;

      const revision = plan.current_revision;
      const fileId = revision?.storage_item_id || revision?.storage_file_id;
      if (!fileId || !revision) return false;

      // Must match getPdfPreviewUrl format (includes rev= for cache-busting)
      const pdfUrl = `${getApiBaseUrl()}/api/v1/documents/download?file_id=${fileId}&preview=true&rev=${revision.id}`;

      // Skip if already cached
      const cached = await getCachedPdf(pdfUrl);
      if (cached) return true;

      try {
        // Get presigned URL for faster download
        // FRC (Feb 2026): skipAuthRedirect prevents logout when SharePoint credential fails
        // A storage 401 means "credential issue", not "session expired"
        const data = await api.get<{ success: boolean; url?: string }>(
          `/api/v1/documents/presigned_url?file_id=${encodeURIComponent(fileId)}`,
          { skipAuthRedirect: true }
        );

        if (!data.success || !data.url) return false;

        // Fetch PDF from presigned URL (direct from S3 - fast)
        const pdfResponse = await fetch(data.url, {
          credentials: "omit",
          mode: "cors",
        });

        if (!pdfResponse.ok) return false;

        const blob = await pdfResponse.blob();
        // Cache under the original URL so PDFViewerImpl finds it
        await cachePdf(pdfUrl, blob);
        return true;
      } catch {
        return false;
      }
    };

    // Preload in batches of 2 to avoid overwhelming the network
    // Prioritize adjacent plans first, then load rest
    const preloadAll = async () => {
      const currentIndex = plans.findIndex(p => p.id === selectedPlan.id);

      // Sort plans by distance from current selection (adjacent first)
      const sortedPlans = [...plansToPreload].sort((a, b) => {
        const aIndex = plans.findIndex(p => p.id === a.id);
        const bIndex = plans.findIndex(p => p.id === b.id);
        return Math.abs(aIndex - currentIndex) - Math.abs(bIndex - currentIndex);
      });

      let loaded = 0;
      const batchSize = 2;

      for (let i = 0; i < sortedPlans.length; i += batchSize) {
        if (cancelled) break;

        const batch = sortedPlans.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(preloadPlan));
        loaded += results.filter(Boolean).length;
      }

      if (!cancelled && loaded > 0) {
      }
    };

    // Start preloading after a short delay to let the selected plan load first
    const timeoutId = setTimeout(preloadAll, UI_ANIMATION_STANDARD_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [selectedPlan?.id, plans]);

  // Get PDF preview URL
  // Cache-busting: revision.id changes when file is updated, invalidating old cache
  const getPdfPreviewUrl = (revision: Revision | null) => {
    const fileId = revision?.storage_item_id || revision?.storage_file_id;
    if (!fileId) return null;
    // Include revision.id as cache-buster - new revision = new URL = fresh cache
    return `${getApiBaseUrl()}/api/v1/documents/download?file_id=${fileId}&preview=true&rev=${revision.id}`;
  };

  // Get thumbnail URL for instant preview (if available)
  // Priority: 1) Inline base64 (instant, no network) 2) File download (slower)
  const getThumbnailUrl = (revision: Revision | null) => {
    // Use inline base64 if available (instant, no network request)
    if (revision?.micro_thumbnail_base64) {
      return `data:image/webp;base64,${revision.micro_thumbnail_base64}`;
    }
    // Fall back to file download if no inline thumbnail
    if (!revision?.thumbnail_file_id) return null;
    return `${getApiBaseUrl()}/api/v1/documents/download?file_id=${revision.thumbnail_file_id}&preview=true`;
  };

  // Open Add Plan dialog
  const handleOpenAddDialog = () => {
    setNewPlanName("");
    setSelectedFile(null);
    setShowAddDialog(true);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Handle file drop - automatically process multi-page PDF with AI
  const handleFileDrop = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
      return;
    }

    try {
      // SSoT: Use presigned URL upload (bypasses Heroku 30s timeout)
      const uploadResult = await uploadFile(file, 'imports', {
        metadata: { job_id: jobId }
      });

      if (!uploadResult.success || !uploadResult.key) {
        throw new Error(uploadResult.error || "Failed to upload file");
      }

      // Create plan upload record with S3 key
      const result = await api.post<{
        success: boolean;
        data?: { id: number };
        error?: string;
      }>(`/api/v1/jobs/${jobId}/plan_uploads`, {
        storage_key: uploadResult.key,
      });

      if (result?.success && result.data?.id) {
        // Show progress modal
        setOperationType("plan_upload");
        setOperationId(result.data.id);
        setShowProcessingModal(true);
      } else {
        throw new Error(result?.error || "Failed to start upload");
      }
    } catch (err) {
      console.error("Error processing plan set:", err);
      toast({
        title: "Upload Failed",
        description:
          err instanceof Error ? err.message : "Failed to upload plan set",
        variant: "destructive",
      });
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileDrop(files[0]);
    }
  };


  // Handle rename
  const handleRename = async (plan: JobPlan, newName: string) => {
    const response = (await api.patch(
      `/api/v1/jobs/${jobId}/job_plans/${plan.id}`,
      {
        job_plan: { display_name: newName },
      }
    )) as { success: boolean; error?: string };

    if (response.success) {
      toast({ title: "Success", description: "Plan renamed successfully" });
      fetchPlans();
    } else {
      toast({
        title: "Error",
        description: response.error || "Failed to rename plan",
        variant: "destructive",
      });
      throw new Error(response.error);
    }
  };

  // Re-extract all plans from PDF (uses BatchOperation for progress tracking)
  const handleRerunAi = async () => {
    try {
      // Start batch re-extraction via BatchOperation API (SSoT)
      const response = await api.post(`/api/v1/jobs/${jobId}/batch_operations`, {
        operation_type: "plan_reextract"
      }) as {
        success: boolean;
        data?: { id: number };
        error?: string;
      };

      if (response.success && response.data?.id) {
        // Show progress modal
        setOperationType("plan_reextract");
        setOperationId(response.data.id);
        setShowProcessingModal(true);
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to start re-extraction",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error starting re-extraction:", err);
      toast({
        title: "Error",
        description: "Failed to start re-extraction",
        variant: "destructive",
      });
    }
  };

  // Handle processing modal completion (all batch operations)
  const handleProcessingComplete = () => {
    setShowProcessingModal(false);
    setOperationId(null);
    // Refresh plans to show updated data
    fetchPlans();
    const titles: Record<OperationType, string> = {
      plan_upload: "Upload Complete",
      plan_reextract: "Re-extraction Complete",
      folder_scan: "Scan Complete",
      folder_process: "Processing Complete",
    };
    const descriptions: Record<OperationType, string> = {
      plan_upload: "Plans have been created from the PDF",
      plan_reextract: "Plans have been re-extracted and renamed",
      folder_scan: "Folders have been scanned for new files",
      folder_process: "Files have been processed into plans",
    };
    toast({
      title: titles[operationType],
      description: descriptions[operationType],
    });
  };

  // Handle set on issue
  const handleSetOnIssue = async (plan: JobPlan) => {
    if (!plan.current_revision) {
      toast({
        title: "Error",
        description: "Plan has no revision to set on issue",
        variant: "destructive",
      });
      return;
    }

    const response = (await api.put(
      `/api/v1/jobs/${jobId}/job_plans/${plan.id}/set_on_issue`,
      { revision_id: plan.current_revision.id }
    )) as { success: boolean; error?: string };

    if (response.success) {
      toast({ title: "Success", description: "Plan marked as On Issue" });
      fetchPlans();
    } else {
      toast({
        title: "Error",
        description: response.error || "Failed to set on issue",
        variant: "destructive",
      });
      throw new Error(response.error);
    }
  };

  // Handle re-extract single plan from PDF (uses OcrTextExtractorService SSoT)
  const handleReprocess = async (plan: JobPlan) => {
    const fileId = plan.current_revision?.storage_item_id || plan.current_revision?.storage_file_id;
    if (!fileId) {
      toast({
        title: "Error",
        description: "Plan has no file to extract from",
        variant: "destructive",
      });
      return;
    }

    const response = await api.post(
      `/api/v1/jobs/${jobId}/job_plans/${plan.id}/reprocess`
    ) as { success: boolean; data?: { message: string }; error?: string };

    if (response.success) {
      toast({
        title: "Extraction Started",
        description: "Plan type will update shortly",
      });
      // Refresh after a delay to show results
      setTimeout(() => {
        fetchPlans();
      }, POLLING_DELAY_MS);
    } else {
      toast({
        title: "Error",
        description: response.error || "Failed to extract from PDF",
        variant: "destructive",
      });
    }
  };

  // Adjust revision letter for selected plan(s) - supports bulk update
  const handleSaveRevision = async () => {
    if (!revisionValue.trim()) return;

    // Determine which plans to update
    const plansToUpdate = selectedPlanIds.length > 0
      ? plans.filter(p => selectedPlanIds.includes(p.id) && p.current_revision)
      : selectedPlan?.current_revision ? [selectedPlan] : [];

    if (plansToUpdate.length === 0) return;

    setSavingRevision(true);
    try {
      const results = await Promise.allSettled(
        plansToUpdate.map(plan =>
          api.patch(
            `/api/v1/jobs/${jobId}/job_plans/${plan.id}/revisions/${plan.current_revision!.id}`,
            { revision: { revision: revisionValue.trim().toUpperCase(), notes: revisionNotes.trim() || null } }
          )
        )
      );

      const succeeded = results.filter(r => r.status === "fulfilled" && (r.value as { success: boolean }).success).length;
      const failed = plansToUpdate.length - succeeded;

      if (failed === 0) {
        toast({ title: "Success", description: `Revision updated to ${revisionValue.trim().toUpperCase()} on ${succeeded} plan${succeeded !== 1 ? "s" : ""}` });
      } else {
        toast({
          title: "Partial Update",
          description: `${succeeded} updated, ${failed} failed`,
          variant: "destructive",
        });
      }
      setShowRevisionDialog(false);
      fetchPlans();
    } catch (err) {
      console.error("Error updating revision:", err);
      toast({
        title: "Error",
        description: "Failed to update revision",
        variant: "destructive",
      });
    } finally {
      setSavingRevision(false);
    }
  };

  // Fetch revision history for a plan (used by DocumentListView expansion)
  const fetchPlanRevisions = useCallback(async (plan: JobPlan): Promise<RevisionHistoryItem[]> => {
    const response = (await api.get(
      `/api/v1/jobs/${jobId}/job_plans/${plan.id}/revisions`
    )) as { success: boolean; data?: Revision[] };

    if (!response.success || !response.data) return [];

    return response.data.map((rev) => ({
      id: rev.id,
      label: `Rev ${rev.revision}`,
      date: rev.revision_date || rev.issued_date || null,
      by: rev.issued_by?.name || null,
      notes: rev.notes || null,
      isCurrent: plan.current_revision?.id === rev.id,
      hasFile: rev.has_file,
    }));
  }, [jobId]);

  // Save new plan
  const handleSavePlan = async () => {
    if (!newPlanName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a plan name",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const planResponse = (await api.post(
        `/api/v1/jobs/${jobId}/job_plans`,
        {
          job_plan: {
            display_name: newPlanName.trim(),
          },
        }
      )) as { success: boolean; data?: JobPlan; error?: string };

      if (!planResponse.success) {
        throw new Error(planResponse.error || "Failed to create plan");
      }

      const newPlan = planResponse.data!;

      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop() || "pdf";
        const sanitizedName = newPlanName.trim().replace(/[^a-zA-Z0-9_\- ]/g, "");
        const renamedFileName = `${sanitizedName}.${fileExt}`;
        const renamedFile = new File([selectedFile], renamedFileName, {
          type: selectedFile.type,
        });

        // SSoT: Provider-agnostic upload (SharePoint direct or S3 multipart)
        const uploadResult = await uploadPhoto(renamedFile, {
          jobId,
          folderPath: "Plans", // Relative to job folder
          filename: renamedFileName,
        });

        if (uploadResult.success && uploadResult.itemId) {
          await api.post(
            `/api/v1/jobs/${jobId}/job_plans/${newPlan.id}/add_revision`,
            {
              storage_file_id: uploadResult.itemId,
              storage_web_url: uploadResult.webUrl,
              file_name: renamedFileName,
              file_size: selectedFile.size,
              revision_date: new Date().toISOString().split("T")[0],
            }
          );
        }
      }

      toast({
        title: "Success",
        description: "Plan created successfully",
      });

      setShowAddDialog(false);
      fetchPlans();
    } catch (err) {
      console.error("Error creating plan:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to create plan",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Main content (used in both fullscreen and normal mode)
  const mainContent = (
    <div
      className="relative h-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Upload className="h-16 w-16 mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium text-primary">
              Drop PDF here to add plans
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              AI will detect plan types from each page
            </p>
          </div>
        </div>
      )}

      {/* Plans toolbar - absolutely positioned over list area */}
      <div className="absolute top-0 left-0 w-[30%] px-3 py-2 z-10 bg-card border-b">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="whitespace-nowrap">
            All Plans ({plans.length})
          </Badge>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleRerunAi}>
                <Sparkles className="h-4 w-4 mr-2" />
                Re-extract All from PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                try {
                  const response = await api.post(`/api/v1/jobs/${jobId}/batch_operations`, {
                    operation_type: "folder_scan"
                  }) as { success: boolean; data?: { id: number }; error?: string };

                  if (response.success && response.data?.id) {
                    setOperationType("folder_scan");
                    setOperationId(response.data.id);
                    setShowProcessingModal(true);
                  } else {
                    toast({
                      title: "Error",
                      description: response.error || "Failed to start folder scan",
                      variant: "destructive",
                    });
                  }
                } catch (err) {
                  toast({
                    title: "Error",
                    description: "Failed to start folder scan",
                    variant: "destructive",
                  });
                }
              }}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Scan Folder for New Plans
              </DropdownMenuItem>
              {((selectedPlan?.current_revision?.storage_item_id || selectedPlan?.current_revision?.storage_file_id) || selectedPlanIds.length > 0) && (
                <DropdownMenuItem onClick={() => {
                  if (selectedPlanIds.length > 0) {
                    const selectedPlansData = plans.filter(p => selectedPlanIds.includes(p.id));
                    selectedPlansData.forEach(plan => {
                      const fileId = plan.current_revision?.storage_item_id || plan.current_revision?.storage_file_id;
                      if (fileId) {
                        window.open(`${getApiBaseUrl()}/api/v1/documents/download?file_id=${fileId}`, "_blank");
                      }
                    });
                  } else {
                    const fileId = selectedPlan?.current_revision?.storage_item_id || selectedPlan?.current_revision?.storage_file_id;
                    if (fileId) {
                      window.open(`${getApiBaseUrl()}/api/v1/documents/download?file_id=${fileId}`, "_blank");
                    }
                  }
                }}>
                  <Download className="h-4 w-4 mr-2" />
                  Download {selectedPlanIds.length > 1 ? `(${selectedPlanIds.length})` : "Selected"}
                </DropdownMenuItem>
              )}
              {(selectedPlanIds.length > 0 || selectedPlan?.current_revision) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    // Pre-fill from focused plan if single, blank if bulk
                    if (selectedPlanIds.length <= 1 && selectedPlan?.current_revision) {
                      setRevisionValue(selectedPlan.current_revision.revision || "");
                      setRevisionNotes(selectedPlan.current_revision.notes || "");
                    } else {
                      setRevisionValue("");
                      setRevisionNotes("");
                    }
                    setShowRevisionDialog(true);
                  }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Adjust Revision {selectedPlanIds.length > 1 ? `(${selectedPlanIds.length} plans)` : selectedPlan?.current_revision ? `(${selectedPlan.current_revision.revision_label})` : ""}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Plan button */}
          <Button size="sm" variant="outline" onClick={handleOpenAddDialog}>
            <Plus className="h-4 w-4 mr-1" />
            Add Plan
          </Button>

          {/* Email button - shows when any plan selected (checkbox or click) */}
          {(selectedPlan || selectedPlanIds.length > 0) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (selectedPlanIds.length === 0 && selectedPlan) {
                  setSelectedPlanIds([selectedPlan.id]);
                }
                setShowEmailModal(true);
              }}
            >
              <Mail className="h-4 w-4 mr-1" />
              Email {selectedPlanIds.length > 0 ? `(${selectedPlanIds.length})` : ""}
            </Button>
          )}
        </div>
      </div>

      {/* Action bar removed - plan name already shown in sidebar, actions available via right-click */}

      {/* DocumentListView - fills entire container */}
      <div className="absolute inset-0">
        <DocumentListView
          documents={plans}
          title=""
          getDocumentId={(p) => p.id}
          getDocumentName={(p) => p.display_name}
          getDocumentStatus={(p) =>
            p.current_revision?.is_on_issue ? "approved" : "draft"
          }
          getPreviewUrl={(p) => getPdfPreviewUrl(p.current_revision)}
          getExternalUrl={(p) => p.current_revision?.storage_web_url || null}
          getRevision={(p) => p.current_revision?.revision_label || null}
          getThumbnailUrl={(p) => getThumbnailUrl(p.current_revision)}
          fetchRevisions={fetchPlanRevisions}
          onRename={handleRename}
          onApprove={handleSetOnIssue}
          onReprocess={handleReprocess}
          onSelect={handlePlanSelect}
          onSelectionChange={setSelectedPlanIds}
          enableSelection
          statusLabels={{ draft: "Draft", approved: "On Issue" }}
          actionLabels={{ approve: "Set On Issue", openExternal: "Open in Storage" }}
          loading={loading}
          emptyMessage="Drop a PDF here or click Add Plan to get started"
          autoSelectFirst
          markupContextType="warehouse_document"
          // MASTERPIECE: Infinite scroll props
          onLoadMore={loadMorePlans}
          hasMore={hasMore}
          loadingMore={loadingMore}
        />
      </div>

      {/* Email Plans Modal */}
      <EmailPlansModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        jobId={jobId}
        jobTitle={jobTitle}
        selectedPlans={plans.filter((p) => selectedPlanIds.includes(p.id))}
        onSent={() => {
          setSelectedPlanIds([]);
        }}
      />

      {/* Unified Processing Progress Modal (all batch operations) */}
      <PlanProcessingModal
        jobId={jobId}
        operationType={operationType}
        operationId={operationId}
        open={showProcessingModal}
        onClose={() => setShowProcessingModal(false)}
        onComplete={handleProcessingComplete}
      />

      {/* Adjust Revision Dialog */}
      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader>
            <DialogTitle>Adjust Revision</DialogTitle>
            <DialogDescription>
              {selectedPlanIds.length > 1
                ? `Set the revision letter for ${selectedPlanIds.length} selected plans`
                : `Set the revision letter for ${selectedPlan?.display_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Revision Letter</Label>
              <Input
                value={revisionValue}
                onChange={(e) => setRevisionValue(e.target.value.toUpperCase())}
                placeholder="e.g., A, B, J"
                maxLength={5}
                className="mt-2 font-mono text-lg"
                autoFocus
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="e.g., Updated floor plan dimensions"
                className="mt-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && revisionValue.trim()) {
                    handleSaveRevision();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Describe what changed in this revision
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevisionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRevision}
              disabled={savingRevision || !revisionValue.trim()}
            >
              {savingRevision && <Spinner size={16} className="mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Plan Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Plan</DialogTitle>
            <DialogDescription>
              Add a new plan to this job. Enter a name and optionally upload a PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan Name *</Label>
              <Input
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="e.g., Floor Plan, Elevation, Site Plan"
              />
            </div>

            <div className="space-y-2">
              <Label>PDF File (optional)</Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="application/pdf"
                className="hidden"
              />
              {selectedFile ? (
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                  <FileText className="h-8 w-8 text-red-600 dark:text-red-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF files only
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePlan}
              disabled={saving || !newPlanName.trim()}
            >
              {saving && <Spinner size={16} className="mr-2" />}
              Add Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Plans always renders in fullscreen mode to maximize viewing area
  // z-[120] to be above breadcrumb (z-110) - breadcrumb hidden on fullscreen pages
  return (
    <div className="fixed inset-0 z-[120] bg-background flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-medium">{jobTitle}</span>
          <Badge variant="secondary">Plans</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/jobs/${jobId}/overview`)}
        >
          <X className="h-4 w-4 mr-1" />
          Close
        </Button>
      </div>

      {/* Main content - full remaining height */}
      <div className="flex-1 min-h-0">
        {mainContent}
      </div>
    </div>
  );
}
