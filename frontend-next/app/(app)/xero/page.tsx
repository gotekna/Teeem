"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  RefreshCw,
  CheckCircle,
  DollarSign,
  FileText,
  CreditCard,
  AlertTriangle,
  ExternalLink,
  Download,
  Building2,
  BarChart3,
  Calendar,
  HelpCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Database,
} from "lucide-react";
import { api } from "@/lib/api";

interface XeroStatus {
  connected: boolean;
  tenant_name: string | null;
  last_sync: string | null;
  sync_in_progress: boolean;
}

interface ExternalInvoice {
  id: number;
  external_id: string;
  invoice_number: string;
  invoice_type: "invoice" | "bill";
  status: string;
  invoice_date: string;
  due_date: string;
  total: number;
  subtotal: number;
  total_tax: number;
  amount_due: number;
  amount_paid: number;
  currency_code: string;
  contact_id: number | null;
  contact_name: string | null;
  job_id: number | null;
  job_title: string | null;
}

interface WarehouseResponse {
  success: boolean;
  data: ExternalInvoice[];
  meta: {
    source: string;
    last_synced_at: string | null;
    cache_age_seconds: number | null;
    total_count: number;
  };
}

interface XeroPayment {
  id: string;
  date: string;
  amount: number;
  reference: string;
  invoice_number: string;
  contact_name: string;
  account_name: string;
}

interface XeroStats {
  invoices_receivable: number;
  invoices_payable: number;
  total_outstanding: number;
  overdue_count: number;
  last_sync: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-foreground dark:bg-muted/50 dark:text-muted-foreground",
  submitted: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 dark:bg-blue-400/10 dark:text-blue-400",
  approved: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  paid: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-400/10 dark:text-green-400",
  voided: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 dark:bg-red-400/10 dark:text-red-400",
};

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-AU");
}

