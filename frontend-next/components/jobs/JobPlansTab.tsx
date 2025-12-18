"use client";

import { useState, useEffect, useCallback, useRef, DragEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { PDFViewer } from "@/components/ui/pdf-viewer";
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
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle,
  Plus,
  Eye,
  Upload,
  X,
} from "lucide-react";
import { api, getApiBaseUrl } from "@/lib/api";
import { EmailPlansModal } from "@/components/plans/EmailPlansModal";
import { useToast } from "@/components/ui/use-toast";

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
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState("on-issue");
  const [plans, setPlans] = useState<JobPlan[]>([]);
  const [tabs, setTabs] = useState<PlanTab[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<JobPlan | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

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
  const [processingPlanSet, setProcessingPlanSet] = useState(false);
  const [processingProgress, setProcessingProgress] = useState("");

  // Fetch plans
  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = activeSubTab === "on-issue"
        ? `/api/v1/jobs/${jobId}/job_plans/on_issue`
        : `/api/v1/jobs/${jobId}/job_plans`;

      const response = await api.get(endpoint) as { success: boolean; data?: JobPlan[]; error?: string };

      if (response.success) {
        setPlans(response.data || []);
      } else {
        setError(response.error || "Failed to load plans");
      }
    } catch (err) {
      setError("Failed to load plans");
      console.error("Error fetching plans:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId, activeSubTab]);

  // Fetch tabs (categories)
  const fetchTabs = useCallback(async () => {
    try {
      const response = await api.get(`/api/v1/jobs/${jobId}/job_plans/tabs`) as { success: boolean; data?: PlanTab[] };
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
      const response = await api.get("/api/v1/plan_types") as { success: boolean; data?: PlanTypeOption[] };
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

  // Toggle plan selection
  const togglePlanSelection = (planId: number) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId]
    );
  };

  // Select all plans
  const selectAllPlans = () => {
    if (selectedPlanIds.length === plans.length) {
      setSelectedPlanIds([]);
    } else {
      setSelectedPlanIds(plans.map((p) => p.id));
    }
  };

  // Get PDF preview URL
  const getPdfPreviewUrl = (revision: Revision | null) => {
    if (!revision?.sharepoint_file_id) return null;
    return `${getApiBaseUrl()}/api/v1/organization_onedrive/download?file_id=${revision.sharepoint_file_id}&preview=true`;
  };

  // Open Add Plan dialog
  const handleOpenAddDialog = (file?: File) => {
    fetchPlanTypes();
    setSelectedPlanTypeId("");
    setSelectedTabId("");
    setVariantSuffix("");
    setSelectedFile(file || null);
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

    setProcessingPlanSet(true);
    setProcessingProgress("Uploading plan set...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setProcessingProgress("Splitting PDF and analyzing with AI...");

      const response = await fetch(`${getApiBaseUrl()}/api/v1/jobs/${jobId}/job_plans/upload_plan_set`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Plans Added",
          description: `Created ${result.data.plans.length} plans from ${result.data.total_pages} pages`,
        });
        fetchPlans();
        fetchTabs();
      } else {
        throw new Error(result.error || "Failed to process plan set");
      }
    } catch (err) {
      console.error("Error processing plan set:", err);
      toast({
        title: "Processing Failed",
        description: err instanceof Error ? err.message : "Failed to process plan set",
        variant: "destructive",
      });
    } finally {
      setProcessingPlanSet(false);
      setProcessingProgress("");
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
  const resolveTemplate = (template: string, values: Record<string, string>) => {
    let result = template;
    Object.entries(values).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value || "");
    });
    return result.trim();
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

    const selectedPlanType = planTypes.find(pt => pt.id === parseInt(selectedPlanTypeId));
    if (!selectedPlanType) {
      toast({
        title: "Error",
        description: "Invalid plan type selected",
        variant: "destructive",
      });
      return;
    }

    // Get the selected category for template resolution
    const selectedTab = selectedTabId ? tabs.find(t => t.id === parseInt(selectedTabId)) : null;

    // Template values for resolution
    const templateValues: Record<string, string> = {
      JobCode: jobCode,
      JobName: jobTitle,
      Code: selectedPlanType.code,
      Name: selectedPlanType.name,
      Variant: variantSuffix || "",
      Rev: "A", // First revision
      Date: new Date().toISOString().split("T")[0].replace(/-/g, ""),
      Category: selectedTab?.name || "",
      CategoryCode: selectedTab?.code || "",
    };

    // Resolve short name (for file) and long name (for display)
    // Use effective templates (includes global defaults from SystemSettings)
    const shortTemplate = selectedPlanType.effective_short_template;
    const longTemplate = selectedPlanType.effective_long_template;

    const shortName = resolveTemplate(shortTemplate, templateValues);
    const longName = resolveTemplate(longTemplate, templateValues);

    setSaving(true);
    try {
      // Step 1: Create the job plan with the long name as display_name
      const planResponse = await api.post(`/api/v1/jobs/${jobId}/job_plans`, {
        job_plan: {
          plan_type_id: parseInt(selectedPlanTypeId),
          job_plan_tab_id: selectedTabId ? parseInt(selectedTabId) : null,
          variant_suffix: variantSuffix || null,
          display_name: longName, // Long name = display in UI
        },
      }) as { success: boolean; data?: JobPlan; error?: string };

      if (!planResponse.success) {
        throw new Error(planResponse.error || "Failed to create plan");
      }

      const newPlan = planResponse.data!;

      // Step 2: If a file is selected, upload to SharePoint with renamed file
      if (selectedFile) {
        // Get file extension from original file
        const fileExt = selectedFile.name.split(".").pop() || "pdf";
        const renamedFileName = `${shortName}.${fileExt}`; // Short name = file name

        // Create renamed file blob
        const renamedFile = new File([selectedFile], renamedFileName, { type: selectedFile.type });

        // Upload file to SharePoint
        const formData = new FormData();
        formData.append("file", renamedFile);
        formData.append("folder_path", `Jobs/${jobCode}/Plans`);

        const uploadResponse = await fetch(`${getApiBaseUrl()}/api/v1/organization_sharepoint/upload`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const uploadResult = await uploadResponse.json();

        if (uploadResult.success && uploadResult.data) {
          // Add revision with file info
          await api.post(`/api/v1/jobs/${jobId}/job_plans/${newPlan.id}/add_revision`, {
            sharepoint_file_id: uploadResult.data.id,
            sharepoint_web_url: uploadResult.data.webUrl,
            file_name: renamedFileName,
            file_size: selectedFile.size,
            revision_date: new Date().toISOString().split("T")[0],
          });
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
        description: err instanceof Error ? err.message : "Failed to create plan",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Get plan types filtered by selected tab's category
  const filteredPlanTypes = selectedTabId
    ? (() => {
        const tab = tabs.find(t => t.id === parseInt(selectedTabId));
        if (tab?.plan_category_id) {
          return planTypes.filter(pt => pt.category_ids?.includes(tab.plan_category_id!));
        }
        return planTypes;
      })()
    : planTypes;

  // Render plans table
  const renderPlansTable = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="mb-4">{error}</p>
          <Button variant="outline" onClick={fetchPlans}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    if (plans.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-16 w-16 mb-4 opacity-50" />
          <p className="text-lg mb-2">No plans found</p>
          <p className="text-sm mb-4">
            {activeSubTab === "on-issue"
              ? "No plans are currently on issue"
              : "Drop a PDF here or click Add Plan to get started"}
          </p>
          <Button onClick={() => handleOpenAddDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Plan
          </Button>
        </div>
      );
    }

    return (
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 px-3 py-3">
                <Checkbox
                  checked={selectedPlanIds.length === plans.length && plans.length > 0}
                  onCheckedChange={selectAllPlans}
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">Sheet</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Revision</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr
                key={plan.id}
                className={`border-t hover:bg-muted/30 cursor-pointer ${
                  selectedPlan?.id === plan.id ? "bg-muted/50" : ""
                }`}
                onClick={() => setSelectedPlan(plan)}
              >
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedPlanIds.includes(plan.id)}
                    onCheckedChange={() => togglePlanSelection(plan.id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{plan.display_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {plan.plan_type?.category_name || "-"}
                </td>
                <td className="px-4 py-3">
                  {plan.current_revision ? (
                    <Badge variant="outline">
                      {plan.current_revision.revision_label}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {plan.current_revision?.revision_date || "-"}
                </td>
                <td className="px-4 py-3">
                  {plan.current_revision?.is_on_issue ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      On Issue
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Draft</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {plan.current_revision?.sharepoint_web_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(plan.current_revision!.sharepoint_web_url!, "_blank");
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlan(plan);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render preview panel
  const renderPreviewPanel = () => {
    if (!selectedPlan) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
          <FileText className="h-16 w-16 mb-4 opacity-50" />
          <p>Select a plan to preview</p>
        </div>
      );
    }

    const previewUrl = getPdfPreviewUrl(selectedPlan.current_revision);

    if (!previewUrl) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
          <FileText className="h-16 w-16 mb-4 opacity-50" />
          <p className="mb-2">{selectedPlan.display_name}</p>
          <p className="text-sm">No file attached</p>
          {selectedPlan.current_revision?.sharepoint_web_url && (
            <Button
              className="mt-4"
              onClick={() => window.open(selectedPlan.current_revision!.sharepoint_web_url!, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in SharePoint
            </Button>
          )}
        </div>
      );
    }

    return (
      <PDFViewer
        url={previewUrl}
        fallbackUrl={selectedPlan.current_revision?.sharepoint_web_url || undefined}
        className="h-full"
      />
    );
  };

  return (
    <div
      className="flex flex-col h-full -mx-4 relative"
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
            <p className="text-lg font-medium text-primary">Drop PDF here to add plans</p>
            <p className="text-sm text-muted-foreground mt-2">AI will detect plan types from each page</p>
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {processingPlanSet && (
        <div className="absolute inset-0 z-50 bg-background/80 flex items-center justify-center">
          <div className="text-center p-6 bg-card border rounded-lg shadow-lg">
            <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
            <p className="text-lg font-medium">{processingProgress}</p>
            <p className="text-sm text-muted-foreground mt-2">
              This may take a minute for large plan sets
            </p>
          </div>
        </div>
      )}

      {/* Header with actions */}
      <div className="px-4 pb-4 flex items-center justify-between shrink-0">
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-auto">
          <TabsList>
            <TabsTrigger value="on-issue">On Issue</TabsTrigger>
            <TabsTrigger value="all">All Plans</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {selectedPlanIds.length > 0 && (
            <Button variant="outline" onClick={() => setShowEmailModal(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Email ({selectedPlanIds.length})
            </Button>
          )}
          <Button variant="outline" onClick={fetchPlans}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => handleOpenAddDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Plan
          </Button>
        </div>
      </div>

      {/* Category tabs */}
      {tabs.length > 0 && (
        <div className="px-4 pb-4 shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Badge variant="outline" className="cursor-pointer whitespace-nowrap">
              All ({plans.length})
            </Badge>
            {tabs.map((tab) => (
              <Badge
                key={tab.id}
                variant="outline"
                className="cursor-pointer whitespace-nowrap"
              >
                {tab.name} ({tab.on_issue_count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Main content: table + preview */}
      <div className="flex-1 flex gap-4 px-4 min-h-0">
        {/* Plans table */}
        <div className="flex-1 overflow-auto">
          {renderPlansTable()}
        </div>

        {/* Preview panel */}
        <Card className="w-[400px] shrink-0 flex flex-col">
          <CardHeader className="py-3 shrink-0">
            <CardTitle className="text-sm font-medium">Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {renderPreviewPanel()}
          </CardContent>
        </Card>
      </div>

      {/* Email Plans Modal */}
      <EmailPlansModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        jobId={jobId}
        jobTitle={jobTitle}
        selectedPlans={plans.filter(p => selectedPlanIds.includes(p.id))}
        onSent={() => {
          setSelectedPlanIds([]);
        }}
      />

      {/* Add Plan Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Plan</DialogTitle>
            <DialogDescription>
              Add a new plan to this job. Select a plan type and optionally upload a PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Category/Tab Selection */}
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

            {/* Plan Type Selection */}
            <div className="space-y-2">
              <Label>Plan Type *</Label>
              <Select value={selectedPlanTypeId} onValueChange={setSelectedPlanTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingPlanTypes ? "Loading..." : "Select a plan type"} />
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

            {/* Variant Suffix */}
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

            {/* File Upload */}
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

            {/* Name Preview */}
            {selectedPlanTypeId && (() => {
              const pt = planTypes.find(p => p.id === parseInt(selectedPlanTypeId));
              const tab = selectedTabId ? tabs.find(t => t.id === parseInt(selectedTabId)) : null;
              if (!pt) return null;

              const values: Record<string, string> = {
                JobCode: jobCode,
                JobName: jobTitle,
                Code: pt.code,
                Name: pt.name,
                Variant: variantSuffix || "",
                Rev: "A",
                Date: new Date().toISOString().split("T")[0].replace(/-/g, ""),
                Category: tab?.name || "",
                CategoryCode: tab?.code || "",
              };

              const shortName = resolveTemplate(pt.effective_short_template, values);
              const longName = resolveTemplate(pt.effective_long_template, values);

              return (
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground">Preview</p>
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
            <Button onClick={handleSavePlan} disabled={saving || !selectedPlanTypeId}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
