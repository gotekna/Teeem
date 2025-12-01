"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Upload,
  FolderOpen,
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  MoreHorizontal,
  Download,
  ExternalLink,
  Trash2,
  Loader2,
  Cloud,
  ChevronDown,
  Sparkles,
  Eye,
  CheckCircle,
  Clock,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { AIVerificationModal } from "@/components/documents/ai-verification-modal";
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal";
import { FolderTree, FolderTreeItem } from "@/components/documents/folder-tree";
import { FolderCard } from "@/components/documents/folder-card";

interface Document {
  id: number;
  name: string;
  display_title?: string;
  type: string;
  size: number;
  url?: string;
  job_title?: string;
  job_id?: number;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_email?: string;
  folder_path?: string;
  folder_id?: string;
  document_type?: {
    id: number;
    name: string;
    abbreviation: string;
  };
  fiscal_year?: string;
  company_name?: string;
  verified: boolean;
  verified_at?: string;
  verified_by?: string;
}

interface Folder {
  id: string;
  name: string;
  path: string;
  documents_count: number;
  children?: Folder[];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(type: string) {
  if (type.includes("image")) return <FileImage className="h-4 w-4 text-purple-500" />;
  if (type.includes("spreadsheet") || type.includes("excel"))
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  if (type.includes("pdf") || type.includes("document"))
    return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-blue-500" />;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [folders, setFolders] = React.useState<FolderTreeItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [oneDriveConnected, setOneDriveConnected] = React.useState(false);

  // Folder navigation state
  const [selectedFolder, setSelectedFolder] = React.useState<FolderTreeItem | null>(null);
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());

  // Modal states
  const [selectedDocument, setSelectedDocument] = React.useState<Document | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = React.useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = React.useState(false);

