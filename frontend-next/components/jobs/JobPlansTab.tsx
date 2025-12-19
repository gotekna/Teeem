"use client";

import { useState, useEffect, useCallback, useRef, DragEvent } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Mail,
  Loader2,
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, getApiBaseUrl } from "@/lib/api";
import { EmailPlansModal } from "@/components/plans/EmailPlansModal";
import { PlanProcessingModal, OperationType } from "@/components/jobs/PlanProcessingModal";
import { useToast } from "@/components/ui/use-toast";
import { TeeemDocumentView } from "@/components/ui/teeem-document-view";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

interface PlanTypeOption {
  id: number;
  code: string;
  name: string;
  display_name: string;
  category_ids: number[];
  short_name_template?: string;
  long_name_template?: string;
  effective_short_template: string;
  effective_long_template: string;
  short_name_preview?: string;
  long_name_preview?: string;
}

interface PlanType {
  id: number;
  code: string;
  name: string;
  category_name: string;
}

interface Revision {
  id: number;
  job_plan_id: number;
  revision: string;
  revision_label: string;
  revision_date: string | null;
  issued_date: string | null;
  is_on_issue: boolean;
  has_file: boolean;
  sharepoint_file_id: string | null;
  sharepoint_web_url: string | null;
  file_name: string | null;
  file_size: number | null;
  formatted_file_size: string | null;
  notes: string | null;
  issued_by: { id: number; name: string } | null;
  // Thumbnail for instant preview
  thumbnail_url: string | null;
  thumbnail_file_id: string | null;
}

interface JobPlan {
  id: number;
  job_id: number;
  job_plan_tab_id: number | null;
  plan_type_id: number | null;
  variant_suffix: string | null;
  display_name: string;
  plan_type: PlanType | null;
  current_revision: Revision | null;
  revision_count: number;
}

interface PlanTab {
  id: number;
  name: string;
  code: string | null;
  plan_category_id: number | null;
  plan_count: number;
  on_issue_count: number;
  children: PlanTab[];
}

interface JobPlansTabProps {
  jobId: number;
  jobCode: string;
  jobTitle: string;
}

