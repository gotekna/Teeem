"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  FileText,
  RefreshCw,
  ExternalLink,
  Calendar,
  DollarSign,
  Hash,
  ClipboardList,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow as UITableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";
import { formatDate, formatCurrency } from "@/utils/formatters";

// Month names for grouping display
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Grouping types for cascade view
interface MonthGroup {
  month: number;
  monthName: string;
  invoices: ExternalInvoice[];
  totalAmount: number;
}

interface YearGroup {
  year: number;
  months: MonthGroup[];
  totalCount: number;
  totalAmount: number;
}

// Warehouse invoice type (from external_invoices table)
interface ExternalInvoice {
  id: number;
  external_id: string;
  invoice_number: string;
  reference?: string;
  invoice_type: string;
  status: string;
  invoice_date: string;
  due_date: string;
  fully_paid_date?: string;
  subtotal?: number;
  total_tax?: number;
  total: number;
  amount_due: number;
  amount_paid: number;
  currency_code: string;
  contact_id: number;
  contact_name: string;
  job_id: number | null;
  job_title: string | null;
  tenant_id?: string;
  line_items?: Array<{
    description: string;
    quantity: number;
    unit_amount: number;
    line_amount: number;
    account_code?: string;
    tax_type?: string;
  }>;
}

interface TenantInfo {
  tenant_id: string;
  tenant_name: string;
  badge_color: string;
}

interface TenantInvoicesData {
  tenant_info: TenantInfo;
  invoices: ExternalInvoice[];
  bills: ExternalInvoice[];
  credit_notes: ExternalInvoice[];
  quotes: ExternalInvoice[];
  total_invoices: number;
  total_bills: number;
  total_credit_notes: number;
  total_quotes: number;
}

interface WarehouseResponse {
  success: boolean;
  data: {
    by_tenant: Record<string, TenantInvoicesData>;
    invoices: ExternalInvoice[];
    bills: ExternalInvoice[];
    total_invoices: number;
    total_bills: number;
    contact_id: number;
    contact_name: string;
  };
  meta: {
    source: string;
    tenant_count: number;
    last_synced_at: string | null;
    cache_age_seconds: number | null;
  };
}

// SSoT: XeroLink from ContactHeader defines which tenants the contact is linked to
interface LinkedTenant {
  xero_tenant_id: string;
  xero_tenant_name: string;
}

interface XeroInvoicesListByTenantProps {
  contactId: number;
  type: "ACCREC" | "ACCPAY"; // ACCREC = Invoices (Receivable), ACCPAY = Bills (Payable)
  onViewInvoiceDetail?: (invoiceId: string) => void;
  // SSoT: Only show tabs for linked tenants (from contact's xero_links)
  // If not provided, shows all tenants from API response
  linkedTenants?: LinkedTenant[];
}

