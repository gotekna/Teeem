"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  FileText,
  ExternalLink,
  CheckCircle2,
  Check,
  Sparkles,
  Loader2,
  AlertTriangle,
  Pencil,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Folder options for document organization
const FOLDER_OPTIONS = [
  "ADVICE",
  "ASIC",
  "ASSETS",
  "ATO",
  "BANK",
  "COMPANY",
  "DIVIDENDS",
  "FINANCIALS",
  "GENERAL",
  "INSURANCE",
  "LOANS",
  "MINUTES",
  "REGISTRY",
  "TRUST",
];

// Generate financial year options (last 10 years)
const generateFYOptions = () => {
  const currentYear = new Date().getFullYear();
  const options = [];
  for (let i = 0; i < 10; i++) {
    options.push(currentYear - i);
  }
  return options;
};

const FY_OPTIONS = generateFYOptions();

// Helper to parse financial years from various formats
const parseFinancialYears = (fy: number[] | string | undefined): number[] => {
  if (!fy) return [];
  if (Array.isArray(fy)) return fy;
  if (typeof fy === "string") {
    // Parse comma-separated string like "2023, 2024" or "FY23, FY24"
    return fy.split(",").map(s => {
      const cleaned = s.trim().replace(/^FY/i, "");
      const num = parseInt(cleaned, 10);
      // Handle 2-digit years (e.g., 23 -> 2023)
      if (num < 100) return 2000 + num;
      return num;
    }).filter(n => !isNaN(n));
  }
  return [];
};

interface Company {
  id: number;
  name: string;
}

interface CompanyDocument {
  id: number | string;
  title?: string;
  display_title?: string;
  file_name?: string;
  file_url?: string;
  file_size?: number;
  folder?: string;
  financial_years?: number[] | string;
  source?: string;
  company_id?: number;
  company?: Company;
  onedrive_file_id?: string;
  user_validated_at?: string;
  user_validated_by_id?: number;
  ai_verification_status?: "pending" | "processing" | "verified" | "mismatch" | "error" | string;
  ai_suggested_name?: string;
  ai_suggested_folder?: string;
  ai_suggested_type?: string;
  ai_suggested_fy?: number[] | string;
  ai_confidence_score?: number;
  ai_analysis_notes?: string;
}

interface DocumentPreviewModalProps {
  document: CompanyDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentUpdate?: () => Promise<void>;
  companies?: Company[];
}