export function JobPlansTab({ jobId, jobCode, jobTitle }: JobPlansTabProps) {
  // Declare this tab needs edge-to-edge layout
  useSetLayoutMode("edge-to-edge");

  const { toast } = useToast();
  const [plans, setPlans] = useState<JobPlan[]>([]);
  const [tabs, setTabs] = useState<PlanTab[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
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
  const [planTypes, setPlanTypes] = useState<PlanTypeOption[]>([]);
  const [loadingPlanTypes, setLoadingPlanTypes] = useState(false);
  const [selectedPlanTypeId, setSelectedPlanTypeId] = useState<string>("");
  const [selectedTabId, setSelectedTabId] = useState<string>("");
  const [variantSuffix, setVariantSuffix] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Unified processing modal state (all batch operations)
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>("plan_upload");
  const [operationId, setOperationId] = useState<number | null>(null);

  // Fetch plans
  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);

      const response = (await api.get(`/api/v1/jobs/${jobId}/job_plans`)) as {
        success: boolean;
        data?: JobPlan[];
        error?: string;
      };

      if (response.success) {
        setPlans(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching plans:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Fetch tabs (categories)
  const fetchTabs = useCallback(async () => {
    try {
      const response = (await api.get(
        `/api/v1/jobs/${jobId}/job_plans/tabs`
      )) as { success: boolean; data?: PlanTab[] };
      if (response.success) {
        setTabs(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching tabs:", err);
    }
  }, [jobId]);

  // Fetch plan types
  const fetchPlanTypes = useCallback(async () => {
    try {
      setLoadingPlanTypes(true);
      const response = (await api.get("/api/v1/plan_types")) as {
        success: boolean;
        data?: PlanTypeOption[];
      };
      if (response.success) {
        setPlanTypes(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching plan types:", err);
    } finally {
      setLoadingPlanTypes(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchTabs();
  }, [fetchPlans, fetchTabs]);

  // Auto-select the category with plans when data loads (if not already selected)
  useEffect(() => {
    if (plans.length > 0 && tabs.length > 0 && selectedCategoryId === null) {
      // Find categories that have plans
      const categoriesWithPlans = tabs.filter(tab =>
        plans.some(p => p.job_plan_tab_id === tab.id)
      );

      if (categoriesWithPlans.length > 0) {
        // Select the first category that has plans
        setSelectedCategoryId(categoriesWithPlans[0].id);
      }
    }
  }, [plans, tabs, selectedCategoryId]);

  // Filter plans based on selected category
  const filteredPlans = selectedCategoryId === null
    ? plans
    : plans.filter((p) => p.job_plan_tab_id === selectedCategoryId);

  // Get the currently selected tab
  const selectedTab = tabs.find(t => t.id === selectedCategoryId);

  // Get other tabs (not selected) that have plans
  const otherTabsWithPlans = tabs.filter(t =>
    t.id !== selectedCategoryId && plans.some(p => p.job_plan_tab_id === t.id)
  );

  // Get tabs without plans (for the dropdown)
  const emptyTabs = tabs.filter(t =>
    !plans.some(p => p.job_plan_tab_id === t.id)
  );

  // Get PDF preview URL
  const getPdfPreviewUrl = (revision: Revision | null) => {
    if (!revision?.sharepoint_file_id) return null;
    return `${getApiBaseUrl()}/api/v1/organization_onedrive/download?file_id=${revision.sharepoint_file_id}&preview=true`;
  };

  // Get thumbnail URL for instant preview (if available)
  const getThumbnailUrl = (revision: Revision | null) => {
    if (!revision?.thumbnail_file_id) return null;
    return `${getApiBaseUrl()}/api/v1/organization_onedrive/download?file_id=${revision.thumbnail_file_id}&preview=true`;
  };

  // Open Add Plan dialog
  const handleOpenAddDialog = () => {
    fetchPlanTypes();
    setSelectedPlanTypeId("");
    setSelectedTabId("");
    setVariantSuffix("");
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
      const formData = new FormData();
      formData.append("file", file);

      const result = await api.postFormData<{
        success: boolean;
        data?: { id: number };
        error?: string;
      }>(`/api/v1/jobs/${jobId}/plan_uploads`, formData, { timeout: 60000 });

      if (result.success && result.data?.id) {
        // Show progress modal
        setOperationType("plan_upload");
        setOperationId(result.data.id);
        setShowProcessingModal(true);
      } else {
        throw new Error(result.error || "Failed to start upload");
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

  // Resolve template placeholders with actual values
  const resolveTemplate = (
    template: string,
    values: Record<string, string>
  ) => {
    let result = template;
    Object.entries(values).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value || "");
    });
    return result.trim();
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
    fetchTabs();
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

  // Handle re-extract single plan from PDF (uses PdfTextExtractionService SSoT)
  const handleReprocess = async (plan: JobPlan) => {
    if (!plan.current_revision?.sharepoint_file_id) {
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
      }, 3000);
    } else {
      toast({
        title: "Error",
        description: response.error || "Failed to extract from PDF",
        variant: "destructive",
      });
    }
  };

  // Save new plan
  const handleSavePlan = async () => {
    if (!selectedPlanTypeId) {
      toast({
        title: "Error",
        description: "Please select a plan type",
        variant: "destructive",
      });
      return;
    }

    const selectedPlanType = planTypes.find(
      (pt) => pt.id === parseInt(selectedPlanTypeId)
    );
    if (!selectedPlanType) {
      toast({
        title: "Error",
        description: "Invalid plan type selected",
        variant: "destructive",
      });
      return;
    }

    const selectedTab = selectedTabId
      ? tabs.find((t) => t.id === parseInt(selectedTabId))
      : null;

    const templateValues: Record<string, string> = {
      JobCode: jobCode,
      JobName: jobTitle,
      Code: selectedPlanType.code,
      Name: selectedPlanType.name,
      Variant: variantSuffix || "",
      Rev: "A",
      Date: new Date().toISOString().split("T")[0].replace(/-/g, ""),
      Category: selectedTab?.name || "",
      CategoryCode: selectedTab?.code || "",
    };

    const shortTemplate = selectedPlanType.effective_short_template;
    const longTemplate = selectedPlanType.effective_long_template;

    const shortName = resolveTemplate(shortTemplate, templateValues);
    const longName = resolveTemplate(longTemplate, templateValues);

    setSaving(true);
    try {
      const planResponse = (await api.post(
        `/api/v1/jobs/${jobId}/job_plans`,
        {
          job_plan: {
            plan_type_id: parseInt(selectedPlanTypeId),
            job_plan_tab_id: selectedTabId ? parseInt(selectedTabId) : null,
            variant_suffix: variantSuffix || null,
            display_name: longName,
          },
        }
      )) as { success: boolean; data?: JobPlan; error?: string };

      if (!planResponse.success) {
        throw new Error(planResponse.error || "Failed to create plan");
      }

      const newPlan = planResponse.data!;

      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop() || "pdf";
        const renamedFileName = `${shortName}.${fileExt}`;
        const renamedFile = new File([selectedFile], renamedFileName, {
          type: selectedFile.type,
        });

        const formData = new FormData();
        formData.append("file", renamedFile);
        formData.append("folder_path", `Jobs/${jobCode}/Plans`);

        const uploadResponse = await fetch(
          `${getApiBaseUrl()}/api/v1/organization_sharepoint/upload`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          }
        );

        const uploadResult = await uploadResponse.json();

        if (uploadResult.success && uploadResult.data) {
          await api.post(
            `/api/v1/jobs/${jobId}/job_plans/${newPlan.id}/add_revision`,
            {
              sharepoint_file_id: uploadResult.data.id,
              sharepoint_web_url: uploadResult.data.webUrl,
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
      fetchTabs();
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

  const filteredPlanTypes = selectedTabId
    ? (() => {
        const tab = tabs.find((t) => t.id === parseInt(selectedTabId));
        if (tab?.plan_category_id) {
          return planTypes.filter((pt) =>
            pt.category_ids?.includes(tab.plan_category_id!)
          );
        }
        return planTypes;
      })()
    : planTypes;

  return (
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

      {/* Category filter + Add Plan button - absolutely positioned over list area */}
      <div className="absolute top-0 left-0 w-[30%] px-3 py-2 z-10 bg-card border-b">
        <div className="flex items-center gap-2">
          {/* Selected category badge */}
          {selectedTab && (
            <Badge variant="default" className="whitespace-nowrap">
              {selectedTab.name} ({filteredPlans.length})
            </Badge>
          )}

          {/* Show "All" if no category selected or no plans */}
          {!selectedTab && (
            <Badge variant="default" className="whitespace-nowrap">
              All Plans ({plans.length})
            </Badge>
          )}

          {/* Dropdown for other categories */}
          {tabs.length > 0 && (otherTabsWithPlans.length > 0 || emptyTabs.length > 0) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {/* Show All option */}
                <DropdownMenuItem onClick={() => setSelectedCategoryId(null)}>
                  All Plans ({plans.length})
                </DropdownMenuItem>

                {/* Other categories with plans */}
                {otherTabsWithPlans.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {otherTabsWithPlans.map(tab => {
                      const count = plans.filter(p => p.job_plan_tab_id === tab.id).length;
                      return (
                        <DropdownMenuItem
                          key={tab.id}
                          onClick={() => setSelectedCategoryId(tab.id)}
                        >
                          {tab.name} ({count})
                        </DropdownMenuItem>
                      );
                    })}
                  </>
                )}

                {/* Empty categories (no plans yet) */}
                {emptyTabs.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No plans yet
                    </div>
                    {emptyTabs.map(tab => (
                      <DropdownMenuItem
                        key={tab.id}
                        onClick={() => setSelectedCategoryId(tab.id)}
                        className="text-muted-foreground"
                      >
                        {tab.name} (0)
                      </DropdownMenuItem>
                    ))}
                  </>
                )}

                {/* Actions */}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleRerunAi}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Re-extract All from PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  // Scan SharePoint folder for new plans
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
                <DropdownMenuItem onClick={() => {
                  // Open SharePoint folder for this job's plans
                  window.open(`https://teeemptyltd.sharepoint.com/sites/TEEEM/Shared%20Documents/TEEEM%20Jobs/${jobCode}/Plans`, "_blank");
                }}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open SharePoint Folder
                </DropdownMenuItem>
                {(selectedPlan?.current_revision?.sharepoint_file_id || selectedPlanIds.length > 0) && (
                  <DropdownMenuItem onClick={() => {
                    // Download selected plans' PDFs
                    if (selectedPlanIds.length > 0) {
                      // Download all checkbox-selected plans
                      const selectedPlansData = plans.filter(p => selectedPlanIds.includes(p.id));
                      selectedPlansData.forEach(plan => {
                        if (plan.current_revision?.sharepoint_file_id) {
                          window.open(`${getApiBaseUrl()}/api/v1/organization_onedrive/download?file_id=${plan.current_revision.sharepoint_file_id}`, "_blank");
                        }
                      });
                    } else if (selectedPlan?.current_revision?.sharepoint_file_id) {
                      // Download single-selected plan
                      window.open(`${getApiBaseUrl()}/api/v1/organization_onedrive/download?file_id=${selectedPlan.current_revision.sharepoint_file_id}`, "_blank");
                    }
                  }}>
                    <Download className="h-4 w-4 mr-2" />
                    Download {selectedPlanIds.length > 1 ? `(${selectedPlanIds.length})` : "Selected"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Add Plan button - next to category */}
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
                // Use checkbox selection if available, otherwise use single selection
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

      {/* Action bar for selected plan - top right over preview */}
      {selectedPlan && (
        <div className="absolute top-0 left-[30%] right-0 px-3 py-2 z-10 bg-card border-b flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground mr-auto truncate">
            {selectedPlan.display_name}
          </span>
          {!selectedPlan.current_revision?.is_on_issue && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                setApproveLoading(true);
                try {
                  await handleSetOnIssue(selectedPlan);
                } finally {
                  setApproveLoading(false);
                }
              }}
              disabled={approveLoading}
            >
              {approveLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Set On Issue
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                const newName = prompt("Enter new name:", selectedPlan.display_name);
                if (newName && newName !== selectedPlan.display_name) {
                  handleRename(selectedPlan, newName);
                }
              }}>
                <Pencil className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleReprocess(selectedPlan)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Re-extract from PDF
              </DropdownMenuItem>
              {selectedPlan.current_revision?.sharepoint_web_url && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => window.open(selectedPlan.current_revision?.sharepoint_web_url || "", "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in SharePoint
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* TeeemDocumentView - fills entire container */}
      <div className="absolute inset-0">
        <TeeemDocumentView
          documents={filteredPlans}
          title=""
          getDocumentId={(p) => p.id}
          getDocumentName={(p) => p.display_name}
          getDocumentStatus={(p) =>
            p.current_revision?.is_on_issue ? "approved" : "draft"
          }
          getPreviewUrl={(p) => getPdfPreviewUrl(p.current_revision)}
          getExternalUrl={(p) => p.current_revision?.sharepoint_web_url || null}
          getRevision={(p) => p.current_revision?.revision_label || null}
          getThumbnailUrl={(p) => getThumbnailUrl(p.current_revision)}
          onRename={handleRename}
          onApprove={handleSetOnIssue}
          onReprocess={handleReprocess}
          onSelect={handlePlanSelect}
          onSelectionChange={setSelectedPlanIds}
          enableSelection
          bulkActions={(ids, clearSelection) => (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedPlanIds(ids);
                setShowEmailModal(true);
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Email ({ids.length})
            </Button>
          )}
          statusLabels={{ draft: "Draft", approved: "On Issue" }}
          actionLabels={{ approve: "Set On Issue", openExternal: "Open in SharePoint" }}
          loading={loading}
          emptyMessage="Drop a PDF here or click Add Plan to get started"
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

      {/* Add Plan Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Plan</DialogTitle>
            <DialogDescription>
              Add a new plan to this job. Select a plan type and optionally
              upload a PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={selectedTabId} onValueChange={setSelectedTabId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {tabs.map((tab) => (
                    <SelectItem key={tab.id} value={tab.id.toString()}>
                      {tab.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plan Type *</Label>
              <Select
                value={selectedPlanTypeId}
                onValueChange={setSelectedPlanTypeId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingPlanTypes ? "Loading..." : "Select a plan type"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredPlanTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id.toString()}>
                      {pt.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Variant (optional)</Label>
              <Input
                value={variantSuffix}
                onChange={(e) => setVariantSuffix(e.target.value)}
                placeholder="e.g., a, b, c"
                maxLength={5}
              />
              <p className="text-xs text-muted-foreground">
                Use for multiple versions like 01a-PERSPECTIVE, 01b-PERSPECTIVE
              </p>
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
                  <FileText className="h-8 w-8 text-red-600" />
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

            {selectedPlanTypeId &&
              (() => {
                const pt = planTypes.find(
                  (p) => p.id === parseInt(selectedPlanTypeId)
                );
                const tab = selectedTabId
                  ? tabs.find((t) => t.id === parseInt(selectedTabId))
                  : null;
                if (!pt) return null;

                const values: Record<string, string> = {
                  JobCode: jobCode,
                  JobName: jobTitle,
                  Code: pt.code,
                  Name: pt.name,
                  Variant: variantSuffix || "",
                  Rev: "A",
                  Date: new Date()
                    .toISOString()
                    .split("T")[0]
                    .replace(/-/g, ""),
                  Category: tab?.name || "",
                  CategoryCode: tab?.code || "",
                };

                const shortName = resolveTemplate(
                  pt.effective_short_template,
                  values
                );
                const longName = resolveTemplate(
                  pt.effective_long_template,
                  values
                );

                return (
                  <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground">
                      Preview
                    </p>
                    <div className="space-y-1">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Filename:</span>{" "}
                        <span className="font-mono">{shortName}.pdf</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Display:</span>{" "}
                        <span className="font-medium">{longName}</span>
                      </p>
                    </div>
                  </div>
                );
              })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePlan}
              disabled={saving || !selectedPlanTypeId}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
