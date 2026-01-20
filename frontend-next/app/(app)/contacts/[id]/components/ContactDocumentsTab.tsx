"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Folder,
  Upload,
  ExternalLink,
  Cloud,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate, formatFileSize } from "@/utils/formatters";
import type { Contact } from "../types";

// =============================================================================
// SSoT: Documents Tab (ROOT level)
// =============================================================================
// Shows documents stored in SharePoint for this contact.
// Uses StorageConfiguration for path resolution.
// Visibility: Always visible
// =============================================================================

interface Document {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime?: string;
  size?: number;
  file?: {
    mimeType: string;
  };
}

interface FolderStatus {
  loading: boolean;
  exists: boolean;
  webUrl: string | null;
  folderId?: string;
}

interface ContactDocumentsTabProps {
  contact: Contact;
}

export function ContactDocumentsTab({ contact }: ContactDocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderStatus, setFolderStatus] = useState<FolderStatus>({
    loading: true,
    exists: false,
    webUrl: null,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [contact.id]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      // Check folder status and load documents
      const response = await api.get<{
        exists: boolean;
        webUrl: string | null;
        folderId?: string;
        documents?: Document[];
      }>(`/api/v1/contacts/${contact.id}/documents`);

      setFolderStatus({
        loading: false,
        exists: response?.exists || false,
        webUrl: response?.webUrl || null,
        folderId: response?.folderId,
      });

      if (response?.documents) {
        setDocuments(response.documents);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
      setFolderStatus({ loading: false, exists: false, webUrl: null });
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <FileText className="h-4 w-4" />;
    if (mimeType.includes("pdf")) return <FileText className="h-4 w-4 text-red-500 dark:text-red-400" />;
    if (mimeType.includes("image")) return <FileText className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
    if (mimeType.includes("word") || mimeType.includes("document"))
      return <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    if (mimeType.includes("sheet") || mimeType.includes("excel"))
      return <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />;
    return <FileText className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Folder Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Documents
              {documents.length > 0 && (
                <Badge variant="secondary">{documents.length}</Badge>
              )}
            </span>
            <div className="flex items-center gap-2">
              {folderStatus.exists ? (
                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/30 dark:text-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  SharePoint Connected
                </Badge>
              ) : (
                <Badge variant="outline">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No Folder
                </Badge>
              )}
              {folderStatus.webUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={folderStatus.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open in SharePoint
                  </a>
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[100px]">Size</TableHead>
                  <TableHead className="w-[120px]">Modified</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getFileIcon(doc.file?.mimeType)}
                        <span className="truncate max-w-[300px]">{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(doc.size)}</TableCell>
                    <TableCell>{formatDate(doc.lastModifiedDateTime)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={doc.webUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : folderStatus.exists ? (
            <div className="text-center py-8 space-y-2">
              <Folder className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No documents in this folder yet.
              </p>
              {folderStatus.webUrl && (
                <Button variant="outline" asChild>
                  <a
                    href={folderStatus.webUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload in SharePoint
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <Cloud className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">
                Document folder not set up for this contact.
              </p>
              <p className="text-sm text-muted-foreground">
                Documents will appear here once a folder is created.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ContactDocumentsTab;
