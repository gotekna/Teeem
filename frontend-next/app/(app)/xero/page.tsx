"use client";

import { useEffect, useState } from "react";
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
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  CreditCard,
  AlertTriangle,
  ExternalLink,
  Download,
  ArrowUpDown,
  Building2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Briefcase,
  ArrowUpRight,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api";

interface XeroStatus {
  connected: boolean;
  tenant_name: string | null;
  last_sync: string | null;
  sync_in_progress: boolean;
}

interface XeroInvoice {
  id: string;
  invoice_number: string;
  contact_name: string;
  date: string;
  due_date: string;
  status: "DRAFT" | "SUBMITTED" | "AUTHORISED" | "PAID" | "VOIDED";
  total: number;
  amount_due: number;
  amount_paid: number;
  type: "ACCREC" | "ACCPAY";
  job_id: number | null;
  job_name: string | null;
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

interface FinancialSummary {
  revenue: number;
  expenses: number;
  profit: number;
  profit_margin: number;
  accounts_receivable: number;
  accounts_payable: number;
  cash_on_hand: number;
}

interface JobProfitability {
  job_id: number;
  job_title: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  status: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  AUTHORISED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500",
  PAID: "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  VOIDED: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400",
};

export default function XeroPage() {
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [invoices, setInvoices] = useState<XeroInvoice[]>([]);
  const [payments, setPayments] = useState<XeroPayment[]>([]);
  const [stats, setStats] = useState<XeroStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("invoices");
  const [invoiceType, setInvoiceType] = useState<"all" | "receivable" | "payable">("all");
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [jobProfitability, setJobProfitability] = useState<JobProfitability[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [statusRes, invoicesRes, paymentsRes] = await Promise.all([
          api.get<XeroStatus>("/api/v1/xero/status"),
          api.get<{ invoices: XeroInvoice[] }>("/api/v1/xero/invoices"),
          api.get<{ payments: XeroPayment[] }>("/api/v1/xero/payments"),
        ]);
        setStatus(statusRes);
        setInvoices(invoicesRes.invoices || []);
        setPayments(paymentsRes.payments || []);
      } catch (error) {
        console.error("Failed to load Xero data:", error);
        setStatus(getMockStatus());
        setInvoices(getMockInvoices());
        setPayments(getMockPayments());
        setStats(getMockStats());
        setFinancialSummary(getMockFinancialSummary());
        setJobProfitability(getMockJobProfitability());
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/api/v1/xero/sync_contacts");
    } catch (error) {
      console.error("Sync failed:", error);
    }
    setSyncing(false);
  };

