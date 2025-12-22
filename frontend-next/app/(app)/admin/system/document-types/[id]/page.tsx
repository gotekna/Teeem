 
"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Save, Trash2, FileText, X, GripVertical, ChevronDown, ChevronRight, ChevronLeft, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import MultipleSelector from "@/components/ui/multiple-selector";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

// Token Components - SSoT for placeholder handling
import { TokenBadge } from "@/components/ui/tokens";
import {
  type PlaceholderToken,
  type PlaceholderScope,
  COMPANY_PLACEHOLDERS,
  JOB_PLACEHOLDERS,
  DATE_PLACEHOLDERS,
  DOCUMENT_PLACEHOLDERS,
  parseTemplate,
  buildTemplate,
  getPlaceholderColor,
  getShortToLongMap,
  PLACEHOLDER_COLOR_CLASSES,
} from "@/lib/placeholders";

// Available folders/tabs
const FOLDER_OPTIONS = [
  "ADVICE", "ASIC", "ASSETS", "ATO", "BANK", "COMPANY",
  "DIVIDENDS", "FINANCIALS", "GENERAL", "INSURANCE",
  "LOANS", "MINUTES", "REGISTRY", "TRUST"
];

// Scope options
const SCOPE_OPTIONS = [
  { value: "company", label: "Company", description: "Corporate documents" },
  { value: "job", label: "Job", description: "Construction/job documents" },
  { value: "people", label: "People", description: "Personal/contact documents" },
  { value: "both", label: "Both", description: "Used for both" }
];

// Common file extensions for documents
const FILE_EXTENSION_OPTIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg",
  ".txt", ".csv", ".zip", ".msg", ".eml"
];

// Placeholder scope mapping - uses SSoT from lib/placeholders.ts
// Note: DocType placeholder is added dynamically based on current document type
const getBasePlaceholders = (scope: string): PlaceholderToken[] => {
  if (scope === "job") {
    return [...JOB_PLACEHOLDERS, ...DATE_PLACEHOLDERS];
  } else if (scope === "both") {
    return [...COMPANY_PLACEHOLDERS, ...JOB_PLACEHOLDERS, ...DATE_PLACEHOLDERS];
  }
  // Default: company scope
  return [...COMPANY_PLACEHOLDERS, ...DATE_PLACEHOLDERS, ...DOCUMENT_PLACEHOLDERS];
};

interface DocumentType {
  id: number;
  name: string;
  display_name?: string;
  abbreviation?: string;
  file_name?: string;
  title_preview?: string;
  category?: string;
  folder?: string;
  description?: string;
  requires_filing?: boolean;
  retention_years?: number;
  active: boolean;
  // OLD (deprecated) - keeping for backwards compatibility
  tabs?: string[];
  primary_tab?: string;
  // NEW SSoT: EntityTab IDs
  entity_tab_ids?: number[];
  entity_tabs?: Array<{
    id: number;
    tab_key: string;
    display_name: string;
    hierarchy_path: string;
    parent_id: number | null;
  }>;
  scope?: string;
  file_extensions?: string[];
  target_folder?: string;
  documents_count?: number;
  created_at?: string;
  updated_at?: string;
}

