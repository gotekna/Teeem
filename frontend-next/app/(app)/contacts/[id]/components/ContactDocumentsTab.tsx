"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  Folder,
  FolderOpen,
  Calendar,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  X,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { formatDate, formatFileSize } from "@/utils/formatters";
import type { Contact } from "../types";

// =============================================================================
// SSoT: Documents Tab (ROOT level)
// =============================================================================
// Shows ContactDocument records stored in the database.
// Includes Xero invoice/bill PDFs migrated from CorporateCompanyDocument.
// Grouped by Year → Month → Folder type (latest first)
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
  downloadUrl: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  datePaid: string | null;
}

interface DocumentsResponse {
  success: boolean;
  exists: boolean;
  total: number;
  documents: ContactDocument[];
}

interface ContactDocumentsTabProps {
  contact: Contact;
}

// Group documents by Year → Month → Folder
interface YearGroup {
  year: number;
  months: MonthGroup[];
  totalCount: number;
}

interface MonthGroup {
  month: number;
  monthName: string;
  folders: FolderGroup[];
  totalCount: number;
}

interface FolderGroup {
  folder: string;
  documents: ContactDocument[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function ContactDocumentsTab({ contact }: ContactDocumentsTabProps) {
  const [documents, setDocuments] = useState<ContactDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<ContactDocument | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        const docs = response.documents || [];
        setDocuments(docs);

        // Auto-expand the most recent year and month if there are documents
        if (docs.length > 0) {
          const firstDoc = docs[0];
          if (firstDoc.createdAt) {
            const date = new Date(firstDoc.createdAt);
            const year = date.getFullYear();
            const month = date.getMonth();
            setExpandedYears(new Set([year]));
            setExpandedMonths(new Set([`${year}-${month}`]));
            // Expand all folders in the most recent month
            const folderKey = `${year}-${month}`;
            const foldersInMonth = docs
              .filter((d) => {
                if (!d.createdAt) return false;
                const dd = new Date(d.createdAt);
                return dd.getFullYear() === year && dd.getMonth() === month;
              })
              .map((d) => d.folder || "Uncategorized");
            const uniqueFolders = [...new Set(foldersInMonth)];
            setExpandedFolders(
              new Set(uniqueFolders.map((f) => `${year}-${month}-${f}`))
            );
          }
        }
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError("Failed to load documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // Group documents by Year → Month → Folder
  const groupedDocuments = (): YearGroup[] => {
    const yearMap = new Map<number, Map<number, Map<string, ContactDocument[]>>>();

    documents.forEach((doc) => {
      const date = doc.createdAt ? new Date(doc.createdAt) : new Date();
      const year = date.getFullYear();
      const month = date.getMonth();
      const folder = doc.folder || "Uncategorized";

      if (!yearMap.has(year)) {
        yearMap.set(year, new Map());
      }
      const monthMap = yearMap.get(year)!;

      if (!monthMap.has(month)) {
        monthMap.set(month, new Map());
      }
      const folderMap = monthMap.get(month)!;

      if (!folderMap.has(folder)) {
        folderMap.set(folder, []);
      }
      folderMap.get(folder)!.push(doc);
    });

    // Convert to sorted array structure (years descending, months descending)
    const years = Array.from(yearMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, monthMap]) => {
        const months = Array.from(monthMap.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([month, folderMap]) => {
            const folders = Array.from(folderMap.entries())
              .sort((a, b) => {
                // Sort folders: Bills, Invoices, Credit Notes, Quotes first
                const priority = ["Bills", "Invoices", "Credit Notes", "Quotes"];
                const aIdx = priority.indexOf(a[0]);
                const bIdx = priority.indexOf(b[0]);
                if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                if (aIdx !== -1) return -1;
                if (bIdx !== -1) return 1;
                return a[0].localeCompare(b[0]);
              })
              .map(([folder, docs]) => ({
                folder,
                documents: docs.sort((a, b) => {
                  // Sort by date descending within folder
                  const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return bDate - aDate;
                }),
              }));

            return {
              month,
              monthName: MONTH_NAMES[month],
              folders,
              totalCount: folders.reduce((sum, f) => sum + f.documents.length, 0),
            };
          });

        return {
          year,
          months,
          totalCount: months.reduce((sum, m) => sum + m.totalCount, 0),
        };
      });

    return years;
  };

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  const toggleMonth = (year: number, month: number) => {
    const key = `${year}-${month}`;
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleFolder = (year: number, month: number, folder: string) => {
    const key = `${year}-${month}-${folder}`;
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
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
          <Badge
            variant="outline"
            className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
          >
            Xero
          </Badge>
        );
      case "sharepoint":
        return (
          <Badge
            variant="outline"
            className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
          >
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

  // Single click: Open drawer to preview
  // Double click: Open in new tab
  const handleDocumentClick = useCallback((doc: ContactDocument) => {
    if (clickTimeoutRef.current) {
      // Double click detected - clear timeout and open in new tab
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      if (doc.downloadUrl) {
        window.open(doc.downloadUrl, "_blank");
      }
    } else {
      // Single click - wait to see if double click follows
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        // Single click confirmed - open drawer
        setSelectedDoc(doc);
        setDrawerOpen(true);
      }, 250); // 250ms delay to detect double click
    }
  }, []);

  const openDocumentInNewTab = useCallback((doc: ContactDocument) => {
    if (doc.downloadUrl) {
      window.open(doc.downloadUrl, "_blank");
    }
  }, []);

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

  const yearGroups = groupedDocuments();

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
          {yearGroups.length > 0 ? (
            <div className="space-y-2">
              {yearGroups.map((yearGroup) => {
                const isYearExpanded = expandedYears.has(yearGroup.year);

                return (
                  <div key={yearGroup.year} className="border rounded-lg">
                    {/* Year Header */}
                    <button
                      onClick={() => toggleYear(yearGroup.year)}
                      className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      {isYearExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <span className="font-semibold">{yearGroup.year}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {yearGroup.totalCount}
                      </Badge>
                    </button>

                    {isYearExpanded && (
                      <div className="border-t">
                        {yearGroup.months.map((monthGroup) => {
                          const monthKey = `${yearGroup.year}-${monthGroup.month}`;
                          const isMonthExpanded = expandedMonths.has(monthKey);

                          return (
                            <div key={monthKey} className="border-b last:border-b-0">
                              {/* Month Header */}
                              <button
                                onClick={() =>
                                  toggleMonth(yearGroup.year, monthGroup.month)
                                }
                                className="w-full flex items-center gap-2 p-3 pl-8 hover:bg-muted/50 transition-colors text-left"
                              >
                                {isMonthExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-medium">
                                  {monthGroup.monthName}
                                </span>
                                <Badge variant="secondary" className="ml-auto">
                                  {monthGroup.totalCount}
                                </Badge>
                              </button>

                              {isMonthExpanded && (
                                <div className="border-t bg-muted/20">
                                  {monthGroup.folders.map((folderGroup) => {
                                    const folderKey = `${yearGroup.year}-${monthGroup.month}-${folderGroup.folder}`;
                                    const isFolderExpanded =
                                      expandedFolders.has(folderKey);

                                    return (
                                      <div key={folderKey}>
                                        {/* Folder Header */}
                                        <button
                                          onClick={() =>
                                            toggleFolder(
                                              yearGroup.year,
                                              monthGroup.month,
                                              folderGroup.folder
                                            )
                                          }
                                          className="w-full flex items-center gap-2 p-2 pl-14 hover:bg-muted/50 transition-colors text-left"
                                        >
                                          {isFolderExpanded ? (
                                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                          ) : (
                                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                          )}
                                          {isFolderExpanded ? (
                                            <FolderOpen className="h-4 w-4 text-amber-500" />
                                          ) : (
                                            <Folder className="h-4 w-4 text-amber-500" />
                                          )}
                                          <span className="text-sm">
                                            {folderGroup.folder}
                                          </span>
                                          <Badge
                                            variant="outline"
                                            className="ml-auto text-xs"
                                          >
                                            {folderGroup.documents.length}
                                          </Badge>
                                        </button>

                                        {isFolderExpanded && (
                                          <div className="border-t bg-background">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="pl-20">
                                                    Name
                                                  </TableHead>
                                                  <TableHead className="w-[80px]">
                                                    Source
                                                  </TableHead>
                                                  <TableHead className="w-[90px]">
                                                    Invoice Date
                                                  </TableHead>
                                                  <TableHead className="w-[90px]">
                                                    Due Date
                                                  </TableHead>
                                                  <TableHead className="w-[90px]">
                                                    Date Paid
                                                  </TableHead>
                                                  <TableHead className="w-[70px]">
                                                    Size
                                                  </TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {folderGroup.documents.map(
                                                  (doc) => (
                                                    <TableRow
                                                      key={doc.id}
                                                      className={
                                                        doc.downloadUrl
                                                          ? "cursor-pointer hover:bg-muted/50"
                                                          : ""
                                                      }
                                                      onClick={() =>
                                                        handleDocumentClick(doc)
                                                      }
                                                    >
                                                      <TableCell className="pl-20">
                                                        <div className="flex items-center gap-2">
                                                          {getFileIcon(
                                                            doc.contentType
                                                          )}
                                                          <span
                                                            className="truncate max-w-[300px]"
                                                            title={
                                                              doc.displayName ||
                                                              doc.name
                                                            }
                                                          >
                                                            {doc.displayName ||
                                                              doc.name}
                                                          </span>
                                                        </div>
                                                      </TableCell>
                                                      <TableCell>
                                                        {getSourceBadge(
                                                          doc.source
                                                        )}
                                                      </TableCell>
                                                      <TableCell className="text-muted-foreground text-sm">
                                                        {formatDate(
                                                          doc.invoiceDate
                                                        )}
                                                      </TableCell>
                                                      <TableCell className="text-muted-foreground text-sm">
                                                        {formatDate(
                                                          doc.dueDate
                                                        )}
                                                      </TableCell>
                                                      <TableCell className="text-muted-foreground text-sm">
                                                        {doc.datePaid ? (
                                                          <span className="text-green-600 dark:text-green-400">
                                                            {formatDate(doc.datePaid)}
                                                          </span>
                                                        ) : (
                                                          <span className="text-amber-600 dark:text-amber-400">
                                                            Unpaid
                                                          </span>
                                                        )}
                                                      </TableCell>
                                                      <TableCell className="text-muted-foreground text-sm">
                                                        {formatFileSize(
                                                          doc.fileSize
                                                        )}
                                                      </TableCell>
                                                    </TableRow>
                                                  )
                                                )}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
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

      {/* Document Preview Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-[600px] sm:w-[800px] sm:max-w-[80vw] p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 truncate pr-4">
                {selectedDoc && getFileIcon(selectedDoc.contentType)}
                <span className="truncate">
                  {selectedDoc?.displayName || selectedDoc?.name || "Document"}
                </span>
              </SheetTitle>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedDoc?.downloadUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDocumentInNewTab(selectedDoc)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open Full Page
                  </Button>
                )}
              </div>
            </div>
            {selectedDoc && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                {getSourceBadge(selectedDoc.source)}
                {selectedDoc.invoiceDate && (
                  <span>Invoice: {formatDate(selectedDoc.invoiceDate)}</span>
                )}
                {selectedDoc.dueDate && (
                  <span>Due: {formatDate(selectedDoc.dueDate)}</span>
                )}
                {selectedDoc.datePaid && (
                  <span className="text-green-600 dark:text-green-400">
                    Paid: {formatDate(selectedDoc.datePaid)}
                  </span>
                )}
              </div>
            )}
          </SheetHeader>
          <div className="flex-1 h-[calc(100vh-120px)]">
            {selectedDoc?.downloadUrl ? (
              <iframe
                src={selectedDoc.downloadUrl}
                className="w-full h-full border-0"
                title={selectedDoc.displayName || selectedDoc.name}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No preview available
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default ContactDocumentsTab;
