"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  RefreshCw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  Receipt,
  Percent,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Invoice {
  id: string;
  invoice_number: string;
  reference?: string;
  contact_name?: string;
  invoice_date: string;
  due_date?: string;
  status: string;
  subtotal: number;
  total_tax: number;
  total: number;
  amount_paid?: number;
  amount_due?: number;
  xero_url?: string;
}

interface Bill {
  id: string;
  invoice_number: string;
  reference?: string;
  contact_name?: string;
  invoice_date: string;
  due_date?: string;
  status: string;
  subtotal: number;
  total_tax: number;
  total: number;
  amount_paid?: number;
  amount_due?: number;
  xero_url?: string;
}

interface CreditNote {
  id: string;
  invoice_number: string;
  reference?: string;
  contact_name?: string;
  invoice_date: string;
  status: string;
  subtotal: number;
  total_tax: number;
  total: number;
}

interface ClaimPattern {
  task_name: string;
  pattern: string;
  percentage: number | null;
}

interface FinancialData {
  invoices: Invoice[];
  credit_notes: CreditNote[];
  quotes: unknown[];
  bills: Bill[];
  supplier_credit_notes: CreditNote[];
  claim_invoice_patterns?: ClaimPattern[];
}

interface JobProfitTabProps {
  jobId: number;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "$0.00";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "0.0%";
  return `${value.toFixed(1)}%`;
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getStatusBadge = (status: string) => {
  const statusLower = status?.toLowerCase();
  if (statusLower === "paid" || statusLower === "authorised") {
    return <Badge className="bg-green-100 text-green-700">{status}</Badge>;
  }
  if (statusLower === "draft") {
    return <Badge variant="secondary">{status}</Badge>;
  }
  if (statusLower === "overdue") {
    return <Badge className="bg-red-100 text-red-700">{status}</Badge>;
  }
  if (statusLower === "voided" || statusLower === "deleted") {
    return <Badge variant="outline" className="text-muted-foreground">{status}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
};

export function JobProfitTab({ jobId }: JobProfitTabProps) {
  const [data, setData] = React.useState<FinancialData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        success: boolean;
        data: FinancialData;
        meta?: { last_synced_at?: string };
        error?: string;
      }>(`/api/v1/external_invoices/by_job/${jobId}`);

      if (response?.success) {
        setData(response.data);
        setLastSyncedAt(response.meta?.last_synced_at || null);
      } else {
        setError(response.error || "Failed to load financial data");
      }
    } catch (err) {
      console.error("Failed to load financial data:", err);
      setError("Failed to load financial data");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive bg-destructive/10">
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={loadData} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const invoices = data?.invoices || [];
  const bills = data?.bills || [];
  const creditNotes = data?.credit_notes || [];
  const supplierCreditNotes = data?.supplier_credit_notes || [];

  // Filter out voided/deleted
  const activeInvoices = invoices.filter(
    (inv) => inv.status !== "DELETED" && inv.status !== "VOIDED"
  );
  const activeBills = bills.filter(
    (bill) => bill.status !== "DELETED" && bill.status !== "VOIDED"
  );
  const activeCreditNotes = creditNotes.filter(
    (cn) => cn.status !== "DELETED" && cn.status !== "VOIDED"
  );
  const activeSupplierCredits = supplierCreditNotes.filter(
    (cn) => cn.status !== "DELETED" && cn.status !== "VOIDED"
  );

  // Revenue calculations
  const totalInvoicedGross = activeInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalCreditNotesGross = activeCreditNotes.reduce((sum, cn) => sum + (cn.total || 0), 0);
  const netRevenueGross = totalInvoicedGross - totalCreditNotesGross;

  const totalInvoicedNet = activeInvoices.reduce((sum, inv) => sum + (inv.subtotal || inv.total / 1.1 || 0), 0);
  const totalCreditNotesNet = activeCreditNotes.reduce((sum, cn) => sum + (cn.subtotal || cn.total / 1.1 || 0), 0);
  const netRevenueNet = totalInvoicedNet - totalCreditNotesNet;

  const revenueGst = activeInvoices.reduce((sum, inv) => sum + (inv.total_tax || 0), 0) -
    activeCreditNotes.reduce((sum, cn) => sum + (cn.total_tax || 0), 0);

  // Cost calculations
  const totalBillsGross = activeBills.reduce((sum, bill) => sum + (bill.total || 0), 0);
  const totalSupplierCreditsGross = activeSupplierCredits.reduce((sum, cn) => sum + (cn.total || 0), 0);
  const netCostsGross = totalBillsGross - totalSupplierCreditsGross;

  const totalBillsNet = activeBills.reduce((sum, bill) => sum + (bill.subtotal || bill.total / 1.1 || 0), 0);
  const totalSupplierCreditsNet = activeSupplierCredits.reduce((sum, cn) => sum + (cn.subtotal || cn.total / 1.1 || 0), 0);
  const netCostsNet = totalBillsNet - totalSupplierCreditsNet;

  const costsGst = activeBills.reduce((sum, bill) => sum + (bill.total_tax || 0), 0) -
    activeSupplierCredits.reduce((sum, cn) => sum + (cn.total_tax || 0), 0);

  // Profit
  const grossProfit = netRevenueNet - netCostsNet;
  const profitMargin = netRevenueNet > 0 ? (grossProfit / netRevenueNet) * 100 : 0;
  const netGstPosition = revenueGst - costsGst;

  // Payment stats
  const paidInvoices = activeInvoices.filter((inv) => inv.status === "PAID");
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalOutstanding = netRevenueGross - totalPaid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Profit & Loss
          </h2>
          {lastSyncedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Last synced: {new Date(lastSyncedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Profit Summary Card */}
      <Card className={cn(
        "relative overflow-hidden",
        grossProfit >= 0
          ? "bg-gradient-to-br from-emerald-500 to-emerald-700"
          : "bg-gradient-to-br from-red-500 to-red-700"
      )}>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-3 mb-2">
            {grossProfit >= 0 ? (
              <TrendingUp className="h-8 w-8 text-white/80" />
            ) : (
              <TrendingDown className="h-8 w-8 text-white/80" />
            )}
            <span className="text-white/80 font-medium text-lg">Gross Profit (ex GST)</span>
          </div>
          <div className="text-4xl font-bold text-white mb-2">
            {formatCurrency(grossProfit)}
          </div>
          <div className="flex items-center gap-4 text-white/80">
            <span className="flex items-center gap-1">
              <Percent className="h-4 w-4" />
              {formatPercentage(profitMargin)} margin
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Sub-tabs for Invoices, Bills, Profit */}
      <Tabs defaultValue="profit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profit" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <FileText className="h-4 w-4" />
            Invoices ({activeInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="bills" className="gap-2">
            <Receipt className="h-4 w-4" />
            Bills ({activeBills.length})
          </TabsTrigger>
        </TabsList>

        {/* Profit Summary Tab */}
        <TabsContent value="profit" className="space-y-6">
          {/* Revenue vs Costs Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Card */}
            <Card>
              <CardHeader className="bg-blue-50 dark:bg-blue-900/20 pb-3">
                <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoices ({activeInvoices.length})</span>
                  <span className="font-medium">{formatCurrency(totalInvoicedGross)}</span>
                </div>
                {totalCreditNotesGross > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Credit Notes ({activeCreditNotes.length})</span>
                    <span>-{formatCurrency(totalCreditNotesGross)}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between font-semibold">
                  <span>Net Revenue (inc GST)</span>
                  <span className="text-blue-600">{formatCurrency(netRevenueGross)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Ex GST</span>
                  <span>{formatCurrency(netRevenueNet)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>GST</span>
                  <span>{formatCurrency(revenueGst)}</span>
                </div>
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-green-600">Paid</span>
                    <span>{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-600">Outstanding</span>
                    <span>{formatCurrency(totalOutstanding)}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${netRevenueGross > 0 ? (totalPaid / netRevenueGross) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Costs Card */}
            <Card>
              <CardHeader className="bg-orange-50 dark:bg-orange-900/20 pb-3">
                <CardTitle className="text-orange-700 dark:text-orange-300 flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Costs
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bills ({activeBills.length})</span>
                  <span className="font-medium">{formatCurrency(totalBillsGross)}</span>
                </div>
                {totalSupplierCreditsGross > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Supplier Credits ({activeSupplierCredits.length})</span>
                    <span>-{formatCurrency(totalSupplierCreditsGross)}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between font-semibold">
                  <span>Net Costs (inc GST)</span>
                  <span className="text-orange-600">{formatCurrency(netCostsGross)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Ex GST</span>
                  <span>{formatCurrency(netCostsNet)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>GST</span>
                  <span>{formatCurrency(costsGst)}</span>
                </div>
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Cost as % of Revenue</span>
                    <span className={cn(
                      "font-medium",
                      netRevenueNet > 0 && (netCostsNet / netRevenueNet) > 0.8
                        ? "text-red-600"
                        : "text-green-600"
                    )}>
                      {netRevenueNet > 0 ? Math.round((netCostsNet / netRevenueNet) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground mb-1">Invoices</div>
                <div className="text-2xl font-bold">{activeInvoices.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground mb-1">Bills</div>
                <div className="text-2xl font-bold">{activeBills.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground mb-1">Paid Invoices</div>
                <div className="text-2xl font-bold text-green-600">{paidInvoices.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground mb-1">Margin</div>
                <div className={cn(
                  "text-2xl font-bold",
                  profitMargin >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatPercentage(profitMargin)}
                </div>
              </CardContent>
            </Card>
            <Card className={cn(
              netGstPosition >= 0 ? "bg-purple-50 dark:bg-purple-900/20" : "bg-green-50 dark:bg-green-900/20"
            )}>
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground mb-1">
                  {netGstPosition >= 0 ? "GST Payable" : "GST Refund"}
                </div>
                <div className={cn(
                  "text-xl font-bold",
                  netGstPosition >= 0 ? "text-purple-600" : "text-green-600"
                )}>
                  {formatCurrency(Math.abs(netGstPosition))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          {/* Claim Invoice Patterns Info */}
          {data?.claim_invoice_patterns && data.claim_invoice_patterns.length > 0 && (
            <Card className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <Search className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                      Invoice Match Patterns
                    </p>
                    <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mb-2">
                      Xero invoices with these patterns in the reference will auto-match to claim stages:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {data.claim_invoice_patterns.map((cp, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="bg-white dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
                        >
                          <span className="font-semibold">{cp.pattern}</span>
                          {cp.percentage && (
                            <span className="ml-1 text-blue-500 dark:text-blue-400">
                              ({cp.percentage}%)
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No invoices found for this job
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{invoice.contact_name || "-"}</TableCell>
                        <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                        <TableCell>{formatDate(invoice.due_date)}</TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.subtotal)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.total_tax)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(invoice.total)}</TableCell>
                        <TableCell>
                          {invoice.xero_url && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={invoice.xero_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Credit Notes */}
          {activeCreditNotes.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Credit Notes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Credit Note #</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeCreditNotes.map((cn) => (
                      <TableRow key={cn.id}>
                        <TableCell className="font-medium">{cn.invoice_number}</TableCell>
                        <TableCell>{cn.contact_name || "-"}</TableCell>
                        <TableCell>{formatDate(cn.invoice_date)}</TableCell>
                        <TableCell>{getStatusBadge(cn.status)}</TableCell>
                        <TableCell className="text-right text-red-600">-{formatCurrency(cn.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Bills Tab */}
        <TabsContent value="bills">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeBills.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No bills found for this job
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeBills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-medium">{bill.invoice_number}</TableCell>
                        <TableCell>{bill.contact_name || "-"}</TableCell>
                        <TableCell>{formatDate(bill.invoice_date)}</TableCell>
                        <TableCell>{formatDate(bill.due_date)}</TableCell>
                        <TableCell>{getStatusBadge(bill.status)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(bill.subtotal)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(bill.total_tax)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(bill.total)}</TableCell>
                        <TableCell>
                          {bill.xero_url && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={bill.xero_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Supplier Credit Notes */}
          {activeSupplierCredits.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Supplier Credit Notes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Credit Note #</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSupplierCredits.map((cn) => (
                      <TableRow key={cn.id}>
                        <TableCell className="font-medium">{cn.invoice_number}</TableCell>
                        <TableCell>{cn.contact_name || "-"}</TableCell>
                        <TableCell>{formatDate(cn.invoice_date)}</TableCell>
                        <TableCell>{getStatusBadge(cn.status)}</TableCell>
                        <TableCell className="text-right text-green-600">-{formatCurrency(cn.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