export default function DocumentTypeDetailPage() {
  // Use full-height layout mode - container provides h-full
  useSetLayoutMode("full-height");

  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [documentType, setDocumentType] = React.useState<DocumentType | null>(null);
  const [newExtension, setNewExtension] = React.useState("");
  const [draggedPlaceholder, setDraggedPlaceholder] = React.useState<string | null>(null);
  const [draggedFromField, setDraggedFromField] = React.useState<"file_name" | "display_name" | "source" | null>(null);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{ field: "file_name" | "display_name"; index: number } | null>(null);
  const [basicInfoExpanded, setBasicInfoExpanded] = React.useState(false);
  const [namingOrgExpanded, setNamingOrgExpanded] = React.useState(true);
  const [filingOrgExpanded, setFilingOrgExpanded] = React.useState(false);
  const [fileExtensionsExpanded, setFileExtensionsExpanded] = React.useState(false);
  const [complianceExpanded, setComplianceExpanded] = React.useState(false);
  const [displayNameSameAsFileName, setDisplayNameSameAsFileName] = React.useState(true);
  const [showFullDescription, setShowFullDescription] = React.useState(true);
  const [removeCompanyName, setRemoveCompanyName] = React.useState(true);
  const [previewCompanyId, setPreviewCompanyId] = React.useState<number | null>(null);
  const [companies, setCompanies] = React.useState<Array<{id: number; name: string; code: string}>>([]);
  const [placeholderSearch, setPlaceholderSearch] = React.useState("");
  const [hidePlaceholderDescriptions, setHidePlaceholderDescriptions] = React.useState(false);
  const [folderOptions, setFolderOptions] = React.useState<string[]>([]); // Root folders only (for Folder/Primary Tab dropdowns)
  const [folderHierarchy, setFolderHierarchy] = React.useState<Array<{ id?: number; name: string; tab_key?: string; children: Array<{ id?: number; name: string; tab_key?: string }> }>>([]); // SSoT: EntityTab hierarchy for Additional Tabs
  const [xeroTabs, setXeroTabs] = React.useState<Array<{ id?: number; name: string; key: string; children: Array<{ id?: number; name: string; key: string }> }>>([]);
  const [focusTextToken, setFocusTextToken] = React.useState<{ field: string; index: number } | null>(null);
  const [allDocumentTypes, setAllDocumentTypes] = React.useState<Array<{ id: number; name: string; scope: string }>>([]);

  const fileNameInputRef = React.useRef<HTMLInputElement>(null);
  const displayNameInputRef = React.useRef<HTMLInputElement>(null);

  // SSoT: Fetch available tabs from EntityTab API (replaces old document_folders)
  React.useEffect(() => {
    const fetchFolders = async () => {
      try {
        // Fetch EntityTabs for corporate_entity scope, documents group
        const data = await api.get<{ success: boolean; data: { tabs: any[] } }>("/api/v1/entity_tabs?scope=corporate_entity");
        if (data.success && data.data?.tabs) {
          // Filter to documents group only
          const documentTabs = data.data.tabs.filter((t: any) => t.tab_group === 'documents');

          // Build folder hierarchy for the additional tabs selector
          const hierarchy = documentTabs.map((t: any) => ({
            id: t.id,
            name: t.display_name,
            tab_key: t.tab_key,
            children: (t.children || []).map((c: any) => ({
              id: c.id,
              name: c.display_name,
              tab_key: c.tab_key
            }))
          }));
          setFolderHierarchy(hierarchy);

          // Extract root tab names for Folder/Primary Tab dropdowns
          const rootNames = documentTabs.map((t: any) => t.display_name).sort();
          setFolderOptions(rootNames);
        } else {
          // Fallback to hard-coded list if API fails
          setFolderOptions(FOLDER_OPTIONS);
          setFolderHierarchy([]);
        }
      } catch (error) {
        console.error("Failed to fetch folders:", error);
        // Fallback to hard-coded list if API fails
        setFolderOptions(FOLDER_OPTIONS);
        setFolderHierarchy([]);
      }
    };
    fetchFolders();
  }, []);

  // SSoT: Xero subtabs are now children of "Xero" tab in EntityTab system
  // They're included in the main entity_tabs fetch above, so we extract them from folderHierarchy
  React.useEffect(() => {
    // Find Xero in the folder hierarchy and use its children as Xero tabs
    const xeroFolder = folderHierarchy.find((f: any) => f.name === "Xero" || f.tab_key === "xero");
    if (xeroFolder) {
      setXeroTabs([{
        name: xeroFolder.name,
        key: xeroFolder.tab_key || "xero",
        id: xeroFolder.id,
        children: (xeroFolder.children || []).map((c: any) => ({
          name: c.name,
          key: c.tab_key,
          id: c.id
        }))
      }]);
    }
  }, [folderHierarchy]);

  // Fetch all document types for navigation
  React.useEffect(() => {
    const fetchAllDocumentTypes = async () => {
      try {
        const response = await api.get<{ success: boolean; data: any[] }>("/api/v1/document_types");
        if (response.success && Array.isArray(response.data)) {
          // Sort by name for consistent navigation, include scope
          const sorted = response.data
            .map((dt: any) => ({ id: dt.id, name: dt.name, scope: dt.scope || "company" }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setAllDocumentTypes(sorted);
        }
      } catch (error) {
        console.error("Failed to fetch document types for navigation:", error);
      }
    };
    fetchAllDocumentTypes();
  }, []);

  const documentTypeId = params.id as string;
  const isNew = documentTypeId === "new";

  React.useEffect(() => {
    if (isNew) {
      // Initialize empty document type for creation
      setDocumentType({
        id: 0,
        name: "",
        display_name: "",
        abbreviation: "",
        file_name: "",
        category: "",
        folder: "",
        description: "",
        requires_filing: false,
        retention_years: undefined,
        active: true,
        tabs: [],
        primary_tab: "",
        scope: "company",
        file_extensions: [],
        target_folder: "",
        entity_tab_ids: [],
      });
      setLoading(false);
      loadCompanies();
    } else if (documentTypeId) {
      loadDocumentType();
      loadCompanies();
    }
  }, [documentTypeId, isNew]);

  const loadCompanies = async () => {
    try {
      const response = await api.get<any>('/api/v1/companies');
      // Handle response format: {success: true, companies: [...], total: N}
      const companiesData = response.data?.companies || response.companies || response.data?.data || response.data || response;

      if (Array.isArray(companiesData)) {
        // Filter to only show corporate-linked companies (those with a company_group_id)
        const corporateLinkedCompanies = companiesData.filter((c: any) => c.company_group_id != null);
        setCompanies(corporateLinkedCompanies);

        // Auto-select Tekna Homes (TH) as default if no preview company is set
        if (corporateLinkedCompanies.length > 0 && previewCompanyId === null) {
          // Try to find Tekna Homes by code "TH" or name containing "Tekna"
          const teknaHomes = corporateLinkedCompanies.find((c: any) =>
            c.code === "TH" || c.name?.toLowerCase().includes("tekna")
          );
          setPreviewCompanyId(teknaHomes ? teknaHomes.id : corporateLinkedCompanies[0].id);
        }
      } else {
        console.warn("Companies data is not an array:", companiesData);
        setCompanies([]);
      }
    } catch (error) {
      console.error("Failed to load companies:", error);
    }
  };

  // Initialize checkbox state based on whether display_name exists
  React.useEffect(() => {
    if (documentType) {
      // Always default all to true - user can uncheck if they want custom display name
      setDisplayNameSameAsFileName(true);
      setShowFullDescription(true);
      setRemoveCompanyName(true);
    }
  }, [documentType?.id]); // Only run when document type changes

  // Map short codes to long codes - uses SSoT from lib/placeholders.ts
  const shortToLongMap: Record<string, string> = {
    // DocType placeholder mapping (added here as it's dynamic)
    "{DocTypeCode}": "{DocTypeName}",
    // Get all other mappings from SSoT
    ...getShortToLongMap(),
  };

  // Convert short placeholders to long versions
  const convertToLongCodes = (value: string): string => {
    let result = value;
    Object.entries(shortToLongMap).forEach(([short, long]) => {
      // Escape curly braces for regex
      const escaped = short.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
      result = result.replace(new RegExp(escaped, 'g'), long);
    });
    return result;
  };

  // Sync display_name with file_name when checkbox is checked
  React.useEffect(() => {
    if (displayNameSameAsFileName && documentType) {
      let fileName = documentType.file_name || "";

      if (showFullDescription) {
        // Convert short codes to long codes
        fileName = convertToLongCodes(fileName);
      }

      // Remove {CompanyName} if the checkbox is checked
      if (removeCompanyName) {
        fileName = fileName.replace(/\{CompanyName\}\s*/g, '').replace(/\{CompanyCode\}\s*/g, '');
      }

      updateField("display_name", fileName);
    }
  }, [displayNameSameAsFileName, showFullDescription, removeCompanyName, documentType?.file_name]);

  const loadDocumentType = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: DocumentType }>(`/api/v1/document_types/${documentTypeId}`);
      setDocumentType(response.data);
    } catch (error) {
      console.error("Failed to load document type:", error);
      toast({
        title: "Error",
        description: "Failed to load document type",
        variant: "destructive",
      });
      router.push("/admin/system?tab=document-types");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!documentType) return;

    // Validate required fields
    if (!documentType.name?.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      if (isNew) {
        // Create new document type
        const response = await api.post<{ success: boolean; data: DocumentType }>(`/api/v1/document_types`, {
          document_type: documentType
        });
        toast({
          title: "Success",
          description: "Document type created successfully",
        });
        // Redirect to the new document type's edit page
        if (response.data?.id) {
          router.push(`/admin/system/document-types/${response.data.id}`);
        }
      } else {
        // Update existing document type
        await api.patch(`/api/v1/document_types/${documentTypeId}`, {
          document_type: documentType
        });
        toast({
          title: "Success",
          description: "Document type saved successfully",
        });
      }
    } catch (error) {
      console.error("Failed to save document type:", error);
      toast({
        title: "Error",
        description: isNew ? "Failed to create document type" : "Failed to save document type",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!documentType) return;

    if (!confirm(`Delete document type "${documentType.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/api/v1/document_types/${documentTypeId}`);
      toast({
        title: "Success",
        description: "Document type deleted successfully",
      });
      router.push("/admin/system?tab=document-types");
    } catch (error: any) {
      console.error("Failed to delete document type:", error);
      const errorMessage = error?.errors?.[0] || "Failed to delete document type";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Navigation functions - filter by current scope (case-insensitive)
  const currentScope = (documentType?.scope || "company").toLowerCase();
  const scopeFilteredTypes = allDocumentTypes.filter(dt => (dt.scope || "company").toLowerCase() === currentScope);
  const currentIndex = scopeFilteredTypes.findIndex(dt => dt.id === parseInt(documentTypeId));
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < scopeFilteredTypes.length - 1 && currentIndex !== -1;

  const navigateToPrevious = () => {
    if (hasPrevious) {
      router.push(`/admin/system/document-types/${scopeFilteredTypes[currentIndex - 1].id}`);
    }
  };

  const navigateToNext = () => {
    if (hasNext) {
      router.push(`/admin/system/document-types/${scopeFilteredTypes[currentIndex + 1].id}`);
    }
  };

  const updateField = (field: keyof DocumentType, value: any) => {
    if (!documentType) return;
    setDocumentType({ ...documentType, [field]: value });
  };


  const addFileExtension = (ext: string) => {
    if (!documentType) return;
    const trimmedExt = ext.trim();
    if (!trimmedExt) return;

    // Ensure it starts with a dot
    const formattedExt = trimmedExt.startsWith('.') ? trimmedExt : `.${trimmedExt}`;

    const currentExts = documentType.file_extensions || [];
    if (!currentExts.includes(formattedExt)) {
      updateField("file_extensions", [...currentExts, formattedExt]);
    }
    setNewExtension("");
  };

  const removeFileExtension = (ext: string) => {
    if (!documentType) return;
    const currentExts = documentType.file_extensions || [];
    updateField("file_extensions", currentExts.filter(e => e !== ext));
  };

  // Check if a placeholder is used in file name or display name
  const isPlaceholderUsed = (placeholderCode: string): boolean => {
    const fileName = documentType?.file_name || "";
    const displayName = documentType?.display_name || "";
    return fileName.includes(placeholderCode) || displayName.includes(placeholderCode);
  };

  // Extract clean name from document type (removes code prefix like "AA - ")
  const getCleanDocTypeName = () => {
    if (!documentType?.name) return "";
    // Remove patterns like "AA - " or "CTR - " from the beginning
    return documentType.name.replace(/^[A-Z0-9]+\s*-\s*/, "").trim();
  };

  // Get placeholders based on scope - uses SSoT from lib/placeholders.ts
  const getAvailablePlaceholders = (): PlaceholderToken[] => {
    const scope = documentType?.scope || "company";

    // Dynamic DocType placeholder based on current document type
    const docTypePlaceholder: PlaceholderToken = {
      code: "{DocTypeCode}",
      example: documentType?.abbreviation || "AA",
      longCode: "{DocTypeName}",
      longExample: getCleanDocTypeName() || "Accountant Advice",
      color: "blue"
    };

    // Get base placeholders from SSoT
    const basePlaceholders = getBasePlaceholders(scope);

    // Add DocType placeholder at the beginning
    const placeholders: PlaceholderToken[] = [docTypePlaceholder, ...basePlaceholders];

    // Filter by search term
    if (placeholderSearch.trim()) {
      const search = placeholderSearch.toLowerCase();
      return placeholders.filter((p) =>
        p.code.toLowerCase().includes(search) ||
        p.longCode?.toLowerCase().includes(search) ||
        p.example?.toLowerCase().includes(search) ||
        p.longExample?.toLowerCase().includes(search)
      );
    }

    return placeholders;
  };

  // Parse a field value into tokens - uses SSoT parseTemplate from lib/placeholders.ts
  // Filters out whitespace-only text tokens for cleaner UI display
  const parseTokens = (value: string): { type: "text" | "placeholder"; value: string }[] => {
    if (!value) return [];
    return parseTemplate(value)
      .map(token => ({
        ...token,
        // Trim text tokens for cleaner display
        value: token.type === "text" ? token.value.trim() : token.value,
      }))
      .filter(token => token.value.length > 0); // Remove empty tokens
  };

  // Rebuild field value from tokens with smart spacing
  const rebuildFromTokens = (tokens: { type: "text" | "placeholder"; value: string }[]): string => {
    if (tokens.length === 0) return "";

    return tokens.map((token, index) => {
      // First token - no prefix space needed
      if (index === 0) return token.value.trimStart();

      // Get previous token
      const prevToken = tokens[index - 1];

      // If previous token is a placeholder, always add space before current
      if (prevToken.type === "placeholder") {
        return " " + token.value.trimStart();
      }

      // If current is placeholder and previous is text without trailing space, add space
      if (token.type === "placeholder" && !prevToken.value.endsWith(" ")) {
        return " " + token.value;
      }

      return token.value;
    }).join("").trim();
  };

  // Get color for placeholder - wraps SSoT function with DocType special case
  const getTokenColor = (placeholder: string): string => {
    // DocType placeholders are blue (dynamic, not in SSoT)
    if (placeholder === "{DocTypeCode}" || placeholder === "{DocTypeName}") {
      return "blue";
    }
    // Use SSoT function for all other placeholders
    return getPlaceholderColor(placeholder);
  };

  // Generate preview by replacing placeholders with example values
  const generatePreview = (value: string, useFullDescription: boolean = false): string => {
    if (!value) return "";

    let preview = value;

    // Get selected company data or use defaults (Tekna Homes)
    const selectedCompany = previewCompanyId ? companies.find(c => c.id === previewCompanyId) : null;
    const companyCode = selectedCompany?.code || "TH";
    const companyName = selectedCompany?.name || "Tekna Homes";

    // Replace DocType placeholders with current document type values
    preview = preview.replace(/\{DocTypeCode\}/g, documentType?.abbreviation || "");
    preview = preview.replace(/\{DocTypeName\}/g, getCleanDocTypeName());

    // Replace placeholders with example values
    // Use full names if checkbox is checked, otherwise use codes
    preview = preview.replace(/\{CompanyCode\}/g, companyCode);
    preview = preview.replace(/\{DisplayName\}/g, companyName);
    preview = preview.replace(/\{LoanID\}/g, "L001");
    preview = preview.replace(/\{LoanName\}/g, "Loan to ABC Trust");
    preview = preview.replace(/\{AssetCode\}/g, "PROP1");
    preview = preview.replace(/\{AssetName\}/g, "123 Main Street");
    preview = preview.replace(/\{LenderCode\}/g, "ABC");
    preview = preview.replace(/\{LenderName\}/g, "ABC Property Trust");
    preview = preview.replace(/\{FY\}/g, "FY25");
    preview = preview.replace(/\{YY\}/g, "25");
    preview = preview.replace(/\{Period\}/g, "Q1");
    preview = preview.replace(/\{PeriodLong\}/g, "Q1 Jul-Sep");
    preview = preview.replace(/\{Date\}/g, new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-"));
    preview = preview.replace(/\{PrintDate\}/g, new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-"));
    preview = preview.replace(/\{JobCode\}/g, "J069");
    preview = preview.replace(/\{JobTitle\}/g, "83 West Ridge");
    preview = preview.replace(/\{CertType\}/g, useFullDescription ? "Certificate of Occupancy" : "Occupancy");
    preview = preview.replace(/\{Consultant\}/g, useFullDescription ? "ABC Engineering" : "ABC Eng");
    preview = preview.replace(/\{Number\}/g, "01");
    preview = preview.replace(/\{Description\}/g, "Example");
    preview = preview.replace(/\{BankCode\}/g, "NAB");
    preview = preview.replace(/\{BankName\}/g, "National Australia Bank");
    preview = preview.replace(/\{BSB\}/g, "082-123");
    preview = preview.replace(/\{BankNumber\}/g, "12345678");
    preview = preview.replace(/\{AccountNum\}/g, "12345678");

    return preview.trim();
  };

  // Handle drag start from source placeholders
  const handleDragStartFromSource = (e: React.DragEvent, placeholder: string) => {
    setDraggedPlaceholder(placeholder);
    setDraggedFromField("source");
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", placeholder);
  };

  // Handle drag start from field token
  const handleDragStartFromToken = (
    e: React.DragEvent,
    field: "file_name" | "display_name",
    index: number,
    placeholder: string
  ) => {
    setDraggedPlaceholder(placeholder);
    setDraggedFromField(field);
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", placeholder);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedPlaceholder(null);
    setDraggedFromField(null);
    setDraggedIndex(null);
    setDropTarget(null);
  };

  // Handle drop to reorder within field
  const handleDropOnToken = (
    e: React.DragEvent,
    field: "file_name" | "display_name",
    dropIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!documentType) return;

    const placeholder = e.dataTransfer.getData("text/plain");
    const currentValue = documentType[field] || "";
    const tokens = parseTokens(currentValue);

    // If dragging from same field, reorder
    if (draggedFromField === field && draggedIndex !== null) {
      const newTokens = [...tokens];
      const [removed] = newTokens.splice(draggedIndex, 1);
      newTokens.splice(dropIndex, 0, removed);
      updateField(field, rebuildFromTokens(newTokens));
    }
    // If dragging from source, insert
    else if (draggedFromField === "source") {
      const newTokens = [...tokens];
      // Handle custom text - insert a text token with empty/default value
      if (placeholder === "__CUSTOM_TEXT__") {
        newTokens.splice(dropIndex, 0, { type: "text", value: "text" });
        // Auto-focus the new text input
        setFocusTextToken({ field, index: dropIndex });
      } else {
        newTokens.splice(dropIndex, 0, { type: "placeholder", value: placeholder });
      }
      updateField(field, rebuildFromTokens(newTokens));
    }
    // If dragging custom text without going through source state
    else if (placeholder === "__CUSTOM_TEXT__") {
      const newTokens = [...tokens];
      newTokens.splice(dropIndex, 0, { type: "text", value: "text" });
      // Auto-focus the new text input
      setFocusTextToken({ field, index: dropIndex });
      updateField(field, rebuildFromTokens(newTokens));
    }

    setDraggedPlaceholder(null);
    setDraggedFromField(null);
    setDraggedIndex(null);
    setDropTarget(null);
  };

  // Handle drag over (required to allow drop)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedFromField === "source" ? "copy" : "move";
  };

  // Handle drag over on a specific position
  const handleDragOverPosition = (e: React.DragEvent, field: "file_name" | "display_name", index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget({ field, index });
  };

  // Handle drop on container (append to end)
  const handleDropOnContainer = (e: React.DragEvent, field: "file_name" | "display_name") => {
    e.preventDefault();
    if (!documentType) return;

    const placeholder = e.dataTransfer.getData("text/plain");
    if (!placeholder) return;

    // Only handle drops from source (not reordering)
    if (draggedFromField === "source" || placeholder === "__CUSTOM_TEXT__") {
      const currentValue = documentType[field] || "";
      const tokens = parseTokens(currentValue);
      // Handle custom text - insert plain text token
      if (placeholder === "__CUSTOM_TEXT__") {
        const newValue = currentValue + (currentValue ? " " : "") + "text";
        updateField(field, newValue);
        // Auto-focus the new text input (it will be at the end)
        setFocusTextToken({ field, index: tokens.length });
      } else {
        const newValue = currentValue + (currentValue ? " " : "") + placeholder;
        updateField(field, newValue);
      }
    }

    setDraggedPlaceholder(null);
    setDraggedFromField(null);
    setDraggedIndex(null);
    setDropTarget(null);
  };

  // Remove token from field
  const removeToken = (field: "file_name" | "display_name", index: number) => {
    if (!documentType) return;
    const tokens = parseTokens(documentType[field] || "");
    const newTokens = tokens.filter((_, i) => i !== index);
    updateField(field, rebuildFromTokens(newTokens));
  };

  // Edit text token
  const updateTextToken = (field: "file_name" | "display_name", index: number, newValue: string) => {
    if (!documentType) return;
    const tokens = parseTokens(documentType[field] || "");
    tokens[index] = { type: "text", value: newValue };
    updateField(field, rebuildFromTokens(tokens));
  };

  // Click to insert at end
  const handlePlaceholderClick = (placeholder: string, field: "file_name" | "display_name") => {
    if (!documentType) return;
    const currentValue = documentType[field] || "";
    const newValue = currentValue + (currentValue ? " " : "") + placeholder;
    updateField(field, newValue);
  };

  // Add blank text token
  const addBlankText = (field: "file_name" | "display_name") => {
    if (!documentType) return;
    const tokens = parseTokens(documentType[field] || "");
    tokens.push({ type: "text", value: " " });
    updateField(field, rebuildFromTokens(tokens));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!documentType) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Document type not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed at top */}
      <div className="flex items-start justify-between p-2 shrink-0">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          {/* Previous/Next navigation - filtered by scope (hidden for new) */}
          {!isNew && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={navigateToPrevious}
                disabled={!hasPrevious}
                className="h-8 w-8"
                title={hasPrevious ? `Previous: ${scopeFilteredTypes[currentIndex - 1]?.name}` : "No previous"}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={navigateToNext}
                disabled={!hasNext}
                className="h-8 w-8"
                title={hasNext ? `Next: ${scopeFilteredTypes[currentIndex + 1]?.name}` : "No next"}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <h1 className="text-2xl font-bold tracking-tight font-serif">
                {isNew ? "New Document Type" : documentType.name || "Untitled"}
              </h1>
              {!isNew && documentType.abbreviation && (
                <Badge variant="outline" className="font-mono font-bold">
                  {documentType.abbreviation}
                </Badge>
              )}
              {!isNew && scopeFilteredTypes.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1} of {scopeFilteredTypes.length} {currentScope}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isNew ? "Create a new document type" : `${documentType.documents_count || 0} documents using this type`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isNew ? "Creating..." : "Saving..."}
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isNew ? "Create Document Type" : "Save Changes"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto space-y-6 p-2">

      {/* Basic Info */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors pb-2 pt-4"
          onClick={() => setBasicInfoExpanded(!basicInfoExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Basic Information</CardTitle>
            {basicInfoExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {basicInfoExpanded && (
          <CardContent className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Document Type Name *</Label>
              <Input
                id="name"
                value={documentType.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Company Tax Return"
              />
              <p className="text-xs text-muted-foreground">
                How this document type appears in dropdowns and lists
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="abbreviation">Code / Abbreviation</Label>
              <Input
                id="abbreviation"
                value={documentType.abbreviation || ""}
                onChange={(e) => updateField("abbreviation", e.target.value.toUpperCase())}
                placeholder="CTR"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Short code for quick identification
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={documentType.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Brief description of this document type..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Select
                value={documentType.scope || "company"}
                onValueChange={(value) => updateField("scope", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div>
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {SCOPE_OPTIONS.find(o => o.value === documentType.scope)?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={documentType.category || ""}
                onChange={(e) => updateField("category", e.target.value)}
                placeholder="e.g., Tax, Compliance"
              />
              <p className="text-xs text-muted-foreground">Optional grouping</p>
            </div>

            <div className="flex items-center justify-between pt-8">
              <div className="flex flex-col gap-1">
                <Label htmlFor="active">Active</Label>
                <p className="text-xs text-muted-foreground">Show in dropdowns</p>
              </div>
              <Switch
                id="active"
                checked={documentType.active}
                onCheckedChange={(checked) => updateField("active", checked)}
              />
            </div>
          </div>
          </CardContent>
        )}
      </Card>

      {/* Naming & Organization */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors pb-2 pt-4"
          onClick={() => setNamingOrgExpanded(!namingOrgExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Naming & Organization</CardTitle>
            {namingOrgExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {namingOrgExpanded && (
          <CardContent className="space-y-4 pt-2">
          <div className="flex gap-4">
            {/* Left side - File Name and Display Name */}
            <div className="flex-1 space-y-4">
              {/* Preview Company Dropdown */}
              <div className="space-y-1 mb-6">
                <Label htmlFor="preview-company" className="text-sm text-muted-foreground">
                  Preview Company
                </Label>
                <Select
                  value={previewCompanyId?.toString() || "default"}
                  onValueChange={(value) => setPreviewCompanyId(value === "default" ? null : parseInt(value))}
                >
                  <SelectTrigger id="preview-company" className="h-9">
                    <SelectValue>
                      {previewCompanyId
                        ? (() => {
                            const company = companies.find(c => c.id === previewCompanyId);
                            return company ? `${company.code} - ${company.name}` : "Example Data";
                          })()
                        : "Example Data"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Example Data</SelectItem>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.code} - {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="file_name">File Name</Label>
            <div
              className={cn(
                "min-h-[60px] p-3 border rounded-md bg-background flex flex-wrap gap-1 items-center transition-colors",
                draggedFromField && "border-dashed border-2 border-green-400 bg-green-50/50"
              )}
              onDrop={(e) => {
                const tokens = parseTokens(documentType.file_name || "");
                handleDropOnToken(e, "file_name", tokens.length);
              }}
              onDragOver={(e) => {
                handleDragOver(e);
                const tokens = parseTokens(documentType.file_name || "");
                setDropTarget({ field: "file_name", index: tokens.length });
              }}
              onDragLeave={() => setDropTarget(null)}
            >
              {parseTokens(documentType.file_name || "").map((token, index) => (
                <React.Fragment key={index}>
                  {/* Drop indicator line - only shows at current drop position */}
                  {dropTarget?.field === "file_name" && dropTarget.index === index && (
                    <div className="w-1 h-10 bg-blue-500 rounded-full animate-pulse shadow-lg shadow-blue-500/50" />
                  )}
                  <div
                    draggable={token.type === "placeholder"}
                    onDragStart={(e) =>
                      token.type === "placeholder" &&
                      handleDragStartFromToken(e, "file_name", index, token.value)
                    }
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDropOnToken(e, "file_name", index);
                    }}
                    onDragOver={(e) => handleDragOverPosition(e, "file_name", index)}
                    className={cn(
                      token.type === "placeholder" &&
                        "cursor-grab active:cursor-grabbing transition-all",
                      draggedFromField === "file_name" &&
                        draggedIndex === index &&
                        "opacity-30"
                    )}
                  >
                    {token.type === "placeholder" ? (
                      <Badge
                        className={cn(
                          "font-mono text-xs px-3 py-1.5 select-none",
                          getTokenColor(token.value) === "purple" &&
                            "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700",
                          getTokenColor(token.value) === "orange" &&
                            "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300 border-orange-300 dark:border-orange-700",
                          getTokenColor(token.value) === "blue" &&
                            "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                        )}
                      >
                        <GripVertical className="h-3 w-3 mr-1 inline" />
                        {token.value}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeToken("file_name", index);
                          }}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : (
                      // Text tokens - white/gray draggable badge with editable text
                      <Badge
                        variant="outline"
                        className="font-mono text-xs px-2 py-1.5 select-none bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="h-3 w-3 mr-1 inline text-muted-foreground" />
                        <input
                          type="text"
                          value={token.value}
                          onChange={(e) => updateTextToken("file_name", index, e.target.value)}
                          className="bg-transparent border-none outline-none w-auto min-w-[20px] max-w-[100px] text-xs font-mono"
                          style={{ width: `${Math.max(20, token.value.length * 7)}px` }}
                          placeholder="text"
                          ref={(el) => {
                            if (el && focusTextToken?.field === "file_name" && focusTextToken?.index === index) {
                              el.focus();
                              el.select();
                              setFocusTextToken(null);
                            }
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeToken("file_name", index);
                          }}
                          className="ml-1 hover:text-destructive text-muted-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                  </div>
                </React.Fragment>
              ))}
              {/* Drop indicator at end */}
              {dropTarget?.field === "file_name" && dropTarget.index === parseTokens(documentType.file_name || "").length && (
                <div className="w-1 h-10 bg-blue-500 rounded-full animate-pulse shadow-lg shadow-blue-500/50" />
              )}
              {parseTokens(documentType.file_name || "").length === 0 && !draggedFromField && (
                <span className="text-sm text-muted-foreground">
                  Drag placeholders here to build your file name template
                </span>
              )}
              {parseTokens(documentType.file_name || "").length === 0 && draggedFromField && (
                <span className="text-sm text-green-600 font-medium animate-pulse">
                  Drop here!
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <span className="text-muted-foreground font-medium">Preview:</span>
              {documentType.file_name && generatePreview(documentType.file_name) ? (
                <span className="font-semibold text-green-700 dark:text-green-400 font-mono">
                  {generatePreview(documentType.file_name)}
                </span>
              ) : (
                <span className="text-muted-foreground italic">
                  (empty - add placeholders to see preview)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Drag placeholders to reorder them. Click X to remove. Edit text directly.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <Label htmlFor="display_name">Display Name</Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hide-company"
                      checked={removeCompanyName}
                      onCheckedChange={(checked) => setRemoveCompanyName(checked as boolean)}
                    />
                    <Label
                      htmlFor="hide-company"
                      className="text-sm font-normal cursor-pointer text-muted-foreground"
                    >
                      {documentType.scope === "people" ? "Hide Person" : documentType.scope === "job" ? "Hide Job" : "Hide Company"}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="same-as-file-name"
                      checked={displayNameSameAsFileName}
                      onCheckedChange={(checked) => setDisplayNameSameAsFileName(checked as boolean)}
                    />
                    <Label
                      htmlFor="same-as-file-name"
                      className="text-sm font-normal cursor-pointer text-muted-foreground"
                    >
                      Same as File Name
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="full-description"
                      checked={showFullDescription}
                      onCheckedChange={(checked) => setShowFullDescription(checked as boolean)}
                    />
                    <Label
                      htmlFor="full-description"
                      className="text-sm font-normal cursor-pointer text-muted-foreground"
                    >
                      Full Description
                    </Label>
                  </div>
                </div>
              </div>
            </div>
            <div
              className={cn(
                "min-h-[60px] p-3 border rounded-md bg-background flex flex-wrap gap-1 items-center transition-colors",
                displayNameSameAsFileName && "opacity-50 pointer-events-none",
                !displayNameSameAsFileName && draggedFromField && "border-dashed border-2 border-green-400 bg-green-50/50"
              )}
              onDrop={(e) => {
                if (displayNameSameAsFileName) return;
                const tokens = parseTokens(documentType.display_name || "");
                handleDropOnToken(e, "display_name", tokens.length);
              }}
              onDragOver={(e) => {
                if (displayNameSameAsFileName) return;
                handleDragOver(e);
                const tokens = parseTokens(documentType.display_name || "");
                setDropTarget({ field: "display_name", index: tokens.length });
              }}
              onDragLeave={() => setDropTarget(null)}
            >
              {parseTokens(documentType.display_name || "").map((token, index) => (
                <React.Fragment key={index}>
                  {/* Drop indicator line - only shows at current drop position */}
                  {dropTarget?.field === "display_name" && dropTarget.index === index && (
                    <div className="w-1 h-10 bg-blue-500 rounded-full animate-pulse shadow-lg shadow-blue-500/50" />
                  )}
                  <div
                    draggable={token.type === "placeholder"}
                    onDragStart={(e) =>
                      token.type === "placeholder" &&
                      handleDragStartFromToken(e, "display_name", index, token.value)
                    }
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDropOnToken(e, "display_name", index);
                    }}
                    onDragOver={(e) => handleDragOverPosition(e, "display_name", index)}
                    className={cn(
                      token.type === "placeholder" &&
                        "cursor-grab active:cursor-grabbing transition-all",
                      draggedFromField === "display_name" &&
                        draggedIndex === index &&
                        "opacity-30"
                    )}
                  >
                    {token.type === "placeholder" ? (
                      <Badge
                        className={cn(
                          "font-mono text-xs px-3 py-1.5 select-none",
                          getTokenColor(token.value) === "purple" &&
                            "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700",
                          getTokenColor(token.value) === "orange" &&
                            "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300 border-orange-300 dark:border-orange-700",
                          getTokenColor(token.value) === "blue" &&
                            "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                        )}
                      >
                        <GripVertical className="h-3 w-3 mr-1 inline" />
                        {token.value}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeToken("display_name", index);
                          }}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : (
                      // Text tokens - white/gray draggable badge with editable text
                      <Badge
                        variant="outline"
                        className="font-mono text-xs px-2 py-1.5 select-none bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="h-3 w-3 mr-1 inline text-muted-foreground" />
                        <input
                          type="text"
                          value={token.value}
                          onChange={(e) => updateTextToken("display_name", index, e.target.value)}
                          className="bg-transparent border-none outline-none w-auto min-w-[20px] max-w-[100px] text-xs font-mono"
                          style={{ width: `${Math.max(20, token.value.length * 7)}px` }}
                          placeholder="text"
                          ref={(el) => {
                            if (el && focusTextToken?.field === "display_name" && focusTextToken?.index === index) {
                              el.focus();
                              el.select();
                              setFocusTextToken(null);
                            }
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeToken("display_name", index);
                          }}
                          className="ml-1 hover:text-destructive text-muted-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                  </div>
                </React.Fragment>
              ))}
              {/* Drop indicator at end */}
              {dropTarget?.field === "display_name" && dropTarget.index === parseTokens(documentType.display_name || "").length && (
                <div className="w-1 h-10 bg-blue-500 rounded-full animate-pulse shadow-lg shadow-blue-500/50" />
              )}
              {parseTokens(documentType.display_name || "").length === 0 && !draggedFromField && (
                <span className="text-sm text-muted-foreground">
                  Optional: Leave empty to use Document Type Name, or drag placeholders here
                </span>
              )}
              {parseTokens(documentType.display_name || "").length === 0 && !displayNameSameAsFileName && draggedFromField && (
                <span className="text-sm text-green-600 font-medium animate-pulse">
                  Drop here!
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <span className="text-muted-foreground font-medium">Preview:</span>
              {documentType.display_name && generatePreview(documentType.display_name, showFullDescription) ? (
                <span className="font-semibold text-green-700 dark:text-green-400 font-mono">
                  {generatePreview(documentType.display_name, showFullDescription)}
                </span>
              ) : (
                <span className="text-muted-foreground italic">
                  (empty - add placeholders to see preview)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {displayNameSameAsFileName
                ? "Display Name will automatically match File Name. Uncheck to customize separately."
                : "Override the document type name for specific display contexts. Drag to reorder, X to remove."}
            </p>
          </div>
            </div>
            {/* End left side */}

            {/* Right side - Available Placeholders */}
            <div className="w-[17rem] shrink-0 self-start sticky top-4">
              <div className="space-y-1.5 p-2 bg-muted/30 rounded-lg border max-h-[600px] overflow-y-auto">
                <div className="flex items-center gap-2 mb-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground shrink-0">
                    Placeholders
                  </Label>
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={placeholderSearch}
                    onChange={(e) => setPlaceholderSearch(e.target.value)}
                    className="h-5 text-[10px] flex-1"
                  />
                </div>
                {/* Custom Text draggable item */}
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", "__CUSTOM_TEXT__");
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onDragEnd={handleDragEnd}
                  className="cursor-grab active:cursor-grabbing px-2 py-1.5 rounded border bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600 mb-2"
                >
                  <div className="flex items-center gap-1.5">
                    <Type className="h-3 w-3 text-gray-500" />
                    <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Custom Text</span>
                  </div>
                  <div className="text-[8px] text-muted-foreground">Drag to add editable text</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="grid grid-cols-2 gap-x-2 flex-1 text-[9px] font-semibold text-muted-foreground uppercase">
                    <div>Short</div>
                    <div>Long</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      id="hide-desc"
                      checked={hidePlaceholderDescriptions}
                      onCheckedChange={(checked) => setHidePlaceholderDescriptions(checked as boolean)}
                      className="h-3 w-3"
                    />
                    <Label htmlFor="hide-desc" className="text-[8px] text-muted-foreground cursor-pointer">
                      Hide
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  {getAvailablePlaceholders().map((placeholder: any, idx: number) => {
                    const isBlue = placeholder.color === "blue";
                    return (
                    <React.Fragment key={`${placeholder.code}-${idx}`}>
                      {/* Short code */}
                      <div
                        draggable
                        onDragStart={(e) => handleDragStartFromSource(e, placeholder.code)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "cursor-grab active:cursor-grabbing px-1.5 py-1 rounded border",
                          isPlaceholderUsed(placeholder.code)
                            ? "bg-purple-50 border-purple-200 dark:bg-purple-900/50"
                            : isBlue
                              ? "bg-blue-50 border-blue-200 dark:bg-blue-900/50"
                              : "bg-green-50 border-green-200 dark:bg-green-900/50",
                          draggedPlaceholder === placeholder.code && draggedFromField === "source" && "opacity-50"
                        )}
                      >
                        <div className={cn(
                          "text-[9px] font-mono font-medium",
                          isPlaceholderUsed(placeholder.code)
                            ? "text-purple-700 dark:text-purple-300"
                            : isBlue
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-green-700 dark:text-green-300"
                        )}>
                          {(placeholder.label || placeholder.code).replace(/[{}]/g, '')}
                        </div>
                        {!hidePlaceholderDescriptions && (
                          <div className="text-[8px] text-muted-foreground truncate">
                            {placeholder.example}
                          </div>
                        )}
                      </div>
                      {/* Long code */}
                      {placeholder.longCode ? (
                        <div
                          draggable
                          onDragStart={(e) => handleDragStartFromSource(e, placeholder.longCode)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "cursor-grab active:cursor-grabbing px-1.5 py-1 rounded border",
                            isPlaceholderUsed(placeholder.longCode)
                              ? "bg-purple-50 border-purple-200 dark:bg-purple-900/50"
                              : isBlue
                                ? "bg-blue-50 border-blue-200 dark:bg-blue-900/50"
                                : "bg-green-50 border-green-200 dark:bg-green-900/50",
                            draggedPlaceholder === placeholder.longCode && draggedFromField === "source" && "opacity-50"
                          )}
                        >
                          <div className={cn(
                            "text-[9px] font-mono font-medium truncate",
                            isPlaceholderUsed(placeholder.longCode)
                              ? "text-purple-700 dark:text-purple-300"
                              : isBlue
                                ? "text-blue-700 dark:text-blue-300"
                                : "text-green-700 dark:text-green-300"
                          )}>
                            {placeholder.longCode.replace(/[{}]/g, '')}
                          </div>
                          {!hidePlaceholderDescriptions && (
                            <div className="text-[8px] text-muted-foreground truncate">
                              {placeholder.longExample}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div />
                      )}
                    </React.Fragment>
                  )})}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        )}
      </Card>

      {/* Filing & Organization */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors pb-2 pt-4"
          onClick={() => setFilingOrgExpanded(!filingOrgExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filing & Organization</CardTitle>
            {filingOrgExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {filingOrgExpanded && (
          <CardContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="folder">Folder</Label>
                <Select
                  value={documentType.folder || "GENERAL"}
                  onValueChange={(value) => updateField("folder", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {folderOptions.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Main folder location</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary_tab">Primary Tab</Label>
                <Select
                  value={documentType.primary_tab || "GENERAL"}
                  onValueChange={(value) => updateField("primary_tab", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {folderOptions.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Default tab to show</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Additional Tabs</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select all tabs where this document type should appear
              </p>
              <MultipleSelector
                placeholder="Select folders/tabs..."
                options={(() => {
                  const opts: Array<{ value: string; label: string }> = [];

                  // SSoT: Build options from EntityTab hierarchy
                  folderHierarchy.forEach((folder: any) => {
                    // Add the folder itself (use ID as value)
                    if (folder.id) {
                      opts.push({
                        value: folder.id.toString(),
                        label: folder.name,
                      });
                    }

                    // Add children (subtabs)
                    (folder.children || []).forEach((child: any) => {
                      if (child.id) {
                        opts.push({
                          value: child.id.toString(),
                          label: `  └ ${child.name}`,
                        });
                      }
                    });
                  });

                  return opts;
                })()}
                value={(documentType.entity_tab_ids || []).map(tabId => {
                  // Find the tab in hierarchy to get label
                  let label = `Tab ${tabId}`;
                  for (const folder of folderHierarchy as any[]) {
                    if (folder.id === tabId) {
                      label = folder.name;
                      break;
                    }
                    for (const child of (folder.children || []) as any[]) {
                      if (child.id === tabId) {
                        label = child.name;
                        break;
                      }
                    }
                  }
                  return { value: tabId.toString(), label };
                })}
                onChange={(options) => updateField("entity_tab_ids", options.map(o => parseInt(o.value)))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Select the tabs where documents of this type should be displayed.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* File Extensions */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setFileExtensionsExpanded(!fileExtensionsExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle>Allowed File Extensions</CardTitle>
            {fileExtensionsExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {fileExtensionsExpanded && (
          <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Extensions</Label>
            <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border rounded-md">
              {(documentType.file_extensions || []).length === 0 ? (
                <span className="text-sm text-muted-foreground">No extensions specified (all allowed)</span>
              ) : (
                documentType.file_extensions?.map((ext) => (
                  <Badge key={ext} variant="secondary" className="font-mono">
                    {ext}
                    <button
                      onClick={() => removeFileExtension(ext)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Add Extensions</Label>
            <div className="flex flex-wrap gap-2">
              {FILE_EXTENSION_OPTIONS.map(ext => (
                <Button
                  key={ext}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addFileExtension(ext)}
                  disabled={(documentType.file_extensions || []).includes(ext)}
                  className="font-mono text-xs"
                >
                  {ext}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-extension">Or Add Custom Extension</Label>
            <div className="flex gap-2">
              <Input
                id="custom-extension"
                value={newExtension}
                onChange={(e) => setNewExtension(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFileExtension(newExtension);
                  }
                }}
                placeholder=".pdf or pdf"
                className="font-mono text-sm"
              />
              <Button
                type="button"
                onClick={() => addFileExtension(newExtension)}
                disabled={!newExtension.trim()}
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter or click Add. Dot prefix optional.
            </p>
          </div>
        </CardContent>
        )}
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setComplianceExpanded(!complianceExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle>Compliance & Retention</CardTitle>
            {complianceExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {complianceExpanded && (
          <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="requires_filing" className="text-base font-medium">
                Requires Filing with Authorities
              </Label>
              <p className="text-sm text-muted-foreground">
                Must be submitted to ASIC, ATO, or other regulatory bodies
              </p>
            </div>
            <Switch
              id="requires_filing"
              checked={documentType.requires_filing || false}
              onCheckedChange={(checked) => updateField("requires_filing", checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="retention_years">Retention Period (Years)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="retention_years"
                type="number"
                min="0"
                max="99"
                value={documentType.retention_years || ""}
                onChange={(e) => updateField("retention_years", parseInt(e.target.value) || null)}
                placeholder="7"
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">
                years (leave empty for indefinite)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              How long to keep before archiving/deleting. Common: 7 years for tax, 5 for general records.
            </p>
          </div>
        </CardContent>
        )}
      </Card>

      {/* Metadata */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Document Type ID:</span>
              <span className="ml-2 font-mono">{documentType.id}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Documents Count:</span>
              <span className="ml-2">{documentType.documents_count || 0}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Created:</span>
              <span className="ml-2">
                {documentType.created_at ? new Date(documentType.created_at).toLocaleString() : "—"}
              </span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Last Updated:</span>
              <span className="ml-2">
                {documentType.updated_at ? new Date(documentType.updated_at).toLocaleString() : "—"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save reminder at bottom */}
      <div className="flex justify-end gap-2 pb-8">
        <Button variant="outline" onClick={() => router.push("/admin/system?tab=document-types")}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save All Changes
            </>
          )}
        </Button>
      </div>
      </div>
      {/* End scroll area */}
    </div>
  );
}
