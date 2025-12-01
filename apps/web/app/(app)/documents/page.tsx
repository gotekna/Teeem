"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  ChevronRight,
  Sparkles,
  Eye,
  CheckCircle,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { AIVerificationModal } from "@/components/documents/ai-verification-modal";
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal";

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
  folder_path?: string;
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

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [oneDriveConnected, setOneDriveConnected] = React.useState(false);

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
      setFolders(docsData.folders || []);
      setOneDriveConnected(statusData.connected);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
      // Mock data for demo
      setDocuments(getMockDocuments());
      setFolders([
        { id: "1", name: "Contracts", path: "/contracts", documents_count: 12 },
        { id: "2", name: "Financial", path: "/financial", documents_count: 8 },
        { id: "3", name: "Compliance", path: "/compliance", documents_count: 5 },
      ]);
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

  const filteredDocuments = React.useMemo(() => {
    if (!searchQuery) return documents;
    return documents.filter(
      (doc) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.job_title?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage project documents and files
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!oneDriveConnected && (
            <Button
              variant="outline"
              onClick={() => router.push("/settings/integrations/microsoft")}
            >
              <Cloud className="h-4 w-4 mr-2" />
              Connect OneDrive
            </Button>
          )}
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* OneDrive Status */}
      {oneDriveConnected && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <p className="font-medium text-blue-900">OneDrive Connected</p>
                <p className="text-sm text-blue-700">
                  Documents are synced with your Microsoft OneDrive
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/settings/integrations/microsoft")}
              >
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folders Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Folders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {folders.length > 0 ? (
              folders.map((folder) => (
                <Button
                  key={folder.id}
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <FolderOpen className="h-4 w-4 mr-2 text-blue-500" />
                  <span className="flex-1 text-left truncate">{folder.name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {folder.documents_count}
                  </Badge>
                </Button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No folders yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Documents List */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="pt-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          {/* Documents Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.length > 0 ? (
                  filteredDocuments.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer hover:bg-secondary/50"
                      onClick={() => handlePreview(doc)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFileIcon(doc.type)}
                          <div>
                            <span className="font-medium">
                              {doc.display_title || doc.name}
                            </span>
                            {doc.display_title && doc.display_title !== doc.name && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {doc.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.document_type ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="font-mono text-xs">
                              {doc.document_type.abbreviation}
                            </Badge>
                            {doc.fiscal_year && (
                              <span className="text-xs text-muted-foreground">
                                FY{doc.fiscal_year}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {doc.job_title ? (
                          <Button
                            variant="link"
                            className="p-0 h-auto text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/jobs/${doc.job_id}`);
                            }}
                          >
                            {doc.job_title}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {doc.verified ? (
                          <Badge className="bg-green-100 text-green-700">
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
                      <TableCell className="text-muted-foreground">
                        <div>
                          {new Date(doc.uploaded_at).toLocaleDateString("en-AU")}
                        </div>
                        <div className="text-xs">{doc.uploaded_by}</div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No documents found</p>
                      <Button className="mt-4">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload First Document
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
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

// Mock data for demo
function getMockDocuments(): Document[] {
  return [
    {
      id: 1,
      name: "Acme Corp - CTR - FY2024.pdf",
      display_title: "Company Tax Return FY2024",
      type: "application/pdf",
      size: 2456000,
      uploaded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Sarah Wilson",
      document_type: { id: 1, name: "Company Tax Return", abbreviation: "CTR" },
      fiscal_year: "2024",
      company_name: "Acme Corporation",
      verified: true,
      verified_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "John Smith",
    },
    {
      id: 2,
      name: "BAS_Q3_2024.pdf",
      type: "application/pdf",
      size: 845000,
      job_title: "Smith Residence",
      job_id: 42,
      uploaded_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Mike Johnson",
      verified: false,
    },
    {
      id: 3,
      name: "Site_Photo_001.jpg",
      type: "image/jpeg",
      size: 3200000,
      job_title: "Commercial Fitout",
      job_id: 67,
      uploaded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Emma Davis",
      verified: true,
      verified_at: new Date().toISOString(),
      verified_by: "Emma Davis",
    },
    {
      id: 4,
      name: "Contract_BuildRight_2024.pdf",
      display_title: "BuildRight Subcontract Agreement",
      type: "application/pdf",
      size: 1250000,
      job_title: "Office Renovation",
      job_id: 89,
      uploaded_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "David Brown",
      document_type: { id: 6, name: "Contract", abbreviation: "CON" },
      verified: true,
      verified_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      verified_by: "Sarah Wilson",
    },
    {
      id: 5,
      name: "Invoice_Supplier_Oct.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 56000,
      uploaded_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "John Smith",
      verified: false,
    },
  ];
}
