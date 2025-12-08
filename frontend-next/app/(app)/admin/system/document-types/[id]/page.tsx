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
import { ArrowLeft, Loader2, Save, Trash2, FileText, X, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

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
  { value: "both", label: "Both", description: "Used for both" }
];

// Common file extensions for documents
const FILE_EXTENSION_OPTIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg",
  ".txt", ".csv", ".zip", ".msg", ".eml"
];

// Placeholder definitions with scope
const PLACEHOLDERS = {
  company: [
    { code: "{CompanyCode}", example: "TH", longCode: "{CompanyName}", longExample: "Tekna Homes", color: "purple" },
    { code: "{LoanID}", example: "L001", longCode: "{LoanName}", longExample: "Loan to ABC Trust", color: "purple" },
    { code: "{AssetCode}", example: "PROP1", longCode: "{AssetName}", longExample: "123 Main Street", color: "purple" },
    { code: "{FY}", label: "FY{FY}", example: "FY25", color: "purple" },
    { code: "{Period}", example: "Q1", longCode: "{PeriodLong}", longExample: "Q1 Jul-Sep", color: "purple" },
    { code: "{LenderCode}", example: "ABC", longCode: "{LenderName}", longExample: "ABC Property Trust", color: "purple" },
    { code: "{Date}", example: "09-12-2025", color: "purple" },
    { code: "{Description}", example: "Example", color: "purple" },
    { code: "{BankCode}", example: "NAB", color: "purple" },
    { code: "{BankBSB}", example: "082-123", color: "purple" },
    { code: "{BankNumber}", example: "12345678", color: "purple" },
  ],
  job: [
    { code: "{JobCode}", example: "J069", color: "orange" },
    { code: "{JobTitle}", example: "83 West Ridge", color: "orange" },
    { code: "{CertType}", example: "Occupancy", color: "orange" },
    { code: "{Consultant}", example: "ABC Eng", color: "orange" },
    { code: "{Number}", example: "01", color: "orange" },
    { code: "{Date}", example: "09-12-2025", color: "orange" },
    { code: "{Description}", example: "Example", color: "orange" },
  ]
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
  tabs?: string[];
  primary_tab?: string;
  scope?: string;
  file_extensions?: string[];
  target_folder?: string;
  documents_count?: number;
  created_at?: string;
  updated_at?: string;
}