export function XeroInvoicesListByTenant({
  contactId,
  type,
  onViewInvoiceDetail,
  linkedTenants,
}: XeroInvoicesListByTenantProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [byTenant, setByTenant] = useState<Record<string, TenantInvoicesData>>({});
  const [activeTenant, setActiveTenant] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [cacheAgeSeconds, setCacheAgeSeconds] = useState<number | null>(null);

  // Single/double click state for invoice preview
  const [selectedInvoice, setSelectedInvoice] = useState<ExternalInvoice | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fullPageOpen, setFullPageOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState<ExternalInvoice | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cascade view state - expanded years and months
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const isInvoice = type === "ACCREC";
  const title = isInvoice ? "Invoices" : "Bills";

  // SSoT: Calculate tenantIds based on linkedTenants prop
  // Must be calculated before any early returns (React hooks rules)
  const tenantIds = useMemo(() => {
    if (linkedTenants && linkedTenants.length > 0) {
      return linkedTenants.map(t => t.xero_tenant_id).filter(id => byTenant[id]);
    }
    return Object.keys(byTenant);
  }, [linkedTenants, byTenant]);

  // Pre-calculate allItems and totalAllCount before any early returns
  const allItems = useMemo(() => {
    return tenantIds.flatMap((tenantId) => {
      const data = byTenant[tenantId];
      if (!data) return [];
      const items = isInvoice ? data.invoices : data.bills;
      return items.map((item) => ({ ...item, tenant_id: tenantId }));
    });
  }, [byTenant, tenantIds, isInvoice]);

  const totalAllCount = useMemo(() => {
    return tenantIds.reduce((sum, tenantId) => {
      const data = byTenant[tenantId];
      if (!data) return sum;
      return sum + (isInvoice ? data.total_invoices : data.total_bills);
    }, 0);
  }, [byTenant, tenantIds, isInvoice]);

  useEffect(() => {
    if (contactId) {
      loadInvoices();
    }
  }, [contactId, type]);

  const loadInvoices = async () => {
    if (!contactId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await api.get<WarehouseResponse>(
        `/api/v1/external_invoices/by_contact/${contactId}`
      );

      if (response.success && response.data) {
        if (response.data.by_tenant) {
          setByTenant(response.data.by_tenant);
          // Auto-select first tenant if none selected
          const tenantIds = Object.keys(response.data.by_tenant);
          if (tenantIds.length > 0 && !activeTenant) {
            setActiveTenant(tenantIds[0]);
          }
        }

        if (response.meta) {
          setLastSyncedAt(response.meta.last_synced_at);
          setCacheAgeSeconds(response.meta.cache_age_seconds);
        }
      }
    } catch (err) {
      console.error(`Failed to load ${title.toLowerCase()}:`, err);
      setError(err instanceof Error ? err.message : `Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    }
  };

  // Get tenant name lookup for "All" view
  const getTenantName = (tenantId: string | undefined): string => {
    if (!tenantId) return "Unknown";
    const data = byTenant[tenantId];
    return data?.tenant_info?.tenant_name || "Unknown";
  };

  // Group invoices by Year → Month for cascade view
  const groupInvoicesByYearMonth = useCallback((invoices: ExternalInvoice[]): YearGroup[] => {
    const yearMap = new Map<number, Map<number, ExternalInvoice[]>>();

    invoices.forEach((invoice) => {
      const date = invoice.invoice_date ? new Date(invoice.invoice_date) : new Date();
      const year = date.getFullYear();
      const month = date.getMonth();

      if (!yearMap.has(year)) {
        yearMap.set(year, new Map());
      }
      const monthMap = yearMap.get(year)!;

      if (!monthMap.has(month)) {
        monthMap.set(month, []);
      }
      monthMap.get(month)!.push(invoice);
    });

    // Convert to sorted array structure (years descending, months descending)
    const years = Array.from(yearMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([year, monthMap]) => {
        const months = Array.from(monthMap.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([month, invoiceList]) => {
            // Sort invoices by date descending within month
            const sortedInvoices = invoiceList.sort((a, b) => {
              const aDate = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
              const bDate = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
              return bDate - aDate;
            });

            return {
              month,
              monthName: MONTH_NAMES[month],
              invoices: sortedInvoices,
              totalAmount: sortedInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
            };
          });

        return {
          year,
          months,
          totalCount: months.reduce((sum, m) => sum + m.invoices.length, 0),
          totalAmount: months.reduce((sum, m) => sum + m.totalAmount, 0),
        };
      });

    return years;
  }, []);

  // Toggle year expansion
  const toggleYear = useCallback((year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  }, []);

  // Toggle month expansion
  const toggleMonth = useCallback((year: number, month: number) => {
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
  }, []);

  // Auto-expand most recent year and month when data loads
  useEffect(() => {
    if (allItems.length > 0 && expandedYears.size === 0) {
      const groups = groupInvoicesByYearMonth(allItems);
      if (groups.length > 0) {
        const latestYear = groups[0].year;
        setExpandedYears(new Set([latestYear]));
        if (groups[0].months.length > 0) {
          const latestMonth = groups[0].months[0].month;
          setExpandedMonths(new Set([`${latestYear}-${latestMonth}`]));
        }
      }
    }
  }, [allItems, groupInvoicesByYearMonth]);

  // Get status badge styling
  const getStatusBadge = (status: string | undefined) => {
    const s = status?.toLowerCase();
    if (s === "paid") {
      return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">{status}</Badge>;
    } else if (s === "authorised") {
      return <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{status}</Badge>;
    } else if (s === "draft") {
      return <Badge className="bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300">{status}</Badge>;
    } else if (s === "voided") {
      return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">{status}</Badge>;
    }
    return <Badge variant="outline">{status || "Unknown"}</Badge>;
  };

  // Render cascade view for a list of invoices
  const renderCascadeView = (invoices: ExternalInvoice[], showTenantColumn: boolean) => {
    const yearGroups = groupInvoicesByYearMonth(invoices);

    if (yearGroups.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No {title.toLowerCase()} found</p>
        </div>
      );
    }

    return (
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
                  {yearGroup.totalCount} {yearGroup.totalCount === 1 ? (isInvoice ? "invoice" : "bill") : (isInvoice ? "invoices" : "bills")}
                </Badge>
                <span className="ml-auto text-sm text-muted-foreground">
                  {formatCurrency(yearGroup.totalAmount)}
                </span>
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
                            {monthGroup.invoices.length}
                          </Badge>
                          <span className="ml-auto text-sm text-muted-foreground">
                            {formatCurrency(monthGroup.totalAmount)}
                          </span>
                        </button>

                        {isMonthExpanded && (
                          <div className="border-t bg-muted/20">
                            <Table>
                              <TableHeader>
                                <UITableRow>
                                  <TableHead className="pl-12 w-[100px]">Number</TableHead>
                                  {showTenantColumn && <TableHead className="w-[150px]">Company</TableHead>}
                                  <TableHead className="w-[100px]">Date</TableHead>
                                  <TableHead className="w-[100px]">Due Date</TableHead>
                                  <TableHead>Job</TableHead>
                                  <TableHead className="w-[100px]">Status</TableHead>
                                  <TableHead className="w-[100px] text-right">Total</TableHead>
                                  <TableHead className="w-[100px] text-right">{isInvoice ? "Due" : "Owing"}</TableHead>
                                </UITableRow>
                              </TableHeader>
                              <TableBody>
                                {monthGroup.invoices.map((invoice) => (
                                  <UITableRow
                                    key={invoice.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleInvoiceClick(invoice)}
                                  >
                                    <TableCell className="pl-12 font-medium">
                                      {invoice.invoice_number}
                                    </TableCell>
                                    {showTenantColumn && (
                                      <TableCell className="text-sm">
                                        {getTenantName(invoice.tenant_id)}
                                      </TableCell>
                                    )}
                                    <TableCell className="text-sm text-muted-foreground">
                                      {formatDate(invoice.invoice_date)}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {formatDate(invoice.due_date)}
                                    </TableCell>
                                    <TableCell className="text-sm truncate max-w-[200px]" title={invoice.job_title || undefined}>
                                      {invoice.job_title || "-"}
                                    </TableCell>
                                    <TableCell>
                                      {getStatusBadge(invoice.status)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {formatCurrency(invoice.total)}
                                    </TableCell>
                                    <TableCell className={`text-right font-medium ${invoice.amount_due > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                                      {formatCurrency(invoice.amount_due)}
                                    </TableCell>
                                  </UITableRow>
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
    );
  };

  // Fetch PDF URL for an invoice
  // Note: PDF endpoint uses database ID, not external_id
  const fetchPdfUrl = useCallback(async (invoiceId: number) => {
    setLoadingPdf(true);
    setPdfUrl(null);
    try {
      // The PDF endpoint returns the PDF directly as binary data, so we need the full URL for iframe
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      setPdfUrl(`${baseUrl}/api/v1/external_invoices/${invoiceId}/pdf`);
    } catch (err) {
      console.error("Failed to set PDF URL:", err);
    } finally {
      setLoadingPdf(false);
    }
  }, []);

  // Fetch full invoice details (includes line items)
  // Uses by_external_id endpoint which looks up by Xero ID
  const fetchInvoiceDetails = useCallback(async (externalId: string) => {
    setLoadingDetails(true);
    setInvoiceDetails(null);
    try {
      const response = await api.get<{ success: boolean; data: ExternalInvoice }>(
        `/api/v1/external_invoices/by_external_id/${externalId}`
      );
      if (response.success && response.data) {
        setInvoiceDetails(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch invoice details:", err);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  // Handle invoice click for single/double click detection
  const handleInvoiceClick = useCallback((invoice: ExternalInvoice) => {
    if (clickTimeoutRef.current) {
      // Double click detected - open full page comparison view
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      setSelectedInvoice(invoice);
      fetchPdfUrl(invoice.id);
      fetchInvoiceDetails(invoice.external_id);
      setFullPageOpen(true);
    } else {
      // Single click - wait to see if double click follows
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        // Single click confirmed - open drawer with PDF
        setSelectedInvoice(invoice);
        fetchPdfUrl(invoice.id);
        setDrawerOpen(true);
      }, 250);
    }
  }, [fetchPdfUrl, fetchInvoiceDetails]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (tenantIds.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>No {title.toLowerCase()} found for this contact</p>
        {lastSyncedAt && (
          <p className="text-xs mt-2">Last synced: {formatRelativeTime(lastSyncedAt)}</p>
        )}
      </div>
    );
  }

  // Sync status header
  const SyncHeader = () => (
    <div className="flex items-center justify-between text-sm text-muted-foreground px-1 mb-4">
      <span>
        Last synced: {lastSyncedAt ? formatRelativeTime(lastSyncedAt) : "Never"}
        {cacheAgeSeconds && cacheAgeSeconds > 86400 && (
          <span className="text-yellow-600 dark:text-yellow-400 ml-2">
            (Data may be outdated)
          </span>
        )}
      </span>
      <Button variant="ghost" size="sm" onClick={loadInvoices} disabled={loading}>
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
  );

  // SSoT: Tab structure based on linkedTenants count, not data count
  // - 1 linked tenant: show company name as header (no tabs)
  // - 2+ linked tenants: show "All" + company tabs
  const linkedTenantCount = linkedTenants?.length || 0;
  const showTabs = linkedTenantCount >= 2;

  // Get all linked tenant IDs for tabs (show even if empty)
  const allLinkedTenantIds = linkedTenants?.map(t => t.xero_tenant_id) || tenantIds;

  // Single linked tenant - no tabs needed, just show the tenant name
  if (!showTabs && tenantIds.length <= 1) {
    const tenantId = tenantIds[0];
    const data = tenantId ? byTenant[tenantId] : null;
    const items = data ? (isInvoice ? data.invoices : data.bills) : [];
    const tenantName = linkedTenants?.[0]?.xero_tenant_name || data?.tenant_info?.tenant_name;

    return (
      <>
        <div className="h-full space-y-4">
          <SyncHeader />
          {tenantName && (
            <div className="text-sm font-medium text-muted-foreground mb-2">
              {tenantName}
            </div>
          )}
          {renderCascadeView(items, false)}
        </div>

        {/* Invoice Preview Drawer (Single Click) */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="w-[600px] sm:w-[800px] sm:max-w-[80vw] p-0">
            <SheetHeader className="p-4 border-b">
              <div className="flex items-center justify-between">
                <SheetTitle className="flex items-center gap-2 truncate pr-4">
                  <FileText className="h-5 w-5" />
                  <span className="truncate">
                    {selectedInvoice?.invoice_number || title.slice(0, -1)}
                  </span>
                </SheetTitle>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pdfUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(pdfUrl, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open Full Page
                    </Button>
                  )}
                </div>
              </div>
              {selectedInvoice && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                  <Badge variant="secondary">{isInvoice ? "Invoice" : "Bill"}</Badge>
                  {selectedInvoice.invoice_date && (
                    <span>Date: {formatDate(selectedInvoice.invoice_date)}</span>
                  )}
                  {selectedInvoice.due_date && (
                    <span>Due: {formatDate(selectedInvoice.due_date)}</span>
                  )}
                  {selectedInvoice.fully_paid_date && (
                    <span className="text-green-600 dark:text-green-400">
                      Paid: {formatDate(selectedInvoice.fully_paid_date)}
                    </span>
                  )}
                </div>
              )}
            </SheetHeader>
            <div className="flex-1 h-[calc(100vh-120px)]">
              {loadingPdf ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner size={24} className="text-muted-foreground" />
                </div>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border-0"
                  title={selectedInvoice?.invoice_number || "Invoice PDF"}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No PDF available
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Full Page Comparison Dialog (Double Click) */}
        <Dialog open={fullPageOpen} onOpenChange={(open) => {
          setFullPageOpen(open);
          if (!open) {
            setInvoiceDetails(null);
            setPdfUrl(null);
          }
        }}>
          <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-0 flex flex-col">
            <DialogHeader className="p-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <span className="truncate max-w-[600px]">
                    {invoiceDetails?.invoice_number || selectedInvoice?.invoice_number || title.slice(0, -1)}
                  </span>
                  {invoiceDetails && (
                    <Badge variant="outline" className="ml-2">
                      {invoiceDetails.status?.toUpperCase()}
                    </Badge>
                  )}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {pdfUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(pdfUrl, "_blank")}
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
                {loadingDetails ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner size={24} className="text-muted-foreground" />
                  </div>
                ) : invoiceDetails ? (
                  <div className="p-4 space-y-6">
                    {/* Invoice Header */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {isInvoice ? "Invoice" : "Bill"} Number
                        </span>
                      </div>
                      <p className="text-lg font-semibold">{invoiceDetails.invoice_number}</p>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          invoiceDetails.status?.toLowerCase() === "paid"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                            : invoiceDetails.status?.toLowerCase() === "authorised"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                        }
                      >
                        {invoiceDetails.status?.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        {isInvoice ? "Invoice" : "Bill"}
                      </Badge>
                    </div>

                    {/* Contact & Job */}
                    {(invoiceDetails.contact_name || invoiceDetails.job_title) && (
                      <div className="space-y-2 pt-2 border-t">
                        {invoiceDetails.contact_name && (
                          <div>
                            <span className="text-xs text-muted-foreground uppercase">Contact</span>
                            <p className="font-medium">{invoiceDetails.contact_name}</p>
                          </div>
                        )}
                        {invoiceDetails.job_title && (
                          <div>
                            <span className="text-xs text-muted-foreground uppercase">Job</span>
                            <p className="font-medium">{invoiceDetails.job_title}</p>
                          </div>
                        )}
                        {invoiceDetails.reference && (
                          <div>
                            <span className="text-xs text-muted-foreground uppercase">Reference</span>
                            <p className="font-medium">{invoiceDetails.reference}</p>
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
                          <span className="text-muted-foreground">{isInvoice ? "Invoice" : "Bill"} Date</span>
                          <p>{formatDate(invoiceDetails.invoice_date)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Due Date</span>
                          <p>{formatDate(invoiceDetails.due_date)}</p>
                        </div>
                        {invoiceDetails.fully_paid_date && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Paid Date</span>
                            <p className="text-green-600 dark:text-green-400">
                              {formatDate(invoiceDetails.fully_paid_date)}
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
                        {invoiceDetails.subtotal !== undefined && invoiceDetails.subtotal !== null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>${invoiceDetails.subtotal.toFixed(2)}</span>
                          </div>
                        )}
                        {invoiceDetails.total_tax !== undefined && invoiceDetails.total_tax !== null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax</span>
                            <span>${invoiceDetails.total_tax.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium">
                          <span>Total</span>
                          <span>${invoiceDetails.total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-blue-600 dark:text-blue-400">
                          <span>Amount Paid</span>
                          <span>${invoiceDetails.amount_paid.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-orange-600 dark:text-orange-400 font-medium">
                          <span>Amount Due</span>
                          <span>${invoiceDetails.amount_due.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Line Items */}
                    {invoiceDetails.line_items && invoiceDetails.line_items.length > 0 && (
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Line Items</span>
                        </div>
                        <div className="space-y-2">
                          {invoiceDetails.line_items.map((item, index) => (
                            <div key={index} className="text-sm p-2 bg-background rounded border">
                              <p className="font-medium line-clamp-2">{item.description || "No description"}</p>
                              <div className="flex justify-between mt-1 text-muted-foreground">
                                <span>{item.quantity} × ${item.unit_amount.toFixed(2)}</span>
                                <span className="font-medium text-foreground">
                                  ${item.line_amount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No invoice details available
                  </div>
                )}
              </div>

              {/* Right Side: PDF Preview */}
              <div className="flex-1 min-w-0">
                {loadingPdf ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner size={32} className="text-muted-foreground" />
                  </div>
                ) : pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full border-0"
                    title={invoiceDetails?.invoice_number || "Invoice PDF"}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>No PDF available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Multiple linked tenants - show tabs with "All" option
  return (
    <div className="h-full space-y-4">
      <SyncHeader />

      <Tabs value={activeTenant || "all"} onValueChange={setActiveTenant}>
        <TabsList className="mb-4">
          {/* "All" tab first */}
          <TabsTrigger value="all" className="flex items-center gap-2">
            All
            <Badge variant="secondary" className="ml-1">
              {totalAllCount}
            </Badge>
          </TabsTrigger>
          {/* Individual tenant tabs - show all linked tenants */}
          {allLinkedTenantIds.map((tenantId) => {
            const data = byTenant[tenantId];
            const linkedTenant = linkedTenants?.find(t => t.xero_tenant_id === tenantId);
            const count = data ? (isInvoice ? data.total_invoices : data.total_bills) : 0;
            const tenantName = linkedTenant?.xero_tenant_name || data?.tenant_info?.tenant_name || "Unknown";
            return (
              <TabsTrigger key={tenantId} value={tenantId} className="flex items-center gap-2">
                {tenantName}
                <Badge variant="secondary" className="ml-1">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* "All" tab content - shows Company column */}
        <TabsContent value="all">
          {renderCascadeView(allItems, true)}
        </TabsContent>

        {/* Individual tenant tab contents - show all linked tenants */}
        {allLinkedTenantIds.map((tenantId) => {
          const data = byTenant[tenantId];
          const items = data ? (isInvoice ? data.invoices : data.bills) : [];
          return (
            <TabsContent key={tenantId} value={tenantId}>
              {renderCascadeView(items, false)}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Invoice Preview Drawer (Single Click) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-[600px] sm:w-[800px] sm:max-w-[80vw] p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 truncate pr-4">
                <FileText className="h-5 w-5" />
                <span className="truncate">
                  {selectedInvoice?.invoice_number || title.slice(0, -1)}
                </span>
              </SheetTitle>
              <div className="flex items-center gap-2 flex-shrink-0">
                {pdfUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(pdfUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open Full Page
                  </Button>
                )}
              </div>
            </div>
            {selectedInvoice && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                <Badge variant="secondary">{isInvoice ? "Invoice" : "Bill"}</Badge>
                {selectedInvoice.invoice_date && (
                  <span>Date: {formatDate(selectedInvoice.invoice_date)}</span>
                )}
                {selectedInvoice.due_date && (
                  <span>Due: {formatDate(selectedInvoice.due_date)}</span>
                )}
                {selectedInvoice.fully_paid_date && (
                  <span className="text-green-600 dark:text-green-400">
                    Paid: {formatDate(selectedInvoice.fully_paid_date)}
                  </span>
                )}
              </div>
            )}
          </SheetHeader>
          <div className="flex-1 h-[calc(100vh-120px)]">
            {loadingPdf ? (
              <div className="flex items-center justify-center h-full">
                <Spinner size={24} className="text-muted-foreground" />
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title={selectedInvoice?.invoice_number || "Invoice PDF"}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No PDF available
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Full Page Comparison Dialog (Double Click) - Invoice + PDF side by side */}
      <Dialog open={fullPageOpen} onOpenChange={(open) => {
        setFullPageOpen(open);
        if (!open) {
          setInvoiceDetails(null);
          setPdfUrl(null);
        }
      }}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <span className="truncate max-w-[600px]">
                  {invoiceDetails?.invoice_number || selectedInvoice?.invoice_number || title.slice(0, -1)}
                </span>
                {invoiceDetails && (
                  <Badge variant="outline" className="ml-2">
                    {invoiceDetails.status?.toUpperCase()}
                  </Badge>
                )}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {pdfUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(pdfUrl, "_blank")}
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
              {loadingDetails ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner size={24} className="text-muted-foreground" />
                </div>
              ) : invoiceDetails ? (
                <div className="p-4 space-y-6">
                  {/* Invoice Header */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {isInvoice ? "Invoice" : "Bill"} Number
                      </span>
                    </div>
                    <p className="text-lg font-semibold">{invoiceDetails.invoice_number}</p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        invoiceDetails.status?.toLowerCase() === "paid"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          : invoiceDetails.status?.toLowerCase() === "authorised"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                      }
                    >
                      {invoiceDetails.status?.toUpperCase()}
                    </Badge>
                    <Badge variant="outline">
                      {isInvoice ? "Invoice" : "Bill"}
                    </Badge>
                  </div>

                  {/* Contact & Job */}
                  {(invoiceDetails.contact_name || invoiceDetails.job_title) && (
                    <div className="space-y-2 pt-2 border-t">
                      {invoiceDetails.contact_name && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Contact</span>
                          <p className="font-medium">{invoiceDetails.contact_name}</p>
                        </div>
                      )}
                      {invoiceDetails.job_title && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Job</span>
                          <p className="font-medium">{invoiceDetails.job_title}</p>
                        </div>
                      )}
                      {invoiceDetails.reference && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase">Reference</span>
                          <p className="font-medium">{invoiceDetails.reference}</p>
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
                        <span className="text-muted-foreground">{isInvoice ? "Invoice" : "Bill"} Date</span>
                        <p>{formatDate(invoiceDetails.invoice_date)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Due Date</span>
                        <p>{formatDate(invoiceDetails.due_date)}</p>
                      </div>
                      {invoiceDetails.fully_paid_date && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Paid Date</span>
                          <p className="text-green-600 dark:text-green-400">
                            {formatDate(invoiceDetails.fully_paid_date)}
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
                      {invoiceDetails.subtotal !== undefined && invoiceDetails.subtotal !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>${invoiceDetails.subtotal.toFixed(2)}</span>
                        </div>
                      )}
                      {invoiceDetails.total_tax !== undefined && invoiceDetails.total_tax !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tax</span>
                          <span>${invoiceDetails.total_tax.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span>${invoiceDetails.total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-blue-600 dark:text-blue-400">
                        <span>Amount Paid</span>
                        <span>${invoiceDetails.amount_paid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-orange-600 dark:text-orange-400 font-medium">
                        <span>Amount Due</span>
                        <span>${invoiceDetails.amount_due.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  {invoiceDetails.line_items && invoiceDetails.line_items.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Line Items</span>
                      </div>
                      <div className="space-y-2">
                        {invoiceDetails.line_items.map((item, index) => (
                          <div key={index} className="text-sm p-2 bg-background rounded border">
                            <p className="font-medium line-clamp-2">{item.description || "No description"}</p>
                            <div className="flex justify-between mt-1 text-muted-foreground">
                              <span>{item.quantity} × ${item.unit_amount.toFixed(2)}</span>
                              <span className="font-medium text-foreground">
                                ${item.line_amount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No invoice details available
                </div>
              )}
            </div>

            {/* Right Side: PDF Preview */}
            <div className="flex-1 min-w-0">
              {loadingPdf ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner size={32} className="text-muted-foreground" />
                </div>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border-0"
                  title={invoiceDetails?.invoice_number || "Invoice PDF"}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No PDF available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
