"use client";

/**
 * CaseQATab - Q&A and document processing tab for a case
 *
 * Displays and manages:
 * - Document folder settings (source/filing folders)
 * - Document processing status
 * - Q&A pairs extracted from emails
 * - Duplicate document reviews
 *
 * Fully self-contained: manages its own state and data fetching.
 *
 * Extracted from cases/[id]/page.tsx for maintainability.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  HelpCircle,
  RefreshCw,
  FolderOpen,
  FolderInput,
  Plus,
  XCircle,
  CheckCircle,
  Star,
  Copy,
  Merge,
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/utils/formatters";

interface QAPair {
  id: number;
  question: string;
  answer: string | null;
  question_from: string | null;
  answer_from: string | null;
  question_date: string | null;
  answer_date: string | null;
  is_answered: boolean;
  is_important: boolean;
  category: string | null;
  formatted_category: string | null;
  case_email_id: number | null;
  email_subject: string | null;
  email_short_code: string | null;
  created_at: string;
}

interface ProcessingStatus {
  status: string;
  documents_count: number;
  emails_count: number;
  unanswered_questions_count: number;
  pending_duplicates_count: number;
  source_folder_paths: string[];
  filing_folder_paths: string[];
  file_action: string;
}

interface DuplicateReview {
  id: number;
  status: string;
  resolution: string | null;
  existing_document_id: number;
  existing_title: string | null;
  existing_filename: string | null;
  existing_sharepoint_path: string | null;
  existing_file_size: number | null;
  existing_document_date: string | null;
  new_file_path: string | null;
  new_file_name: string | null;
  new_file_hash: string | null;
  new_file_size: number | null;
  source_type: string | null;
  new_document_id: number | null;
  new_document_title: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface CaseQATabProps {
  caseId: string;
  initialFolderSettings: {
    source_folder_paths: string[];
    filing_folder_paths: string[];
    file_action: string;
  };
  onFolderSettingsSaved?: (settings: {
    source_folder_paths: string[];
    filing_folder_paths: string[];
    file_action: string;
  }) => void;
}

export function CaseQATab({
  caseId,
  initialFolderSettings,
  onFolderSettingsSaved,
}: CaseQATabProps) {
  // Q&A state
  const [qaPairs, setQaPairs] = React.useState<QAPair[]>([]);
  const [loadingQA, setLoadingQA] = React.useState(false);
  const [qaFilter, setQaFilter] = React.useState<"all" | "unanswered" | "important">("all");

  // Processing status
  const [processingStatus, setProcessingStatus] = React.useState<ProcessingStatus | null>(null);

  // Duplicates
  const [duplicates, setDuplicates] = React.useState<DuplicateReview[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = React.useState(false);

  // Folder settings
  const [editingFolders, setEditingFolders] = React.useState(false);
  const [folderSettings, setFolderSettings] = React.useState({
    source_folder_paths: initialFolderSettings.source_folder_paths || [],
    filing_folder_paths: initialFolderSettings.filing_folder_paths || [],
    file_action: initialFolderSettings.file_action || "copy",
  });
  const [displayFolderSettings, setDisplayFolderSettings] = React.useState({
    source_folder_paths: initialFolderSettings.source_folder_paths || [],
    filing_folder_paths: initialFolderSettings.filing_folder_paths || [],
    file_action: initialFolderSettings.file_action || "copy",
  });
  const [savingFolders, setSavingFolders] = React.useState(false);

  // Load Q&A pairs
  const loadQAPairs = React.useCallback(async () => {
    try {
      setLoadingQA(true);
      const params = new URLSearchParams();
      if (qaFilter === "unanswered") params.append("answered", "false");
      if (qaFilter === "important") params.append("important", "true");

      const response = await api.get<{ success: boolean; data: QAPair[] }>(
        `/api/v1/cases/${caseId}/qa_pairs?${params.toString()}`
      );
      setQaPairs(response.data || []);
    } catch (error) {
      console.error("Failed to load Q&A pairs:", error);
    } finally {
      setLoadingQA(false);
    }
  }, [caseId, qaFilter]);

  // Load processing status
  const loadProcessingStatus = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: ProcessingStatus }>(
        `/api/v1/cases/${caseId}/processing_status`
      );
      setProcessingStatus(response.data);
    } catch (error) {
      console.error("Failed to load processing status:", error);
    }
  }, [caseId]);

  // Load duplicates
  const loadDuplicates = async () => {
    try {
      setLoadingDuplicates(true);
      const response = await api.get<{ success: boolean; data: DuplicateReview[] }>(
        `/api/v1/cases/${caseId}/duplicates?status=pending`
      );
      setDuplicates(response.data || []);
    } catch (error) {
      console.error("Failed to load duplicates:", error);
    } finally {
      setLoadingDuplicates(false);
    }
  };

  // Load data on mount and filter change
  React.useEffect(() => {
    loadQAPairs();
  }, [loadQAPairs]);

  React.useEffect(() => {
    loadProcessingStatus();
  }, [loadProcessingStatus]);

  // Resolve duplicate
  const resolveDuplicate = async (reviewId: number, resolution: string) => {
    try {
      await api.post(`/api/v1/cases/${caseId}/resolve_duplicate`, {
        review_id: reviewId,
        resolution: resolution,
      });
      loadDuplicates();
      loadProcessingStatus();
    } catch (error) {
      console.error("Failed to resolve duplicate:", error);
    }
  };

  // Reprocess documents
  const reprocessDocuments = async () => {
    try {
      await api.post(`/api/v1/cases/${caseId}/reprocess_documents`);
      loadProcessingStatus();
    } catch (error) {
      console.error("Failed to reprocess documents:", error);
    }
  };

  // Folder settings functions
  const initFolderSettings = () => {
    setFolderSettings({
      source_folder_paths: displayFolderSettings.source_folder_paths,
      filing_folder_paths: displayFolderSettings.filing_folder_paths,
      file_action: displayFolderSettings.file_action,
    });
    setEditingFolders(true);
  };

  const saveFolderSettings = async () => {
    try {
      setSavingFolders(true);
      const response = await api.patch<{ success: boolean; data: unknown }>(
        `/api/v1/cases/${caseId}/folder_settings`,
        folderSettings
      );
      if (response?.success) {
        setDisplayFolderSettings(folderSettings);
        onFolderSettingsSaved?.(folderSettings);
      }
      setEditingFolders(false);
    } catch (error) {
      console.error("Failed to save folder settings:", error);
    } finally {
      setSavingFolders(false);
    }
  };

  const addSourceFolder = (path: string) => {
    if (path && !folderSettings.source_folder_paths.includes(path)) {
      setFolderSettings((prev) => ({
        ...prev,
        source_folder_paths: [...prev.source_folder_paths, path],
      }));
    }
  };

  const removeSourceFolder = (path: string) => {
    setFolderSettings((prev) => ({
      ...prev,
      source_folder_paths: prev.source_folder_paths.filter((p) => p !== path),
    }));
  };

  const addFilingFolder = (path: string) => {
    if (path && !folderSettings.filing_folder_paths.includes(path)) {
      setFolderSettings((prev) => ({
        ...prev,
        filing_folder_paths: [...prev.filing_folder_paths, path],
      }));
    }
  };

  const removeFilingFolder = (path: string) => {
    setFolderSettings((prev) => ({
      ...prev,
      filing_folder_paths: prev.filing_folder_paths.filter((p) => p !== path),
    }));
  };

  // Q&A actions
  const toggleQAImportant = async (qaId: number, isImportant: boolean) => {
    try {
      await api.patch(`/api/v1/cases/${caseId}/qa_pairs/${qaId}`, {
        is_important: !isImportant,
      });
      loadQAPairs();
    } catch (error) {
      console.error("Failed to toggle importance:", error);
    }
  };

  const markQAAnswered = async (qaId: number, answer: string) => {
    try {
      await api.patch(`/api/v1/cases/${caseId}/qa_pairs/${qaId}`, {
        is_answered: true,
        answer: answer,
      });
      loadQAPairs();
    } catch (error) {
      console.error("Failed to mark as answered:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Folder Settings Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Document Folder Settings
          </CardTitle>
          {!editingFolders ? (
            <Button variant="outline" size="sm" onClick={initFolderSettings}>
              Configure Folders
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingFolders(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveFolderSettings} disabled={savingFolders}>
                {savingFolders && <Spinner size={16} className="mr-1" />}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!editingFolders ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Source Folders</p>
                {displayFolderSettings.source_folder_paths.length > 0 ? (
                  <div className="space-y-1">
                    {displayFolderSettings.source_folder_paths.map((path, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-blue-500" />
                        <span className="truncate" title={path}>
                          {path.split("/").pop() || path}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Not configured</span>
                )}
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Filing Folders</p>
                {displayFolderSettings.filing_folder_paths.length > 0 ? (
                  <div className="space-y-1">
                    {displayFolderSettings.filing_folder_paths.map((path, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <FolderInput className="h-4 w-4 text-green-500" />
                        <span className="truncate" title={path}>
                          {path.split("/").pop() || path}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Not configured</span>
                )}
              </div>
              <div>
                <p className="text-muted-foreground mb-1">File Action</p>
                <Badge variant="outline">
                  {displayFolderSettings.file_action === "move" ? "Move files" : "Copy files"}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Source Folders */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <FolderOpen className="h-4 w-4 text-blue-500" />
                  Source Folders
                  <span className="text-muted-foreground font-normal text-xs">
                    (Where to scan for documents)
                  </span>
                </Label>
                <div className="space-y-2">
                  {folderSettings.source_folder_paths.map((path, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={path} readOnly className="flex-1" />
                      <Button variant="ghost" size="sm" onClick={() => removeSourceFolder(path)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Enter cloud storage folder path..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addSourceFolder((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        addSourceFolder(input.value);
                        input.value = "";
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Filing Folders */}
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <FolderInput className="h-4 w-4 text-green-500" />
                  Filing Folders
                  <span className="text-muted-foreground font-normal text-xs">
                    (Where to organize case documents)
                  </span>
                </Label>
                <div className="space-y-2">
                  {folderSettings.filing_folder_paths.map((path, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={path} readOnly className="flex-1" />
                      <Button variant="ghost" size="sm" onClick={() => removeFilingFolder(path)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Enter cloud storage folder path..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          addFilingFolder((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        addFilingFolder(input.value);
                        input.value = "";
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* File Action */}
              <div>
                <Label className="mb-2 block">File Action</Label>
                <Select
                  value={folderSettings.file_action}
                  onValueChange={(v) => setFolderSettings((prev) => ({ ...prev, file_action: v }))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="copy">Copy files (keep originals)</SelectItem>
                    <SelectItem value="move">Move files (remove from source)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Status */}
      {processingStatus && (
        <Card
          className={cn(
            "border-l-4",
            processingStatus.status === "completed"
              ? "border-l-green-500"
              : processingStatus.status === "processing"
              ? "border-l-blue-500"
              : processingStatus.status === "failed"
              ? "border-l-red-500"
              : "border-l-border"
          )}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Document Processing Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    className={cn(
                      processingStatus.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : processingStatus.status === "processing"
                        ? "bg-blue-100 text-blue-700"
                        : processingStatus.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {processingStatus.status === "processing" && (
                      <Spinner size={12} className="mr-1" />
                    )}
                    {processingStatus.status === "completed" && (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    {processingStatus.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                    {processingStatus.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {processingStatus.documents_count} docs, {processingStatus.emails_count} emails
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {processingStatus.unanswered_questions_count > 0 && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-600">
                      {processingStatus.unanswered_questions_count}
                    </p>
                    <p className="text-xs text-muted-foreground">Unanswered</p>
                  </div>
                )}
                {processingStatus.pending_duplicates_count > 0 && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">
                      {processingStatus.pending_duplicates_count}
                    </p>
                    <p className="text-xs text-muted-foreground">Duplicates</p>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={reprocessDocuments}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reprocess
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Q&A Pairs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Questions & Answers ({qaPairs.length})
          </CardTitle>
          <div className="flex gap-2">
            <Select
              value={qaFilter}
              onValueChange={(v: "all" | "unanswered" | "important") => setQaFilter(v)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Questions</SelectItem>
                <SelectItem value="unanswered">Unanswered</SelectItem>
                <SelectItem value="important">Important</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => loadQAPairs()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingQA ? (
            <div className="flex items-center justify-center h-32">
              <Spinner size={24} className="text-muted-foreground" />
            </div>
          ) : qaPairs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No Q&A pairs extracted yet</p>
              <p className="text-sm mt-1">
                Questions will be automatically extracted from case emails
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {qaPairs.map((qa) => (
                <div
                  key={qa.id}
                  className={cn(
                    "p-4 rounded-lg border",
                    !qa.is_answered && "border-amber-200 bg-amber-50 dark:bg-amber-950/20",
                    qa.is_important &&
                      !qa.is_answered &&
                      "border-red-300 bg-red-50 dark:bg-red-950/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {qa.is_important && (
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        )}
                        <Badge variant="outline" className="text-xs">
                          {qa.formatted_category || "General"}
                        </Badge>
                        {qa.email_short_code && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {qa.email_short_code}
                          </span>
                        )}
                        {!qa.is_answered && (
                          <Badge className="bg-amber-100 text-amber-700">Unanswered</Badge>
                        )}
                      </div>
                      <p className="font-medium">{qa.question}</p>
                      {qa.question_from && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Asked by: {qa.question_from}
                          {qa.question_date &&
                            ` on ${format(new Date(qa.question_date), "d MMM yyyy")}`}
                        </p>
                      )}
                      {qa.is_answered && qa.answer && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200">
                          <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                            Answer:
                          </p>
                          <p className="text-sm">{qa.answer}</p>
                          {qa.answer_from && (
                            <p className="text-xs text-muted-foreground mt-2">
                              By: {qa.answer_from}
                              {qa.answer_date &&
                                ` on ${format(new Date(qa.answer_date), "d MMM yyyy")}`}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleQAImportant(qa.id, qa.is_important)}
                        className={qa.is_important ? "text-amber-500" : ""}
                      >
                        <Star className={cn("h-4 w-4", qa.is_important && "fill-amber-500")} />
                      </Button>
                      {!qa.is_answered && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markQAAnswered(qa.id, "Marked as answered")}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duplicate Documents */}
      {processingStatus && processingStatus.pending_duplicates_count > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Duplicate Documents ({processingStatus.pending_duplicates_count} pending)
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadDuplicates}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loadingDuplicates ? (
              <div className="flex items-center justify-center h-32">
                <Spinner size={24} className="text-muted-foreground" />
              </div>
            ) : duplicates.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>Click Refresh to load pending duplicates</p>
              </div>
            ) : (
              <div className="space-y-4">
                {duplicates.map((dup) => (
                  <div
                    key={dup.id}
                    className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/20"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            Existing Document
                          </p>
                          <p className="font-medium">
                            {dup.existing_title || dup.existing_filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {dup.existing_sharepoint_path}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Size: {formatFileSize(dup.existing_file_size)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            New File
                          </p>
                          <p className="font-medium">{dup.new_file_name}</p>
                          <p className="text-xs text-muted-foreground">{dup.new_file_path}</p>
                          <p className="text-xs text-muted-foreground">
                            Size: {formatFileSize(dup.new_file_size)}
                          </p>
                          <Badge variant="outline" className="mt-1">
                            {dup.source_type}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveDuplicate(dup.id, "keep_existing")}
                        >
                          Keep Existing
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveDuplicate(dup.id, "replace")}
                        >
                          Replace
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveDuplicate(dup.id, "keep_both")}
                        >
                          <Merge className="h-4 w-4 mr-1" />
                          Keep Both
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CaseQATab;
