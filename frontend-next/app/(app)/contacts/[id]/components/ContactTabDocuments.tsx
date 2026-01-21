"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Calendar,
  ChevronRight,
  ChevronDown,
  Download,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatDate, formatFileSize } from "@/utils/formatters";

// =============================================================================
// ContactTabDocuments - Shows documents filtered by EntityTab
// =============================================================================
// Uses the tab_key to filter documents via document_type links (primary + also_show_in)
// Displays in cascade Year → Month → Documents format
// =============================================================================

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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

interface MonthGroup {
  month: number;
  monthName: string;
  documents: ContactDocument[];
}

interface YearGroup {
  year: number;
  months: MonthGroup[];
  totalCount: number;
}

interface ContactTabDocumentsProps {
  contactId: number;
  tabKey: string;
  title?: string;
}

export function ContactTabDocuments({
  contactId,
  tabKey,
  title = "Documents",
}: ContactTabDocumentsProps) {
  const [documents, setDocuments] = useState<ContactDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Preview states
  const [selectedDoc, setSelectedDoc] = useState<ContactDocument | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fullPageOpen, setFullPageOpen] = useState(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch documents
  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<{
          success: boolean;
          documents: ContactDocument[];
          total: number;
        }>(`/api/v1/contacts/${contactId}/documents?tab_key=${tabKey}`);

        if (response?.documents) {
          setDocuments(response.documents);
        }
      } catch (err) {
        console.error("Failed to fetch documents:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch documents");
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [contactId, tabKey]);

  // Group documents by year and month
  const groupDocumentsByYearMonth = useCallback((docs: ContactDocument[]): YearGroup[] => {
    const yearMap = new Map<number, Map<number, ContactDocument[]>>();

    docs.forEach((doc) => {
      // Use invoiceDate if available, otherwise createdAt
      const dateStr = doc.invoiceDate || doc.createdAt;
      const date = dateStr ? new Date(dateStr) : new Date();
      const year = date.getFullYear();
      const month = date.getMonth();

      if (!yearMap.has(year)) {
        yearMap.set(year, new Map());
      }
      const monthMap = yearMap.get(year)!;
      if (!monthMap.has(month)) {
        monthMap.set(month, []);
      }
      monthMap.get(month)!.push(doc);
    });

    // Convert to array and sort
    const yearGroups: YearGroup[] = [];
    yearMap.forEach((monthMap, year) => {
      const months: MonthGroup[] = [];
      monthMap.forEach((docs, month) => {
        months.push({
          month,
          monthName: MONTH_NAMES[month],
          documents: docs.sort((a, b) => {
            const dateA = new Date(a.invoiceDate || a.createdAt || 0);
            const dateB = new Date(b.invoiceDate || b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
          }),
        });
      });

      // Sort months descending
      months.sort((a, b) => b.month - a.month);

      yearGroups.push({
        year,
        months,
        totalCount: months.reduce((sum, m) => sum + m.documents.length, 0),
      });
    });

    // Sort years descending
    yearGroups.sort((a, b) => b.year - a.year);
    return yearGroups;
  }, []);

  // Auto-expand most recent year/month
  useEffect(() => {
    if (documents.length > 0 && expandedYears.size === 0) {
      const groups = groupDocumentsByYearMonth(documents);
      if (groups.length > 0) {
        const latestYear = groups[0].year;
        setExpandedYears(new Set([latestYear]));
        if (groups[0].months.length > 0) {
          const latestMonth = groups[0].months[0].month;
          setExpandedMonths(new Set([`${latestYear}-${latestMonth}`]));
        }
      }
    }
  }, [documents, groupDocumentsByYearMonth]);

  const toggleYear = useCallback((year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }, []);

  const toggleMonth = useCallback((year: number, month: number) => {
    const key = `${year}-${month}`;
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleDocumentClick = useCallback((doc: ContactDocument) => {
    if (clickTimeoutRef.current) {
      // Double-click: open full page
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      setSelectedDoc(doc);
      setFullPageOpen(true);
    } else {
      // Single-click: open drawer after delay
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        setSelectedDoc(doc);
        setDrawerOpen(true);
      }, 250);
    }
  }, []);

  const handleDownload = useCallback((doc: ContactDocument) => {
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
      <div className="text-center py-8 text-destructive">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>No {title.toLowerCase()} found</p>
      </div>
    );
  }

  const yearGroups = groupDocumentsByYearMonth(documents);

  return (
    <>
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
                <Badge variant="secondary" className="ml-2">
                  {yearGroup.totalCount} {yearGroup.totalCount === 1 ? "document" : "documents"}
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
                          onClick={() => toggleMonth(yearGroup.year, monthGroup.month)}
                          className="w-full flex items-center gap-2 p-3 pl-8 hover:bg-muted/50 transition-colors text-left"
                        >
                          {isMonthExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{monthGroup.monthName}</span>
                          <Badge variant="secondary" className="ml-2">
                            {monthGroup.documents.length}
                          </Badge>
                        </button>

                        {isMonthExpanded && (
                          <div className="border-t bg-muted/20">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="pl-12">Name</TableHead>
                                  <TableHead className="w-[100px]">Type</TableHead>
                                  <TableHead className="w-[100px]">Date</TableHead>
                                  <TableHead className="w-[80px]">Size</TableHead>
                                  <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {monthGroup.documents.map((doc) => (
                                  <TableRow
                                    key={doc.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleDocumentClick(doc)}
                                  >
                                    <TableCell className="pl-12">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium truncate max-w-[300px]">
                                          {doc.displayName || doc.name}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {doc.documentType || doc.folder || "-"}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {formatDate(doc.invoiceDate || doc.createdAt)}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {doc.fileSize ? formatFileSize(doc.fileSize) : "-"}
                                    </TableCell>
                                    <TableCell>
                                      {doc.downloadUrl && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownload(doc);
                                          }}
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      )}
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
              )}
            </div>
          );
        })}
      </div>

      {/* Drawer Preview (Single Click) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>{selectedDoc?.displayName || selectedDoc?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {selectedDoc?.downloadUrl && selectedDoc.contentType?.startsWith("application/pdf") ? (
              <iframe
                src={selectedDoc.downloadUrl}
                className="w-full h-[calc(100vh-200px)] border rounded"
                title="Document Preview"
              />
            ) : selectedDoc?.downloadUrl && selectedDoc.contentType?.startsWith("image/") ? (
              <img
                src={selectedDoc.downloadUrl}
                alt={selectedDoc.displayName || selectedDoc.name}
                className="max-w-full h-auto"
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Preview not available</p>
                {selectedDoc?.downloadUrl && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => handleDownload(selectedDoc)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Full Page Modal (Double Click) */}
      <Dialog open={fullPageOpen} onOpenChange={setFullPageOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedDoc?.displayName || selectedDoc?.name}</span>
              {selectedDoc?.downloadUrl && (
                <Button variant="outline" size="sm" onClick={() => handleDownload(selectedDoc)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {selectedDoc?.downloadUrl && selectedDoc.contentType?.startsWith("application/pdf") ? (
              <iframe
                src={selectedDoc.downloadUrl}
                className="w-full h-[calc(90vh-120px)] border rounded"
                title="Document Preview"
              />
            ) : selectedDoc?.downloadUrl && selectedDoc.contentType?.startsWith("image/") ? (
              <img
                src={selectedDoc.downloadUrl}
                alt={selectedDoc.displayName || selectedDoc.name}
                className="max-w-full max-h-[calc(90vh-120px)] mx-auto"
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Preview not available for this file type</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ContactTabDocuments;
