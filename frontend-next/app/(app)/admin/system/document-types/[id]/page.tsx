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
import { ArrowLeft, Loader2, Save, Trash2, FileText, X } from "lucide-react";
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

interface DocumentType {
  id: number;
  name: string;
  abbreviation?: string;
  naming_format?: string;
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

  const documentTypeId = params.id as string;

  React.useEffect(() => {
    if (documentTypeId) {
      loadDocumentType();
    }
  }, [documentTypeId]);

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
      router.push("/admin/system?tab=document-types");
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
    <div className="space-y-6 max-w-5xl">
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
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Document Type Name *</Label>
              <Input
                id="name"
                value={documentType.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="CTR - Company Tax Return"
              />
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
      </Card>

      {/* Naming & Organization */}
      <Card>
        <CardHeader>
          <CardTitle>Naming & Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="naming_format">Naming Format Template</Label>
            <Input
              id="naming_format"
              value={documentType.naming_format || ""}
              onChange={(e) => updateField("naming_format", e.target.value)}
              placeholder="{CompanyCode} CTR FY{YY}"
              className="font-mono text-sm"
            />
            {documentType.title_preview && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Preview:</span>
                <span className="font-semibold text-green-700 dark:text-green-400 font-mono">
                  {documentType.title_preview}
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Use variables like {"{CompanyCode}"}, {"{Date}"}, {"{FY}"} - see legend below
            </p>
          </div>

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

      {/* Naming Format Legend */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="text-base text-blue-900 dark:text-blue-200">
            Naming Format Variables Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800 pb-1">
              Corporate Documents (Company Scope)
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-blue-700 dark:text-blue-300">
              <div><code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">{"{CompanyCode}"}</code> Company abbreviation</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">{"{LoanID}"}</code> Loan identifier</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">{"{AssetCode}"}</code> Asset abbreviation</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">{"{FY}"}</code> Financial year (4 digits)</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">{"{YY}"}</code> Financial year (2 digits)</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">{"{Date}"}</code> Document date</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">{"{Period}"}</code> BAS period (Q1, Q2, etc)</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">{"{Description}"}</code> Custom text field</div>
              <div><code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">{"{LenderCode}"}</code> Lender company code</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold text-orange-700 dark:text-orange-300 border-b border-orange-200 dark:border-orange-800 pb-1">
              Job Documents (Job Scope)
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-orange-700 dark:text-orange-300">
              <div><code className="bg-orange-100 dark:bg-orange-900 px-1.5 py-0.5 rounded">{"{JobCode}"}</code> Job number</div>
              <div><code className="bg-orange-100 dark:bg-orange-900 px-1.5 py-0.5 rounded">{"{JobTitle}"}</code> Job address/title</div>
              <div><code className="bg-orange-100 dark:bg-orange-900 px-1.5 py-0.5 rounded">{"{CertType}"}</code> Certificate type</div>
              <div><code className="bg-orange-100 dark:bg-orange-900 px-1.5 py-0.5 rounded">{"{Consultant}"}</code> Consultant name</div>
              <div><code className="bg-orange-100 dark:bg-orange-900 px-1.5 py-0.5 rounded">{"{Number}"}</code> Sequential number</div>
            </div>
          </div>

          <div className="text-xs text-blue-600 dark:text-blue-400 pt-2 border-t border-blue-200 dark:border-blue-800">
            💡 Example: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{CompanyCode}"} CTR FY{"{YY}"}</code> → "ABC CTR FY25"
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