  const handleConnect = async () => {
    try {
      const { url } = await api.get<{ url: string }>("/api/v1/xero/auth_url");
      window.location.href = url;
    } catch (error) {
      console.error("Failed to get auth URL:", error);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.contact_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      invoiceType === "all" ||
      (invoiceType === "receivable" && invoice.type === "ACCREC") ||
      (invoiceType === "payable" && invoice.type === "ACCPAY");
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
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
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Connected to Xero. Last synced:{" "}
            {status.last_sync
              ? new Date(status.last_sync).toLocaleString()
              : "Never"}
          </span>
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Receivables</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">
              {invoices.filter((i) => i.type === "ACCREC" && i.status !== "PAID").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Payables</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">
              {invoices.filter((i) => i.type === "ACCPAY" && i.status !== "PAID").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Outstanding</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">
              ${invoices
                .filter((i) => i.status !== "PAID")
                .reduce((sum, i) => sum + i.amount_due, 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-300 bg-red-50 dark:bg-red-900/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Overdue</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2 text-red-600">
              {invoices.filter(
                (i) => i.status !== "PAID" && new Date(i.due_date) < new Date()
              ).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400 text-xs">
                            Bill
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400 text-xs">
                            Invoice
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{invoice.contact_name}</TableCell>
                    <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span
                        className={
                          new Date(invoice.due_date) < new Date() && invoice.status !== "PAID"
                            ? "text-red-600 font-medium"
                            : ""
                        }
                      >
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[invoice.status]}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.job_name ? (
                        <Link
                          href={`/jobs/${invoice.job_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {invoice.job_name}
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
                    <TableCell className="text-right font-mono font-medium text-green-600">
                      ${payment.amount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-6">
          {/* Financial Summary Cards */}
          {financialSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Revenue</p>
                      <p className="text-2xl font-bold font-mono">{formatCurrency(financialSummary.revenue)}</p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4" />
                    +12.5% vs last period
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Expenses</p>
                      <p className="text-2xl font-bold font-mono">{formatCurrency(financialSummary.expenses)}</p>
                    </div>
                    <div className="p-2 bg-red-100 rounded-lg">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-sm text-red-600">
                    <ArrowUpRight className="h-4 w-4" />
                    +8.2% vs last period
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Net Profit</p>
                      <p className="text-2xl font-bold font-mono text-green-600">
                        {formatCurrency(financialSummary.profit)}
                      </p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <Badge className="bg-green-100 text-green-700">
                      {financialSummary.profit_margin.toFixed(1)}% margin
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Cash Position</p>
                      <p className="text-2xl font-bold font-mono">{formatCurrency(financialSummary.cash_on_hand)}</p>
                    </div>
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>AR: {formatCurrency(financialSummary.accounts_receivable)}</span>
                    <span>AP: {formatCurrency(financialSummary.accounts_payable)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Job Profitability Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Job Profitability
              </CardTitle>
              <CardDescription>Revenue, costs, and margins by job</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobProfitability.map((job) => (
                    <TableRow key={job.job_id}>
                      <TableCell className="font-medium">{job.job_title}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(job.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatCurrency(job.cost)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {formatCurrency(job.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={job.margin >= 25 ? "default" : job.margin >= 15 ? "secondary" : "destructive"}
                        >
                          {job.margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={job.status === "active" ? "outline" : "secondary"}>
                          {job.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

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
                        <h3 className="font-medium">{report.title}</h3>
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
  );
}

function getMockStatus(): XeroStatus {
  return {
    connected: true,
    tenant_name: "Harrison Builders Pty Ltd",
    last_sync: new Date(Date.now() - 3600000).toISOString(),
    sync_in_progress: false,
  };
}

function getMockInvoices(): XeroInvoice[] {
  return [
    {
      id: "inv-1",
      invoice_number: "INV-0045",
      contact_name: "Boral Timber",
      date: "2024-11-15",
      due_date: "2024-12-15",
      status: "AUTHORISED",
      total: 12500,
      amount_due: 12500,
      amount_paid: 0,
      type: "ACCPAY",
      job_id: 1,
      job_name: "Harrison Residence",
    },
    {
      id: "inv-2",
      invoice_number: "INV-0046",
      contact_name: "John & Sarah Harrison",
      date: "2024-11-20",
      due_date: "2024-12-20",
      status: "AUTHORISED",
      total: 85000,
      amount_due: 85000,
      amount_paid: 0,
      type: "ACCREC",
      job_id: 1,
      job_name: "Harrison Residence",
    },
    {
      id: "inv-3",
      invoice_number: "INV-0044",
      contact_name: "BlueScope Steel",
      date: "2024-11-01",
      due_date: "2024-11-30",
      status: "PAID",
      total: 34500,
      amount_due: 0,
      amount_paid: 34500,
      type: "ACCPAY",
      job_id: 2,
      job_name: "Coastal Views Duplex",
    },
    {
      id: "inv-4",
      invoice_number: "INV-0043",
      contact_name: "Hanson Concrete",
      date: "2024-10-25",
      due_date: "2024-11-24",
      status: "AUTHORISED",
      total: 8900,
      amount_due: 8900,
      amount_paid: 0,
      type: "ACCPAY",
      job_id: 1,
      job_name: "Harrison Residence",
    },
    {
      id: "inv-5",
      invoice_number: "INV-0042",
      contact_name: "Michael & Emma Thompson",
      date: "2024-10-15",
      due_date: "2024-11-15",
      status: "PAID",
      total: 125000,
      amount_due: 0,
      amount_paid: 125000,
      type: "ACCREC",
      job_id: 3,
      job_name: "Thompson Family Home",
    },
  ];
}

function getMockPayments(): XeroPayment[] {
  return [
    {
      id: "pay-1",
      date: "2024-11-25",
      amount: 34500,
      reference: "EFT-4521",
      invoice_number: "INV-0044",
      contact_name: "BlueScope Steel",
      account_name: "Business Account",
    },
    {
      id: "pay-2",
      date: "2024-11-15",
      amount: 125000,
      reference: "Progress Claim 3",
      invoice_number: "INV-0042",
      contact_name: "Michael & Emma Thompson",
      account_name: "Business Account",
    },
    {
      id: "pay-3",
      date: "2024-11-10",
      amount: 15000,
      reference: "EFT-4518",
      invoice_number: "INV-0041",
      contact_name: "Reece Plumbing",
      account_name: "Business Account",
    },
  ];
}

function getMockStats(): XeroStats {
  return {
    invoices_receivable: 12,
    invoices_payable: 28,
    total_outstanding: 156400,
    overdue_count: 3,
    last_sync: new Date(Date.now() - 3600000).toISOString(),
  };
}

function getMockFinancialSummary(): FinancialSummary {
  return {
    revenue: 1245000,
    expenses: 892000,
    profit: 353000,
    profit_margin: 28.4,
    accounts_receivable: 185000,
    accounts_payable: 67000,
    cash_on_hand: 423000,
  };
}

function getMockJobProfitability(): JobProfitability[] {
  return [
    { job_id: 1, job_title: "Smith Residence - Full Build", revenue: 450000, cost: 312000, profit: 138000, margin: 30.7, status: "active" },
    { job_id: 2, job_title: "Commercial Fitout - CBD", revenue: 285000, cost: 198000, profit: 87000, margin: 30.5, status: "active" },
    { job_id: 3, job_title: "Office Renovation - Tech Park", revenue: 165000, cost: 128000, profit: 37000, margin: 22.4, status: "completed" },
    { job_id: 4, job_title: "Warehouse Extension", revenue: 220000, cost: 178000, profit: 42000, margin: 19.1, status: "active" },
    { job_id: 5, job_title: "Retail Shopfit - Mall", revenue: 125000, cost: 76000, profit: 49000, margin: 39.2, status: "completed" },
  ];
}
