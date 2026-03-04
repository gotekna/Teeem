"use client";

// =============================================================================
// SSoT: Documents Tab (ROOT level) - Uses StandardDocumentList
// =============================================================================
// Shows ContactDocument records stored in the database.
// Includes Xero invoice/bill PDFs migrated from CorporateDocument.
// Double-click on Xero docs opens invoice comparison dialog.
// Folder filtering with cascade mode preserved.
// =============================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Folder,
  FolderTree,
  Calendar,
  ExternalLink,
  DollarSign,
  Hash,
  ClipboardList,
  ArrowLeft,
  Layers,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatDate } from "@/utils/formatters";
import {
  StandardDocumentList,
  type LibraryDocument,
} from "@/components/documents/StandardDocumentList";
import type { Contact } from "../types";

interface ContactDocument {
  id: number;
  name: string;
  uiName: string;
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

// Invoice data from ExternalInvoice for comparison view
interface ExternalInvoiceData {
  id: number;
  invoice_number: string;
  invoice_type: string;
  status: string;
  invoice_date: string | null;
  due_date: string | null;
  fully_paid_date: string | null;
  subtotal: number | null;
  total_tax: number | null;
  total: number | null;
  amount_due: number | null;
  amount_paid: number | null;
  currency_code: string;
  contact_name: string | null;
  job_title: string | null;
  reference: string | null;
  line_items?: Array<{
    description: string;
    quantity: number;
    unit_amount: number;
    line_amount: number;
    account_code: string | null;
    tax_type: string | null;
  }>;
}

/** Map contact document to StandardDocumentList's LibraryDocument */
function toLibraryDocument(doc: ContactDocument): LibraryDocument {
  return {
    id: doc.id,
    displayName: doc.uiName || doc.name,
    sendName: doc.name,
    originalFilename: doc.name,
    mimeType: doc.contentType || "application/octet-stream",
    fileSize: doc.fileSize || 0,
    fileUrl: doc.downloadUrl,
    storagePath: doc.storagePath,
    folder: doc.folder,
    createdAt: doc.createdAt || new Date().toISOString(),
    source: doc.source,
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

/** Keep a map of LibraryDocument.id → ContactDocument for Xero lookup */
function buildContactDocMap(docs: ContactDocument[]): Map<number, ContactDocument> {
  const map = new Map<number, ContactDocument>();
  docs.forEach(d => map.set(d.id, d));
  return map;
}

export function ContactDocumentsTab({ contact }: ContactDocumentsTabProps) {
  const [documents, setDocuments] = useState<ContactDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cascade view mode - shows documents from folder AND all subfolders
  const [cascadeMode, setCascadeMode] = useState(true);
  // Selected folder for filtering (null = show all)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Xero invoice comparison dialog
  const [fullPageOpen, setFullPageOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ContactDocument | null>(null);
  const [invoiceData, setInvoiceData] = useState<ExternalInvoiceData | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [contact.id, selectedFolder, cascadeMode]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (selectedFolder) {
        params.folder = selectedFolder;
        if (cascadeMode) {
          params.include_descendants = "true";
        }
      }

      const queryString = new URLSearchParams(params).toString();
      const url = `/api/v1/contacts/${contact.id}/documents${queryString ? `?${queryString}` : ""}`;

      const response = await api.get<DocumentsResponse>(url);

      if (response?.success) {
        setDocuments(response.documents || []);
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError("Failed to load documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Xero invoice data for comparison view
  const fetchInvoiceData = useCallback(async (doc: ContactDocument) => {
    if (!doc.externalId || doc.source !== "xero") {
      setInvoiceData(null);
      return;
    }

    const parts = doc.externalId.split(":");
    if (parts.length < 2) {
      setInvoiceData(null);
      return;
    }
    const xeroInvoiceId = parts[1];

    setLoadingInvoice(true);
    try {
      const response = await api.get<{ success: boolean; data: ExternalInvoiceData }>(
        `/api/v1/external_invoices/by_external_id/${xeroInvoiceId}`
      );
      if (response?.success && response.data) {
        setInvoiceData(response.data);
      } else {
        setInvoiceData(null);
      }
    } catch (err) {
      console.error("Failed to fetch invoice data:", err);
      setInvoiceData(null);
    } finally {
      setLoadingInvoice(false);
    }
  }, []);

  // Double-click on a document → open Xero invoice comparison (if Xero doc)
  const contactDocMap = buildContactDocMap(documents);

  const handleDocumentDoubleClick = useCallback((doc: LibraryDocument) => {
    const contactDoc = contactDocMap.get(doc.id);
    if (contactDoc?.source === "xero" && contactDoc.externalId) {
      setSelectedDoc(contactDoc);
      fetchInvoiceData(contactDoc);
      setFullPageOpen(true);
    } else if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank");
    }
  }, [contactDocMap, fetchInvoiceData]);

  // Get unique folders for folder filter chips
  const uniqueFolders = [...new Set(documents.map(d => d.folder || "Uncategorized"))].sort();

  const libraryDocs = documents.map(toLibraryDocument);

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
              {selectedFolder ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFolder(null)}
                    className="p-1 h-auto"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <FolderTree className="h-5 w-5 text-amber-500" />
                  <span>{selectedFolder}</span>
                  {cascadeMode && (
                    <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                      + Subfolders
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <Folder className="h-5 w-5" />
                  Documents
                </>
              )}
              {documents.length > 0 && (
                <Badge variant="secondary">{documents.length}</Badge>
              )}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant={cascadeMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => setCascadeMode(!cascadeMode)}
                title={cascadeMode ? "Showing all subfolders" : "Showing this folder only"}
                className="text-xs"
              >
                <Layers className="h-3.5 w-3.5 mr-1" />
                {cascadeMode ? "All Subfolders" : "This Folder Only"}
              </Button>
              <Button variant="outline" size="sm" onClick={loadDocuments}>
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Folder filter chips (when not filtered) */}
          {!selectedFolder && uniqueFolders.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {uniqueFolders.map((folder) => (
                <Button
                  key={folder}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setSelectedFolder(folder)}
                >
                  <Folder className="h-3 w-3 mr-1 text-amber-500" />
                  {folder}
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                    {documents.filter(d => (d.folder || "Uncategorized") === folder).length}
                  </Badge>
                </Button>
              ))}
            </div>
          )}

          <StandardDocumentList
            documents={libraryDocs}
            loading={false}
            showVerifiedBadge={false}
            showExpiryBadge={false}
            showVerifyActions={false}
            onDocumentDoubleClick={handleDocumentDoubleClick}
            emptyMessage="No documents found for this contact."
          />
        </CardContent>
      </Card>

      {/* Full Page Comparison Dialog - Invoice + PDF side by side */}
      <Dialog open={fullPageOpen} onOpenChange={(open) => {
        setFullPageOpen(open);
        if (!open) {
          setInvoiceData(null);
        }
      }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="truncate max-w-[600px]">
                  {selectedDoc?.uiName || selectedDoc?.name || "Document"}
                </span>
                {invoiceData && (
                  <Badge variant="outline" className="ml-2">
                    {invoiceData.invoice_number}
                  </Badge>
                )}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {selectedDoc?.downloadUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(selectedDoc.downloadUrl!, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open in New Tab
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
            {/* Left Side: Invoice Details */}
            <div className="w-[400px] flex-shrink-0 border-r overflow-y-auto bg-muted/20">
              {loadingInvoice ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner size={24} className="text-muted-foreground" />
                </div>
              ) : invoiceData ? (
                <div className="p-4 space-y-6">
                  {/* Invoice Header */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Invoice Number</span>
                    </div>
                    <p className="text-lg font-semibold">{invoiceData.invoice_number}</p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        invoiceData.status === "paid" || invoiceData.status === "PAID"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          : invoiceData.status === "authorised" || invoiceData.status === "AUTHORISED"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                      }
                    >
                      {invoiceData.status}
                    </Badge>
                    <Badge variant="outline">
                      {invoiceData.invoice_type === "bill" ? "Bill" : "Invoice"}
                    </Badge>
                  </div>

                  {/* Contact & Job */}
                  {(invoiceData.contact_name || invoiceData.job_title) && (
                    <div className="space-y-2 pt-2 border-t">
                      {invoiceData.contact_name && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Contact</span>
                          <p className="font-medium">{invoiceData.contact_name}</p>
                        </div>
                      )}
                      {invoiceData.job_title && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Job</span>
                          <p className="font-medium">{invoiceData.job_title}</p>
                        </div>
                      )}
                      {invoiceData.reference && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Reference</span>
                          <p className="font-medium">{invoiceData.reference}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dates */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Dates</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Invoice Date</span>
                        <p>{formatDate(invoiceData.invoice_date)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due Date</span>
                        <p>{formatDate(invoiceData.due_date)}</p>
                      </div>
                      {invoiceData.fully_paid_date && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Paid Date</span>
                          <p className="text-green-600 dark:text-green-400">
                            {formatDate(invoiceData.fully_paid_date)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Amounts */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Amounts</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      {invoiceData.subtotal !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>${invoiceData.subtotal?.toFixed(2)}</span>
                        </div>
                      )}
                      {invoiceData.total_tax !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GST</span>
                          <span>${invoiceData.total_tax?.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-base pt-1 border-t">
                        <span>Total</span>
                        <span>${invoiceData.total?.toFixed(2)}</span>
                      </div>
                      {invoiceData.amount_paid !== null && invoiceData.amount_paid > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Paid</span>
                          <span>${invoiceData.amount_paid?.toFixed(2)}</span>
                        </div>
                      )}
                      {invoiceData.amount_due !== null && invoiceData.amount_due > 0 && (
                        <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                          <span>Amount Due</span>
                          <span>${invoiceData.amount_due?.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Line Items */}
                  {invoiceData.line_items && invoiceData.line_items.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Line Items ({invoiceData.line_items.length})</span>
                      </div>
                      <div className="space-y-2">
                        {invoiceData.line_items.map((item, idx) => (
                          <div key={idx} className="p-2 bg-background rounded border text-sm">
                            <p className="font-medium truncate" title={item.description}>
                              {item.description || "(No description)"}
                            </p>
                            <div className="flex justify-between text-muted-foreground mt-1">
                              <span>{item.quantity} x ${item.unit_amount?.toFixed(2)}</span>
                              <span className="font-medium text-foreground">
                                ${item.line_amount?.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <FileText className="h-8 w-8 mb-2" />
                  <p className="text-center">
                    {selectedDoc?.source === "xero"
                      ? "Invoice details not found"
                      : "This document is not linked to a Xero invoice"}
                  </p>
                </div>
              )}
            </div>

            {/* Right Side: PDF Preview */}
            <div className="flex-1 bg-muted/10 min-w-0">
              {selectedDoc?.downloadUrl ? (
                <iframe
                  src={selectedDoc.downloadUrl}
                  className="w-full h-full border-0"
                  title={selectedDoc.uiName || selectedDoc.name}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No preview available
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ContactDocumentsTab;