export default function DocumentTypeDetailPage() {
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
  const [basicInfoExpanded, setBasicInfoExpanded] = React.useState(false);
  const [displayNameSameAsFileName, setDisplayNameSameAsFileName] = React.useState(true);
  const [showFullDescription, setShowFullDescription] = React.useState(true);
  const [previewCompanyId, setPreviewCompanyId] = React.useState<number | null>(null);
  const [companies, setCompanies] = React.useState<Array<{id: number; name: string; code: string}>>([]);

  const fileNameInputRef = React.useRef<HTMLInputElement>(null);
  const displayNameInputRef = React.useRef<HTMLInputElement>(null);

  const documentTypeId = params.id as string;

  React.useEffect(() => {
    if (documentTypeId) {
      loadDocumentType();
      loadCompanies();
    }
  }, [documentTypeId]);

  const loadCompanies = async () => {
    try {
      const response = await api.get<any>('/api/v1/companies');
      // Handle response format: {success: true, companies: [...], total: N}
      const companiesData = response.data?.companies || response.companies || response.data?.data || response.data || response;

      if (Array.isArray(companiesData)) {
        // Filter to only show corporate-linked companies (those with a company_group_id)
        const corporateLinkedCompanies = companiesData.filter((c: any) => c.company_group_id != null);
        setCompanies(corporateLinkedCompanies);
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
      // Always default both to true - user can uncheck if they want custom display name
      setDisplayNameSameAsFileName(true);
      setShowFullDescription(true);
    }
  }, [documentType?.id]); // Only run when document type changes

  // Map short codes to long codes
  const shortToLongMap: Record<string, string> = {};
  const allPlaceholders = [...PLACEHOLDERS.company, ...PLACEHOLDERS.job];
  allPlaceholders.forEach((p: any) => {
    if (p.longCode) {
      shortToLongMap[p.code] = p.longCode;
    }
  });

  // Convert short placeholders to long versions
  const convertToLongCodes = (value: string): string => {
    let result = value;
    Object.entries(shortToLongMap).forEach(([short, long]) => {
      result = result.replace(new RegExp(short.replace(/[{}]/g, '\\$&'), 'g'), long);
    });
    return result;
  };

  // Sync display_name with file_name when checkbox is checked
  React.useEffect(() => {
    if (displayNameSameAsFileName && documentType) {
      const fileName = documentType.file_name || "";
      if (showFullDescription) {
        // Convert short codes to long codes
        updateField("display_name", convertToLongCodes(fileName));
      } else {
        updateField("display_name", fileName);
      }
    }
  }, [displayNameSameAsFileName, showFullDescription, documentType?.file_name]);

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

    try {
      setSaving(true);
      await api.patch(`/api/v1/document_types/${documentTypeId}`, {
        document_type: documentType
      });
      toast({
        title: "Success",
        description: "Document type saved successfully",
      });
    } catch (error) {
      console.error("Failed to save document type:", error);
      toast({
        title: "Error",
        description: "Failed to save document type",
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

  const updateField = (field: keyof DocumentType, value: any) => {
    if (!documentType) return;
    setDocumentType({ ...documentType, [field]: value });
  };

  const toggleTab = (tab: string) => {
    if (!documentType) return;
    const currentTabs = documentType.tabs || [];
    const newTabs = currentTabs.includes(tab)
      ? currentTabs.filter(t => t !== tab)
      : [...currentTabs, tab];
    updateField("tabs", newTabs);
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

  // Get placeholders based on scope
  const getAvailablePlaceholders = () => {
    const scope = documentType?.scope || "company";
    if (scope === "both") {
      return [...PLACEHOLDERS.company, ...PLACEHOLDERS.job];
    }
    return PLACEHOLDERS[scope as keyof typeof PLACEHOLDERS] || PLACEHOLDERS.company;
  };

  // Parse a field value into tokens (text and placeholders)
  const parseTokens = (value: string): { type: "text" | "placeholder"; value: string }[] => {
    if (!value) return [];
    const tokens: { type: "text" | "placeholder"; value: string }[] = [];
    const regex = /(\{[^}]+\})/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(value)) !== null) {
      // Add text before placeholder
      if (match.index > lastIndex) {
        tokens.push({ type: "text", value: value.slice(lastIndex, match.index) });
      }
      // Add placeholder
      tokens.push({ type: "placeholder", value: match[0] });
      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      tokens.push({ type: "text", value: value.slice(lastIndex) });
    }

    return tokens;
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

  // Get color for placeholder
  const getPlaceholderColor = (placeholder: string): string => {
    const allPlaceholders = [...PLACEHOLDERS.company, ...PLACEHOLDERS.job];
    const found = allPlaceholders.find(p => p.code === placeholder);
    return found?.color || "purple";
  };

  // Generate preview by replacing placeholders with example values
  const generatePreview = (value: string, useFullDescription: boolean = false): string => {
    if (!value) return "";

    let preview = value;

    // Get selected company data or use defaults (Tekna Homes)
    const selectedCompany = previewCompanyId ? companies.find(c => c.id === previewCompanyId) : null;
    const companyCode = selectedCompany?.code || "TH";
    const companyName = selectedCompany?.name || "Tekna Homes";

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
    preview = preview.replace(/\{BankBSB\}/g, "082-123");
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
      newTokens.splice(dropIndex, 0, { type: "placeholder", value: placeholder });
      updateField(field, rebuildFromTokens(newTokens));
    }

    setDraggedPlaceholder(null);
    setDraggedFromField(null);
    setDraggedIndex(null);
  };

  // Handle drag over (required to allow drop)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedFromField === "source" ? "copy" : "move";
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/system?tab=document-types")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <h1 className="text-2xl font-bold tracking-tight font-serif">{documentType.name}</h1>
              {documentType.abbreviation && (
                <Badge variant="outline" className="font-mono font-bold">
                  {documentType.abbreviation}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {documentType.documents_count || 0} documents using this type
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleDelete} disabled={saving}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
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

      {/* Basic Info */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setBasicInfoExpanded(!basicInfoExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle>Basic Information</CardTitle>
            {basicInfoExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {basicInfoExpanded && (
          <CardContent className="space-y-4">
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
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle>Naming & Organization</CardTitle>
            <div className="space-y-1 min-w-[300px]">
              <Label htmlFor="preview-company" className="text-xs text-muted-foreground">
                Preview Company
              </Label>
              <Select
                value={previewCompanyId?.toString() || "default"}
                onValueChange={(value) => setPreviewCompanyId(value === "default" ? null : parseInt(value))}
              >
                <SelectTrigger id="preview-company" className="h-8 text-sm">
                  <SelectValue placeholder="Select company..." />
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-6">
            {/* Left side - File Name and Display Name */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="file_name">File Name</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addBlankText("file_name")}
                    className="text-xs h-7"
                  >
                    + Add Text
                  </Button>
                </div>
            <div className="min-h-[60px] p-3 border rounded-md bg-background flex flex-wrap gap-2 items-center">
              {parseTokens(documentType.file_name || "").map((token, index) => (
                <div
                  key={index}
                  draggable={token.type === "placeholder"}
                  onDragStart={(e) =>
                    token.type === "placeholder" &&
                    handleDragStartFromToken(e, "file_name", index, token.value)
                  }
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDropOnToken(e, "file_name", index)}
                  onDragOver={handleDragOver}
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
                        getPlaceholderColor(token.value) === "purple" &&
                          "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700",
                        getPlaceholderColor(token.value) === "orange" &&
                          "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300 border-orange-300 dark:border-orange-700"
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
                    <Input
                      value={token.value}
                      onChange={(e) => updateTextToken("file_name", index, e.target.value)}
                      className="h-8 w-auto min-w-[50px] px-2 font-mono text-xs inline-block"
                      style={{ width: `${Math.max(50, token.value.length * 8)}px` }}
                    />
                  )}
                </div>
              ))}
              {parseTokens(documentType.file_name || "").length === 0 && (
                <span className="text-sm text-muted-foreground">
                  Drag placeholders here to build your file name template
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
                {!displayNameSameAsFileName && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addBlankText("display_name")}
                    className="text-xs h-7 -mt-1"
                  >
                    + Add Text
                  </Button>
                )}
                <div className="flex items-center gap-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remove-display-name"
                      checked={!displayNameSameAsFileName && !documentType.display_name}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setDisplayNameSameAsFileName(false);
                          updateField("display_name", "");
                        } else {
                          setDisplayNameSameAsFileName(true);
                        }
                      }}
                    />
                    <Label
                      htmlFor="remove-display-name"
                      className="text-sm font-normal cursor-pointer text-muted-foreground"
                    >
                      Remove Display Name
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
            <div className={cn(
              "min-h-[60px] p-3 border rounded-md bg-background flex flex-wrap gap-2 items-center",
              displayNameSameAsFileName && "opacity-50 pointer-events-none"
            )}>
              {parseTokens(documentType.display_name || "").map((token, index) => (
                <div
                  key={index}
                  draggable={token.type === "placeholder"}
                  onDragStart={(e) =>
                    token.type === "placeholder" &&
                    handleDragStartFromToken(e, "display_name", index, token.value)
                  }
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDropOnToken(e, "display_name", index)}
                  onDragOver={handleDragOver}
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
                        getPlaceholderColor(token.value) === "purple" &&
                          "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700",
                        getPlaceholderColor(token.value) === "orange" &&
                          "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300 border-orange-300 dark:border-orange-700"
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
                    <Input
                      value={token.value}
                      onChange={(e) => updateTextToken("display_name", index, e.target.value)}
                      className="h-8 w-auto min-w-[50px] px-2 font-mono text-xs inline-block"
                      style={{ width: `${Math.max(50, token.value.length * 8)}px` }}
                    />
                  )}
                </div>
              ))}
              {parseTokens(documentType.display_name || "").length === 0 && (
                <span className="text-sm text-muted-foreground">
                  Optional: Leave empty to use Document Type Name, or drag placeholders here
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
            <div className="w-96 shrink-0">
              <div className="space-y-3 p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 sticky top-4">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <Label className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                    Available Placeholders
                  </Label>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                  Drag chips to fields or click to add
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Short</div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Long</div>
                  {getAvailablePlaceholders().map((placeholder: any) => (
                    <React.Fragment key={placeholder.code}>
                      {/* Short column */}
                      <div
                        draggable
                        onDragStart={(e) => handleDragStartFromSource(e, placeholder.code)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "cursor-grab active:cursor-grabbing p-1.5 rounded border transition-all hover:scale-[1.01]",
                          placeholder.color === "purple" && "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950 dark:hover:bg-purple-900 border-purple-200 dark:border-purple-800",
                          placeholder.color === "orange" && "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950 dark:hover:bg-orange-900 border-orange-200 dark:border-orange-800",
                          draggedPlaceholder === placeholder.code && draggedFromField === "source" && "opacity-50 scale-95"
                        )}
                      >
                        <div className="flex items-center gap-1">
                          <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                          <code className={cn(
                            "font-mono text-[10px] px-1 py-0.5 rounded",
                            placeholder.color === "purple" && "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                            placeholder.color === "orange" && "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                          )}>
                            {placeholder.label || placeholder.code}
                          </code>
                        </div>
                        <div className="pl-4 mt-0.5 text-[10px] font-semibold">
                          {placeholder.example}
                        </div>
                      </div>
                      {/* Long column */}
                      {placeholder.longCode ? (
                        <div
                          draggable
                          onDragStart={(e) => handleDragStartFromSource(e, placeholder.longCode)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "cursor-grab active:cursor-grabbing p-1.5 rounded border transition-all hover:scale-[1.01]",
                            placeholder.color === "purple" && "bg-purple-50 hover:bg-purple-100 dark:bg-purple-950 dark:hover:bg-purple-900 border-purple-200 dark:border-purple-800",
                            placeholder.color === "orange" && "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950 dark:hover:bg-orange-900 border-orange-200 dark:border-orange-800",
                            draggedPlaceholder === placeholder.longCode && draggedFromField === "source" && "opacity-50 scale-95"
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                            <code className={cn(
                              "font-mono text-[10px] px-1 py-0.5 rounded",
                              placeholder.color === "purple" && "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                              placeholder.color === "orange" && "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                            )}>
                              {placeholder.longCode}
                            </code>
                          </div>
                          <div className="pl-4 mt-0.5 text-[10px] font-semibold">
                            {placeholder.longExample}
                          </div>
                        </div>
                      ) : (
                        <div />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* End flex container */}

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
                  {FOLDER_OPTIONS.map(f => (
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
                  {FOLDER_OPTIONS.map(f => (
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
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {FOLDER_OPTIONS.map(tab => {
                const isSelected = (documentType.tabs || []).includes(tab);
                const isPrimary = documentType.primary_tab === tab;
                return (
                  <div
                    key={tab}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors",
                      isSelected && "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700",
                      isPrimary && "ring-2 ring-blue-500",
                      !isSelected && "hover:bg-muted"
                    )}
                    onClick={() => toggleTab(tab)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleTab(tab)}
                    />
                    <Label className="cursor-pointer text-xs font-normal">
                      {tab}
                      {isPrimary && <span className="ml-1 text-blue-600">★</span>}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_folder">Target Folder Path (OneDrive/SharePoint)</Label>
            <Input
              id="target_folder"
              value={documentType.target_folder || ""}
              onChange={(e) => updateField("target_folder", e.target.value)}
              placeholder="/Corporate/Company Name/ATO"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Cloud storage path for auto-filing
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File Extensions */}
      <Card>
        <CardHeader>
          <CardTitle>Allowed File Extensions</CardTitle>
        </CardHeader>
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
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance & Retention</CardTitle>
        </CardHeader>
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
  );
}
