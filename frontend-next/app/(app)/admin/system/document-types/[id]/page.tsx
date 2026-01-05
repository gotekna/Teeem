 
"use client";

import * as React from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
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
import {
  Save,
  Trash2,
  FileText,
  X,
  GripVertical,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Type,
  Copy,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import MultipleSelector from "@/components/ui/multiple-selector";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

// Token Components - SSoT for placeholder handling
import { TokenBadge } from "@/components/ui/tokens";
import { Spinner } from "@/components/ui/spinner";
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
import { DOCUMENT_TYPE_SCOPES, DOCUMENT_FOLDER_OPTIONS } from "@/lib/constants/document-types";

// Re-export for local use (SSoT: @/lib/constants/document-types.ts)
const FOLDER_OPTIONS = DOCUMENT_FOLDER_OPTIONS;
const SCOPE_OPTIONS = DOCUMENT_TYPE_SCOPES;

// Common file extensions for documents
const FILE_EXTENSION_OPTIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg",
  ".txt", ".csv", ".zip", ".msg", ".eml"
];

// Placeholder scope mapping - uses SSoT from lib/placeholders.ts
// Note: DocType placeholder is added dynamically based on current document type
const getBasePlaceholders = (scope: string): PlaceholderToken[] => {
  if (scope === "job") {
    return [...JOB_PLACEHOLDERS, ...DATE_PLACEHOLDERS, ...DOCUMENT_PLACEHOLDERS];
  } else if (scope === "contacts" || scope === "people") {
    // SSoT: "contacts" is canonical, "people" is legacy
    return [...COMPANY_PLACEHOLDERS, ...DATE_PLACEHOLDERS, ...DOCUMENT_PLACEHOLDERS];
  } else if (scope === "both") {
    return [...COMPANY_PLACEHOLDERS, ...JOB_PLACEHOLDERS, ...DATE_PLACEHOLDERS, ...DOCUMENT_PLACEHOLDERS];
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
  supports_versioning?: boolean;
  form_number_mapping?: Record<string, string>; // Dwelling type -> Form number mapping
}

export default function DocumentTypeDetailPage() {
  // Use fullscreen layout mode - hides sidebar for focused editing
  useSetLayoutMode("fullscreen");

  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
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
  const [previewPersonId, setPreviewPersonId] = React.useState<number | null>(null);
  const [previewJobId, setPreviewJobId] = React.useState<number | null>(46); // Default to Job 46
  const [companies, setCompanies] = React.useState<Array<{id: number; name: string; code: string}>>([]);
  const [people, setPeople] = React.useState<Array<{id: number; name: string; code: string}>>([]);
  const [jobs, setJobs] = React.useState<Array<{id: number; name: string; code: string}>>([]);
  const [placeholderSearch, setPlaceholderSearch] = React.useState("");
  const [hidePlaceholderDescriptions, setHidePlaceholderDescriptions] = React.useState(false);
  const [folderOptions, setFolderOptions] = React.useState<string[]>([]); // Root folders only (for Folder/Primary Tab dropdowns)
  const [folderHierarchy, setFolderHierarchy] = React.useState<Array<{ id?: number; name: string; tab_key?: string; children: Array<{ id?: number; name: string; tab_key?: string }> }>>([]); // SSoT: EntityTab hierarchy for Additional Tabs
  const [xeroTabs, setXeroTabs] = React.useState<Array<{ id?: number; name: string; key: string; children: Array<{ id?: number; name: string; key: string }> }>>([]);
  const [focusTextToken, setFocusTextToken] = React.useState<{ field: string; index: number } | null>(null);
  const [allDocumentTypes, setAllDocumentTypes] = React.useState<Array<{ id: number; name: string; scope: string }>>([]);
  const [dwellingTypes, setDwellingTypes] = React.useState<Array<{ value: string; description: string; displayLabel: string }>>([]);

  // SSoT: Naming format change confirmation dialog state
  const [renameConfirmDialog, setRenameConfirmDialog] = React.useState<{
    open: boolean;
    oldFormat: string;
    newFormat: string;
    affectedCount: number;
    preview?: Array<{ id: number; current_name: string; proposed_name: string; job_code?: string; company_code?: string }>;
    showPreview?: boolean;
    loadingPreview?: boolean;
  } | null>(null);
  const [renaming, setRenaming] = React.useState(false);

  const fileNameInputRef = React.useRef<HTMLInputElement>(null);
  const displayNameInputRef = React.useRef<HTMLInputElement>(null);

  // URL params - must be declared before useEffects that use them
  const documentTypeId = params.id as string;
  const isNew = documentTypeId === "new";
  const searchParams = useSearchParams();
  const urlScope = searchParams.get("scope") as "company" | "job" | "contacts" | "people" | null;
  const urlTabId = searchParams.get("tab");

  // SSoT: Fetch available tabs from EntityTab API (replaces old document_folders)
  React.useEffect(() => {
    const fetchFolders = async () => {
      try {
        // Use document type scope (for existing) or URL scope (for new), default to corporate_entity
        const scope = documentType?.scope || urlScope || "company";
        // Map document type scope to EntityTab scope
        // SSoT: Map document type scope to EntityTab scope
        // "contacts" and legacy "people" both map to "contact" EntityTab scope
        const entityTabScope = (scope === "contacts" || scope === "people") ? "contact" : scope === "job" ? "job" : "corporate_entity";

        // Build folder hierarchy recursively for all depths
        const mapTabRecursive = (tab: any): any => ({
          id: tab.id,
          name: tab.display_name,
          tab_key: tab.tab_key,
          children: (tab.children || []).map(mapTabRecursive)
        });

        // Fetch EntityTabs for the appropriate scope, documents group
        // SSoT: Xero tabs are children of the Xero tab in corporate_entity scope
        const data = await api.get<{ success: boolean; data: { tabs: any[] } }>(`/api/v1/entity_tabs?scope=${entityTabScope}`);
        let allDocumentTabs: any[] = [];

        if (data.success && data.data?.tabs) {
          // Filter to documents group tabs (Xero is now in documents group with children nested)
          allDocumentTabs = data.data.tabs.filter((t: any) => t.tab_group === 'documents');
        }

        if (allDocumentTabs.length > 0) {
          const hierarchy = allDocumentTabs.map(mapTabRecursive);
          setFolderHierarchy(hierarchy);

          // Extract root tab names for Folder/Primary Tab dropdowns (keep sorted)
          const rootNames = allDocumentTabs.map((t: any) => t.display_name).sort();
          setFolderOptions(rootNames);
        } else {
          // Fallback to hard-coded list if API fails
          setFolderOptions([...DOCUMENT_FOLDER_OPTIONS]);
          setFolderHierarchy([]);
        }
      } catch (error) {
        console.error("Failed to fetch folders:", error);
        // Fallback to hard-coded list if API fails
        setFolderOptions([...DOCUMENT_FOLDER_OPTIONS]);
        setFolderHierarchy([]);
      }
    };
    fetchFolders();
  }, [urlScope, documentType?.scope]);

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

  // Pre-fill folder from URL tab ID once hierarchy is loaded
  React.useEffect(() => {
    if (!isNew || !urlTabId || folderHierarchy.length === 0) return;

    const tabIdNum = parseInt(urlTabId);
    // Find the tab name from the hierarchy
    for (const folder of folderHierarchy) {
      if (folder.id === tabIdNum) {
        setDocumentType(prev => prev ? { ...prev, folder: folder.name, primary_tab: folder.name } : prev);
        return;
      }
      // Check children
      for (const child of folder.children || []) {
        if (child.id === tabIdNum) {
          // For subtabs, set folder to parent and keep the child in entity_tab_ids
          setDocumentType(prev => prev ? { ...prev, folder: folder.name, primary_tab: folder.name } : prev);
          return;
        }
      }
    }
  }, [folderHierarchy, urlTabId, isNew]);

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

  // Fetch dwelling types from API (SSoT: Jobs foundation column)
  React.useEffect(() => {
    const fetchDwellingTypes = async () => {
      try {
        const response = await api.get<{ success: boolean; data: Array<{ value: string; description: string; displayLabel: string }> }>("/api/v1/document_types/dwelling_types");
        if (response.success && Array.isArray(response.data)) {
          setDwellingTypes(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch dwelling types:", error);
      }
    };
    fetchDwellingTypes();
  }, []);

  // Get default file name template based on scope
  const getDefaultFileNameForScope = (scope: string) => {
    // SSoT: "contacts" is canonical, "people" is legacy - both use same default pattern
    if (scope === "contacts" || scope === "people") return "{PersonCode} {DocTypeCode} {FY}";
    if (scope === "job") return "{JobCode} {DocTypeCode} {FY}";
    return "{CompanyCode} {DocTypeCode} {FY}";
  };

  React.useEffect(() => {
    if (isNew) {
      // Get scope from URL or default to company
      const initialScope = urlScope || "company";
      // Get tab ID from URL for pre-selecting folder
      const initialTabIds = urlTabId ? [parseInt(urlTabId)] : [];

      // Initialize document type with sensible defaults for creation
      setDocumentType({
        id: 0,
        name: "",
        display_name: "",
        abbreviation: "",
        file_name: getDefaultFileNameForScope(initialScope),
        category: "", // Deprecated - not used, kept for backwards compatibility
        folder: "GENERAL",
        description: "",
        requires_filing: false,
        retention_years: undefined,
        active: true,
        tabs: [],
        primary_tab: "GENERAL",
        scope: initialScope,
        file_extensions: [".pdf"],
        target_folder: "",
        entity_tab_ids: initialTabIds,
      });
      // Open Basic Information when creating new
      setBasicInfoExpanded(true);
      setLoading(false);
      loadCompanies();
      loadPeople();
      loadJobs();
    } else if (documentTypeId) {
      loadDocumentType();
      loadCompanies();
      loadPeople();
      loadJobs();
    }
  }, [documentTypeId, isNew, urlScope, urlTabId]);

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

  const loadPeople = async () => {
    try {
      const response = await api.get<any>('/api/v1/contacts');
      const peopleData = response.data?.data || response.data || response;

      if (Array.isArray(peopleData)) {
        // Map contacts to people with code (initials)
        const mappedPeople = peopleData.map((p: any) => ({
          id: p.id,
          name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          code: p.code || getInitials(p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim())
        }));
        setPeople(mappedPeople);

        // Auto-select Robert Harder as default
        if (mappedPeople.length > 0 && previewPersonId === null) {
          const robertHarder = mappedPeople.find((p: any) =>
            p.name?.toLowerCase().includes("robert harder") ||
            p.code === "RH"
          );
          setPreviewPersonId(robertHarder ? robertHarder.id : mappedPeople[0].id);
        }
      } else {
        setPeople([]);
      }
    } catch (error) {
      console.error("Failed to load people:", error);
    }
  };

  const loadJobs = async () => {
    try {
      const response = await api.get<any>('/api/v1/jobs');
      const jobsData = response.data?.data || response.data?.jobs || response.data || response;

      if (Array.isArray(jobsData)) {
        const mappedJobs = jobsData.map((j: any) => ({
          id: j.id,
          name: j.title || j.name || `Job ${j.id}`,
          code: j.code || `J${String(j.id).padStart(3, '0')}`
        }));
        setJobs(mappedJobs);
      } else {
        setJobs([]);
      }
    } catch (error) {
      console.error("Failed to load jobs:", error);
    }
  };

  // Helper to get initials from name
  const getInitials = (name: string): string => {
    if (!name) return "";
    return name
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
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

  // Update file_name template when scope changes (only for new document types or empty file_name)
  React.useEffect(() => {
    if (documentType && isNew) {
      const scope = documentType.scope || "company";
      let defaultTemplate = "{CompanyCode} {DocTypeCode} {FY}";

      // SSoT: "contacts" is canonical, "people" is legacy
      if (scope === "contacts" || scope === "people") {
        defaultTemplate = "{PersonCode} {DocTypeCode} {FY}";
      } else if (scope === "job") {
        defaultTemplate = "{JobCode} {DocTypeCode} {FY}";
      }

      // Only update if file_name is using a default template pattern
      const currentFileName = documentType.file_name || "";
      const isDefaultPattern = currentFileName === "" ||
        currentFileName === "{CompanyCode} {DocTypeCode} {FY}" ||
        currentFileName === "{PersonCode} {DocTypeCode} {FY}" ||
        currentFileName === "{JobCode} {DocTypeCode} {FY}";

      if (isDefaultPattern && currentFileName !== defaultTemplate) {
        updateField("file_name", defaultTemplate);
      }
    }
  }, [documentType?.scope, isNew]);

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

      // Remove entity placeholder based on scope if the checkbox is checked
      if (removeCompanyName) {
        const scope = documentType.scope || "company";
        // SSoT: "contacts" is canonical, "people" is legacy
        if (scope === "contacts" || scope === "people") {
          // Remove person placeholders for contacts scope
          fileName = fileName.replace(/\{PersonName\}\s*/g, '').replace(/\{PersonCode\}\s*/g, '').replace(/\{Person\}\s*/g, '');
        } else if (scope === "job") {
          // Remove job placeholders for job scope
          fileName = fileName.replace(/\{JobTitle\}\s*/g, '').replace(/\{JobCode\}\s*/g, '').replace(/\{JobName\}\s*/g, '');
        } else {
          // Remove company placeholders for company scope (default)
          fileName = fileName.replace(/\{CompanyName\}\s*/g, '').replace(/\{CompanyCode\}\s*/g, '');
        }
      }

      updateField("display_name", fileName);
    }
  }, [displayNameSameAsFileName, showFullDescription, removeCompanyName, documentType?.file_name, documentType?.scope]);

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
      router.push("/admin/system/document-types");
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
        if (response?.data?.id) {
          router.push(`/admin/system/document-types/${response.data.id}`);
        }
      } else {
        // Update existing document type
        const response = await api.patch<{
          success: boolean;
          data: DocumentType;
          naming_format_change?: {
            old_format: string;
            new_format: string;
            affected_documents_count: number;
            message: string;
          };
        }>(`/api/v1/document_types/${documentTypeId}`, {
          document_type: documentType
        });
        // Refresh local state with saved data from server
        if (response?.data) {
          setDocumentType(response.data);
        }

        // SSoT: Check if naming format changed and prompt for document rename
        if (response?.naming_format_change && response.naming_format_change.affected_documents_count > 0) {
          setRenameConfirmDialog({
            open: true,
            oldFormat: response.naming_format_change.old_format || "",
            newFormat: response.naming_format_change.new_format || "",
            affectedCount: response.naming_format_change.affected_documents_count,
          });
          toast({
            title: "Document type saved",
            description: response.naming_format_change.message,
          });
        } else {
          toast({
            title: "Success",
            description: "Document type saved successfully",
          });
        }
      }
    } catch (error: unknown) {
      console.error("Failed to save document type:", error);
      // Extract the actual error message from the API response
      let errorMessage = error instanceof Error
        ? error.message
        : (error as { message?: string })?.message || (isNew ? "Failed to create document type" : "Failed to save document type");

      // Make name uniqueness errors more user-friendly
      if (errorMessage.toLowerCase().includes("name") && errorMessage.toLowerCase().includes("taken")) {
        errorMessage = `A document type named "${documentType?.name}" already exists. Please choose a different name.`;
      }

      toast({
        title: "Error",
        description: errorMessage,
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
      router.push("/admin/system/document-types");
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

  const handleDuplicate = async () => {
    if (!documentType) return;

    try {
      setSaving(true);
      const response = await api.post<{ data: DocumentType; message: string }>(
        `/api/v1/document_types/${documentTypeId}/duplicate`
      );

      if (response?.data) {
        toast({
          title: "Success",
          description: response.message || `Duplicated as "${response.data.name}"`,
        });
        // Navigate to the new document type
        router.push(`/admin/system/document-types/${response.data.id}`);
      }
    } catch (error: any) {
      console.error("Failed to duplicate document type:", error);
      toast({
        title: "Error",
        description: "Failed to duplicate document type",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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

    // Add DocType placeholder and sort alphabetically by code
    const placeholders: PlaceholderToken[] = [docTypePlaceholder, ...basePlaceholders]
      .sort((a, b) => a.code.replace(/[{}]/g, '').localeCompare(b.code.replace(/[{}]/g, '')));

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

    // Get selected person data or use current user (auto-detected)
    const selectedPerson = previewPersonId ? people.find(p => p.id === previewPersonId) : null;
    const currentUserName = user?.name || "Robert Harder";
    const currentUserCode = getInitials(currentUserName);
    const personCode = selectedPerson?.code || currentUserCode;
    const personName = selectedPerson?.name || currentUserName;

    // Get selected job data or use defaults (Job 46)
    const selectedJob = previewJobId ? jobs.find(j => j.id === previewJobId) : null;
    const jobCode = selectedJob?.code || "J046";
    const jobName = selectedJob?.name || "Job 46";

    // Replace DocType placeholders with current document type values
    preview = preview.replace(/\{DocTypeCode\}/g, documentType?.abbreviation || "");
    preview = preview.replace(/\{DocTypeName\}/g, getCleanDocTypeName());

    // Replace placeholders with example values
    // Use full names if checkbox is checked, otherwise use codes
    preview = preview.replace(/\{CompanyCode\}/g, companyCode);
    preview = preview.replace(/\{CompanyName\}/g, companyName);
    preview = preview.replace(/\{DisplayName\}/g, companyName);

    // Person placeholders
    preview = preview.replace(/\{PersonCode\}/g, personCode);
    preview = preview.replace(/\{PersonName\}/g, personName);
    preview = preview.replace(/\{Person\}/g, personCode);

    // Job placeholders
    preview = preview.replace(/\{JobCode\}/g, jobCode);
    preview = preview.replace(/\{JobTitle\}/g, jobName);
    preview = preview.replace(/\{JobName\}/g, jobName);

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
    preview = preview.replace(/\{EX\}/g, "EX 15/12/25");
    preview = preview.replace(/\{Expiry\}/g, "Expiry 15 December 2025");
    // Certificate type placeholders (static text)
    preview = preview.replace(/\{BA\}/g, "BA");
    preview = preview.replace(/\{BuildingApproval\}/g, "Building Approval");
    preview = preview.replace(/\{FIA\}/g, "FIA");
    preview = preview.replace(/\{FinalInspectionCertificate\}/g, "Final Inspection Certificate");
    preview = preview.replace(/\{Occ\}/g, "Occ");
    preview = preview.replace(/\{CertificateOfOccupancy\}/g, "Certificate of Occupancy");
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

  // SSoT: Handle batch rename of documents after naming format change
  const handleBatchRename = async () => {
    if (!documentType?.id) return;

    setRenaming(true);
    try {
      const response = await api.post<{
        success: boolean;
        data: {
          executed: boolean;
          stats: {
            total: number;
            success: number;
            failed: number;
            skipped: number;
          };
        };
      }>("/api/v1/document_standardization/execute", {
        document_type_id: documentType.id,
        scope: documentType.scope === "job" ? "job" : "corporate",
      });

      if (response?.success) {
        const stats = response.data.stats;
        toast({
          title: "Documents renamed",
          description: `${stats.success} documents renamed successfully${stats.failed > 0 ? `, ${stats.failed} failed` : ""}${stats.skipped > 0 ? `, ${stats.skipped} skipped` : ""}`,
        });
      }
    } catch (error) {
      console.error("Failed to batch rename documents:", error);
      toast({
        title: "Rename failed",
        description: "Failed to rename documents. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setRenaming(false);
      setRenameConfirmDialog(null);
    }
  };

  // Fetch preview of documents that will be renamed
  const handleShowPreview = async () => {
    if (!documentType?.id || !renameConfirmDialog) return;

    setRenameConfirmDialog(prev => prev ? { ...prev, loadingPreview: true } : null);
    try {
      const response = await api.get<{
        success: boolean;
        data: {
          total_affected: number;
          preview: Array<{ id: number; current_name: string; proposed_name: string; job_code?: string; company_code?: string }>;
        };
      }>("/api/v1/document_standardization/preview", {
        params: {
          document_type_id: documentType.id,
          scope: documentType.scope === "job" ? "job" : "corporate",
          limit: 50,
        },
      });

      if (response?.success) {
        setRenameConfirmDialog(prev => prev ? {
          ...prev,
          preview: response.data.preview,
          showPreview: true,
          loadingPreview: false,
        } : null);
      }
    } catch (error) {
      console.error("Failed to load preview:", error);
      setRenameConfirmDialog(prev => prev ? { ...prev, loadingPreview: false } : null);
      toast({
        title: "Preview failed",
        description: "Failed to load preview. Check console for details.",
        variant: "destructive",
      });
    }
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
        <Spinner size={32} className="text-muted-foreground" />
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
    <div className="h-full flex flex-col px-6 pt-8">
      {/* Header - Fixed at top */}
      <div className="flex items-start justify-between pb-4 shrink-0">
        <div className="flex items-start gap-4">
          <BackButton fallbackHref="/admin/system/document-types" />
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
            <>
              <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button variant="outline" onClick={handleDuplicate} disabled={saving}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Spinner size={16} className="mr-2" />
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

      {/* 3-Column Layout - All info visible without collapsing */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-4 h-full">

          {/* ========== COLUMN 1: Basic Info ========== */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">Basic Information</h3>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={documentType.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Company Tax Return"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="abbreviation">Code</Label>
                <Input
                  id="abbreviation"
                  value={documentType.abbreviation || ""}
                  onChange={(e) => updateField("abbreviation", e.target.value.toUpperCase())}
                  placeholder="CTR"
                  className="font-mono"
                />
              </div>
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
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={documentType.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Brief description..."
                rows={2}
                className="text-sm"
              />
            </div>

            {/* Tab View - Primary Tab */}
            <div className="space-y-2">
              <Label>Primary Tab</Label>
              {(() => {
                const selectedId = documentType.entity_tab_ids?.[0];
                const findTabName = (items: any[]): string | null => {
                  for (const item of items) {
                    if (item.id === selectedId) return item.name;
                    if (item.children?.length) {
                      const found = findTabName(item.children);
                      if (found) return found;
                    }
                  }
                  return null;
                };
                return (
                  <Select
                    value={selectedId?.toString() || ""}
                    onValueChange={(value) => {
                      const newId = parseInt(value);
                      const otherIds = (documentType.entity_tab_ids || []).slice(1);
                      updateField("entity_tab_ids", [newId, ...otherIds]);
                    }}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select primary tab">
                        {selectedId ? findTabName(folderHierarchy) || `Tab ${selectedId}` : "Select..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {folderHierarchy.filter(p => p.id).flatMap(parent => [
                        <SelectItem key={parent.id} value={parent.id!.toString()}>{parent.name}</SelectItem>,
                        ...(parent.children || []).filter((c: any) => c.id).map((child: any) => (
                          <SelectItem key={child.id} value={child.id.toString()} className="pl-6">↳ {child.name}</SelectItem>
                        ))
                      ])}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>

            {/* File Extensions - Compact */}
            <div className="space-y-2">
              <Label>File Extensions</Label>
              <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md bg-muted/20">
                {(documentType.file_extensions || []).length === 0 ? (
                  <span className="text-xs text-muted-foreground">All allowed</span>
                ) : (
                  documentType.file_extensions?.map((ext) => (
                    <Badge key={ext} variant="secondary" className="font-mono text-xs">
                      {ext}
                      <button onClick={() => removeFileExtension(ext)} className="ml-1 hover:text-destructive">
                        <X className="h-2 w-2" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {[".pdf", ".doc", ".docx", ".xls", ".xlsx"].map(ext => (
                  <Button
                    key={ext}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addFileExtension(ext)}
                    disabled={(documentType.file_extensions || []).includes(ext)}
                    className="h-6 px-2 text-xs font-mono"
                  >
                    +{ext}
                  </Button>
                ))}
              </div>
            </div>

            {/* Compliance - Compact */}
            <div className="space-y-2">
              <Label>Compliance</Label>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="requires_filing"
                    checked={documentType.requires_filing || false}
                    onCheckedChange={(checked) => updateField("requires_filing", checked)}
                  />
                  <Label htmlFor="requires_filing" className="text-xs cursor-pointer">Requires Filing</Label>
                </div>
                <div className="flex items-center gap-1">
                  <Label htmlFor="retention" className="text-xs">Retain:</Label>
                  <Input
                    id="retention"
                    type="number"
                    min="0"
                    max="99"
                    value={documentType.retention_years || ""}
                    onChange={(e) => updateField("retention_years", parseInt(e.target.value) || null)}
                    placeholder="7"
                    className="w-14 h-7 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">yrs</span>
                </div>
              </div>
            </div>

            {/* Versioning - Draft/Signed Support */}
            <div className="space-y-2">
              <Label>Versioning</Label>
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="supports_versioning"
                  checked={documentType.supports_versioning || false}
                  onCheckedChange={(checked) => updateField("supports_versioning", checked)}
                />
                <Label htmlFor="supports_versioning" className="text-xs cursor-pointer">
                  Supports Draft/Signed versions
                </Label>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Enable to track Draft and Signed versions of the same document
              </p>
            </div>

            {/* System Info - Compact */}
            <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
              <div className="flex justify-between">
                <span>ID: {documentType.id}</span>
                <span>{documentType.documents_count || 0} docs</span>
              </div>
            </div>
          </div>
          {/* End Column 1 */}

          {/* ========== COLUMN 2: File Naming ========== */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">File Naming</h3>

            {/* Preview Data - Compact */}
            <div className="flex items-center gap-2 text-xs p-2 bg-muted/30 rounded-md border">
              <span className="font-medium shrink-0">Preview:</span>
                <Select
                  value={previewCompanyId?.toString() || "default"}
                  onValueChange={(value) => setPreviewCompanyId(value === "default" ? null : parseInt(value))}
                >
                  <SelectTrigger className="h-7 text-xs w-auto min-w-[60px] bg-background">
                    <SelectValue>
                      {previewCompanyId
                        ? companies.find(c => c.id === previewCompanyId)?.code || "TH"
                        : "TH"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">TH - Tekna Homes</SelectItem>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.code} - {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground/50">|</span>
                <Select
                  value={previewPersonId?.toString() || "default"}
                  onValueChange={(value) => setPreviewPersonId(value === "default" ? null : parseInt(value))}
                >
                  <SelectTrigger className="h-7 text-xs w-auto min-w-[50px] bg-background">
                    <SelectValue>
                      {previewPersonId
                        ? people.find(p => p.id === previewPersonId)?.code || getInitials(user?.name || "")
                        : getInitials(user?.name || "") || "RH"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{getInitials(user?.name || "")} - {user?.name || "Current User"}</SelectItem>
                    {people.map(person => (
                      <SelectItem key={person.id} value={person.id.toString()}>
                        {person.code} - {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground/50">|</span>
                <Select
                  value={previewJobId?.toString() || "46"}
                  onValueChange={(value) => setPreviewJobId(parseInt(value) || 46)}
                >
                  <SelectTrigger className="h-7 text-xs w-auto min-w-[60px] bg-background">
                    <SelectValue>
                      {previewJobId
                        ? jobs.find(j => j.id === previewJobId)?.code || `J${String(previewJobId).padStart(3, '0')}`
                        : "J046"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.length === 0 ? (
                      <SelectItem value="46">J046 - Job 46</SelectItem>
                    ) : null}
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.code} - {job.name}
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
                      {(documentType.scope === "contacts" || documentType.scope === "people") ? "Hide Person" : documentType.scope === "job" ? "Hide Job" : "Hide Company"}
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
                ? "Display Name matches File Name automatically"
                : "Drag placeholders to customize"}
            </p>
          </div>

          {/* Form Number Mapping - for {FormNumber} placeholder */}
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Form Number Mapping</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  const mapping = { ...(documentType.form_number_mapping || {}) };
                  // Find first unused dwelling type from SSoT
                  const allTypes = dwellingTypes.map(dt => dt.value);
                  const unusedType = allTypes.find(t => !mapping[t]) || "default";
                  mapping[unusedType] = "Form XX";
                  updateField("form_number_mapping", mapping);
                }}
              >
                + Add
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Map dwelling types to form numbers. Use {"{FormNumber}"} in templates.
            </p>
            {Object.keys(documentType.form_number_mapping || {}).length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No mappings configured. Click "+ Add" to add a dwelling type → form number mapping.
              </p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(documentType.form_number_mapping || {}).map(([dwellingType, formNumber], idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={dwellingType}
                      onValueChange={(newDwellingType) => {
                        const mapping = { ...(documentType.form_number_mapping || {}) };
                        const newValue = mapping[dwellingType];
                        delete mapping[dwellingType];
                        mapping[newDwellingType] = newValue;
                        updateField("form_number_mapping", mapping);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Select dwelling type" />
                      </SelectTrigger>
                      <SelectContent>
                        {dwellingTypes.map((dt) => (
                          <SelectItem key={dt.value} value={dt.value}>
                            {dt.displayLabel}
                          </SelectItem>
                        ))}
                        <SelectItem value="default">Default (fallback for unmatched)</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input
                      value={formNumber}
                      onChange={(e) => {
                        const mapping = { ...(documentType.form_number_mapping || {}) };
                        mapping[dwellingType] = e.target.value;
                        updateField("form_number_mapping", mapping);
                      }}
                      className="h-7 text-xs w-24"
                      placeholder="Form 15"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const mapping = { ...(documentType.form_number_mapping || {}) };
                        delete mapping[dwellingType];
                        updateField("form_number_mapping", mapping);
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
          {/* End Column 2 */}

          {/* ========== COLUMN 3: Placeholders ========== */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">Placeholders</h3>
            <div className="sticky top-0">
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
          {/* End Column 3 */}

        </div>
        {/* End 3-column grid */}
      </div>
      {/* End scroll area */}

      {/* SSoT: Naming format change confirmation dialog */}
      <Dialog
        open={renameConfirmDialog?.open || false}
        onOpenChange={(open) => !open && setRenameConfirmDialog(null)}
      >
        <DialogContent className={cn("sm:max-w-md", renameConfirmDialog?.showPreview && "sm:max-w-2xl")}>
          <DialogHeader>
            <DialogTitle>Rename Existing Documents?</DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                The file naming format has been changed. There are{" "}
                <span className="font-semibold text-foreground">
                  {renameConfirmDialog?.affectedCount || 0}
                </span>{" "}
                existing documents that don&apos;t match the new format.
              </p>
              {renameConfirmDialog?.oldFormat && (
                <div className="text-xs space-y-1">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Old:</span>
                    <code className="font-mono bg-muted px-1 rounded">
                      {renameConfirmDialog.oldFormat}
                    </code>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">New:</span>
                    <code className="font-mono bg-muted px-1 rounded">
                      {renameConfirmDialog?.newFormat}
                    </code>
                  </div>
                </div>
              )}
              <p className="text-sm">
                Would you like to rename them in SharePoint to match the new naming convention?
              </p>
            </DialogDescription>
          </DialogHeader>

          {/* Preview list */}
          {renameConfirmDialog?.showPreview && renameConfirmDialog.preview && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Current Name</th>
                    <th className="text-left p-2 font-medium">→</th>
                    <th className="text-left p-2 font-medium">New Name</th>
                  </tr>
                </thead>
                <tbody>
                  {renameConfirmDialog.preview.map((doc) => (
                    <tr key={doc.id} className="border-t">
                      <td className="p-2 font-mono text-muted-foreground truncate max-w-[200px]" title={doc.current_name}>
                        {doc.current_name}
                      </td>
                      <td className="p-2 text-muted-foreground">→</td>
                      <td className="p-2 font-mono text-green-600 dark:text-green-400 truncate max-w-[200px]" title={doc.proposed_name}>
                        {doc.proposed_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(renameConfirmDialog.affectedCount || 0) > 50 && (
                <div className="p-2 text-xs text-muted-foreground text-center border-t bg-muted/50">
                  Showing 50 of {renameConfirmDialog.affectedCount} documents
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setRenameConfirmDialog(null)}
              disabled={renaming}
            >
              Skip for Now
            </Button>
            {!renameConfirmDialog?.showPreview && (
              <Button
                variant="outline"
                onClick={handleShowPreview}
                disabled={renaming || renameConfirmDialog?.loadingPreview}
              >
                {renameConfirmDialog?.loadingPreview ? (
                  <>
                    <Spinner size={16} className="mr-2" />
                    Loading...
                  </>
                ) : (
                  "Show"
                )}
              </Button>
            )}
            <Button
              variant="default"
              onClick={handleBatchRename}
              disabled={renaming}
            >
              {renaming ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Renaming...
                </>
              ) : (
                `Rename ${renameConfirmDialog?.affectedCount || 0} Documents`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
