"use client";

/**
 * CaseDocumentsTab - Document management for a case
 *
 * Handles:
 * - Case folder creation in SharePoint
 * - Source folder selection and browsing
 * - Document scanning and linking
 * - Document list display (via StandardDocumentList)
 *
 * Extracted from cases/[id]/page.tsx for maintainability.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search,
  ExternalLink,
  Plus,
  XCircle,
  Trash2,
  RefreshCw,
  FolderOpen,
  FolderInput,
  Pencil,
} from "lucide-react";
import { api } from "@/lib/api";
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";
import { Spinner } from "@/components/ui/spinner";
import {
  StandardDocumentList,
  type LibraryDocument,
} from "@/components/documents/StandardDocumentList";

interface CaseDocument {
  id: number;
  filename: string;
  document_type: string;
  document_date: string | null;
  file_size: number | null;
  relevance: string;
  notes: string | null;
  storage_path: string | null;
  web_url: string | null;
}

interface CaseFolderInfo {
  has_folder: boolean;
  folder_path: string | null;
  web_url: string | null;
}

interface CaseDocumentsTabProps {
  caseId: string;
  caseNumber: string | null;
}

/** Map case document to StandardDocumentList's LibraryDocument */
function toLibraryDocument(doc: CaseDocument): LibraryDocument {
  return {
    id: doc.id,
    displayName: doc.filename,
    sendName: doc.filename,
    originalFilename: doc.filename,
    mimeType: "application/octet-stream",
    fileSize: doc.file_size || 0,
    fileUrl: doc.web_url,
    storagePath: doc.storage_path,
    folder: doc.document_type,
    createdAt: doc.document_date || new Date().toISOString(),
    source: doc.relevance || "linked",
    verified: false,
    verifiedBy: null,
    verifiedAt: null,
    versionNumber: 1,
    versionLetter: null,
    versionGroupId: null,
    versionCount: 1,
    expiryDate: null,
    isExpired: false,
    isExpiringSoon: false,
    expiryStatus: null,
    daysUntilExpiry: null,
  };
}

