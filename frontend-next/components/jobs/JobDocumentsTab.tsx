"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Folder,
  Upload,
  ExternalLink,
  Cloud,
  CheckCircle,
  AlertCircle,
  FileText,
  Paperclip,
  XCircle,
  Eye,
  ShieldCheck,
  Settings,
  RefreshCw,
  Loader2,
  ChevronRight,
  ArrowLeft,
  File,
} from "lucide-react";
import { api } from "@/lib/api";

interface OrgStatus {
  loading: boolean;
  connected: boolean;
  rootFolderPath?: string;
}

interface JobFolderStatus {
  loading: boolean;
  exists: boolean;
  webUrl: string | null;
  jobFolderId?: string;
}

interface OneDriveItem {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime?: string;
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
  };
  size?: number;
}

interface OneDriveFolder {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime?: string;
  folder?: {
    childCount: number;
  };
}

interface FolderPath {
  id: string;
  name: string;
}

interface DocumentCategory {
  id: number;
  name: string;
  document_count: number;
}

interface DocumentTask {
  id: number;
  name: string;
  description: string;
  required: boolean;
  has_document: boolean;
  is_validated: boolean;
  document_url: string | null;
  uploaded_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
}

interface JobDocumentsTabProps {
  jobId: string | number;
  jobTitle?: string;
}