function getCacheAgeColor(seconds: number | null): string {
  if (!seconds) return "text-muted-foreground";
  const hours = seconds / 3600;
  if (hours < 1) return "text-green-600 dark:text-green-400";
  if (hours < 24) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export default function XeroPage() {
  const router = useRouter();
  const pathname = usePathname();

  // Parse tab from path: /xero/payments → "payments", /xero → "invoices"
  const activeTab = useMemo(() => {
    const parts = (pathname ?? "").replace("/xero", "").split("/").filter(Boolean);
    // Skip "callback" path (OAuth callback uses query params)
    if (parts[0] === "callback") return "invoices";
    return parts[0] || "invoices";
  }, [pathname]);

  const handleTabChange = useCallback((tabId: string) => {
    // Path-based navigation: /xero, /xero/payments, /xero/reports
    const url = tabId === "invoices"
      ? "/xero"
      : `/xero/${tabId}`;
    router.push(url, { scroll: false });
  }, [router]);

  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [invoices, setInvoices] = useState<ExternalInvoice[]>([]);
  const [bills, setBills] = useState<ExternalInvoice[]>([]);
  const [cacheMetadata, setCacheMetadata] = useState<WarehouseResponse["meta"] | null>(null);
  const [payments, setPayments] = useState<XeroPayment[]>([]);
  const [stats, setStats] = useState<XeroStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceType, setInvoiceType] = useState<"all" | "receivable" | "payable">("all");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load status
        const statusRes = await api.get<{ success: boolean; data: XeroStatus }>("/api/v1/xero/status");
        setStatus(statusRes.data);

        // Only load invoices if connected
        if (statusRes.data.connected) {
          // Load invoices and bills from warehouse (10-100x faster than Xero API)
          const [invoicesRes, billsRes] = await Promise.all([
            api.get<WarehouseResponse>("/api/v1/external_invoices?type=invoice&per_page=200"),
            api.get<WarehouseResponse>("/api/v1/external_invoices?type=bill&per_page=200"),
          ]);

          setInvoices(invoicesRes.data || []);
          setBills(billsRes.data || []);
          setCacheMetadata(invoicesRes.meta);
        }
      } catch (error) {
        console.error("Failed to load Xero data:", error);
        // Set status as disconnected on error so the connect UI shows
        setStatus({ connected: false, tenant_name: null, last_sync: null, sync_in_progress: false });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/api/v1/xero/sync_contacts");
    } catch (_error) {
      console.error("Sync failed:", _error);
    }
    setSyncing(false);
  };

  const handleConnect = async () => {
    try {
      const response = await api.get<{ success: boolean; auth_url: string; url?: string }>("/api/v1/xero/auth_url");
      const authUrl = response.auth_url || response.url;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error("No authorization URL received from server");
      }
    } catch (_error) {
      console.error("Failed to get auth URL:", _error);
    }
  };

  // Combine invoices and bills into a single array with type field
  const allTransactions = [
    ...invoices.map(inv => ({ ...inv, type: "ACCREC" as const })),
    ...bills.map(bill => ({ ...bill, type: "ACCPAY" as const })),
  ];

  const filteredInvoices = allTransactions.filter((invoice) => {
    const matchesSearch =
      (invoice.invoice_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invoice.contact_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      invoiceType === "all" ||
      (invoiceType === "receivable" && invoice.type === "ACCREC") ||
      (invoiceType === "payable" && invoice.type === "ACCPAY");
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Xero Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect to Xero for invoices, payments, and contact sync
          </p>
        </div>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Connect to Xero
            </CardTitle>
            <CardDescription>
              Link your Xero account to sync invoices, payments, and contacts automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleConnect} className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Xero Account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Xero Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connected to <span className="font-medium">{status.tenant_name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings/integrations">
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Alert>
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Connected to Xero. Last synced:{" "}
            {status.last_sync
              ? new Date(status.last_sync).toLocaleString()
              : "Never"}
          </span>
        </AlertDescription>
      </Alert>

      {/* Cache Age Alert */}
      {cacheMetadata && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/10">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <Zap className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
          </div>
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm">
                <strong>Fast Mode:</strong> Using local warehouse (10-100x faster)
              </span>
              <span className="text-xs text-muted-foreground">
                Last synced:{" "}
                <span className={getCacheAgeColor(cacheMetadata.cache_age_seconds)}>
                  {formatRelativeTime(cacheMetadata.last_synced_at)}
                </span>
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Clock className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Data is cached locally for instant loading. Click &quot;Sync Now&quot; to get latest from Xero.
                </p>
              </TooltipContent>
            </Tooltip>
          </AlertDescription>
        </Alert>
      )}


      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="reports">
              <BarChart3 className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-4">
            {activeTab === "invoices" && (
              <div className="flex gap-1">
                <Button
                  variant={invoiceType === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setInvoiceType("all")}
                >
                  All
                </Button>
                <Button
                  variant={invoiceType === "receivable" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setInvoiceType("receivable")}
                >
                  Receivable
                </Button>
                <Button
                  variant={invoiceType === "payable" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setInvoiceType("payable")}
                >
                  Payable
                </Button>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
          </div>
        </div>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {invoice.invoice_number}
                        </Badge>
                        {invoice.type === "ACCPAY" ? (
                          <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 dark:bg-purple-400/10 dark:text-purple-400 text-xs">
                            Bill
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 dark:bg-blue-400/10 dark:text-blue-400 text-xs">
                            Invoice
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{invoice.contact_name}</TableCell>
                    <TableCell>{new Date(invoice.invoice_date).toLocaleDateString("en-AU")}</TableCell>
                    <TableCell>
                      <span
                        className={
                          new Date(invoice.due_date) < new Date() && invoice.status !== "paid"
                            ? "text-red-600 dark:text-red-400 font-medium"
                            : ""
                        }
                      >
                        {new Date(invoice.due_date).toLocaleDateString("en-AU")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[invoice.status]}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.job_title ? (
                        <Link
                          href={`/jobs/${invoice.job_id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {invoice.job_title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${invoice.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      ${invoice.amount_due.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-mono">{payment.reference || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {payment.invoice_number}
                      </Badge>
                    </TableCell>
                    <TableCell>{payment.contact_name}</TableCell>
                    <TableCell>{payment.account_name}</TableCell>
                    <TableCell className="text-right font-mono font-medium text-green-600 dark:text-green-400">
                      ${payment.amount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-6">
          {/* Standard Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Standard Reports</CardTitle>
              <CardDescription>Download financial reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { title: "Profit & Loss Statement", description: "Income and expense summary", icon: FileText },
                  { title: "Balance Sheet", description: "Assets, liabilities, and equity", icon: Building2 },
                  { title: "Cash Flow Statement", description: "Cash inflows and outflows", icon: DollarSign },
                  { title: "Aged Receivables", description: "Outstanding customer invoices", icon: Calendar },
                  { title: "Aged Payables", description: "Outstanding supplier bills", icon: Calendar },
                  { title: "Trial Balance", description: "Account balances summary", icon: BarChart3 },
                ].map((report) => {
                  const Icon = report.icon;
                  return (
                    <div key={report.title} className="flex items-start gap-4 p-4 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
                      <div className="p-2 bg-secondary rounded-lg">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium">{report.title}</h3>
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </TooltipProvider>
  );
}
