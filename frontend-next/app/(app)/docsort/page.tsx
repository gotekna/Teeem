"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CloudArrowUpIcon,
  DocumentIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  FunnelIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  DocumentChartBarIcon,
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import ClassificationPanel from "@/components/documents/ClassificationPanel";
import type { ClassificationData, ClassificationDocumentType, ClassificationCompany, ClassificationDocument } from "@/lib/types/classification-types";

// Types
interface ClassificationSuggestion {
  name: string;
  confidence: number;
  match_type: string;
  matched_term: string | null;
}

interface MethodResult {
  document_type: string | null;
  confidence: number;
  method: string;
  status: "completed" | "not_applicable" | "disabled" | "error";
  signals: string[];
  matched_document_type?: string;
  suggestions?: ClassificationSuggestion[];
  text_preview?: string;
  reason?: string;
  duration_ms?: number;
}

interface ClassificationResult {
  document_type: string | null;
  confidence: number;
  method: string;
  signals: string[];
  matched_document_type?: string;
  suggestions?: ClassificationSuggestion[];
  classified_at: string;
  // New 3-method fields
  winner?: string;
  methods?: {
    name_match: MethodResult;
    content_match: MethodResult;
    ai_match: MethodResult;
  };
}

interface DocumentInboxItem {
  id: number;
  source: string;
  status: string;
  document_type: string | null;
  document_type_label: string;
  classification_confidence: number | null;
  confidence_percent: number | null;
  confidence_color: string;
  original_filename: string | null;
  content_type: string | null;
  file_size: number | null;
  from_email: string | null;
  subject: string | null;
  user_override: boolean;
  routed_to_type: string | null;
  routed_to_id: number | null;
  routed_at: string | null;
  error_message: string | null;
  status_color: string;
  source_icon: string;
  display_name: string;
  can_auto_route: boolean;
  classification_result: ClassificationResult | null;
  created_at: string;
  updated_at: string;
}

interface DocsortStats {
  total: number;
  active: number;
  by_status: Record<string, number>;
  by_document_type: Record<string, number>;
  by_source: Record<string, number>;
  by_confidence: {
    high: number;
    medium: number;
    low: number;
    unclassified: number;
  };
  needs_review: number;
  today_count: number;
}

// Document type icons
const DOCUMENT_TYPE_ICONS: Record<string, typeof DocumentIcon> = {
  invoice: CurrencyDollarIcon,
  plan: DocumentChartBarIcon,
  quote: DocumentTextIcon,
  contract: ClipboardDocumentListIcon,
  purchase_order: DocumentTextIcon,
  work_order: DocumentTextIcon,
  certificate: DocumentTextIcon,
  compliance: DocumentTextIcon,
  correspondence: EnvelopeIcon,
  email: EnvelopeIcon,
  general: DocumentIcon,
};

// Confidence badge colors
const CONFIDENCE_COLORS: Record<string, string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
};

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// Display names for the 3 classification methods
const METHOD_DISPLAY_NAMES: Record<string, string> = {
  name_match: "Name Match",
  content_match: "Content Match (OCR)",
  ai_match: "AI Match",
};

// Status labels for method results
const METHOD_STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  not_applicable: "N/A",
  disabled: "Disabled",
  error: "Error",
};

// Fallback document type options (used while DB types load)
const FALLBACK_DOCUMENT_TYPES = [
  { value: "general", label: "General" },
];