export default function DocumentPreviewModal({
  document: initialDocument,
  open,
  onOpenChange,
  onDocumentUpdate,
  companies = [],
}: DocumentPreviewModalProps) {
  const [document, setDocument] = React.useState<CompanyDocument>(initialDocument);
  const [validating, setValidating] = React.useState(false);
  const [validated, setValidated] = React.useState(initialDocument?.user_validated_at != null);
  const [aiVerifying, setAiVerifying] = React.useState(false);
  const [applyingSuggestion, setApplyingSuggestion] = React.useState(false);

  // Editing states
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(initialDocument?.title || "");
  const [editedCompanyId, setEditedCompanyId] = React.useState<string>(
    String(initialDocument?.company_id || initialDocument?.company?.id || "")
  );
  const [editedFolder, setEditedFolder] = React.useState(initialDocument?.folder || "");
  const [editedFinancialYears, setEditedFinancialYears] = React.useState<number[]>(
    parseFinancialYears(initialDocument?.financial_years)
  );
  const [saving, setSaving] = React.useState(false);

  const pollingRef = React.useRef<NodeJS.Timeout | null>(null);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  // Update state when initialDocument changes
  React.useEffect(() => {
    setDocument(initialDocument);
    setValidated(initialDocument?.user_validated_at != null);
    setEditedTitle(initialDocument?.title || "");
    setEditedCompanyId(String(initialDocument?.company_id || initialDocument?.company?.id || ""));
    setEditedFolder(initialDocument?.folder || "");
    setEditedFinancialYears(parseFinancialYears(initialDocument?.financial_years));
  }, [initialDocument]);

  // Determine file type for preview
  const getFileType = (filename?: string) => {
    if (!filename) return "unknown";
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "pdf";
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext || "")) return "image";
    if (["doc", "docx"].includes(ext || "")) return "word";
    if (["xls", "xlsx"].includes(ext || "")) return "excel";
    return "unknown";
  };

  const fileType = getFileType(document?.file_name || document?.title);

  // Poll for AI verification results
  React.useEffect(() => {
    if (document?.ai_verification_status === "processing") {
      pollingRef.current = setInterval(async () => {
        try {
          const response = await api.get<{ document: CompanyDocument }>(
            `/api/v1/company_documents/${document.id}`
          );
          if (response.document) {
            setDocument(response.document);
            // Stop polling when status changes from processing
            if (response.document.ai_verification_status !== "processing") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setAiVerifying(false);
            }
          }
        } catch (error) {
          console.error("Failed to poll document status:", error);
        }
      }, 2000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [document?.id, document?.ai_verification_status]);

  // Focus title input when editing starts
  React.useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditing]);

  // Handle user validation
  const handleValidate = async () => {
    try {
      setValidating(true);
      await api.post(`/api/v1/company_documents/${document.id}/validate`);
      setValidated(true);
      if (onDocumentUpdate) {
        await onDocumentUpdate();
      }
    } catch (error) {
      console.error("Failed to validate document:", error);
      alert("Failed to validate document");
    } finally {
      setValidating(false);
    }
  };

  // Handle AI verification
  const handleAiVerify = async () => {
    try {
      setAiVerifying(true);
      const response = await api.post<{ success: boolean }>(
        `/api/v1/company_documents/${document.id}/ai_verify`
      );
      if (response?.success) {
        // Update document status to processing
        setDocument((prev) => ({ ...prev, ai_verification_status: "processing" }));
      }
    } catch (error: unknown) {
      console.error("Failed to start AI verification:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start AI verification";
      alert(errorMessage);
      setAiVerifying(false);
    }
  };

  // Start editing mode
  const startEditing = () => {
    setEditedTitle(document.title || "");
    setEditedCompanyId(String(document.company_id || document.company?.id || ""));
    setEditedFolder(document.folder || "");
    setEditedFinancialYears(parseFinancialYears(document.financial_years));
    setIsEditing(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
  };

  // Save all changes - uses relocate endpoint to move file in OneDrive
  const handleSave = async () => {
    try {
      setSaving(true);

      // Use relocate endpoint which moves/renames in OneDrive
      const response = await api.post<{ success: boolean; document: CompanyDocument }>(
        `/api/v1/company_documents/${document.id}/relocate`,
        {
          relocate: {
            title: editedTitle.trim(),
            company_id: editedCompanyId || null,
            folder: editedFolder || null,
            financial_years: editedFinancialYears,
          },
        }
      );

      if (response?.success) {
        // Record feedback if there was an AI suggestion (user modified it)
        if (document.ai_suggested_name) {
          try {
            await api.post(`/api/v1/company_documents/${document.id}/feedback`, {
              feedback: {
                action: "modified",
                final_name: editedTitle.trim(),
                final_folder: editedFolder,
                final_fy: editedFinancialYears.join(","),
              },
            });
          } catch {
            // Feedback recording is non-critical
            console.error("Failed to record feedback");
          }
        }

        if (response.document) {
          setDocument(response.document);
        }
        setIsEditing(false);

        // Refresh parent list
        if (onDocumentUpdate) {
          await onDocumentUpdate();
        }
      }
    } catch (error: unknown) {
      console.error("Failed to save document:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save document";
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Handle applying AI suggestion
  const handleApplySuggestion = async () => {
    try {
      setApplyingSuggestion(true);
      const response = await api.post<{ success: boolean; document: CompanyDocument }>(
        `/api/v1/company_documents/${document.id}/apply_ai_suggestion`
      );
      if (response?.success && response.document) {
        setDocument(response.document);
        setValidated(true);

        // Record feedback that user accepted suggestion
        try {
          await api.post(`/api/v1/company_documents/${document.id}/feedback`, {
            feedback: {
              action: "accepted",
              final_name: response.document.title,
              final_folder: response.document.folder,
            },
          });
        } catch {
          // Feedback is optional, don't fail if it errors
        }

        if (onDocumentUpdate) {
          await onDocumentUpdate();
        }
      }
    } catch (error: unknown) {
      console.error("Failed to apply suggestion:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to apply suggestion";
      alert(errorMessage);
    } finally {
      setApplyingSuggestion(false);
    }
  };

  // Handle rejecting AI suggestion (keep current name)
  const handleRejectSuggestion = async () => {
    // Record feedback that user rejected suggestion
    try {
      await api.post(`/api/v1/company_documents/${document.id}/feedback`, {
        feedback: {
          action: "rejected",
          final_name: document.title,
          final_folder: document.folder,
          reason: "User preferred original name",
        },
      });
    } catch {
      // Feedback is optional
    }
    await handleValidate();
  };

  // Handle financial year checkbox toggle
  const toggleFinancialYear = (year: number) => {
    setEditedFinancialYears((prev) => {
      if (prev.includes(year)) {
        return prev.filter((y) => y !== year);
      } else {
        return [...prev, year].sort((a, b) => b - a);
      }
    });
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  };

  // Check if document has OneDrive file for AI verification
  const canAiVerify = document?.onedrive_file_id && !validated;

  // AI verification status
  const aiStatus = document?.ai_verification_status;
  const hasAiSuggestion = document?.ai_suggested_name && aiStatus === "mismatch";
  const isProcessing = aiStatus === "processing" || aiVerifying;

  // Get current company name
  const currentCompanyName =
    document?.company?.name ||
    companies.find((c) => c.id === document?.company_id)?.name ||
    "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-muted-foreground flex-shrink-0" />
            {isEditing ? (
              <Input
                ref={titleInputRef}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="flex-1 text-lg font-semibold"
                placeholder="Document title"
              />
            ) : (
              <button
                onClick={startEditing}
                className="group flex items-center gap-2 text-left flex-1 min-w-0"
                title="Click to edit"
              >
                <DialogTitle className="truncate mb-0">
                  {document.display_title || document.title}
                </DialogTitle>
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Document Details - Editable or Display */}
          {isEditing ? (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Edit Document Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Company Dropdown */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Company</Label>
                  <Select value={editedCompanyId} onValueChange={setEditedCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={String(company.id)}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Folder Dropdown */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Folder (Tab)</Label>
                  <Select value={editedFolder} onValueChange={setEditedFolder}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select folder..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FOLDER_OPTIONS.map((folder) => (
                        <SelectItem key={folder} value={folder}>
                          {folder}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Financial Year Multi-Select */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Financial Year(s)</Label>
                  <div className="flex flex-wrap gap-1 min-h-[38px] p-2 border rounded-md bg-background">
                    {editedFinancialYears.length > 0 ? (
                      editedFinancialYears.map((year) => (
                        <Badge
                          key={year}
                          variant="secondary"
                          className="gap-1 cursor-pointer"
                          onClick={() => toggleFinancialYear(year)}
                        >
                          FY{year.toString().slice(-2)}
                          <X className="h-3 w-3" />
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">Select years...</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FY_OPTIONS.slice(0, 6).map((year) => (
                      <Button
                        key={year}
                        type="button"
                        size="sm"
                        variant={editedFinancialYears.includes(year) ? "default" : "outline"}
                        onClick={() => toggleFinancialYear(year)}
                        className="h-7 px-2 text-xs"
                      >
                        FY{year.toString().slice(-2)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save/Cancel buttons */}
              <div className="mt-4 flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="text-sm font-medium">{currentCompanyName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Folder</p>
                <p className="text-sm font-medium">{document.folder || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Financial Year</p>
                <p className="text-sm font-medium">
                  {Array.isArray(document.financial_years) && document.financial_years.length > 0
                    ? document.financial_years.map((y) => `FY${y.toString().slice(-2)}`).join(", ")
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">File Size</p>
                <p className="text-sm font-medium">{formatFileSize(document.file_size)}</p>
              </div>
            </div>
          )}

          {/* Preview Area */}
          <div
            className="bg-muted rounded-lg overflow-hidden mb-6"
            style={{ minHeight: "400px" }}
          >
            {fileType === "pdf" && document.file_url ? (
              <iframe
                src={document.file_url}
                className="w-full h-[500px]"
                title="Document Preview"
              />
            ) : fileType === "image" && document.file_url ? (
              <div className="flex items-center justify-center p-4">
                <img
                  src={document.file_url}
                  alt={document.title}
                  className="max-w-full max-h-[500px] object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <p className="text-lg font-medium mb-2">Preview not available</p>
                <p className="text-sm mb-4">
                  {fileType === "word"
                    ? "Word documents"
                    : fileType === "excel"
                    ? "Excel spreadsheets"
                    : "This file type"}{" "}
                  cannot be previewed inline
                </p>
                {document.file_url && (
                  <Button asChild>
                    <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in New Tab
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* AI Verification Results */}
          {hasAiSuggestion && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    AI Suggests a Better Name
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20">Current:</span>
                      <span className="font-mono bg-muted px-2 py-1 rounded">
                        {document.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20">Suggested:</span>
                      <span className="font-mono text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                        {document.ai_suggested_name}
                      </span>
                    </div>
                    {document.ai_confidence_score && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-20">Confidence:</span>
                        <span className="font-medium text-blue-700 dark:text-blue-300">
                          {document.ai_confidence_score}%
                        </span>
                      </div>
                    )}
                    {document.ai_analysis_notes && (
                      <div className="mt-2 text-muted-foreground italic">
                        {document.ai_analysis_notes}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Button
                      onClick={handleApplySuggestion}
                      disabled={applyingSuggestion}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {applyingSuggestion ? "Applying..." : "Apply Suggestion"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRejectSuggestion}
                      disabled={validating}
                    >
                      {validating ? "Keeping..." : "Keep Current Name"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Error Status */}
          {aiStatus === "error" && document.ai_analysis_notes && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                    AI Verification Failed
                  </h4>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {document.ai_analysis_notes}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Processing Status */}
          {isProcessing && (
            <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-spin" />
                <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  AI is analyzing document...
                </span>
              </div>
            </div>
          )}

          {/* Validation Status */}
          {validated ? (
            <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Document naming has been validated
              </span>
            </div>
          ) : (
            !hasAiSuggestion &&
            !isProcessing &&
            !isEditing && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                  Please review the document and confirm the naming is correct.
                </p>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleValidate}
                    disabled={validating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {validating ? "Validating..." : "Confirm Naming is Correct"}
                  </Button>
                  {canAiVerify && (
                    <Button
                      variant="outline"
                      onClick={handleAiVerify}
                      disabled={isProcessing}
                      className="text-purple-700 dark:text-purple-300 border-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {isProcessing ? "Verifying..." : "AI Verify"}
                    </Button>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-muted/50 border-t">
          <div className="text-sm text-muted-foreground">{currentCompanyName}</div>
          <div className="flex items-center gap-3">
            {!isEditing && (
              <Button variant="outline" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {document.file_url && (
              <Button variant="outline" asChild>
                <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open
                </a>
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
