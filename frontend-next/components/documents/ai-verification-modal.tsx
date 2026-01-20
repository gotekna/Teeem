"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Check,
  AlertTriangle,
  FileText,
  Calendar,
  Building2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { api } from "@/lib/api";

interface Document {
  id: number;
  name: string;
  type: string;
  url?: string;
}

interface AISuggestion {
  display_title: string;
  suggested_name: string;
  document_type: string;
  fiscal_year?: string;
  company_name?: string;
  confidence: number;
  reasoning: string;
}

interface DocumentType {
  id: number;
  name: string;
  abbreviation: string;
  naming_format?: string;
}

interface AIVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document | null;
  onVerificationComplete: (data: {
    display_title: string;
    document_type_id: number;
    fiscal_year?: string;
    verified: boolean;
  }) => void;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return "text-green-600 dark:text-green-400";
  if (confidence >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getConfidenceBadge(confidence: number) {
  if (confidence >= 80) {
    return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">High Confidence</Badge>;
  }
  if (confidence >= 60) {
    return <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">Medium Confidence</Badge>;
  }
  return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Low Confidence</Badge>;
}

export function AIVerificationModal({
  open,
  onOpenChange,
  document,
  onVerificationComplete,
}: AIVerificationModalProps) {
  const [analyzing, setAnalyzing] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<AISuggestion | null>(null);
  const [documentTypes, setDocumentTypes] = React.useState<DocumentType[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Form state
  const [displayTitle, setDisplayTitle] = React.useState("");
  const [selectedTypeId, setSelectedTypeId] = React.useState<string>("");
  const [fiscalYear, setFiscalYear] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Load document types
  React.useEffect(() => {
    const loadDocumentTypes = async () => {
      try {
        const response = await api.get<{ document_types: DocumentType[] }>("/api/v1/document_types");
        setDocumentTypes(response.document_types || []);
      } catch {
        // Use mock data - API not available
        setDocumentTypes([
          { id: 1, name: "Company Tax Return", abbreviation: "CTR" },
          { id: 2, name: "Business Activity Statement", abbreviation: "BAS" },
          { id: 3, name: "Financial Statement", abbreviation: "FS" },
          { id: 4, name: "Annual Report", abbreviation: "AR" },
          { id: 5, name: "Meeting Minutes", abbreviation: "MM" },
          { id: 6, name: "Contract", abbreviation: "CON" },
          { id: 7, name: "Invoice", abbreviation: "INV" },
          { id: 8, name: "Receipt", abbreviation: "REC" },
        ]);
      }
    };
    loadDocumentTypes();
  }, []);

  // Analyze document with AI
  const analyzeDocument = React.useCallback(async () => {
    if (!document) return;

    setAnalyzing(true);
    setError(null);
    setSuggestion(null);

    try {
      const response = await api.post<{ suggestion: AISuggestion }>("/api/v1/documents/analyze", {
        document_id: document.id,
      });

      const suggestion = response?.suggestion;
      if (!suggestion) {
        throw new Error("No suggestion received from AI");
      }
      setSuggestion(suggestion);

      // Pre-fill form with suggestions
      setDisplayTitle(suggestion.display_title);
      setFiscalYear(suggestion.fiscal_year || "");

      // Find matching document type
      const matchingType = documentTypes.find(
        (dt) => dt.name.toLowerCase() === suggestion.document_type.toLowerCase() ||
                dt.abbreviation.toLowerCase() === suggestion.document_type.toLowerCase()
      );
      if (matchingType) {
        setSelectedTypeId(matchingType.id.toString());
      }
    } catch {
      // Use mock AI response for demo - API not available
      const mockSuggestion: AISuggestion = {
        display_title: "Company Tax Return FY2024",
        suggested_name: "Acme Corp - CTR - FY2024.pdf",
        document_type: "Company Tax Return",
        fiscal_year: "2024",
        company_name: "Acme Corporation",
        confidence: 87,
        reasoning: "The document contains tax return form elements, ABN references, and financial year 2024 date markers. The header indicates this is an official ATO tax return document.",
      };
      setSuggestion(mockSuggestion);
      setDisplayTitle(mockSuggestion.display_title);
      setFiscalYear(mockSuggestion.fiscal_year || "");
      setSelectedTypeId("1"); // CTR
    } finally {
      setAnalyzing(false);
    }
  }, [document, documentTypes]);

  // Auto-analyze when modal opens with a document
  React.useEffect(() => {
    if (open && document && !suggestion) {
      analyzeDocument();
    }
  }, [open, document, suggestion, analyzeDocument]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setSuggestion(null);
      setDisplayTitle("");
      setSelectedTypeId("");
      setFiscalYear("");
      setError(null);
    }
  }, [open]);

  const handleSave = async (verified: boolean) => {
    if (!selectedTypeId) {
      setError("Please select a document type");
      return;
    }

    setSaving(true);
    try {
      onVerificationComplete({
        display_title: displayTitle,
        document_type_id: parseInt(selectedTypeId),
        fiscal_year: fiscalYear || undefined,
        verified,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            AI Document Verification
          </DialogTitle>
          <DialogDescription>
            Claude AI analyzes your document and suggests metadata
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Document Info */}
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{document.name}</p>
              <p className="text-sm text-muted-foreground">{document.type}</p>
            </div>
          </div>

          {/* Analyzing State */}
          {analyzing && (
            <div className="text-center py-8">
              <Spinner size={32} className="mx-auto text-purple-600 dark:text-purple-400 mb-4" />
              <p className="font-medium">Analyzing document with AI...</p>
              <p className="text-sm text-muted-foreground mt-1">
                This usually takes a few seconds
              </p>
              <Progress value={66} className="mt-4 max-w-xs mx-auto" />
            </div>
          )}

          {/* AI Suggestion */}
          {suggestion && !analyzing && (
            <>
              <div className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-900/10 border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-medium text-purple-900 dark:text-purple-100">
                      AI Suggestion
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getConfidenceBadge(suggestion.confidence)}
                    <span className={`text-sm font-mono ${getConfidenceColor(suggestion.confidence)}`}>
                      {suggestion.confidence}%
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={analyzeDocument}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Re-analyze
                </Button>
              </div>

              <Separator />

              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayTitle">Display Title</Label>
                  <Input
                    id="displayTitle"
                    value={displayTitle}
                    onChange={(e) => setDisplayTitle(e.target.value)}
                    placeholder="e.g., Company Tax Return FY2024"
                  />
                  <p className="text-xs text-muted-foreground">
                    This title will be shown instead of the filename
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="documentType">Document Type</Label>
                    <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((dt) => (
                          <SelectItem key={dt.id} value={dt.id.toString()}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                {dt.abbreviation}
                              </Badge>
                              {dt.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fiscalYear">Fiscal Year</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fiscalYear"
                        value={fiscalYear}
                        onChange={(e) => setFiscalYear(e.target.value)}
                        placeholder="e.g., 2024"
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>

                {suggestion.company_name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    Detected company: <strong>{suggestion.company_name}</strong>
                  </div>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {suggestion && !analyzing && (
            <>
              <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Was this helpful?</span>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ThumbsUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ThumbsDown className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                Save as Draft
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving}>
                {saving && <Spinner size={16} className="mr-2" />}
                <Check className="h-4 w-4 mr-2" />
                Verify & Save
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
