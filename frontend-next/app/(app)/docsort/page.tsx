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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { api, getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

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

// Classification method labels
const METHOD_LABELS: Record<string, string> = {
  filename_pattern: "Filename pattern match",
  content_type: "Content type detection",
  file_extension: "File extension detection",
  document_type_matcher: "Document type matcher",
  ai: "AI classification",
  default: "Default (no match)",
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [documentTypes, setDocumentTypes] = useState<{ value: string; label: string }[]>(FALLBACK_DOCUMENT_TYPES);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load document types from database
  const loadDocumentTypes = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: Array<{ id: number; name: string }> }>(
        "/api/v1/document_types"
      );
      if (response?.data) {
        const types = response.data.map((dt) => ({
          // Match Rails .parameterize(separator: '_')
          value: dt.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
          label: dt.name,
        }));
        // Add "General" at the end if not already present
        if (!types.find((t) => t.value === "general")) {
          types.push({ value: "general", label: "General" });
        }
        setDocumentTypes(types);
      }
    } catch (error) {
      console.error("Failed to load document types:", error);
    }
  }, []);

  // Load document types once on mount
  useEffect(() => {
    loadDocumentTypes();
  }, [loadDocumentTypes]);

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
      await api.post(`/api/v1/document_inboxes/${item.id}/classify`);
      toast({ title: "Classification started" });
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

  const handleRoute = async (item: DocumentInboxItem, jobId?: number) => {
    setProcessingId(item.id);
    try {
      const params: any = {};
      if (jobId) params.job_id = jobId;

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
        setDrawerOpen(false);
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
      setDrawerOpen(false);
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
                      onClick={() => setSelectedItem(item)}
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
                        {/* Document type badge with classification method tooltip */}
                        {item.document_type && (
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className={cn("text-xs cursor-default", CONFIDENCE_COLORS[item.confidence_color])}>
                                  {item.document_type_label}
                                  {item.confidence_percent != null && ` (${item.confidence_percent}%)`}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-medium text-xs">
                                    {item.classification_result
                                      ? METHOD_LABELS[item.classification_result.method] || item.classification_result.method
                                      : "Unknown method"}
                                  </p>
                                  {(item.classification_result?.signals?.length ?? 0) > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Signals: {item.classification_result!.signals.join(", ")}
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
                          setDrawerOpen(true);
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

        {/* Right: Detail panel */}
        <Sheet open={drawerOpen} onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedItem(null);
        }}>
          <SheetContent side="right-xl" className="overflow-y-auto">
            {selectedItem && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    {(() => {
                      const Icon = getDocTypeIcon(selectedItem.document_type);
                      return <Icon className="h-5 w-5" />;
                    })()}
                    {selectedItem.display_name}
                  </SheetTitle>
                  <SheetDescription>
                    {selectedItem.from_email
                      ? `From: ${selectedItem.from_email}`
                      : `Uploaded ${formatDistanceToNow(new Date(selectedItem.created_at), { addSuffix: true })}`}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Classification Header */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">Classification</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Document Type</span>
                        <Select
                          value={selectedItem.document_type || "general"}
                          onValueChange={(value) => handleOverride(selectedItem, value)}
                          disabled={processingId === selectedItem.id}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {documentTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedItem.classification_confidence !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Confidence</span>
                          <Badge className={cn(CONFIDENCE_COLORS[selectedItem.confidence_color])}>
                            {selectedItem.confidence_percent}%
                          </Badge>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge className={cn(STATUS_COLORS[selectedItem.status_color])}>
                          {selectedItem.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* 3-Method Classification Display */}
                  {selectedItem.classification_result?.methods ? (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Classification Methods</h4>
                      <Accordion
                        type="multiple"
                        defaultValue={selectedItem.classification_result.winner ? [selectedItem.classification_result.winner] : ["name_match"]}
                        className="w-full"
                      >
                        {(Object.entries(selectedItem.classification_result.methods) as [string, MethodResult][]).map(
                          ([methodKey, methodResult]) => {
                            const isWinner = selectedItem.classification_result?.winner === methodKey;
                            const hasResult = methodResult.status === "completed" && methodResult.document_type;
                            const confidencePercent = Math.round(methodResult.confidence * 100);
                            const docTypeLabel = hasResult
                              ? documentTypes.find((t) => t.value === methodResult.document_type)?.label || methodResult.document_type
                              : null;

                            return (
                              <AccordionItem key={methodKey} value={methodKey} className="border-b last:border-b-0">
                                <AccordionTrigger className="py-3 text-sm hover:no-underline">
                                  <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                                    <span className="font-medium shrink-0">
                                      {METHOD_DISPLAY_NAMES[methodKey] || methodKey}
                                    </span>
                                    {hasResult ? (
                                      <>
                                        <span className="text-muted-foreground truncate">{docTypeLabel}</span>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-xs shrink-0",
                                            confidencePercent >= 80
                                              ? "border-green-500 text-green-700 dark:text-green-400"
                                              : confidencePercent >= 60
                                                ? "border-yellow-500 text-yellow-700 dark:text-yellow-400"
                                                : "border-gray-400 text-gray-600 dark:text-gray-400"
                                          )}
                                        >
                                          {confidencePercent}%
                                        </Badge>
                                      </>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        {METHOD_STATUS_LABELS[methodResult.status] || methodResult.status}
                                      </span>
                                    )}
                                    {isWinner && (
                                      <Badge className="text-xs bg-primary/10 text-primary border-primary/30 shrink-0">
                                        Winner
                                      </Badge>
                                    )}
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-sm">
                                  <div className="space-y-2 pl-1">
                                    {/* Signals / Matched Terms */}
                                    {methodResult.signals && methodResult.signals.length > 0 && (
                                      <div>
                                        <span className="text-xs text-muted-foreground">
                                          {methodKey === "content_match" ? "Matched Terms" : "Signals"}
                                        </span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {methodResult.signals.map((signal, i) => (
                                            <Badge key={i} variant="outline" className="text-xs font-mono">
                                              {signal}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Text Preview (Content Match / OCR) */}
                                    {methodResult.text_preview && (
                                      <div>
                                        <span className="text-xs text-muted-foreground">Text Preview</span>
                                        <p className="text-xs mt-1 p-2 rounded bg-muted/50 font-mono whitespace-pre-wrap line-clamp-4">
                                          {methodResult.text_preview}
                                        </p>
                                      </div>
                                    )}

                                    {/* Suggestions (Name Match) */}
                                    {methodResult.suggestions && methodResult.suggestions.length > 0 && (
                                      <div>
                                        <span className="text-xs text-muted-foreground">Suggestions</span>
                                        <div className="space-y-1 mt-1">
                                          {methodResult.suggestions.map((suggestion, i) => (
                                            <div
                                              key={i}
                                              className="flex items-center justify-between p-1.5 rounded bg-muted/50 text-xs"
                                            >
                                              <div className="flex-1 min-w-0">
                                                <span className="font-medium">{suggestion.name}</span>
                                                {suggestion.matched_term && (
                                                  <span className="text-muted-foreground ml-1">
                                                    via {suggestion.match_type}: &quot;{suggestion.matched_term}&quot;
                                                  </span>
                                                )}
                                              </div>
                                              <Badge
                                                variant="outline"
                                                className={cn(
                                                  "text-xs ml-2 shrink-0",
                                                  suggestion.confidence >= 80
                                                    ? "border-green-500 text-green-700 dark:text-green-400"
                                                    : suggestion.confidence >= 60
                                                      ? "border-yellow-500 text-yellow-700 dark:text-yellow-400"
                                                      : "border-gray-400 text-gray-600 dark:text-gray-400"
                                                )}
                                              >
                                                {suggestion.confidence}%
                                              </Badge>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Reason (for N/A, disabled, error) */}
                                    {methodResult.reason && (
                                      <p className="text-xs text-muted-foreground italic">{methodResult.reason}</p>
                                    )}

                                    {/* Duration */}
                                    {methodResult.duration_ms != null && (
                                      <p className="text-xs text-muted-foreground">Time: {methodResult.duration_ms}ms</p>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          }
                        )}
                      </Accordion>
                    </div>
                  ) : selectedItem.classification_result ? (
                    /* Backward compatibility: old single-result display */
                    <div>
                      <h4 className="text-sm font-medium mb-3">Classification Details</h4>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm text-muted-foreground shrink-0">Method</span>
                          <span className="text-sm text-right break-words min-w-0">
                            {METHOD_LABELS[selectedItem.classification_result.method] || selectedItem.classification_result.method}
                          </span>
                        </div>
                        {selectedItem.classification_result.signals?.length > 0 && (
                          <div>
                            <span className="text-sm text-muted-foreground">Signals</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedItem.classification_result.signals.map((signal, i) => (
                                <Badge key={i} variant="outline" className="text-xs font-mono">
                                  {signal}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedItem.classification_result.matched_document_type && (
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm text-muted-foreground shrink-0">Matched Type</span>
                            <span className="text-sm text-right break-words min-w-0">
                              {selectedItem.classification_result.matched_document_type}
                            </span>
                          </div>
                        )}
                        {selectedItem.classification_result.suggestions &&
                          selectedItem.classification_result.suggestions.length > 0 && (
                          <div>
                            <span className="text-sm text-muted-foreground">Suggestions</span>
                            <div className="space-y-1 mt-1">
                              {selectedItem.classification_result.suggestions.map((suggestion, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between p-1.5 rounded bg-muted/50 text-xs"
                                >
                                  <span className="font-medium">{suggestion.name}</span>
                                  <Badge variant="outline" className="text-xs ml-2">
                                    {suggestion.confidence}%
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* No classification at all */}
                  {selectedItem.document_type === "general" &&
                    !selectedItem.classification_result && (
                    <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400">
                      <p className="text-sm">
                        No document type matches found. Use the dropdown above to manually classify this document.
                      </p>
                    </div>
                  )}

                  {/* File info */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">File Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Filename</span>
                        <span className="text-right break-words min-w-0">{selectedItem.original_filename || "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Size</span>
                        <span>{formatFileSize(selectedItem.file_size)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Type</span>
                        <span className="text-right break-words min-w-0">{selectedItem.content_type || "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Source</span>
                        <span className="capitalize">{selectedItem.source}</span>
                      </div>
                    </div>
                  </div>

                  {/* Error message */}
                  {selectedItem.error_message && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400">
                      <div className="flex items-start gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                        <p className="text-sm">{selectedItem.error_message}</p>
                      </div>
                    </div>
                  )}

                  {/* Routing result */}
                  {selectedItem.routed_to_type && (
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400">
                      <div className="flex items-start gap-2">
                        <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
                        <div className="text-sm">
                          <p>Routed to {selectedItem.routed_to_type}</p>
                          <p className="text-xs opacity-75">
                            {selectedItem.routed_at &&
                              formatDistanceToNow(new Date(selectedItem.routed_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {selectedItem.status === "classified" && !selectedItem.routed_to_type && (
                      <Button
                        onClick={() => handleRoute(selectedItem)}
                        disabled={processingId === selectedItem.id}
                      >
                        {processingId === selectedItem.id ? (
                          <Spinner size={16} className="mr-2" />
                        ) : (
                          <CheckCircleIcon className="h-4 w-4 mr-2" />
                        )}
                        Route Document
                      </Button>
                    )}

                    {selectedItem.status === "pending" && (
                      <Button
                        onClick={() => handleClassify(selectedItem)}
                        disabled={processingId === selectedItem.id}
                        variant="outline"
                      >
                        {processingId === selectedItem.id ? (
                          <Spinner size={16} className="mr-2" />
                        ) : (
                          <ArrowPathIcon className="h-4 w-4 mr-2" />
                        )}
                        Re-classify
                      </Button>
                    )}

                    <Button variant="outline" asChild>
                      <a
                        href={`${getApiBaseUrl()}/api/v1/document_inboxes/${selectedItem.id}/download?url_only=false`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <DocumentIcon className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </Button>

                    {/* Open in Takeoff - for any PDF document */}
                    {selectedItem.content_type === "application/pdf" && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/takeoff/docsort/${selectedItem.id}`)}
                      >
                        <Ruler className="h-4 w-4 mr-2" />
                        Open in Takeoff
                      </Button>
                    )}

                    {!selectedItem.routed_to_type && (
                      <Button
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => handleDelete(selectedItem)}
                        disabled={processingId === selectedItem.id}
                      >
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