export default function DocsortPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [items, setItems] = useState<DocumentInboxItem[]>([]);
  const [stats, setStats] = useState<DocsortStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DocumentInboxItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Classification panel state
  const [classificationData, setClassificationData] = useState<ClassificationData | null>(null);
  const [classificationLoading, setClassificationLoading] = useState(false);
  const [panelDocTypes, setPanelDocTypes] = useState<ClassificationDocumentType[]>([]);
  const [panelCompanies, setPanelCompanies] = useState<ClassificationCompany[]>([]);
  const [reclassifyingAll, setReclassifyingAll] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<{ value: string; label: string; id?: number; folderPath?: string; targetFolder?: string; uiName?: string; downloadName?: string }[]>(FALLBACK_DOCUMENT_TYPES);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load document types from database
  const loadDocumentTypes = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: Array<{ id: number; name: string; primary_folder_path?: string; target_folder?: string; uiName?: string; downloadName?: string }> }>(
        "/api/v1/document_types"
      );
      if (response?.data) {
        const types = response.data.map((dt) => ({
          // Match Rails .parameterize(separator: '_')
          value: dt.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
          label: dt.name,
          id: dt.id,
          folderPath: dt.primary_folder_path,
          targetFolder: dt.target_folder,
          uiName: dt.uiName,
          downloadName: dt.downloadName,
        }));
        // Add "General" at the end if not already present
        if (!types.find((t) => t.value === "general")) {
          types.push({ value: "general", label: "General", id: 0, folderPath: undefined, targetFolder: undefined, uiName: undefined, downloadName: undefined });
        }
        setDocumentTypes(types);
      }
    } catch (error) {
      console.error("Failed to load document types:", error);
    }
  }, []);

  // Load document types on mount
  useEffect(() => {
    loadDocumentTypes();
  }, [loadDocumentTypes]);

  // Load ClassificationPanel-compatible doc types
  useEffect(() => {
    const fetchPanelDocTypes = async () => {
      try {
        const response = await api.get<{ success: boolean; data: ClassificationDocumentType[] }>("/api/v1/document_types");
        if (response?.success && response.data) setPanelDocTypes(response.data);
      } catch { /* non-critical */ }
    };
    fetchPanelDocTypes();
  }, []);

  // Load ClassificationPanel-compatible companies
  useEffect(() => {
    const fetchPanelCompanies = async () => {
      try {
        const response = await api.get<{ success: boolean; companies: ClassificationCompany[] }>("/api/v1/companies?include_unlinked=true");
        if (response?.companies) setPanelCompanies(response.companies);
      } catch { /* non-critical */ }
    };
    fetchPanelCompanies();
  }, []);

  // Fetch classification data when selected item changes
  useEffect(() => {
    const fetchClassification = async () => {
      if (!selectedItem || !panelOpen) {
        setClassificationData(null);
        return;
      }
      setClassificationLoading(true);
      try {
        const response = await api.get<ClassificationData>(
          `/api/v1/document_inboxes/${selectedItem.id}/classification`
        );
        if (response?.success) setClassificationData(response);
      } catch {
        setClassificationData(null);
      } finally {
        setClassificationLoading(false);
      }
    };
    fetchClassification();
  }, [selectedItem?.id, panelOpen]);

  // Normalize DocumentInboxItem → ClassificationDocument
  const normalizeDocInboxItem = useCallback((item: DocumentInboxItem): ClassificationDocument => {
    return {
      id: item.id,
      document_type: item.document_type || undefined,
      display_name: item.display_name,
      file_name: item.original_filename || undefined,
      source: item.source,
    };
  }, []);

  // Load items and stats
  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter === "active") {
        params.set("active", "true");
      } else if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (typeFilter && typeFilter !== "all") params.set("document_type", typeFilter);
      if (searchQuery) params.set("search", searchQuery);

      const [itemsResponse, statsResponse] = await Promise.all([
        api.get<{ items: DocumentInboxItem[]; meta: any }>(`/api/v1/document_inboxes?${params}`),
        api.get<DocsortStats>("/api/v1/document_inboxes/stats"),
      ]);

      setItems(itemsResponse?.items || []);
      setStats(statsResponse || null);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: "Failed to load data",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, searchQuery, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await uploadFiles(files);
    }
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await uploadFiles(files);
    }
    // Reset input
    e.target.value = "";
  };

  // Upload files
  const uploadFiles = async (files: File[]) => {
    setUploading(true);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files[]", file));

      const token = getStorageItem<string>(STORAGE_KEYS.TOKEN, "");
      const response = await fetch(`${getApiBaseUrl()}/api/v1/document_inboxes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.items?.length > 0) {
        toast({
          title: "Files uploaded",
          description: `${data.items.length} file(s) uploaded and queued for classification`,
        });
        loadData(); // Refresh list
      } else if (data.errors?.length > 0) {
        toast({
          title: "Upload failed",
          description: data.errors.map((e: any) => e.error).join(", "),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Actions
  const handleClassify = async (item: DocumentInboxItem) => {
    setProcessingId(item.id);
    try {
      const response = await api.post<{ success: boolean; item: DocumentInboxItem }>(
        `/api/v1/document_inboxes/${item.id}/classify`
      );
      toast({ title: "Re-classified successfully" });
      // Update the selected item with fresh data if it's the one we just classified
      if (response?.item && selectedItem?.id === item.id) {
        setSelectedItem(response.item);
      }
      loadData();
    } catch (error) {
      toast({
        title: "Classification failed",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReclassifyAll = async () => {
    const classifiableItems = items.filter((item) => item.status !== "completed");
    if (classifiableItems.length === 0) {
      toast({ title: "No items to re-classify", description: "All items are already completed" });
      return;
    }

    setReclassifyingAll(true);
    let success = 0;
    let failed = 0;

    for (const item of classifiableItems) {
      try {
        await api.post(`/api/v1/document_inboxes/${item.id}/classify`);
        success++;
      } catch {
        failed++;
      }
    }

    toast({
      title: "Re-classification complete",
      description: `${success} classified${failed > 0 ? `, ${failed} failed` : ""}`,
    });
    loadData();
    setReclassifyingAll(false);
  };

  const handleRoute = async (item: DocumentInboxItem, jobId?: number, corporateId?: string) => {
    setProcessingId(item.id);
    try {
      const params: any = {};
      if (jobId) params.job_id = jobId;
      if (corporateId) params.corporate_id = corporateId;

      const response = await api.post<{ success: boolean; routing: any }>(
        `/api/v1/document_inboxes/${item.id}/route`,
        params
      );

      if (response?.success) {
        toast({
          title: "Document routed",
          description: response.routing?.message || "Successfully routed",
        });
        loadData();
        setPanelOpen(false);
        setSelectedItem(null);
      } else {
        toast({
          title: "Routing requires action",
          description: response?.routing?.error || "Manual intervention needed",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Routing failed",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleOverride = async (item: DocumentInboxItem, newType: string) => {
    setProcessingId(item.id);
    try {
      await api.patch(`/api/v1/document_inboxes/${item.id}/override`, {
        document_type: newType,
        auto_route: false,
      });
      toast({ title: "Classification updated" });
      loadData();
    } catch (error) {
      toast({
        title: "Override failed",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (item: DocumentInboxItem) => {
    setProcessingId(item.id);
    try {
      await api.delete(`/api/v1/document_inboxes/${item.id}?hard=true`);
      toast({ title: "Item deleted" });
      loadData();
      setPanelOpen(false);
      setSelectedItem(null);
    } catch (error) {
      toast({
        title: "Delete failed",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get icon for document type
  const getDocTypeIcon = (type: string | null) => {
    const Icon = DOCUMENT_TYPE_ICONS[type || "general"] || DocumentIcon;
    return Icon;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">DocSort</h1>
          <p className="text-sm text-muted-foreground">
            Universal document inbox with AI classification
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{stats.active} active</span>
              <span>{stats.needs_review} need review</span>
              <span>{stats.today_count} today</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReclassifyAll}
            disabled={reclassifyingAll || loading || items.length === 0}
          >
            <ArrowPathIcon className={cn("h-4 w-4 mr-2", reclassifyingAll && "animate-spin")} />
            {reclassifyingAll ? "Re-classifying..." : "Re-classify All"}
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <ArrowPathIcon className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Upload zone + List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Drop zone */}
          <div className="p-4 border-b">
            <div
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              {uploading ? (
                <>
                  <Spinner size={32} className="text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">Uploading files...</p>
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">
                    Drop files here or <span className="text-primary">browse</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDFs, images, emails, and documents
                  </p>
                </>
              )}
              <input
                id="file-input"
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.eml,.msg"
                onChange={handleFileInput}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
            <SearchInput value={searchQuery} onChange={setSearchQuery} className="flex-1 max-w-xs" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <FunnelIcon className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="classified">Classified</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <DocumentIcon className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">All Types</SelectItem>
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Spinner size={32} />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <DocumentIcon className="h-12 w-12 mb-3" />
                <p>No documents found</p>
                <p className="text-sm">Drop files above to get started</p>
              </div>
            ) : (
              <div className="divide-y">
                {items.map((item) => {
                  const DocIcon = getDocTypeIcon(item.document_type);
                  const isProcessing = processingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors",
                        selectedItem?.id === item.id && "bg-muted"
                      )}
                      onClick={() => {
                        setSelectedItem(item);
                        setPanelOpen(true);
                      }}
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <DocIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{item.display_name}</p>
                          {item.user_override && (
                            <Badge variant="outline" className="text-xs">
                              Manual
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {item.from_email && (
                            <span className="truncate max-w-[200px]">{item.from_email}</span>
                          )}
                          <span>{formatFileSize(item.file_size)}</span>
                          <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>

                      {/* Status badges */}
                      <div className="flex items-center gap-2">
                        {/* Document type badge */}
                        {item.document_type && (
                          <Badge className={cn("text-xs", CONFIDENCE_COLORS[item.confidence_color])}>
                            {item.document_type_label}
                            {item.confidence_percent != null && ` (${item.confidence_percent}%)`}
                          </Badge>
                        )}

                        {/* 3-method indicators */}
                        {item.classification_result?.methods && (
                          <div className="flex items-center gap-1">
                            {(["name_match", "content_match", "ai_match"] as const).map((key) => {
                              const m = (item.classification_result!.methods as Record<string, MethodResult>)[key];
                              if (!m) return null;
                              const isWinner = item.classification_result!.winner === key;
                              const pct = Math.round(m.confidence * 100);
                              const label = key === "name_match" ? "N" : key === "content_match" ? "O" : "AI";
                              const hasResult = m.status === "completed" && m.document_type;

                              return (
                                <TooltipProvider key={key} delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className={cn(
                                          "inline-flex items-center text-[10px] font-medium rounded px-1 py-0.5 tabular-nums",
                                          isWinner
                                            ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                                            : hasResult
                                              ? "bg-muted text-muted-foreground"
                                              : "bg-muted/50 text-muted-foreground/50"
                                        )}
                                      >
                                        {label}:{hasResult ? `${pct}%` : "—"}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                      <p className="font-medium">{METHOD_DISPLAY_NAMES[key]}</p>
                                      {hasResult ? (
                                        <p>{m.matched_document_type || m.document_type} — {pct}%</p>
                                      ) : (
                                        <p className="text-muted-foreground">{METHOD_STATUS_LABELS[m.status] || m.status}</p>
                                      )}
                                      {isWinner && <p className="text-primary">Winner</p>}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>
                        )}

                        {/* Status badge - clickable dropdown for pending items */}
                        {item.status === "pending" ? (
                          <Select
                            value=""
                            onValueChange={(value) => {
                              if (value) handleOverride(item, value);
                            }}
                            disabled={isProcessing}
                          >
                            <SelectTrigger
                              className="h-6 w-auto min-w-[80px] px-2 text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SelectValue placeholder="pending" />
                            </SelectTrigger>
                            <SelectContent>
                              {documentTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={cn("text-xs", STATUS_COLORS[item.status_color])}>
                            {item.status}
                          </Badge>
                        )}

                        {/* Processing indicator */}
                        {isProcessing && <Spinner size={16} />}

                        {/* Open in Takeoff button for plan documents */}
                        {item.document_type === "plan" && item.content_type === "application/pdf" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/takeoff/docsort/${item.id}`);
                            }}
                          >
                            <Ruler className="h-3 w-3 mr-1" />
                            Takeoff
                          </Button>
                        )}

                        {/* Delete button - shows when selected */}
                        {selectedItem?.id === item.id && !item.routed_to_type && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item);
                            }}
                            disabled={isProcessing}
                          >
                            <XMarkIcon className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>

                      {/* Arrow - opens drawer */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                          setPanelOpen(true);
                        }}
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Classification Panel */}
        {panelOpen && selectedItem && (
          <div className="w-[520px] border-l border-border flex flex-col overflow-hidden bg-background">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                {(() => {
                  const Icon = getDocTypeIcon(selectedItem.document_type);
                  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />;
                })()}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedItem.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedItem.from_email
                      ? `From: ${selectedItem.from_email}`
                      : `Uploaded ${formatDistanceToNow(new Date(selectedItem.created_at), { addSuffix: true })}`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => {
                  setPanelOpen(false);
                  setSelectedItem(null);
                }}
              >
                <XMarkIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Classification Panel */}
            <div className="flex-1 overflow-y-auto">
              <ClassificationPanel
                document={normalizeDocInboxItem(selectedItem)}
                classificationData={classificationData}
                classificationLoading={classificationLoading}
                documentTypes={panelDocTypes}
                companies={panelCompanies}
                mode="validate"
                onRoute={async (companyId) => {
                  await handleRoute(selectedItem, undefined, companyId);
                }}
                onReclassify={async () => {
                  await handleClassify(selectedItem);
                  // Re-fetch classification after reclassify
                  try {
                    const response = await api.get<ClassificationData>(
                      `/api/v1/document_inboxes/${selectedItem.id}/classification`
                    );
                    if (response?.success) setClassificationData(response);
                  } catch { /* ignore */ }
                }}
                onRerunOCR={async () => {
                  await handleClassify(selectedItem);
                  try {
                    const response = await api.get<ClassificationData>(
                      `/api/v1/document_inboxes/${selectedItem.id}/classification`
                    );
                    if (response?.success) setClassificationData(response);
                  } catch { /* ignore */ }
                }}
              />
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-border p-3 space-y-2">
              {/* File info summary */}
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{selectedItem.original_filename || "Unknown file"}</span>
                <span>{formatFileSize(selectedItem.file_size)}</span>
              </div>

              {/* Error message */}
              {selectedItem.error_message && (
                <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 text-xs flex items-start gap-1.5">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{selectedItem.error_message}</span>
                </div>
              )}

              {/* Routing result */}
              {selectedItem.routed_to_type && (
                <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400 text-xs flex items-start gap-1.5">
                  <CheckCircleIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Routed to {selectedItem.routed_to_type}
                    {selectedItem.routed_at && ` — ${formatDistanceToNow(new Date(selectedItem.routed_at), { addSuffix: true })}`}
                  </span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={async () => {
                    try {
                      const response = await api.get<{ url: string }>(
                        `/api/v1/document_inboxes/${selectedItem.id}/download?url_only=true`
                      );
                      if (response?.url) {
                        window.open(response.url, "_blank");
                      } else {
                        toast({ title: "Download failed", description: "No download URL returned", variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "Download failed", variant: "destructive" });
                    }
                  }}
                >
                  <DocumentIcon className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>

                {selectedItem.content_type === "application/pdf" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/takeoff/docsort/${selectedItem.id}`)}
                  >
                    <Ruler className="h-3.5 w-3.5 mr-1.5" />
                    Takeoff
                  </Button>
                )}

                {!selectedItem.routed_to_type && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => handleDelete(selectedItem)}
                    disabled={processingId === selectedItem.id}
                  >
                    <XMarkIcon className="h-3.5 w-3.5 mr-1.5" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