export function CaseDocumentsTab({ caseId, caseNumber }: CaseDocumentsTabProps) {
  // Documents state
  const [documents, setDocuments] = React.useState<CaseDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = React.useState(false);

  // Case folder state
  const [caseFolderInfo, setCaseFolderInfo] = React.useState<CaseFolderInfo | null>(null);
  const [creatingFolder, setCreatingFolder] = React.useState(false);

  // Source folder browser state
  const [showSourceFolderBrowser, setShowSourceFolderBrowser] = React.useState(false);
  const [sourceFolderInputMode, setSourceFolderInputMode] = React.useState<"browse" | "type">("browse");
  const [newSourceFolderPath, setNewSourceFolderPath] = React.useState("");
  const [scanningFolders, setScanningFolders] = React.useState(false);

  // Folder settings (source folders to scan)
  const [folderSettings, setFolderSettings] = React.useState<{
    source_folder_paths: string[];
  }>({ source_folder_paths: [] });

  // Load documents
  const loadDocuments = React.useCallback(async () => {
    try {
      setLoadingDocuments(true);
      const response = await api.get<{ success: boolean; data: CaseDocument[] }>(
        `/api/v1/cases/${caseId}/documents`
      );
      setDocuments(response.data || []);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoadingDocuments(false);
    }
  }, [caseId]);

  // Load case folder info
  const loadCaseFolderInfo = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: CaseFolderInfo }>(
        `/api/v1/cases/${caseId}/folder_info`
      );
      setCaseFolderInfo(response.data);
    } catch (error) {
      console.error("Failed to load case folder info:", error);
    }
  }, [caseId]);

  // Load initial data
  React.useEffect(() => {
    loadDocuments();
    loadCaseFolderInfo();
  }, [loadDocuments, loadCaseFolderInfo]);

  // Create case folder in SharePoint
  const createCaseFolder = async () => {
    try {
      setCreatingFolder(true);
      await api.post(`/api/v1/cases/${caseId}/create_folder`);
      await loadCaseFolderInfo();
    } catch (error) {
      console.error("Failed to create case folder:", error);
    } finally {
      setCreatingFolder(false);
    }
  };

  // Handle folder selection from SharePoint browser
  const handleSourceFolderSelect = (
    folder: { id: string; name: string; web_url?: string; child_count: number } | null,
    path: string
  ) => {
    if (path && !folderSettings.source_folder_paths.includes(path)) {
      setFolderSettings(prev => ({
        ...prev,
        source_folder_paths: [...prev.source_folder_paths, path]
      }));
    }
  };

  // Add source folder from typed path
  const addSourceFolderFromPath = () => {
    if (newSourceFolderPath.trim() && !folderSettings.source_folder_paths.includes(newSourceFolderPath.trim())) {
      setFolderSettings(prev => ({
        ...prev,
        source_folder_paths: [...prev.source_folder_paths, newSourceFolderPath.trim()]
      }));
      setNewSourceFolderPath("");
    }
  };

  // Remove a source folder
  const removeSourceFolder = (path: string) => {
    setFolderSettings(prev => ({
      ...prev,
      source_folder_paths: prev.source_folder_paths.filter(p => p !== path)
    }));
  };

  // Scan all selected source folders for documents
  const scanSourceFolders = async () => {
    if (folderSettings.source_folder_paths.length === 0) return;
    try {
      setScanningFolders(true);
      await api.post(`/api/v1/cases/${caseId}/scan_folders`, {
        folder_paths: folderSettings.source_folder_paths,
      });
      await loadDocuments();
    } catch (error) {
      console.error("Failed to scan folders:", error);
    } finally {
      setScanningFolders(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Case Folder Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">Case Folder</CardTitle>
          {caseFolderInfo?.has_folder && caseFolderInfo.web_url && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(caseFolderInfo.web_url!, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Storage
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {caseFolderInfo === null ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size={20} className="text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : caseFolderInfo.has_folder ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
              <FolderOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {caseFolderInfo.folder_path}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Folder created in cloud storage
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <FolderInput className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground mb-3">
                No folder created yet for this case
              </p>
              <Button onClick={createCaseFolder} disabled={creatingFolder}>
                {creatingFolder ? (
                  <>
                    <Spinner size={16} className="mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Case Folder
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Creates folder at: Corporate/Case Info/{caseNumber}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source Folders Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderInput className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            Source Folders
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSourceFolderBrowser(!showSourceFolderBrowser)}
          >
            {showSourceFolderBrowser ? (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Close
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Folder
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Folder Browser Panel (when open) */}
          {showSourceFolderBrowser && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              {/* Browse / Type tabs */}
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  className={`flex-1 px-4 py-2 text-sm flex items-center justify-center gap-2 ${
                    sourceFolderInputMode === "browse"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                  onClick={() => setSourceFolderInputMode("browse")}
                >
                  <Search className="w-4 h-4" />
                  Browse Folders
                </button>
                <button
                  type="button"
                  className={`flex-1 px-4 py-2 text-sm flex items-center justify-center gap-2 ${
                    sourceFolderInputMode === "type"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                  onClick={() => setSourceFolderInputMode("type")}
                >
                  <Pencil className="w-4 h-4" />
                  Type Path
                </button>
              </div>

              {sourceFolderInputMode === "browse" ? (
                <div>
                  <SharePointFolderBrowser
                    onSelect={handleSourceFolderSelect}
                    className="max-h-[300px]"
                  />
                  <div className="flex justify-end pt-2 border-t mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSourceFolderBrowser(false)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={newSourceFolderPath}
                    onChange={(e) => setNewSourceFolderPath(e.target.value)}
                    placeholder="e.g. Corporate/Clients/Smith"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newSourceFolderPath.trim()) {
                        addSourceFolderFromPath();
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addSourceFolderFromPath}
                    disabled={!newSourceFolderPath.trim()}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Selected folders list */}
          {folderSettings.source_folder_paths.length === 0 ? (
            !showSourceFolderBrowser && (
              <div className="text-center py-4 text-muted-foreground">
                <FolderInput className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No source folders selected</p>
                <p className="text-xs mt-1">Add folders from cloud storage to scan for documents</p>
              </div>
            )
          ) : (
            <div className="space-y-2">
              {folderSettings.source_folder_paths.map((path, index) => (
                <div
                  key={path || `folder-${index}`}
                  className="flex items-center justify-between p-2 bg-muted rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <span className="text-sm font-medium">{path}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSourceFolder(path)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-end mt-3">
                <Button
                  onClick={scanSourceFolders}
                  disabled={scanningFolders}
                >
                  {scanningFolders ? (
                    <>
                      <Spinner size={16} className="mr-2" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Scan Folders
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents List — uses StandardDocumentList */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documents ({documents.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={loadDocuments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <StandardDocumentList
            documents={documents.map(toLibraryDocument)}
            loading={loadingDocuments}
            showVerifiedBadge={false}
            showExpiryBadge={false}
            showVerifyActions={false}
            emptyMessage="No documents linked to this case"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default CaseDocumentsTab;
