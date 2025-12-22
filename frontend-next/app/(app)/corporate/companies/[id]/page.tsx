"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  Users,
  FileText,
  DollarSign,
  Edit,
  Loader2,
  Briefcase,
  Heart,
  Landmark,
  FolderOpen,
  Banknote,
  Save,
  Plus,
  Cloud,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { format, isValid } from "date-fns";

// Safe date formatter that handles null/invalid dates
const safeFormatDate = (dateValue: string | Date | null | undefined, formatStr: string, fallback = "—"): string => {
  if (!dateValue) return fallback;
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  return isValid(date) ? format(date, formatStr) : fallback;
};
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import DocumentPreviewModal from "@/components/corporate/DocumentPreviewModal";
import DocumentSidePanel from "@/components/corporate/DocumentSidePanel";

// Dynamic tab rendering (SSoT: lib/tab-component-registry.ts)
// Individual components are lazy-loaded via OverviewTabRenderer
import { OverviewTabRenderer } from "@/components/corporate/OverviewTabRenderer";
import { XeroTabSection } from "@/components/corporate/XeroTabSection";
// ActivityTab is used for main "activity-main" tab (not overview sub-tab)
import { ActivityTab } from "@/components/tabs";
// Shared types for corporate entities (SSoT for Company type)
import type { CorporateCompany } from "@/lib/types/corporate";

// SSoT: Using unified EntityTabs API (Phase 4 migration)
import { useCorporateEntityTabs } from "@/lib/hooks/useCorporateEntityTabs";
import { getIcon } from "@/lib/icon-map";

// =============================================================================
// TAB CONFIGURATION
// SSoT: GET /api/v1/entity_tabs?scope=corporate_entity (EntityTab model)
// Xero tabs are children of the Xero tab in corporate_entity scope (SSoT)
// Manage via: Admin > System > Entity Configuration
// Phase 4 Migration Complete: Using useCorporateEntityTabs & useXeroEntityTabs hooks
// =============================================================================

// SSoT: All tabs come from API only (EntityTabs database)
// NO FALLBACK ARRAYS - if API fails, show error so we can fix it
// Manage tabs via: Admin > System > Entity Configuration

// Company type alias - SSoT: CorporateCompany from @/lib/types/corporate
type Company = CorporateCompany;

// =============================================================================
// PAGE COMPONENT
// =============================================================================

// Document interface for table
interface CompanyDocument extends TableRow {
  display_title?: string;
  display_name?: string;
  file_name?: string;
  validated?: boolean;
  validation_source?: string;
  financial_years?: string;
  folder?: string;
  document_type?: string;
  source?: string;
  file_size?: number;
  document_date?: string;
  created_at?: string;
  file_url?: string;
  user_validated_at?: string;
  // AI verification fields
  ai_verification_status?: "pending" | "processing" | "verified" | "mismatch" | "error";
  ai_suggested_name?: string;
  ai_suggested_folder?: string;
  ai_suggested_type?: string;
  ai_suggested_fy?: string;
  ai_confidence_score?: number;
  ai_analysis_notes?: string;
  ai_error_message?: string;
  user_validated_by_id?: number;
  company_id?: number;
}

// Folder options for documents
const DOCUMENT_FOLDER_OPTIONS = [
  "ADVICE", "ASIC", "ASSETS", "ATO", "BANK", "COMPANY",
  "DIVIDENDS", "FINANCIALS", "GENERAL", "INSURANCE",
  "LOANS", "MINUTES", "REGISTRY", "TRUST"
];

// Document type options
const DOCUMENT_TYPE_OPTIONS = [
  { value: "tax_return", label: "Tax Return" },
  { value: "bas", label: "BAS" },
  { value: "financial_statement", label: "Financial Statement" },
  { value: "annual_report", label: "Annual Report" },
  { value: "minutes", label: "Minutes" },
  { value: "resolution", label: "Resolution" },
  { value: "contract", label: "Contract" },
  { value: "loan", label: "Loan Document" },
  { value: "insurance", label: "Insurance" },
  { value: "asic", label: "ASIC Document" },
  { value: "other", label: "Other" },
];

