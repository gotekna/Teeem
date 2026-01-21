"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Folder,
  FolderOpen,
  Download,
  Eye,
  ChevronRight,
  ChevronDown,
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
// Shows ContactDocument records stored in the database.
// Includes Xero invoice/bill PDFs migrated from CorporateCompanyDocument.
// Visibility: Always visible
// =============================================================================

interface ContactDocument {
  id: number;
  name: string;
  displayName: string;
  folder: string | null;
  fileSize: number | null;
  contentType: string | null;
  source: string;
  externalId: string | null;
  storagePath: string | null;
  storageProvider: string | null;
  documentType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface DocumentsResponse {
  success: boolean;
  exists: boolean;
  total: number;
  folders: string[];
  documents: ContactDocument[];
}

interface ContactDocumentsTabProps {
  contact: Contact;
}

export function ContactDocumentsTab({ contact }: ContactDocumentsTabProps) {
  const [documents, setDocuments] = useState<ContactDocument[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [contact.id]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<DocumentsResponse>(
        `/api/v1/contacts/${contact.id}/documents`
      );

      if (response?.success) {
        setDocuments(response.documents || []);
        setFolders(response.folders || []);
        // Auto-expand first folder if there's only one
        if (response.folders?.length === 1) {
          setExpandedFolders(new Set([response.folders[0]]));
        }
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError("Failed to load documents");
      setDocuments([]);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  const getFileIcon = (contentType?: string | null) => {
    if (!contentType) return <FileText className="h-4 w-4" />;
    if (contentType.includes("pdf"))
      return <FileText className="h-4 w-4 text-red-500 dark:text-red-400" />;
    if (contentType.includes("image"))
      return <FileText className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
    if (contentType.includes("word") || contentType.includes("document"))
      return <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    if (contentType.includes("sheet") || contentType.includes("excel"))
      return <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />;
    return <FileText className="h-4 w-4" />;
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "xero":
        return (
          <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
            Xero
          </Badge>
        );
      case "sharepoint":
        return (
          <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
            SharePoint
          </Badge>
        );
      case "manual":
        return (
          <Badge variant="outline" className="text-xs">
            Manual
          </Badge>
        );
      default:
        return null;
    }
  };

  // Group documents by folder
  const documentsByFolder = documents.reduce((acc, doc) => {
    const folder = doc.folder || "Uncategorized";
    if (!acc[folder]) {
      acc[folder] = [];
    }
    acc[folder].push(doc);
    return acc;
  }, {} as Record<string, ContactDocument[]>);

  // Sort folders with Bills/Invoices first
  const sortedFolders = Object.keys(documentsByFolder).sort((a, b) => {
    const priority = ["Bills", "Invoices", "Credit Notes", "Quotes"];
    const aIndex = priority.indexOf(a);
    const bIndex = priority.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Documents
              {documents.length > 0 && (
                <Badge variant="secondary">{documents.length}</Badge>
              )}
            </span>
            <Button variant="outline" size="sm" onClick={loadDocuments}>
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <div className="space-y-2">
              {sortedFolders.map((folder) => {
                const folderDocs = documentsByFolder[folder];
                const isExpanded = expandedFolders.has(folder);

                return (
                  <div key={folder} className="border rounded-lg">
                    <button
                      onClick={() => toggleFolder(folder)}
                      className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {isExpanded ? (
                        <FolderOpen className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Folder className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="font-medium">{folder}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {folderDocs.length}
                      </Badge>
                    </button>

                    {isExpanded && (
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead className="w-[80px]">Source</TableHead>
                              <TableHead className="w-[80px]">Size</TableHead>
                              <TableHead className="w-[100px]">Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {folderDocs.map((doc) => (
                              <TableRow key={doc.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getFileIcon(doc.contentType)}
                                    <span
                                      className="truncate max-w-[300px]"
                                      title={doc.displayName || doc.name}
                                    >
                                      {doc.displayName || doc.name}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>{getSourceBadge(doc.source)}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {formatFileSize(doc.fileSize)}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {formatDate(doc.createdAt)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <Folder className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No documents found for this contact.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ContactDocumentsTab;