export function JobDocumentsTab({ jobId, jobTitle }: JobDocumentsTabProps) {
  const [viewMode, setViewMode] = useState<"tasks" | "onedrive">("tasks");
  const [orgStatus, setOrgStatus] = useState<OrgStatus>({ loading: true, connected: false });
  const [jobFolderStatus, setJobFolderStatus] = useState<JobFolderStatus>({ loading: false, exists: false, webUrl: null });
  const [folders, setFolders] = useState<OneDriveFolder[]>([]);
  const [creatingFolders, setCreatingFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [documentCategories, setDocumentCategories] = useState<DocumentCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(null);
  const [tasks, setTasks] = useState<DocumentTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([]);
  const [folderContents, setFolderContents] = useState<OneDriveItem[]>([]);
  const [loadingContents, setLoadingContents] = useState(false);

  useEffect(() => {
    checkOrganizationStatus();
    loadDocumentCategories();
  }, [jobId]);

  useEffect(() => {
    if (selectedCategory) {
      loadDocumentTasks(selectedCategory.id);
    }
  }, [selectedCategory]);

  const checkOrganizationStatus = async () => {
    try {
      setOrgStatus({ loading: true, connected: false });
      setError(null);

      const response = await api.get<{ connected: boolean; root_folder_path?: string }>(
        "/api/v1/organization_onedrive/status"
      );

      setOrgStatus({
        loading: false,
        connected: response?.connected || false,
        rootFolderPath: response?.root_folder_path,
      });

      if (response?.connected) {
        await checkJobFolderStatus();
      }
    } catch (err) {
      console.error("Failed to check organization OneDrive status:", err);
      setOrgStatus({ loading: false, connected: false });
    }
  };

  const checkJobFolderStatus = async () => {
    try {
      setJobFolderStatus({ loading: true, exists: false, webUrl: null });

      const response = await api.get<{
        job_folder_web_url?: string;
        job_folder_id?: string;
        items?: OneDriveFolder[];
      }>(`/api/v1/organization_onedrive/job_folders?job_id=${jobId}`);

      if (response) {
        setJobFolderStatus({
          loading: false,
          exists: true,
          webUrl: response.job_folder_web_url || null,
          jobFolderId: response.job_folder_id,
        });

        const items = response.items || [];
        const folderItems = items.filter((item) => item.folder);
        setFolders(folderItems);
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 404) {
        setJobFolderStatus({ loading: false, exists: false, webUrl: null });
      } else {
        console.error("Failed to check job folder status:", err);
      }
    }
  };

  const loadDocumentCategories = async () => {
    try {
      const response = await api.get<DocumentCategory[]>(`/api/v1/jobs/${jobId}/documentation_tabs`);
      const categories = response || [];
      setDocumentCategories(categories);
      if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0]);
      }
    } catch (err) {
      console.error("Failed to load document categories:", err);
    }
  };

  const loadDocumentTasks = async (categoryId: number) => {
    try {
      setLoadingTasks(true);
      const response = await api.get<{ tasks: DocumentTask[] }>(
        `/api/v1/jobs/${jobId}/document_tasks?category=${categoryId}`
      );
      setTasks(response?.tasks || []);
    } catch (err) {
      console.error("Failed to load document tasks:", err);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleCreateFolders = async () => {
    try {
      setCreatingFolders(true);
      setError(null);
      setMessage(null);

      const response = await api.post<{ message?: string }>(
        `/api/v1/organization_onedrive/create_job_folders?job_id=${jobId}`
      );

      setMessage({
        type: "success",
        text: response?.message || "Folder structure created successfully!",
      });

      await checkJobFolderStatus();
    } catch (err) {
      console.error("Failed to create folders:", err);
      setError("Failed to create folder structure");
    } finally {
      setCreatingFolders(false);
    }
  };

  const handleUpload = (folderId: string) => {
    setUploadFolderId(folderId);
    fileInputRef.current?.click();
  };

  const loadFolderContents = async (folderId: string, folderName: string) => {
    try {
      setLoadingContents(true);
      const response = await api.get<{ items: OneDriveItem[] }>(
        `/api/v1/organization_onedrive/folder_contents?folder_id=${folderId}&job_id=${jobId}`
      );

      setFolderContents(response?.items || []);
      setCurrentFolderId(folderId);
      setFolderPath((prev) => [...prev, { id: folderId, name: folderName }]);
    } catch (err) {
      console.error("Failed to load folder contents:", err);
      setError("Failed to load folder contents");
    } finally {
      setLoadingContents(false);
    }
  };

  const navigateBack = () => {
    if (folderPath.length <= 1) {
      // Go back to folder list
      setCurrentFolderId(null);
      setFolderPath([]);
      setFolderContents([]);
    } else {
      // Go up one level
      const newPath = folderPath.slice(0, -2);
      const parentFolder = folderPath[folderPath.length - 2];
      setFolderPath(newPath);
      loadFolderContents(parentFolder.id, parentFolder.name);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadFolderId) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("job_id", String(jobId));
      formData.append("folder_id", uploadFolderId);

      await api.postFormData("/api/v1/organization_onedrive/upload", formData);

      setMessage({ type: "success", text: `File "${file.name}" uploaded successfully!` });
      await checkJobFolderStatus();
    } catch (err) {
      console.error("Failed to upload file:", err);
      setError("Failed to upload file");
    } finally {
      setUploadFolderId(null);
      if (event.target) event.target.value = "";
    }
  };

  const handleTaskUpload = async (taskId: number, file: File) => {
    try {
      setUploading(taskId);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("task_id", String(taskId));
      formData.append("construction_id", String(jobId));
      formData.append("category", String(selectedCategory?.id));

      const response = await api.postFormData<{ document_url: string; uploaded_at: string }>(
        `/api/v1/jobs/${jobId}/document_tasks/${taskId}/upload`,
        formData
      );

      if (response) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, has_document: true, document_url: response.document_url, uploaded_at: response.uploaded_at }
              : task
          )
        );
      }
    } catch (err) {
      console.error("Failed to upload document:", err);
      setError("Failed to upload document");
    } finally {
      setUploading(null);
    }
  };

  const handleValidate = async (taskId: number) => {
    try {
      const response = await api.post<{ validated_at: string; validated_by: string }>(
        `/api/v1/jobs/${jobId}/document_tasks/${taskId}/validate`
      );

      if (response) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, is_validated: true, validated_at: response.validated_at, validated_by: response.validated_by }
              : task
          )
        );
      }
    } catch (err) {
      console.error("Failed to validate document:", err);
    }
  };

  const getStatusBadge = (task: DocumentTask) => {
    if (task.is_validated) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Validated</Badge>;
    }
    if (task.has_document) {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Paperclip className="h-3 w-3 mr-1" />Attached</Badge>;
    }
    if (task.required) {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Required</Badge>;
    }
    return <Badge variant="secondary">Optional</Badge>;
  };

  // Document Tasks View
  const renderTasksView = () => {
    if (documentCategories.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No documentation categories found.</p>
            <p className="text-sm text-muted-foreground mt-1">Please create categories in Settings.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <Tabs
          value={String(selectedCategory?.id)}
          onValueChange={(val) => {
            const cat = documentCategories.find((c) => String(c.id) === val);
            if (cat) setSelectedCategory(cat);
          }}
        >
          <TabsList className="w-full justify-start overflow-x-auto">
            {documentCategories.map((cat) => (
              <TabsTrigger key={cat.id} value={String(cat.id)}>
                {cat.name} ({cat.document_count || 0})
              </TabsTrigger>
            ))}
          </TabsList>

          {documentCategories.map((cat) => (
            <TabsContent key={cat.id} value={String(cat.id)}>
              {loadingTasks ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {tasks.filter((t) => t.has_document).length}/{tasks.length}
                        </div>
                        <p className="text-sm text-muted-foreground">Documents Attached</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-600">
                          {tasks.filter((t) => t.is_validated).length}/{tasks.length}
                        </div>
                        <p className="text-sm text-muted-foreground">Validated</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-red-600">
                          {tasks.filter((t) => t.required && !t.has_document).length}
                        </div>
                        <p className="text-sm text-muted-foreground">Required Missing</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tasks Table */}
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Document</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Uploaded</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tasks.map((task) => (
                            <TableRow key={task.id}>
                              <TableCell>
                                <div className="flex items-start gap-3">
                                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                                  <div>
                                    <p className="font-medium">
                                      {task.name}
                                      {task.required && <span className="text-red-500 ml-1">*</span>}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{task.description}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(task)}</TableCell>
                              <TableCell>
                                {task.uploaded_at ? new Date(task.uploaded_at).toLocaleDateString() : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <label className="cursor-pointer">
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleTaskUpload(task.id, file);
                                      }}
                                      disabled={uploading === task.id}
                                    />
                                    <Button variant="ghost" size="sm" asChild disabled={uploading === task.id}>
                                      <span>
                                        {uploading === task.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Upload className="h-4 w-4 mr-1" />
                                        )}
                                        {task.has_document ? "Replace" : "Upload"}
                                      </span>
                                    </Button>
                                  </label>
                                  {task.has_document && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => task.document_url && window.open(task.document_url, "_blank")}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      View
                                    </Button>
                                  )}
                                  {task.has_document && !task.is_validated && (
                                    <Button variant="ghost" size="sm" onClick={() => handleValidate(task.id)}>
                                      <ShieldCheck className="h-4 w-4 mr-1" />
                                      Validate
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  };

  // OneDrive View
  const renderOneDriveView = () => {
    if (orgStatus.loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!orgStatus.connected) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Cloud className="h-16 w-16 text-muted-foreground mx-auto" />
            <h3 className="mt-4 text-lg font-semibold">SharePoint Not Connected</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Your organization hasn't connected SharePoint yet. An admin needs to connect Microsoft 365 in Settings first.
            </p>
            <Button asChild className="mt-6">
              <Link href="/settings/integrations/microsoft">
                <Settings className="h-4 w-4 mr-2" />
                Go to Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!jobFolderStatus.exists) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Folder className="h-16 w-16 text-yellow-500 mx-auto" />
            <h3 className="mt-4 text-lg font-semibold">Create Folder Structure</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Create the folder structure in SharePoint for {jobTitle || "this job"}.
            </p>
            <Button className="mt-6" onClick={handleCreateFolders} disabled={creatingFolders}>
              {creatingFolders ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Folders...
                </>
              ) : (
                <>
                  <Folder className="h-4 w-4 mr-2" />
                  Create Folder Structure
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Success header */}
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold">SharePoint Connected</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Job folder found for {jobTitle || "this job"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={checkJobFolderStatus}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
                {jobFolderStatus.webUrl && (
                  <Button variant="outline" size="sm" onClick={() => window.open(jobFolderStatus.webUrl!, "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open in SharePoint
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Folders list or folder contents */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              {currentFolderId ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={navigateBack}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    {folderPath.map((p, i) => (
                      <span key={p.id} className="flex items-center">
                        {i > 0 && <ChevronRight className="h-3 w-3 mx-1" />}
                        <span className={i === folderPath.length - 1 ? "font-medium text-foreground" : ""}>
                          {p.name}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <CardTitle className="text-base">Folder Structure</CardTitle>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingContents ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : currentFolderId ? (
              // Show folder contents
              folderContents.length > 0 ? (
                <div className="divide-y">
                  {folderContents.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors group ${item.folder ? "cursor-pointer" : ""}`}
                      onClick={() => item.folder && loadFolderContents(item.id, item.name)}
                    >
                      <div className="flex items-center gap-3">
                        {item.folder ? (
                          <>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            <Folder className="h-5 w-5 text-yellow-500" />
                          </>
                        ) : (
                          <>
                            <div className="w-4" />
                            <File className="h-5 w-5 text-blue-500" />
                          </>
                        )}
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.lastModifiedDateTime && `Modified ${new Date(item.lastModifiedDateTime).toLocaleDateString()}`}
                            {item.size && ` • ${formatFileSize(item.size)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.folder && (
                          <span className="text-xs text-muted-foreground">
                            {item.folder.childCount || 0} items
                          </span>
                        )}
                        {!item.folder && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(item.webUrl, "_blank"); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(item.webUrl, "_blank"); }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">This folder is empty.</p>
                </div>
              )
            ) : (
              // Show top-level folders
              folders.length > 0 ? (
                <div className="divide-y">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors group cursor-pointer"
                      onClick={() => loadFolderContents(folder.id, folder.name)}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <Folder className="h-5 w-5 text-yellow-500" />
                        <div>
                          <p className="text-sm font-medium">{folder.name}</p>
                          {folder.lastModifiedDateTime && (
                            <p className="text-xs text-muted-foreground">
                              Modified {new Date(folder.lastModifiedDateTime).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-muted-foreground">
                          {folder.folder?.childCount || 0} items
                        </span>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleUpload(folder.id); }}>
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(folder.webUrl, "_blank"); }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">No folders found. Try refreshing.</p>
                </div>
              )
            )}
          </CardContent>
        </Card>

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}
      {message && (
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-700 dark:text-green-300">{message.text}</p>
          </CardContent>
        </Card>
      )}

      {/* View Mode Toggle */}
      <div className="flex items-center gap-2 bg-muted rounded-lg p-1 w-fit">
        <Button
          variant={viewMode === "tasks" ? "default" : "ghost"}
          size="sm"
          onClick={() => setViewMode("tasks")}
        >
          <FileText className="h-4 w-4 mr-2" />
          Document Tasks
        </Button>
        <Button
          variant={viewMode === "onedrive" ? "default" : "ghost"}
          size="sm"
          onClick={() => setViewMode("onedrive")}
        >
          <Cloud className="h-4 w-4 mr-2" />
          SharePoint Folders
        </Button>
      </div>

      {viewMode === "tasks" ? renderTasksView() : renderOneDriveView()}
    </div>
  );
}

export default JobDocumentsTab;