// Format file size helper
function formatFileSize(bytes?: number): string {
  if (!bytes) return "-";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
}

function CompanyDocumentsTab({ companyId, company, category }: { companyId: string; company: Company; category?: string }) {
  const [documents, setDocuments] = React.useState<CompanyDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<Company[]>([]);

  // Document preview state - side panel for single click, fullscreen modal for double click
  const [selectedDocument, setSelectedDocument] = React.useState<CompanyDocument | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [sidePanelDocument, setSidePanelDocument] = React.useState<CompanyDocument | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = React.useState(false);

  React.useEffect(() => {
    loadDocuments();
    // checkSharePointConnection(); // Unused - SharePoint connection state was never defined
    loadCompanies();
     
  }, [companyId, category]);

  const loadCompanies = async () => {
    try {
      const response = await api.get<{ companies: Company[] }>("/api/v1/companies");
      setCompanies(response.companies || []);
    } catch (error) {
      console.error("Failed to load companies:", error);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { company_id: companyId };
      if (category && category !== "all") {
        params.tab = category;
      }
      const response = await api.get<{ documents: CompanyDocument[] }>("/api/v1/company_documents", { params });
      const docs = response.documents || [];
      // Transform documents for table display
      const transformed = docs.map((doc) => ({
        ...doc,
        display_title: doc.display_name || doc.file_name,
        file_size_display: formatFileSize(doc.file_size),
        source_display: doc.source === "sharepoint" ? "SharePoint" : "Upload",
        financial_years: Array.isArray(doc.financial_years)
          ? (doc.financial_years as unknown as string[]).join(", ")
          : doc.financial_years || "",
        validated: !!(doc.user_validated_at || doc.ai_verification_status === "verified"),
        validation_source: doc.user_validated_at ? "user" : doc.ai_verification_status === "verified" ? "ai" : undefined,
        ai_confidence: doc.ai_confidence_score || null,
      }));
      setDocuments(transformed);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  };

  // Unused - SharePoint connection state was never defined
  // const checkSharePointConnection = async () => {
  //   try {
  //     const response = await api.get<{ connected: boolean }>("/api/v1/organization_onedrive/status");
  //     setSharepointConnected(response.connected === true);
  //   } catch {
  //     setSharepointConnected(false);
  //   }
  // };

  // Debounce ref to distinguish single vs double click
  const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Single click - open side panel preview (debounced to avoid triggering on double-click)
  const handleSingleClick = (doc: CompanyDocument) => {
    // Clear any pending single-click action
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    // Delay single-click action to see if it's actually a double-click
    clickTimeoutRef.current = setTimeout(() => {
      setSidePanelDocument(doc);
      setIsSidePanelOpen(true);
      clickTimeoutRef.current = null;
    }, 200); // 200ms delay to detect double-click
  };

  // Double click - open fullscreen modal for editing
  const handleDoubleClick = (doc: CompanyDocument) => {
    // Cancel the pending single-click action
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    // Close side panel if open
    setIsSidePanelOpen(false);
    setSidePanelDocument(null);
    // Open fullscreen modal
    setSelectedDocument(doc);
    setIsPreviewOpen(true);
  };

  // Expand from side panel to fullscreen modal
  const handleExpandToFullscreen = () => {
    if (sidePanelDocument) {
      setSelectedDocument(sidePanelDocument);
      setIsPreviewOpen(true);
      setIsSidePanelOpen(false);
      setSidePanelDocument(null);
    }
  };

  const handleDelete = async (doc: CompanyDocument) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await api.delete(`/api/v1/company_documents/${doc.id}`);
      await loadDocuments();
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    if (!confirm(`Delete ${ids.length} documents? This cannot be undone.`)) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/api/v1/company_documents/${id}`)));
      await loadDocuments();
    } catch (error) {
      console.error("Failed to bulk delete documents:", error);
    }
  };

  // Handle inline document field update (folder, type, etc.)
  const handleInlineUpdate = async (docId: number | string, field: string, value: string) => {
    try {
      // Use relocate endpoint for folder changes (moves file in OneDrive)
      if (field === "folder") {
        await api.post(`/api/v1/company_documents/${docId}/relocate`, {
          relocate: { folder: value }
        });
      } else {
        // Regular update for other fields
        await api.patch(`/api/v1/company_documents/${docId}`, {
          company_document: { [field]: value }
        });
      }
      await loadDocuments();
    } catch (error) {
      console.error(`Failed to update document ${field}:`, error);
      alert(`Failed to update ${field}`);
    }
  };

  // Custom cell renderer
  const customCellRenderer = (doc: CompanyDocument, columnKey: string) => {
    switch (columnKey) {
      case "validated":
        if (doc.validated) {
          return (
            <div className="flex justify-center" title={doc.validation_source === "user" ? "Validated by user" : "Validated by AI"}>
              <CheckCircle className={cn("h-5 w-5", doc.validation_source === "ai" ? "text-blue-500" : "text-green-500")} />
            </div>
          );
        }
        return (
          <div className="flex justify-center" title="Not validated">
            <span className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
          </div>
        );
      case "ai_confidence":
        // Show AI verification status with confidence percentage
        if (doc.ai_verification_status === "processing") {
          return (
            <div className="flex justify-center" title="AI analyzing...">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
            </div>
          );
        }
        if (doc.ai_confidence_score) {
          const score = doc.ai_confidence_score;
          const colorClass = score >= 90 ? "text-green-600 bg-green-100 dark:bg-green-900/30"
            : score >= 70 ? "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30"
            : "text-red-600 bg-red-100 dark:bg-red-900/30";
          return (
            <div className="flex justify-center" title={`AI confidence: ${score}%\n${doc.ai_analysis_notes || ''}`}>
              <Badge variant="outline" className={cn("text-[10px] px-1 py-0 font-mono", colorClass)}>
                {score}%
              </Badge>
            </div>
          );
        }
        if (doc.ai_verification_status === "error") {
          return (
            <div className="flex justify-center" title={doc.ai_error_message || "AI analysis failed"}>
              <XCircle className="h-4 w-4 text-red-400" />
            </div>
          );
        }
        return (
          <div className="flex justify-center" title="Not analyzed by AI">
            <span className="text-muted-foreground text-xs">-</span>
          </div>
        );
      case "source":
        if (doc.source === "sharepoint") {
          return (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              <Cloud className="h-3 w-3 mr-1" />
              SharePoint
            </Badge>
          );
        }
        return <Badge variant="outline">Upload</Badge>;
      case "file_size":
        return <span className="text-muted-foreground">{formatFileSize(doc.file_size)}</span>;
      case "folder":
        return (
          <Select
            value={doc.folder || ""}
            onValueChange={(value) => handleInlineUpdate(doc.id, "folder", value)}
          >
            <SelectTrigger
              className="h-7 w-[120px] text-xs border-0 bg-transparent hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue placeholder="Select...">
                {doc.folder ? (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {doc.folder}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent onClick={(e) => e.stopPropagation()}>
              {DOCUMENT_FOLDER_OPTIONS.map((folder) => (
                <SelectItem key={folder} value={folder}>
                  {folder}
                  {folder === doc.folder && " ✓"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "document_type":
        return (
          <Select
            value={doc.document_type || ""}
            onValueChange={(value) => handleInlineUpdate(doc.id, "document_type", value)}
          >
            <SelectTrigger
              className="h-7 w-[130px] text-xs border-0 bg-transparent hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue placeholder="Select...">
                {doc.document_type ? (
                  <span className="capitalize">{doc.document_type.replace(/_/g, " ")}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent onClick={(e) => e.stopPropagation()}>
              {DOCUMENT_TYPE_OPTIONS.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                  {type.value === doc.document_type && " ✓"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "financial_years":
        // Show FY badges that can be used for filtering
        // Parse the financial_years - it could be an array, string, or comma-separated
        const fyValue = doc.financial_years;
        let fyArray: number[] = [];
        if (Array.isArray(fyValue)) {
          fyArray = fyValue.map(y => typeof y === 'number' ? y : parseInt(String(y), 10)).filter(y => !isNaN(y));
        } else if (typeof fyValue === 'string' && fyValue) {
          fyArray = fyValue.split(',').map(s => parseInt(s.trim(), 10)).filter(y => !isNaN(y));
        }

        if (fyArray.length === 0) {
          return <span className="text-muted-foreground text-xs">-</span>;
        }

        return (
          <div className="flex flex-wrap gap-0.5">
            {fyArray.map(year => (
              <Badge
                key={year}
                variant="outline"
                className="text-[10px] px-1 py-0 font-mono bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 cursor-pointer hover:bg-blue-100"
                title={`Filter by FY${year.toString().slice(-2)}`}
              >
                FY{year.toString().slice(-2)}
              </Badge>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  // Get SharePoint folder URL for this tab
  // const getSharePointUrl = () => {
  //   if (!company.sharepoint_folder_url) return null;
  //   if (category && category !== "all") {
  //     return `${company.sharepoint_folder_url}/${encodeURIComponent(category.toUpperCase())}`;
  //   }
  //   return company.sharepoint_folder_url;
  // };

  // Bulk AI verification state
  const [bulkAiProcessing, setBulkAiProcessing] = React.useState(false);
  const [bulkAiProgress, setBulkAiProgress] = React.useState<{ current: number; total: number } | null>(null);

  // Helper to poll document status until verification completes
  const waitForVerification = async (docId: number | string, maxWaitMs = 120000): Promise<CompanyDocument | null> => {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await api.get<{ document: CompanyDocument }>(
          `/api/v1/company_documents/${docId}`
        );

        if (response?.document) {
          const status = response.document.ai_verification_status;
          // Done when not processing
          if (status !== "processing") {
            return response.document;
          }
        }
      } catch (err) {
        console.error(`Failed to poll document ${docId}:`, err);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.warn(`Verification timeout for document ${docId}`);
    return null;
  };

  // Bulk AI verification handler - uses async mode to avoid Heroku timeouts
  const handleBulkAiVerify = async (ids: (number | string)[], clearSelection: () => void) => {
    setBulkAiProcessing(true);
    setBulkAiProgress({ current: 0, total: ids.length });

    try {
      // Process documents one by one using async mode
      for (let i = 0; i < ids.length; i++) {
        const docId = ids[i];
        setBulkAiProgress({ current: i + 1, total: ids.length });

        try {
          // Trigger async AI verification (no auto_apply_threshold = async mode)
          // The DocumentVerificationService already auto-applies at 90%+ confidence
          await api.post<{ success: boolean }>(`/api/v1/company_documents/${docId}/ai_verify`);

          // Update local state to show processing
          setDocuments(prev => prev.map(d =>
            d.id === docId ? { ...d, ai_verification_status: "processing" as const } : d
          ));

          // Wait for verification to complete
          const updatedDoc = await waitForVerification(docId);

          // Update local state with result
          if (updatedDoc) {
            setDocuments(prev => prev.map(d =>
              d.id === docId ? {
                ...d,
                ...updatedDoc,
                ai_confidence: updatedDoc.ai_confidence_score || null,
              } : d
            ));
          }
        } catch (err) {
          console.error(`Failed to AI verify document ${docId}:`, err);
        }
      }

      // Reload documents to get final state
      await loadDocuments();
      clearSelection();
    } catch (error) {
      console.error("Bulk AI verification failed:", error);
    } finally {
      setBulkAiProcessing(false);
      setBulkAiProgress(null);
    }
  };

  // Left actions for table toolbar (Add Record button)
  const leftActions = (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Upload
    </Button>
  );

  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Always show TeeemTableView - let it handle empty state for consistent UI
  return (
    <>
      <TeeemTableView
        foundationId={`company-documents-${category || "all"}`}
        foundationIdNumeric={357}
        tableName={`${category ? category.toUpperCase() : "All"} Documents (${documents.length})`}
        entries={documents}
        // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRowClick={handleSingleClick}
        onRowDoubleClick={handleDoubleClick}
        enableImport={false}
        enableExport={true}
        enableSchemaEditor={false}
        showDataHealth={false}
        leftActions={leftActions}
        customCellRenderer={customCellRenderer}
        customBulkActions={(selectedIds, clearSelection) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAiVerify(selectedIds, clearSelection)}
            disabled={bulkAiProcessing}
            className="bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700"
          >
            {bulkAiProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                {bulkAiProgress ? `${bulkAiProgress.current}/${bulkAiProgress.total}` : "Processing..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Run AI ({selectedIds.length})
              </>
            )}
          </Button>
        )}
      />

      {/* Document Side Panel - Single click preview */}
      <DocumentSidePanel
        document={sidePanelDocument}
        open={isSidePanelOpen}
        onOpenChange={(open) => {
          setIsSidePanelOpen(open);
          if (!open) setSidePanelDocument(null);
        }}
        onExpandToFullscreen={handleExpandToFullscreen}
      />

      {/* Document Preview Modal with AI Verification - Double click for editing */}
      {selectedDocument && (
        <DocumentPreviewModal
          open={isPreviewOpen}
          onOpenChange={(open) => {
            setIsPreviewOpen(open);
            if (!open) setSelectedDocument(null);
          }}
          document={selectedDocument}
          onDocumentUpdate={loadDocuments}
          companies={companies}
        />
      )}
    </>
  );
}

// Data Warehouse Tab - Redirects to /admin/system?tab=data-warehouse&company_id={id}
// The Data tab redirects to the admin data warehouse with company filter

// SSoT: ATO Setup Card - Shows Contact data as source of truth
function ATOSetupCard({ company }: { company: Company }) {
  const router = useRouter();

  if (!company.contact_id) {
    return (
      <Card className="mb-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-5 w-5" />
            Contact Not Linked
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            This company is not linked to a Contact record. Link to a Contact for centralised data management.
          </p>
          <Button variant="outline" size="sm" onClick={() => router.push("/contacts")}>
            Link to Contact
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            ATO Registration
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/contacts/${company.contact_id}?edit=true`)}
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Data sourced from linked Contact record
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">ABN</p>
            <p className="font-medium">{company.formatted_abn || company.abn || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">TFN</p>
            <p className="font-medium">{company.tfn ? "••• ••• •••" : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">GST Status</p>
            <Badge
              variant="outline"
              className={company.gst_registration_status === "registered"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }
            >
              {company.gst_registration_status === "registered" ? "Registered" : "Not Registered"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Source</p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-blue-600"
              onClick={() => router.push(`/contacts/${company.contact_id}`)}
            >
              View Contact →
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CompanyDetailPage() {
  useSetLayoutMode("full-height");
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [company, setCompany] = React.useState<Company | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [overviewSubTab, setOverviewSubTab] = React.useState("info");

  // Company edit sheet state
  const [isEditSheetOpen, setIsEditSheetOpen] = React.useState(false);
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [editFormData, setEditFormData] = React.useState({
    name: "",
    acn: "",
    abn: "",
    status: "",
    entity_type: "",
    date_incorporated: "",
    registered_office_address: "",
    principal_place_of_business: "",
    purpose: "",
  });

  // Company edit handlers
  const openEditSheet = () => {
    if (company) {
      setEditFormData({
        name: company.name || "",
        acn: company.acn || "",
        abn: company.abn || "",
        status: company.status || "active",
        entity_type: company.entity_type || "Company",
        date_incorporated: company.date_incorporated || "",
        registered_office_address: company.registered_office_address || "",
        principal_place_of_business: company.principal_place_of_business || "",
        purpose: company.purpose || "",
      });
      setIsEditSheetOpen(true);
    }
  };

  const handleSaveCompany = async () => {
    setSavingEdit(true);
    try {
      await api.put(`/api/v1/companies/${companyId}`, { company: editFormData });
      setIsEditSheetOpen(false);
      loadCompany();
    } catch (error) {
      console.error("Failed to save company:", error);
    } finally {
      setSavingEdit(false);
    }
  };

  const [documentCounts, setDocumentCounts] = React.useState<Record<string, number>>({});
  const [healthScore, setHealthScore] = React.useState<{ score: number; status: string } | null>(null);

  // SSoT: Entity type normalization for tab filtering
  const normalizedEntityType = React.useMemo(() => {
    if (!company) return undefined;
    const entityType = company.entity_type || "Company";
    // Normalize entity type (handle lowercase from legacy data)
    if (entityType.toLowerCase() === "company") return "Company";
    if (entityType.toLowerCase() === "trust") return "Trust";
    if (entityType.toLowerCase() === "superfund") return "Superfund";
    if (entityType.toLowerCase() === "charity") return "Charity";
    return entityType;
  }, [company]);

  // SSoT: Using unified EntityTabs API (Phase 4 migration)
  // Corporate tabs - replaces old /api/v1/corporate/entity_tabs
  const {
    overviewTabs: entityOverviewTabs,
    documentTabs: documentFolderTabs,
    mainTabs: entityMainTabs,
  } = useCorporateEntityTabs(normalizedEntityType);

  // Map folder names to icons
  const getFolderIcon = (folderName: string) => {
    const iconMap: Record<string, any> = {
      'ADVICE': Briefcase,
      'ASIC': FileText,
      'ASSETS': Briefcase,
      'ATO': FileText,
      'BANK': Landmark,
      'XERO': RefreshCw,
      'COMPANY': Building2,
      'DIVIDENDS': DollarSign,
      'FINANCIALS': FileText,
      'GENERAL': FolderOpen,
      'INSURANCE': Heart,
      'LOANS': Banknote,
      'MINUTES': FileText,
      'REGISTRY': FileText,
      'TRUST': Users,
      'PAYROLL': DollarSign,
      'SUPERANNUATION': DollarSign,
      'CONTRACTS': FileText,
      'COMPLIANCE': CheckCircle,
    };
    return iconMap[folderName] || FileText;
  };

  // REMOVED: loadEntityTabs - now using useCorporateEntityTabs hook (SSoT)
  // REMOVED: loadXeroTabs - now using useXeroEntityTabs hook (SSoT)

  // Load company details
  const loadCompany = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; company: Company }>(
        `/api/v1/companies/${companyId}`
      );
      setCompany(response.company);
      // SSoT: Entity tabs now loaded via useCorporateEntityTabs hook (Phase 4)
      // The hook automatically refetches when company.entity_type changes
    } catch (error) {
      console.error("Failed to load company:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Load document counts for tabs
  const loadDocumentCounts = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; counts: Record<string, number> }>(
        `/api/v1/company_documents/counts`,
        { params: { company_id: companyId } }
      );
      setDocumentCounts(response.counts || {});
    } catch (error) {
      console.error("Failed to load document counts:", error);
    }
  }, [companyId]);

  // Load health score for header badge (fast endpoint - loads only this company)
  const loadHealthScore = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; health: { health_score: number; health_status: string } }>(
        `/api/v1/companies/${companyId}/health`
      );
      if (response.health) {
        setHealthScore({ score: response.health.health_score, status: response.health.health_status });
      }
    } catch (error) {
      console.error("Failed to load health score:", error);
    }
  }, [companyId]);

  // SSoT: Document tabs from API only (EntityTabs database, group: documents)
  // Convert string icon names to Lucide components
  const computedDocumentTabs = React.useMemo(() => {
    return documentFolderTabs.map(tab => ({
      ...tab,
      icon: tab.id === "xero" ? RefreshCw : getFolderIcon(tab.name.toUpperCase()),
    }));
  }, [documentFolderTabs]);

  // SSoT: Overview sub-tabs from CorporateEntityTab API only
  // Returns entity-specific tabs (e.g., Company gets Directors/Shareholdings, Charity gets Directors/Members)
  // No fallback - database is SSoT via Admin > System > Entity Configuration
  const computedOverviewTabs = React.useMemo(() => {
    return entityOverviewTabs;
  }, [entityOverviewTabs]);

  React.useEffect(() => {
    loadCompany();
    loadDocumentCounts();
    loadHealthScore();
    // SSoT: Xero tabs now loaded via useXeroEntityTabs hook (Phase 4)
  }, [loadCompany, loadDocumentCounts, loadHealthScore]);

  // Handle tab from URL
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    // Redirect Data tab to data warehouse page with company filter
    if (tabId === "data-main") {
      router.push(`/data-warehouse?company_id=${companyId}`);
      return;
    }
    setActiveTab(tabId);
    router.push(`/corporate/companies/${companyId}?tab=${tabId}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Company not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "inactive":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "deregistered":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    }
  };

  const getCompanyGroup = () => {
    if (typeof company.company_group === "string") {
      return company.company_group.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    return company.company_group?.name || company.group_name || null;
  };

  const getSharePointUrl = () => {
    if (company.sharepoint_folder_url) return company.sharepoint_folder_url;
    return "https://gotekna-my.sharepoint.com/personal/robert_tekna_com_au/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Frobert%5Ftekna%5Fcom%5Fau%2FDocuments%2FAccounts%20%2D%20Internal%2FCorporate%20File";
  };

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Sticky header and tabs - matches Job detail page layout */}
      <div className="sticky top-0 z-10 bg-background">
        {/* Header row - no card, inline back button like job detail */}
        <div className="px-3 pb-2 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/corporate")} className="mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight font-serif">{company.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {company.formatted_acn && (
                  <span className="text-sm text-muted-foreground">ACN: {company.formatted_acn}</span>
                )}
                {company.formatted_abn && (
                  <>
                    <span className="text-sm text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">ABN: {company.formatted_abn}</span>
                  </>
                )}
                {getCompanyGroup() && (
                  <>
                    <span className="text-sm text-muted-foreground">·</span>
                    <Badge variant="secondary">{getCompanyGroup()}</Badge>
                  </>
                )}
                <Badge className={getStatusColor(company.status)}>
                  {company.status || "active"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Health Score Badge */}
            {healthScore && (
              <button
                onClick={() => {
                  setActiveTab("overview");
                  setOverviewSubTab("health");
                }}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-md bg-muted",
                  healthScore.status === "excellent" && "text-green-700 dark:text-green-300",
                  healthScore.status === "good" && "text-blue-700 dark:text-blue-300",
                  healthScore.status === "needs_attention" && "text-yellow-700 dark:text-yellow-300",
                  healthScore.status === "critical" && "text-red-700 dark:text-red-300"
                )}
              >
                <span className="font-semibold">{healthScore.score}%</span>
                <span className="text-xs text-muted-foreground uppercase">Health</span>
              </button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={getSharePointUrl()} target="_blank" rel="noopener noreferrer">
                <FolderOpen className="h-4 w-4 mr-2" />
                SharePoint
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={openEditSheet}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Main Tabs - inside sticky header */}
        {/* SSoT: Main tabs (Overview) from API, document tabs from API */}
        <div className="border-b px-3 shrink-0">
        <div className="flex flex-wrap gap-1 pb-2">
          {/* Main tabs from API (Overview, etc.) - SSoT: tab_group='main' */}
          {entityMainTabs.map((tab) => {
            const Icon = tab.icon ? getIcon(tab.icon) : Building2;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            );
          })}
          {/* Fallback Overview button if API hasn't loaded main tabs yet */}
          {entityMainTabs.length === 0 && (
            <button
              onClick={() => handleTabChange("overview")}
              className={cn(
                "inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Building2 className="h-4 w-4 mr-2" />
              Overview
            </button>
          )}
          {computedDocumentTabs.map((tab) => {
            const Icon = tab.icon;
            // Map tab id to count key (handle naming differences)
            const countKey = tab.id === "assets-docs" ? "assets-docs" :
                            tab.id === "dividends-docs" ? "dividends-docs" :
                            tab.id === "loans-docs" ? "loans-docs" :
                            tab.id === "minutes-docs" ? "minutes-docs" :
                            tab.id;
            const count = documentCounts[countKey] || 0;
            const showCount = !["documents-main", "data-main", "activity-main"].includes(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
                {showCount && count > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Tab Content - scrollable area below sticky header */}
      <div className="flex-1 min-h-0 px-3 pb-3 overflow-auto">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Overview Sub-tabs - SSoT: From CorporateEntityTab API based on entity type */}
              <div className="border-b">
                <nav className="-mb-px flex gap-6">
                  {computedOverviewTabs.map((subTab) => (
                    <button
                      key={subTab.id}
                      onClick={() => setOverviewSubTab(subTab.id)}
                      className={cn(
                        "border-b-2 py-2 px-1 text-sm font-medium transition-colors",
                        overviewSubTab === subTab.id
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                      )}
                    >
                      {subTab.name}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Overview Sub-tab Content - Dynamic rendering from registry */}
              <OverviewTabRenderer
                tabKey={overviewSubTab}
                company={company}
                companyId={companyId}
                onUpdate={loadCompany}
                renderInfoPrefix={<ATOSetupCard company={company} />}
              />
            </div>
          )}

          {/* XERO Tab - Extracted to XeroTabSection component */}
          {activeTab === "xero" && (
            <XeroTabSection
              companyId={companyId}
              company={company}
              DocumentsTabComponent={CompanyDocumentsTab}
            />
          )}

          {/* Document Category Tabs */}
          {computedDocumentTabs.find(t => t.id === activeTab)?.name && activeTab !== "activity-main" && activeTab !== "documents-main" && activeTab !== "data-main" && activeTab !== "xero" && (
            <>
              <CompanyDocumentsTab
                companyId={companyId}
                company={company}
                category={computedDocumentTabs.find(t => t.id === activeTab)?.name}
              />
            </>
          )}

          {activeTab === "documents-main" && (
            <CompanyDocumentsTab companyId={companyId} company={company} category="all" />
          )}
          {/* Data tab redirects to /admin/system?tab=data-warehouse&company_id={id} */}
          {activeTab === "activity-main" && <ActivityTab />}
      </div>

      {/* Company Edit Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Company</SheetTitle>
            <SheetDescription>
              Update company details. Changes will be saved immediately.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Company Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-acn">ACN</Label>
                <Input
                  id="edit-acn"
                  value={editFormData.acn}
                  onChange={(e) => setEditFormData({ ...editFormData, acn: e.target.value })}
                  placeholder="000 000 000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-abn">ABN</Label>
                <Input
                  id="edit-abn"
                  value={editFormData.abn}
                  onChange={(e) => setEditFormData({ ...editFormData, abn: e.target.value })}
                  placeholder="00 000 000 000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="deregistered">Deregistered</SelectItem>
                    <SelectItem value="struck_off">Struck Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-entity-type">Entity Type</Label>
                <Select
                  value={editFormData.entity_type}
                  onValueChange={(value) => setEditFormData({ ...editFormData, entity_type: value })}
                >
                  <SelectTrigger id="edit-entity-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Company">Company</SelectItem>
                    <SelectItem value="Trust">Trust</SelectItem>
                    <SelectItem value="Superfund">Superfund</SelectItem>
                    <SelectItem value="Charity">Charity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date-incorporated">Date Incorporated</Label>
              <Input
                id="edit-date-incorporated"
                type="date"
                value={editFormData.date_incorporated}
                onChange={(e) => setEditFormData({ ...editFormData, date_incorporated: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-registered-office">Registered Office Address</Label>
              <Textarea
                id="edit-registered-office"
                value={editFormData.registered_office_address}
                onChange={(e) => setEditFormData({ ...editFormData, registered_office_address: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ppob">Principal Place of Business</Label>
              <Textarea
                id="edit-ppob"
                value={editFormData.principal_place_of_business}
                onChange={(e) => setEditFormData({ ...editFormData, principal_place_of_business: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-purpose">Purpose</Label>
              <Textarea
                id="edit-purpose"
                value={editFormData.purpose}
                onChange={(e) => setEditFormData({ ...editFormData, purpose: e.target.value })}
                rows={3}
                placeholder="Company purpose or activities..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditSheetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCompany} disabled={savingEdit}>
                {savingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