  const fetchDocuments = React.useCallback(async () => {
    try {
      const [docsData, statusData] = await Promise.all([
        api.get<{ documents: Document[]; folders: Folder[] }>("/api/v1/documents"),
        api.get<{ connected: boolean }>("/api/v1/organization_onedrive/status"),
      ]);
      setDocuments(docsData.documents || []);
      setFolders(docsData.folders as FolderTreeItem[] || []);
      setOneDriveConnected(statusData.connected);
    } catch {
      // Mock data for demo when API is unavailable
      setDocuments(getMockDocuments());
      setFolders(getMockFolders());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleVerificationComplete = async (data: {
    display_title: string;
    document_type_id: number;
    fiscal_year?: string;
    verified: boolean;
  }) => {
    if (!selectedDocument) return;

    try {
      await api.patch(`/api/v1/documents/${selectedDocument.id}`, {
        display_title: data.display_title,
        document_type_id: data.document_type_id,
        fiscal_year: data.fiscal_year,
        verified: data.verified,
      });
      fetchDocuments();
    } catch (error) {
      console.error("Failed to update document:", error);
    }
  };

  const handlePreview = (doc: Document) => {
    setSelectedDocument(doc);
    setPreviewModalOpen(true);
  };

  const handleVerify = (doc: Document) => {
    setSelectedDocument(doc);
    setVerificationModalOpen(true);
  };

  const handleFolderSelect = (folder: FolderTreeItem) => {
    setSelectedFolder(folder);
  };

  const handleToggleExpand = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Get subfolders of current selected folder
  const currentSubfolders = React.useMemo(() => {
    if (!selectedFolder) {
      // Show top-level folders
      return folders;
    }
    return selectedFolder.children || [];
  }, [selectedFolder, folders]);

  // Filter documents by selected folder and search
  const filteredDocuments = React.useMemo(() => {
    let filtered = documents;

    // Filter by folder
    if (selectedFolder) {
      filtered = filtered.filter((doc) => doc.folder_id === selectedFolder.id);
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(
        (doc) =>
          doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.display_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.uploaded_by?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [documents, selectedFolder, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* OneDrive Status Banner */}
      {oneDriveConnected && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 px-4 py-3 flex items-center gap-3">
          <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div className="flex-1">
            <p className="font-medium text-blue-900 dark:text-blue-100 text-sm">OneDrive Connected</p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Documents are synced with your Microsoft OneDrive
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/settings/integrations/microsoft")}
            className="text-xs"
          >
            Manage
          </Button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Folder Tree */}
        <div className="w-64 border-r border-border flex flex-col bg-card">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Document Library</h2>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Folder Tree */}
          <div className="flex-1 overflow-y-auto p-2">
            <FolderTree
              folders={folders}
              selectedFolderId={selectedFolder?.id ?? null}
              onFolderSelect={handleFolderSelect}
              expandedFolders={expandedFolders}
              onToggleExpand={handleToggleExpand}
            />
          </div>

          {/* Connect OneDrive CTA */}
          {!oneDriveConnected && (
            <div className="p-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => router.push("/settings/integrations/microsoft")}
              >
                <Cloud className="h-3.5 w-3.5 mr-2" />
                Connect OneDrive
              </Button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-background">
            <div className="flex items-center gap-2">
              {/* Breadcrumb / Current Folder */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 gap-1 text-base font-semibold font-serif">
                    {selectedFolder?.name || "All Documents"}
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setSelectedFolder(null)}>
                    All Documents
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {folders.map((folder) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={() => setSelectedFolder(folder)}
                    >
                      {folder.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Subfolders Section */}
            {currentSubfolders.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Folders</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {currentSubfolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      id={folder.id}
                      name={folder.name}
                      fileCount={folder.documents_count}
                      onClick={() => {
                        setSelectedFolder(folder);
                        setExpandedFolders((prev) => new Set([...prev, folder.id]));
                      }}
                      isOneDriveConnected={oneDriveConnected}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Files Section */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Files</h3>
              {filteredDocuments.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="table-header">Name</TableHead>
                        <TableHead className="table-header">Added By</TableHead>
                        <TableHead className="table-header w-[100px]">Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map((doc) => (
                        <TableRow
                          key={doc.id}
                          className="cursor-pointer"
                          onClick={() => handlePreview(doc)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {getFileIcon(doc.type)}
                              <div>
                                <span className="font-medium text-sm">
                                  {doc.display_title || doc.name}
                                </span>
                                {doc.display_title && doc.display_title !== doc.name && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                                    {doc.name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${getAvatarColor(doc.uploaded_by)}`}
                              >
                                {getInitials(doc.uploaded_by)}
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {doc.uploaded_by_email || doc.uploaded_by}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {doc.verified ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handlePreview(doc)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Preview
                                </DropdownMenuItem>
                                {!doc.verified && (
                                  <DropdownMenuItem onClick={() => handleVerify(doc)}>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    AI Verify
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Open in OneDrive
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-lg p-12 text-center">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    {searchQuery
                      ? "No documents match your search"
                      : selectedFolder
                      ? "No documents in this folder"
                      : "No documents yet"}
                  </p>
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload First Document
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AIVerificationModal
        open={verificationModalOpen}
        onOpenChange={setVerificationModalOpen}
        document={selectedDocument}
        onVerificationComplete={handleVerificationComplete}
      />

      <DocumentPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        document={selectedDocument}
        onVerify={() => {
          setPreviewModalOpen(false);
          setVerificationModalOpen(true);
        }}
        onDownload={() => {
          // TODO: Implement download
        }}
        onOpenExternal={() => {
          // TODO: Open in OneDrive
        }}
      />
    </div>
  );
}

// Mock data for demo - linked to active jobs
function getMockDocuments(): Document[] {
  return [
    // Harrison Residence - Custom Home (Job 1)
    {
      id: 1,
      name: "Harrison_Residence_QBCC_Contract.pdf",
      display_title: "QBCC Domestic Building Contract",
      type: "application/pdf",
      size: 2456000,
      job_title: "Harrison Residence - Custom Home",
      job_id: 1,
      uploaded_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "James Wilson",
      uploaded_by_email: "james.wilson@teeem.com.au",
      folder_id: "1-1",
      document_type: { id: 1, name: "Contract", abbreviation: "CON" },
      verified: true,
      verified_at: new Date(Date.now() - 74 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Sarah Wilson",
    },
    {
      id: 2,
      name: "Harrison_Engineering_Plans_Rev3.pdf",
      display_title: "Structural Engineering Plans Rev 3",
      type: "application/pdf",
      size: 8450000,
      job_title: "Harrison Residence - Custom Home",
      job_id: 1,
      uploaded_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Mark Thompson",
      uploaded_by_email: "mark.thompson@teeem.com.au",
      folder_id: "3",
      document_type: { id: 2, name: "Engineering Plans", abbreviation: "ENG" },
      verified: true,
      verified_at: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "James Wilson",
    },
    {
      id: 3,
      name: "Harrison_Site_Photo_Framing_001.jpg",
      type: "image/jpeg",
      size: 4200000,
      job_title: "Harrison Residence - Custom Home",
      job_id: 1,
      uploaded_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "James Wilson",
      uploaded_by_email: "james.wilson@teeem.com.au",
      folder_id: "4",
      verified: true,
      verified_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "James Wilson",
    },
    {
      id: 4,
      name: "Harrison_Site_Photo_Framing_002.jpg",
      type: "image/jpeg",
      size: 3800000,
      job_title: "Harrison Residence - Custom Home",
      job_id: 1,
      uploaded_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "James Wilson",
      uploaded_by_email: "james.wilson@teeem.com.au",
      folder_id: "4",
      verified: true,
      verified_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "James Wilson",
    },
    {
      id: 5,
      name: "Harrison_BA_Approval.pdf",
      display_title: "Building Approval Certificate",
      type: "application/pdf",
      size: 1250000,
      job_title: "Harrison Residence - Custom Home",
      job_id: 1,
      uploaded_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Lisa Chen",
      uploaded_by_email: "lisa.chen@teeem.com.au",
      folder_id: "3",
      document_type: { id: 3, name: "Building Approval", abbreviation: "BA" },
      verified: true,
      verified_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Lisa Chen",
    },

    // Coastal Views Duplex (Job 2)
    {
      id: 6,
      name: "Coastal_Views_QBCC_Contract.pdf",
      display_title: "QBCC Domestic Building Contract",
      type: "application/pdf",
      size: 2890000,
      job_title: "Coastal Views Duplex",
      job_id: 2,
      uploaded_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Mark Thompson",
      uploaded_by_email: "mark.thompson@teeem.com.au",
      folder_id: "1-1",
      document_type: { id: 1, name: "Contract", abbreviation: "CON" },
      verified: true,
      verified_at: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Sarah Wilson",
    },
    {
      id: 7,
      name: "Coastal_Views_Geotech_Report.pdf",
      display_title: "Geotechnical Investigation Report",
      type: "application/pdf",
      size: 5670000,
      job_title: "Coastal Views Duplex",
      job_id: 2,
      uploaded_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Mark Thompson",
      uploaded_by_email: "mark.thompson@teeem.com.au",
      folder_id: "3",
      document_type: { id: 4, name: "Geotechnical Report", abbreviation: "GEO" },
      verified: true,
      verified_at: new Date(Date.now() - 54 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Mark Thompson",
    },
    {
      id: 8,
      name: "Coastal_Views_Slab_Inspection.pdf",
      display_title: "Slab Pre-Pour Inspection Report",
      type: "application/pdf",
      size: 890000,
      job_title: "Coastal Views Duplex",
      job_id: 2,
      uploaded_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Mark Thompson",
      uploaded_by_email: "mark.thompson@teeem.com.au",
      folder_id: "3",
      document_type: { id: 5, name: "Inspection Report", abbreviation: "INS" },
      verified: true,
      verified_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Mark Thompson",
    },

    // Thompson Family Home - Renovation (Job 3)
    {
      id: 9,
      name: "Thompson_Renovation_Contract.pdf",
      display_title: "QBCC Domestic Building Contract",
      type: "application/pdf",
      size: 2100000,
      job_title: "Thompson Family Home - Renovation",
      job_id: 3,
      uploaded_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Lisa Chen",
      uploaded_by_email: "lisa.chen@teeem.com.au",
      folder_id: "1-1",
      document_type: { id: 1, name: "Contract", abbreviation: "CON" },
      verified: true,
      verified_at: new Date(Date.now() - 99 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Sarah Wilson",
    },
    {
      id: 10,
      name: "Thompson_Variation_001.pdf",
      display_title: "Variation Order - Kitchen Upgrade",
      type: "application/pdf",
      size: 456000,
      job_title: "Thompson Family Home - Renovation",
      job_id: 3,
      uploaded_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Lisa Chen",
      uploaded_by_email: "lisa.chen@teeem.com.au",
      folder_id: "1-2",
      document_type: { id: 6, name: "Variation", abbreviation: "VAR" },
      verified: true,
      verified_at: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "David Thompson",
    },
    {
      id: 11,
      name: "Thompson_Electrical_Plan.pdf",
      display_title: "Electrical Layout Plan",
      type: "application/pdf",
      size: 1890000,
      job_title: "Thompson Family Home - Renovation",
      job_id: 3,
      uploaded_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Lisa Chen",
      uploaded_by_email: "lisa.chen@teeem.com.au",
      folder_id: "3",
      document_type: { id: 7, name: "Electrical Plans", abbreviation: "ELEC" },
      verified: true,
      verified_at: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Lisa Chen",
    },

    // Greenfield Estate - Lot 45 (Job 4)
    {
      id: 12,
      name: "Greenfield_Lot45_Contract.pdf",
      display_title: "QBCC Domestic Building Contract",
      type: "application/pdf",
      size: 2340000,
      job_title: "Greenfield Estate - Lot 45",
      job_id: 4,
      uploaded_at: new Date(Date.now() - 140 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "James Wilson",
      uploaded_by_email: "james.wilson@teeem.com.au",
      folder_id: "1-1",
      document_type: { id: 1, name: "Contract", abbreviation: "CON" },
      verified: true,
      verified_at: new Date(Date.now() - 139 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Sarah Wilson",
    },
    {
      id: 13,
      name: "Greenfield_Lockup_Inspection.pdf",
      display_title: "Lock-up Stage Inspection",
      type: "application/pdf",
      size: 1120000,
      job_title: "Greenfield Estate - Lot 45",
      job_id: 4,
      uploaded_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "James Wilson",
      uploaded_by_email: "james.wilson@teeem.com.au",
      folder_id: "3",
      document_type: { id: 5, name: "Inspection Report", abbreviation: "INS" },
      verified: true,
      verified_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "James Wilson",
    },
    {
      id: 14,
      name: "Greenfield_Site_Progress_Nov.jpg",
      type: "image/jpeg",
      size: 5100000,
      job_title: "Greenfield Estate - Lot 45",
      job_id: 4,
      uploaded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "James Wilson",
      uploaded_by_email: "james.wilson@teeem.com.au",
      folder_id: "4",
      verified: false,
    },

    // Industrial Shed - BrisWest (Job 6)
    {
      id: 15,
      name: "BrisWest_Commercial_Contract.pdf",
      display_title: "Commercial Building Contract",
      type: "application/pdf",
      size: 3200000,
      job_title: "Industrial Shed - BrisWest",
      job_id: 6,
      uploaded_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Mark Thompson",
      uploaded_by_email: "mark.thompson@teeem.com.au",
      folder_id: "1-1",
      document_type: { id: 1, name: "Contract", abbreviation: "CON" },
      verified: true,
      verified_at: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Sarah Wilson",
    },
    {
      id: 16,
      name: "BrisWest_Steel_Shop_Drawings.pdf",
      display_title: "Structural Steel Shop Drawings",
      type: "application/pdf",
      size: 12500000,
      job_title: "Industrial Shed - BrisWest",
      job_id: 6,
      uploaded_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Mark Thompson",
      uploaded_by_email: "mark.thompson@teeem.com.au",
      folder_id: "3",
      document_type: { id: 2, name: "Engineering Plans", abbreviation: "ENG" },
      verified: true,
      verified_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Mark Thompson",
    },
    {
      id: 17,
      name: "BrisWest_Steel_Delivery_Receipt.pdf",
      type: "application/pdf",
      size: 234000,
      job_title: "Industrial Shed - BrisWest",
      job_id: 6,
      uploaded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Mark Thompson",
      uploaded_by_email: "mark.thompson@teeem.com.au",
      folder_id: "2",
      verified: false,
    },

    // Waverly Heights - New Build (Job 8)
    {
      id: 18,
      name: "Waverly_QBCC_Contract.pdf",
      display_title: "QBCC Domestic Building Contract",
      type: "application/pdf",
      size: 2670000,
      job_title: "Waverly Heights - New Build",
      job_id: 8,
      uploaded_at: new Date(Date.now() - 115 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "James Wilson",
      uploaded_by_email: "james.wilson@teeem.com.au",
      folder_id: "1-1",
      document_type: { id: 1, name: "Contract", abbreviation: "CON" },
      verified: true,
      verified_at: new Date(Date.now() - 114 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Sarah Wilson",
    },
    {
      id: 19,
      name: "Waverly_Roof_Truss_Layout.pdf",
      display_title: "Roof Truss Layout Plan",
      type: "application/pdf",
      size: 4500000,
      job_title: "Waverly Heights - New Build",
      job_id: 8,
      uploaded_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "James Wilson",
      uploaded_by_email: "james.wilson@teeem.com.au",
      folder_id: "3",
      document_type: { id: 2, name: "Engineering Plans", abbreviation: "ENG" },
      verified: true,
      verified_at: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "James Wilson",
    },
    {
      id: 20,
      name: "Waverly_Frame_Inspection.pdf",
      display_title: "Frame Stage Inspection Report",
      type: "application/pdf",
      size: 980000,
      job_title: "Waverly Heights - New Build",
      job_id: 8,
      uploaded_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "James Wilson",
      uploaded_by_email: "james.wilson@teeem.com.au",
      folder_id: "3",
      document_type: { id: 5, name: "Inspection Report", abbreviation: "INS" },
      verified: true,
      verified_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "James Wilson",
    },
    {
      id: 21,
      name: "Waverly_Roof_Progress.jpg",
      type: "image/jpeg",
      size: 4800000,
      job_title: "Waverly Heights - New Build",
      job_id: 8,
      uploaded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "James Wilson",
      uploaded_by_email: "james.wilson@teeem.com.au",
      folder_id: "4",
      verified: false,
    },

    // Commercial Fit-out - Queen St (Job 9)
    {
      id: 22,
      name: "CBD_Medical_Fitout_Contract.pdf",
      display_title: "Commercial Fit-out Contract",
      type: "application/pdf",
      size: 2890000,
      job_title: "Commercial Fit-out - Queen St",
      job_id: 9,
      uploaded_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Mark Thompson",
      uploaded_by_email: "mark.thompson@teeem.com.au",
      folder_id: "1-1",
      document_type: { id: 1, name: "Contract", abbreviation: "CON" },
      verified: true,
      verified_at: new Date(Date.now() - 69 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Sarah Wilson",
    },
    {
      id: 23,
      name: "CBD_Medical_Mechanical_Plans.pdf",
      display_title: "Mechanical Services Layout",
      type: "application/pdf",
      size: 6700000,
      job_title: "Commercial Fit-out - Queen St",
      job_id: 9,
      uploaded_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Mark Thompson",
      uploaded_by_email: "mark.thompson@teeem.com.au",
      folder_id: "3",
      document_type: { id: 8, name: "Mechanical Plans", abbreviation: "MECH" },
      verified: true,
      verified_at: new Date(Date.now() - 39 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Mark Thompson",
    },
    {
      id: 24,
      name: "CBD_Medical_Fire_Cert.pdf",
      display_title: "Fire Safety Certificate",
      type: "application/pdf",
      size: 1200000,
      job_title: "Commercial Fit-out - Queen St",
      job_id: 9,
      uploaded_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Mark Thompson",
      uploaded_by_email: "mark.thompson@teeem.com.au",
      folder_id: "3",
      document_type: { id: 9, name: "Fire Certificate", abbreviation: "FIRE" },
      verified: true,
      verified_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Mark Thompson",
    },

    // Financial documents
    {
      id: 25,
      name: "Teeem_BAS_Q3_2024.pdf",
      display_title: "BAS Statement Q3 2024",
      type: "application/pdf",
      size: 456000,
      uploaded_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Sarah Wilson",
      uploaded_by_email: "sarah.wilson@teeem.com.au",
      folder_id: "2-2",
      document_type: { id: 10, name: "BAS Statement", abbreviation: "BAS" },
      verified: true,
      verified_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Sarah Wilson",
    },
    {
      id: 26,
      name: "Supplier_Invoice_Boral_Nov.pdf",
      type: "application/pdf",
      size: 178000,
      uploaded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Sarah Wilson",
      uploaded_by_email: "sarah.wilson@teeem.com.au",
      folder_id: "2",
      verified: false,
    },
    {
      id: 27,
      name: "Supplier_Invoice_Bunnings_Nov.pdf",
      type: "application/pdf",
      size: 234000,
      uploaded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Sarah Wilson",
      uploaded_by_email: "sarah.wilson@teeem.com.au",
      folder_id: "2",
      verified: false,
    },
  ];
}

function getMockFolders(): FolderTreeItem[] {
  return [
    {
      id: "1",
      name: "Contracts",
      path: "/contracts",
      documents_count: 12,
      children: [
        { id: "1-1", name: "Signed", path: "/contracts/signed", documents_count: 7 },
        { id: "1-2", name: "Drafts", path: "/contracts/drafts", documents_count: 5 },
      ],
    },
    {
      id: "2",
      name: "Financial",
      path: "/financial",
      documents_count: 8,
      children: [
        { id: "2-1", name: "Tax Returns", path: "/financial/tax-returns", documents_count: 3 },
        { id: "2-2", name: "BAS", path: "/financial/bas", documents_count: 5 },
      ],
    },
    { id: "3", name: "Compliance", path: "/compliance", documents_count: 5 },
    { id: "4", name: "Site Photos", path: "/site-photos", documents_count: 20 },
    { id: "5", name: "Signed Contracts", path: "/signed-contracts", documents_count: 7 },
  ];
}
