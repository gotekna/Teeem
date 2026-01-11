"use client";

import * as React from "react";
import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Building2,
  Briefcase,
  CreditCard,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Wallet,
  PiggyBank,
  Calculator,
  FileSpreadsheet,
  Scale,
  Banknote,
  ChevronRight,
  Phone,
  Mail,
  AlertCircle,
  CircleDollarSign,
  ArrowRight,
  Eye,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  TrendingUp as TrendUp,
  FileCheck,
  ExternalLink,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { cn, safePercent } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface Company {
  id: number;
  name: string;
  entity_type: string;
  xero_connected: boolean;
}

interface DashboardSummary {
  revenue: number;
  revenue_change: number;
  expenses: number;
  expenses_change: number;
  profit: number;
  profit_margin: number;
  cash_on_hand: number;
  accounts_receivable: number;
  accounts_payable: number;
  overdue_receivables: number;
  overdue_payables: number;
}

interface BankAccount {
  id: number;
  name: string;
  account_number: string;
  balance: number;
  unreconciled_count: number;
  last_reconciled: string | null;
}

interface AgedBucket {
  label: string;
  amount: number;
  count: number;
  percent: number;
}

interface AgedSummary {
  total: number;
  overdue: number;
  overdue_percent: number;
  average_days: number;
  aging: AgedBucket[];
}

interface AgedContact {
  contact_id: number;
  contact_name: string;
  total: number;
  current: number;
  overdue: number;
  oldest_days: number;
  phone?: string;
  email?: string;
}

interface CashFlowWeek {
  week_start: string;
  week_end: string;
  inflows: number;
  outflows: number;
  net: number;
  running_balance: number;
}

interface BasPeriod {
  period: string;
  financial_year: string;
  label: string;
  start_date: string;
  end_date: string;
  due_date: string;
  status: string;
}

interface BasData {
  gst_collected: number;
  gst_paid: number;
  net_gst: number;
  total_sales: number;
  total_purchases: number;
  payg_withholding: number;
  payg_instalment: number;
  total_payable: number;
}

interface JobProfitability {
  job_id: number;
  job_title: string;
  job_number: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  status: string;
  budget: number;
  budget_variance: number;
}

interface XeroSyncStatus {
  connected: boolean;
  display_status: "connected" | "warning" | "error" | "disconnected";
  message: string;
  xero_tenant_name: string | null;
  last_sync_at: string | null;
  days_since_sync: number;
  needs_attention: boolean;
  action_required: string | null;
  counts?: {
    contacts: number;
    invoices: number;
    bills: number;
    bank_accounts: number;
    gl_accounts: number; // SSoT: from Gl::Account table, matches GL page
  };
}

// API Response Types (flexible to handle different backend response formats)
interface DashboardApiResponse {
  kpis?: {
    revenue?: { ytd?: number; mtd?: number; trend?: number };
    expenses?: { ytd?: number; mtd?: number; trend?: number };
    net_profit?: { ytd?: number; mtd?: number; margin?: number };
    cash?: { balance?: number; change_mtd?: number };
    receivables?: { balance?: number; overdue?: number };
    payables?: { balance?: number; due_soon?: number };
  };
  [key: string]: unknown;
}

interface BankAccountApiResponse {
  id: number;
  name: string;
  code?: string;
  balance?: number;
  unreconciled_count?: number;
  last_reconciled?: string | null;
  [key: string]: unknown;
}

interface AgingApiResponse {
  bucket?: string;
  label?: string;
  amount?: number;
  count?: number;
  percent?: number;
}

interface AgedReportApiResponse {
  summary?: {
    total?: number;
    overdue?: number;
    overdue_percent?: number;
    average_days?: number;
  };
  aging?: AgingApiResponse[];
  [key: string]: unknown;
}

interface AgedContactApiResponse {
  contact_id: number;
  contact_name: string;
  total?: number;
  current?: number;
  overdue?: number;
  oldest_invoice_days?: number;
  oldest_bill_days?: number;
  oldest_days?: number;
  phone?: string;
  email?: string;
  [key: string]: unknown;
}

interface CashFlowWeekApiResponse {
  week_start: string;
  week_end: string;
  inflows?: number;
  outflows?: number;
  total_inflows?: number;
  total_outflows?: number;
  net?: number;
  net_flow?: number;
  running_balance?: number;
  closing_balance?: number;
  [key: string]: unknown;
}

interface BasPeriodApiResponse {
  period: string;
  financial_year: string;
  label: string;
  start_date: string;
  end_date: string;
  due_date: string;
  status: string;
}

interface BasDataApiResponse {
  gst?: {
    collected?: number;
    paid?: number;
    net?: number;
    total_sales?: number;
    total_purchases?: number;
  };
  payg?: {
    withholding?: number;
    instalment?: number;
  };
  gst_on_sales?: number;
  gst_on_purchases?: number;
  net_gst?: number;
  total_sales?: number;
  total_purchases?: number;
  payg_withholding?: number;
  payg_instalment?: number;
  total_payable?: number;
  [key: string]: unknown;
}

interface JobApiResponse {
  id?: number;
  job_id?: number;
  number?: string;
  job_number?: string;
  name?: string;
  title?: string;
  job_title?: string;
  revenue?: number;
  actual_revenue?: number;
  cost?: number;
  actual_cost?: number;
  profit?: number;
  gross_profit?: number;
  margin?: number;
  profit_margin?: number;
  status?: string;
  budget?: number;
  budgeted_revenue?: number;
  budget_variance?: number;
  variance?: number;
  [key: string]: unknown;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 1000000) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  subValue,
  subLabel,
  onClick,
}: {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: "up" | "down" | "neutral";
  subValue?: string;
  subLabel?: string;
  onClick?: () => void;
}) {
  return (
    <Card className={cn("transition-all", onClick && "cursor-pointer hover:shadow-md hover:border-primary/50")} onClick={onClick}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
            {change !== undefined && (
              <div className={cn(
                "flex items-center gap-1 text-sm",
                trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"
              )}>
                {trend === "up" ? <ArrowUpRight className="h-4 w-4" /> :
                 trend === "down" ? <ArrowDownRight className="h-4 w-4" /> : null}
                {formatPercent(change)} {changeLabel}
              </div>
            )}
            {subValue && (
              <p className="text-xs text-muted-foreground">
                {subLabel}: <span className="font-mono">{subValue}</span>
              </p>
            )}
          </div>
          <div className={cn("p-3 rounded-xl", iconBg)}>
            <Icon className={cn("h-6 w-6", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AgingBar({ aging, colorClass }: { aging: AgedBucket[]; colorClass: string }) {
  const colors = {
    green: ["bg-green-500", "bg-green-400", "bg-yellow-400", "bg-orange-400", "bg-red-500"],
    blue: ["bg-blue-500", "bg-blue-400", "bg-yellow-400", "bg-orange-400", "bg-red-500"],
  };
  const palette = colors[colorClass as keyof typeof colors] || colors.green;

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden">
        {aging.map((bucket, i) => (
          <div
            key={bucket.label}
            className={cn(palette[i], "transition-all")}
            style={{ width: `${bucket.percent}%` }}
            title={`${bucket.label}: ${formatCurrency(bucket.amount)} (${safePercent(bucket.percent)})`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {aging.map((bucket, i) => (
          <div key={bucket.label} className="flex items-center gap-1">
            <div className={cn("w-2 h-2 rounded-full", palette[i])} />
            <span>{bucket.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FollowUpPriority({ days, amount }: { days: number; amount: number }) {
  let priority = "low";
  let color = "bg-green-100 text-green-700";
  let action = "Friendly reminder";

  if (days > 90 || amount > 10000) {
    priority = "critical";
    color = "bg-red-100 text-red-700";
    action = "Urgent: Consider debt collection";
  } else if (days > 60 || amount > 5000) {
    priority = "high";
    color = "bg-orange-100 text-orange-700";
    action = "Send formal demand letter";
  } else if (days > 30) {
    priority = "medium";
    color = "bg-yellow-100 text-yellow-700";
    action = "Phone call follow-up";
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className={color}>{priority}</Badge>
      <span className="text-xs text-muted-foreground">{action}</span>
    </div>
  );
}

function XeroSyncStatusCard({
  status,
  companyId,
}: {
  status: XeroSyncStatus;
  companyId: string;
}) {
  const statusColor = {
    connected: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
    warning: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    error: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
    disconnected: "bg-muted dark:bg-gray-900/30 text-foreground dark:text-muted-foreground border-border dark:border-border",
  };

  const statusIcon = {
    connected: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
    error: <AlertCircle className="h-5 w-5 text-red-600" />,
    disconnected: <AlertCircle className="h-5 w-5 text-muted-foreground" />,
  };

  return (
    <Card className={cn("border", statusColor[status.display_status])}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {statusIcon[status.display_status]}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Xero Integration</span>
                {status.xero_tenant_name && (
                  <span className="text-sm text-muted-foreground">({status.xero_tenant_name})</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-normal",
                    status.display_status === "connected" && "border-green-500 text-green-700",
                    status.display_status === "warning" && "border-yellow-500 text-yellow-700",
                    status.display_status === "error" && "border-red-500 text-red-700",
                    status.display_status === "disconnected" && "border-border text-muted-foreground"
                  )}
                >
                  {status.connected ? "Connected" : "Disconnected"}
                </Badge>
                {status.last_sync_at && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Last sync: {formatDate(status.last_sync_at)}
                  </span>
                )}
                {status.needs_attention && (
                  <Badge variant="destructive" className="animate-pulse">
                    Needs Attention
                  </Badge>
                )}
              </div>
              {status.counts && (
                <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {status.counts.gl_accounts} GL Accounts
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {status.counts.contacts} Contacts
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {status.counts.invoices} Invoices
                  </span>
                  <span className="flex items-center gap-1">
                    <Receipt className="h-3 w-3" />
                    {status.counts.bills} Bills
                  </span>
                  <span className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    {status.counts.bank_accounts} Bank Accounts
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/corporate/companies/${companyId}/xero`}>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Manage Xero
              </Button>
            </Link>
            <Link href="/financial/tas">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <Briefcase className="h-4 w-4 mr-1" />
                T.A.S.
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Tab Components
// ============================================================================

function DashboardTab({
  summary,
  jobs,
  onNavigate,
}: {
  summary: DashboardSummary | null;
  jobs: JobProfitability[];
  onNavigate: (tab: string) => void;
}) {
  if (!summary) return <Spinner size={32} className="mx-auto" />;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Revenue"
          value={formatCurrency(summary.revenue)}
          change={summary.revenue_change}
          changeLabel="vs last period"
          icon={TrendingUp}
          iconBg="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600"
          trend={summary.revenue_change >= 0 ? "up" : "down"}
        />
        <StatCard
          title="Expenses"
          value={formatCurrency(summary.expenses)}
          change={summary.expenses_change}
          changeLabel="vs last period"
          icon={TrendingDown}
          iconBg="bg-red-100 dark:bg-red-900/30"
          iconColor="text-red-600"
          trend={summary.expenses_change <= 0 ? "up" : "down"}
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(summary.profit)}
          icon={DollarSign}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600"
          subValue={safePercent(summary.profit_margin)}
          subLabel="Margin"
        />
        <StatCard
          title="Cash Position"
          value={formatCurrency(summary.cash_on_hand)}
          icon={Wallet}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600"
          onClick={() => onNavigate("bank")}
        />
      </div>

      {/* AR/AP Quick View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => onNavigate("aged")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Accounts Receivable</CardTitle>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono">{formatCurrency(summary.accounts_receivable)}</span>
              {summary.overdue_receivables > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {formatCurrency(summary.overdue_receivables)} overdue
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">From customers owing you money</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => onNavigate("aged")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Accounts Payable</CardTitle>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono">{formatCurrency(summary.accounts_payable)}</span>
              {summary.overdue_payables > 0 && (
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                  {formatCurrency(summary.overdue_payables)} overdue
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">You owe to suppliers</p>
          </CardContent>
        </Card>
      </div>

      {/* Job Profitability */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Job Profitability</CardTitle>
              <CardDescription>Real-time profit tracking by job</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              View All Jobs
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
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
                <TableHead className="text-right">Budget Var</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.slice(0, 5).map((job) => (
                <TableRow key={job.job_id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <p className="font-medium">{job.job_title}</p>
                      <p className="text-xs text-muted-foreground">{job.job_number}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(job.revenue)}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(job.cost)}</TableCell>
                  <TableCell className="text-right font-mono text-green-600">{formatCurrency(job.profit)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={job.margin >= 25 ? "default" : job.margin >= 15 ? "secondary" : "destructive"}>
                      {safePercent(job.margin)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn("font-mono text-sm", job.budget_variance >= 0 ? "text-green-600" : "text-red-600")}>
                      {job.budget_variance >= 0 ? "+" : ""}{formatCurrency(job.budget_variance)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Reconcile Bank", icon: CreditCard, onClick: () => onNavigate("bank"), color: "text-blue-600" },
          { label: "Prepare BAS", icon: Calculator, onClick: () => onNavigate("bas"), color: "text-purple-600" },
          { label: "Cash Flow Forecast", icon: TrendUp, onClick: () => onNavigate("cashflow"), color: "text-emerald-600" },
          { label: "Download Reports", icon: Download, onClick: () => onNavigate("reports"), color: "text-orange-600" },
        ].map((action) => (
          <Card
            key={action.label}
            className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
            onClick={action.onClick}
          >
            <CardContent className="pt-6 pb-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <action.icon className={cn("h-8 w-8", action.color)} />
                <span className="text-sm font-medium">{action.label}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BankReconciliationTab({ accounts }: { accounts: BankAccount[] }) {
  const [selectedAccount, setSelectedAccount] = React.useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Bank Reconciliation</h2>
          <p className="text-sm text-muted-foreground">Match bank transactions with your records</p>
        </div>
        <Button>
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync Bank Feeds
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <Card
            key={account.id}
            className={cn(
              "cursor-pointer transition-all",
              selectedAccount === account.id ? "ring-2 ring-primary" : "hover:shadow-md"
            )}
            onClick={() => setSelectedAccount(account.id)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">***{account.account_number.slice(-4)}</p>
                </div>
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold font-mono">{formatCurrency(account.balance)}</p>
                {account.unreconciled_count > 0 ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      {account.unreconciled_count} to reconcile
                    </Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Fully reconciled
                  </div>
                )}
                {account.last_reconciled && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last reconciled: {formatDate(account.last_reconciled)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Workspace</CardTitle>
            <CardDescription>Match bank transactions with invoices and bills</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select transactions to reconcile</p>
              <Button className="mt-4">Start Reconciliation</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AgedReportsTab({
  receivables,
  payables,
  receivablesContacts,
  payablesContacts,
  selectedCompany,
}: {
  receivables: AgedSummary | null;
  payables: AgedSummary | null;
  receivablesContacts: AgedContact[];
  payablesContacts: AgedContact[];
  selectedCompany: string;
}) {
  // Simple React state for subtab (not in URL - internal navigation)
  const [activeTab, setActiveTab] = React.useState("receivables");

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  const [selectedPayables, setSelectedPayables] = React.useState<Set<number>>(new Set());
  const [processingPayment, setProcessingPayment] = React.useState(false);
  const [generatingAba, setGeneratingAba] = React.useState(false);

  // Toggle selection for a payable contact
  const togglePayableSelection = (contactId: number) => {
    setSelectedPayables((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  // Select/deselect all payables
  const toggleAllPayables = () => {
    if (selectedPayables.size === payablesContacts.length) {
      setSelectedPayables(new Set());
    } else {
      setSelectedPayables(new Set(payablesContacts.map((c) => c.contact_id)));
    }
  };

  // Get total amount for selected payables
  const selectedTotal = React.useMemo(() => {
    return payablesContacts
      .filter((c) => selectedPayables.has(c.contact_id))
      .reduce((sum, c) => sum + c.total, 0);
  }, [payablesContacts, selectedPayables]);

  // Create payment batch and generate ABA file
  const handleCreateBankFile = async () => {
    if (selectedPayables.size === 0) return;

    setGeneratingAba(true);
    try {
      const companyId = selectedCompany !== "all" ? selectedCompany : "1";

      // Create a new payment batch
      const batchRes = await api.post<{ success: boolean; data: { id: number } }>(
        `/api/v1/companies/${companyId}/bill_payment_batches`,
        {
          description: `Payment batch ${new Date().toLocaleDateString("en-AU")}`,
          payment_date: new Date().toISOString().split("T")[0],
          contact_ids: Array.from(selectedPayables),
        }
      );

      if (batchRes?.success && batchRes.data?.id) {
        const batchId = batchRes.data.id;

        // Generate ABA file
        await api.post(`/api/v1/companies/${companyId}/bill_payment_batches/${batchId}/generate_aba`);

        // Download the ABA file
        window.open(`/api/v1/companies/${companyId}/bill_payment_batches/${batchId}/download_aba`, "_blank");

        setSelectedPayables(new Set());
      }
    } catch (error) {
      console.error("Error creating bank file:", error);
    } finally {
      setGeneratingAba(false);
    }
  };

  // Pay selected bills
  const handlePaySelected = async () => {
    if (selectedPayables.size === 0) return;

    setProcessingPayment(true);
    try {
      const companyId = selectedCompany !== "all" ? selectedCompany : "1";

      // Create a payment batch for review
      const batchRes = await api.post<{ success: boolean; data: { id: number } }>(
        `/api/v1/companies/${companyId}/bill_payment_batches`,
        {
          description: `Payment batch ${new Date().toLocaleDateString("en-AU")}`,
          payment_date: new Date().toISOString().split("T")[0],
          contact_ids: Array.from(selectedPayables),
        }
      );

      if (batchRes?.success && batchRes.data?.id) {
        // Navigate to payment batch for review/approval
        window.location.href = `/financial/payments/${batchRes.data.id}`;
      }
    } catch (error) {
      console.error("Error creating payment batch:", error);
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="receivables" className="gap-2">
            <Users className="h-4 w-4" />
            Receivables (AR)
          </TabsTrigger>
          <TabsTrigger value="payables" className="gap-2">
            <Receipt className="h-4 w-4" />
            Payables (AP)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="space-y-6">
          {receivables && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Receivables"
                  value={formatCurrency(receivables.total)}
                  icon={DollarSign}
                  iconBg="bg-blue-100 dark:bg-blue-900/30"
                  iconColor="text-blue-600"
                />
                <StatCard
                  title="Overdue"
                  value={formatCurrency(receivables.overdue)}
                  icon={AlertTriangle}
                  iconBg="bg-red-100 dark:bg-red-900/30"
                  iconColor="text-red-600"
                  subValue={safePercent(receivables.overdue_percent)}
                  subLabel="Of total"
                />
                <StatCard
                  title="Average Days"
                  value={`${(receivables.average_days ?? 0).toFixed(0)} days`}
                  icon={Clock}
                  iconBg="bg-yellow-100 dark:bg-yellow-900/30"
                  iconColor="text-yellow-600"
                />
                <StatCard
                  title="Current"
                  value={formatCurrency(receivables.total - receivables.overdue)}
                  icon={CheckCircle2}
                  iconBg="bg-green-100 dark:bg-green-900/30"
                  iconColor="text-green-600"
                />
              </div>

              {/* Aging Bar */}
              <Card>
                <CardHeader>
                  <CardTitle>Aging Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <AgingBar aging={receivables.aging} colorClass="green" />
                  <div className="grid grid-cols-5 gap-4 mt-4">
                    {receivables.aging.map((bucket) => (
                      <div key={bucket.label} className="text-center">
                        <p className="text-lg font-bold font-mono">{formatCurrency(bucket.amount, true)}</p>
                        <p className="text-xs text-muted-foreground">{bucket.count} invoices</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Customer List */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>By Customer</CardTitle>
                      <CardDescription>Follow up on overdue invoices</CardDescription>
                    </div>
                    <Button variant="outline" size="sm">
                      <Mail className="h-4 w-4 mr-2" />
                      Send Reminders
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">Overdue</TableHead>
                        <TableHead className="text-right">Oldest</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receivablesContacts.map((contact) => (
                        <TableRow key={contact.contact_id}>
                          <TableCell>
                            <div>
                              <Link
                                href={`/contacts/${contact.contact_id}`}
                                className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                              >
                                {contact.contact_name}
                                <ExternalLink className="h-3 w-3 opacity-50" />
                              </Link>
                              {contact.phone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {contact.phone}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(contact.total)}</TableCell>
                          <TableCell className="text-right font-mono text-green-600">{formatCurrency(contact.current)}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">{formatCurrency(contact.overdue)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={contact.oldest_days > 60 ? "destructive" : contact.oldest_days > 30 ? "outline" : "secondary"}>
                              {contact.oldest_days} days
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <FollowUpPriority days={contact.oldest_days} amount={contact.overdue} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="payables" className="space-y-6">
          {payables && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Payables"
                  value={formatCurrency(payables.total)}
                  icon={Receipt}
                  iconBg="bg-purple-100 dark:bg-purple-900/30"
                  iconColor="text-purple-600"
                />
                <StatCard
                  title="Overdue"
                  value={formatCurrency(payables.overdue)}
                  icon={AlertTriangle}
                  iconBg="bg-red-100 dark:bg-red-900/30"
                  iconColor="text-red-600"
                  subValue={safePercent(payables.overdue_percent)}
                  subLabel="Of total"
                />
                <StatCard
                  title="Average Days"
                  value={`${(payables.average_days ?? 0).toFixed(0)} days`}
                  icon={Clock}
                  iconBg="bg-yellow-100 dark:bg-yellow-900/30"
                  iconColor="text-yellow-600"
                />
                <StatCard
                  title="Due This Week"
                  value={formatCurrency(payables.aging[1]?.amount || 0)}
                  icon={Calendar}
                  iconBg="bg-orange-100 dark:bg-orange-900/30"
                  iconColor="text-orange-600"
                />
              </div>

              {/* Aging Bar */}
              <Card>
                <CardHeader>
                  <CardTitle>Aging Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <AgingBar aging={payables.aging} colorClass="blue" />
                  <div className="grid grid-cols-5 gap-4 mt-4">
                    {payables.aging.map((bucket) => (
                      <div key={bucket.label} className="text-center">
                        <p className="text-lg font-bold font-mono">{formatCurrency(bucket.amount, true)}</p>
                        <p className="text-xs text-muted-foreground">{bucket.count} bills</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Supplier List */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>By Supplier</CardTitle>
                      <CardDescription>Select suppliers to pay and generate bank file</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedPayables.size > 0 && (
                        <Badge variant="secondary" className="text-sm">
                          {selectedPayables.size} selected • {formatCurrency(selectedTotal)}
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePaySelected}
                        disabled={selectedPayables.size === 0 || processingPayment}
                      >
                        {processingPayment ? (
                          <Spinner size={16} className="mr-2" />
                        ) : (
                          <Banknote className="h-4 w-4 mr-2" />
                        )}
                        Pay Selected
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreateBankFile}
                        disabled={selectedPayables.size === 0 || generatingAba}
                      >
                        {generatingAba ? (
                          <Spinner size={16} className="mr-2" />
                        ) : (
                          <FileCheck className="h-4 w-4 mr-2" />
                        )}
                        Create Bank File
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedPayables.size === payablesContacts.length && payablesContacts.length > 0}
                            onCheckedChange={toggleAllPayables}
                            aria-label="Select all suppliers"
                          />
                        </TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">Overdue</TableHead>
                        <TableHead className="text-right">Oldest</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payablesContacts.map((contact) => (
                        <TableRow
                          key={contact.contact_id}
                          className={cn(
                            selectedPayables.has(contact.contact_id) && "bg-primary/5"
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedPayables.has(contact.contact_id)}
                              onCheckedChange={() => togglePayableSelection(contact.contact_id)}
                              aria-label={`Select ${contact.contact_name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/contacts/${contact.contact_id}`}
                              className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {contact.contact_name}
                              <ExternalLink className="h-3 w-3 opacity-50" />
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(contact.total)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(contact.current)}</TableCell>
                          <TableCell className="text-right font-mono text-red-600">{formatCurrency(contact.overdue)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={contact.oldest_days > 60 ? "destructive" : "secondary"}>
                              {contact.oldest_days} days
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CashFlowTab({ forecast }: { forecast: CashFlowWeek[] }) {
  const minBalance = Math.min(...forecast.map((w) => w.running_balance));
  const hasWarning = minBalance < 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Cash Flow Forecast</h2>
          <p className="text-sm text-muted-foreground">90-day projection based on AR/AP due dates</p>
        </div>
        <Select defaultValue="90">
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 Days</SelectItem>
            <SelectItem value="60">60 Days</SelectItem>
            <SelectItem value="90">90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasWarning && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-700">Cash Flow Warning</p>
                <p className="text-sm text-red-600 mt-1">
                  Your projected cash balance goes negative. Consider delaying payments or accelerating collections.
                </p>
                <Button variant="outline" size="sm" className="mt-3 border-red-300 text-red-700 hover:bg-red-100">
                  View Recommendations
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Weekly Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead className="text-right">Inflows</TableHead>
                <TableHead className="text-right">Outflows</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecast.map((week, i) => (
                <TableRow key={i} className={week.running_balance < 0 ? "bg-red-50 dark:bg-red-900/20" : ""}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{formatDate(week.week_start)}</p>
                      <p className="text-xs text-muted-foreground">to {formatDate(week.week_end)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-green-600">+{formatCurrency(week.inflows)}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">-{formatCurrency(week.outflows)}</TableCell>
                  <TableCell className="text-right">
                    <span className={cn("font-mono", week.net >= 0 ? "text-green-600" : "text-red-600")}>
                      {week.net >= 0 ? "+" : ""}{formatCurrency(week.net)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn("font-mono font-bold", week.running_balance >= 0 ? "text-foreground" : "text-red-600")}>
                      {formatCurrency(week.running_balance)}
                    </span>
                    {week.running_balance < 0 && <AlertTriangle className="h-4 w-4 text-red-500 inline ml-2" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function BasTaxTab({ periods, basData }: { periods: BasPeriod[]; basData: BasData | null }) {
  const [selectedPeriod, setSelectedPeriod] = React.useState(periods[0]?.label || "");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">BAS Preparation</h2>
          <p className="text-sm text-muted-foreground">Business Activity Statement for GST and PAYG</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.label} value={p.label}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export BAS
          </Button>
        </div>
      </div>

      {basData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GST Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                GST Section
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">G1 - Total Sales (incl GST)</span>
                  <span className="font-mono font-medium">{formatCurrency(basData.total_sales)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">1A - GST on Sales</span>
                  <span className="font-mono font-medium">{formatCurrency(basData.gst_collected)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">1B - GST on Purchases</span>
                  <span className="font-mono font-medium">{formatCurrency(basData.gst_paid)}</span>
                </div>
                <div className="flex justify-between py-2 bg-muted/50 px-3 rounded-lg">
                  <span className="font-semibold">Net GST Payable</span>
                  <span className={cn("font-mono font-bold", basData.net_gst >= 0 ? "text-red-600" : "text-green-600")}>
                    {basData.net_gst >= 0 ? "" : "-"}{formatCurrency(Math.abs(basData.net_gst))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PAYG Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                PAYG Section
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">W1 - Total Wages</span>
                  <span className="font-mono font-medium">{formatCurrency(basData.payg_withholding / 0.3)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">W2 - Tax Withheld</span>
                  <span className="font-mono font-medium">{formatCurrency(basData.payg_withholding)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">T9 - PAYG Instalment</span>
                  <span className="font-mono font-medium">{formatCurrency(basData.payg_instalment)}</span>
                </div>
                <div className="flex justify-between py-2 bg-muted/50 px-3 rounded-lg">
                  <span className="font-semibold">Total PAYG</span>
                  <span className="font-mono font-bold text-red-600">
                    {formatCurrency(basData.payg_withholding + basData.payg_instalment)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Summary */}
          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount Payable to ATO</p>
                  <p className="text-3xl font-bold font-mono mt-1">{formatCurrency(basData.total_payable)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Lodge with ATO
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ReportsTab() {
  const reports = [
    { title: "Profit & Loss Statement", description: "Income and expenses summary", icon: BarChart3, category: "Financial" },
    { title: "Balance Sheet", description: "Assets, liabilities, and equity", icon: Scale, category: "Financial" },
    { title: "Trial Balance", description: "All account balances", icon: FileSpreadsheet, category: "Financial" },
    { title: "Cash Flow Statement", description: "Cash movements", icon: Banknote, category: "Financial" },
    { title: "Aged Receivables", description: "Outstanding customer invoices", icon: Users, category: "AR/AP" },
    { title: "Aged Payables", description: "Outstanding supplier bills", icon: Receipt, category: "AR/AP" },
    { title: "GST Summary", description: "GST collected vs paid", icon: Calculator, category: "Tax" },
    { title: "BAS Report", description: "Business Activity Statement", icon: FileText, category: "Tax" },
    { title: "Job Profitability", description: "Profit by job", icon: Briefcase, category: "Jobs" },
    { title: "Chart of Accounts", description: "Account listing", icon: FileSpreadsheet, category: "Setup" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Financial Reports</h2>
          <p className="text-sm text-muted-foreground">Generate and export reports</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Accountant Package
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <Card key={report.title} className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-secondary rounded-lg">
                  <report.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{report.title}</h3>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                  <Badge variant="outline" className="mt-2 text-xs">{report.category}</Badge>
                </div>
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function FinancialPage() {
  const router = useRouter();
  const pathname = usePathname();

  // SSoT: Parse path segments for state
  // Pattern: /financial/[tab]/company/[companyId]
  const pathSegments = React.useMemo(() => {
    const parts = pathname.replace("/financial", "").split("/").filter(Boolean);
    const KNOWN_TABS = ["dashboard", "bank", "aged", "cashflow", "bas", "reports"];

    // Find tab (first segment if it's a known tab)
    const tab = KNOWN_TABS.includes(parts[0]) ? parts[0] : "dashboard";

    // Find company ID (after "company" segment)
    const companyIndex = parts.indexOf("company");
    const company = companyIndex >= 0 && parts[companyIndex + 1]
      ? parts[companyIndex + 1]
      : "all";

    return { tab, company };
  }, [pathname]);

  const activeTab = pathSegments.tab;
  const selectedCompany = pathSegments.company;

  const handleTabChange = useCallback((tabId: string) => {
    // Build new path with tab and preserve company filter
    let path = `/financial/${tabId === "dashboard" ? "" : tabId}`;
    if (selectedCompany !== "all") {
      path += `/company/${selectedCompany}`;
    }
    router.push(path, { scroll: false });
  }, [router, selectedCompany]);

  // URL is SSoT for company selection (enables shareable links)
  const handleCompanyChange = useCallback((newCompanyId: string) => {
    const tabPath = activeTab === "dashboard" ? "" : activeTab;
    if (newCompanyId === "all") {
      router.push(`/financial/${tabPath}`, { scroll: false });
    } else {
      router.push(`/financial/${tabPath}/company/${newCompanyId}`, { scroll: false });
    }
  }, [router, activeTab]);

  // State
  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);

  // Data State
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [jobs, setJobs] = React.useState<JobProfitability[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);
  const [receivables, setReceivables] = React.useState<AgedSummary | null>(null);
  const [payables, setPayables] = React.useState<AgedSummary | null>(null);
  const [receivablesContacts, setReceivablesContacts] = React.useState<AgedContact[]>([]);
  const [payablesContacts, setPayablesContacts] = React.useState<AgedContact[]>([]);
  const [cashForecast, setCashForecast] = React.useState<CashFlowWeek[]>([]);
  const [basPeriods, setBasPeriods] = React.useState<BasPeriod[]>([]);
  const [basData, setBasData] = React.useState<BasData | null>(null);
  const [xeroSyncStatus, setXeroSyncStatus] = React.useState<XeroSyncStatus | null>(null);

  // Fetch data from real GL API endpoints
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const companyParam = selectedCompany !== "all" ? `?corporate_company_id=${selectedCompany}` : "";

    try {
      // Fetch companies list
      const companiesRes = await api.get<{ success: boolean; companies: Company[] }>("/api/v1/companies").catch(() => null);
      if (companiesRes?.companies) {
        setCompanies(companiesRes.companies);
      }

      // Fetch all GL data in parallel
      const [
        dashboardRes,
        bankAccountsRes,
        receivablesRes,
        payablesRes,
        receivablesCustomersRes,
        payablesSuppliersRes,
        cashFlowRes,
        basPeriodsRes,
        basDataRes,
        jobsRes,
      ] = await Promise.all([
        api.get<{ success: boolean; data: DashboardApiResponse }>(`/api/v1/gl/dashboard${companyParam}`).catch(() => null),
        api.get<{ success: boolean; data: { accounts: BankAccountApiResponse[] } }>(`/api/v1/gl/dashboard/bank_accounts${companyParam}`).catch(() => null),
        api.get<{ success: boolean; data: AgedReportApiResponse }>(`/api/v1/gl/aged_reports/receivables${companyParam}`).catch(() => null),
        api.get<{ success: boolean; data: AgedReportApiResponse }>(`/api/v1/gl/aged_reports/payables${companyParam}`).catch(() => null),
        api.get<{ success: boolean; data: AgedContactApiResponse[] }>(`/api/v1/gl/aged_reports/receivables/by_customer${companyParam}`).catch(() => null),
        api.get<{ success: boolean; data: AgedContactApiResponse[] }>(`/api/v1/gl/aged_reports/payables/by_supplier${companyParam}`).catch(() => null),
        api.get<{ success: boolean; data: { weeks: CashFlowWeekApiResponse[] } }>(`/api/v1/gl/cash_flow/weekly${companyParam}`).catch(() => null),
        api.get<{ success: boolean; data: { periods: BasPeriodApiResponse[] } }>(`/api/v1/gl/bas/periods${companyParam}`).catch(() => null),
        api.get<{ success: boolean; data: BasDataApiResponse }>(`/api/v1/gl/bas${companyParam}`).catch(() => null),
        api.get<{ success: boolean; data: { jobs: JobApiResponse[] } }>(`/api/v1/gl/job_costing/summary${companyParam}`).catch(() => null),
      ]);

      // Process Dashboard data
      if (dashboardRes?.success && dashboardRes.data) {
        const d = dashboardRes.data;
        const kpis = d.kpis || {};
        setSummary({
          revenue: kpis.revenue?.ytd || 0,
          revenue_change: kpis.revenue?.trend || 0,
          expenses: kpis.expenses?.ytd || 0,
          expenses_change: kpis.expenses?.trend || 0,
          profit: kpis.net_profit?.ytd || 0,
          profit_margin: kpis.net_profit?.margin || 0,
          cash_on_hand: kpis.cash?.balance || 0,
          accounts_receivable: kpis.receivables?.balance || 0,
          accounts_payable: kpis.payables?.balance || 0,
          overdue_receivables: kpis.receivables?.overdue || 0,
          overdue_payables: kpis.payables?.due_soon || 0,
        });
      } else {
        // SSoT: No fallback data - show zeros if API fails
        setSummary({
          revenue: 0, revenue_change: 0, expenses: 0, expenses_change: 0,
          profit: 0, profit_margin: 0, cash_on_hand: 0,
          accounts_receivable: 0, accounts_payable: 0,
          overdue_receivables: 0, overdue_payables: 0,
        });
      }

      // Process Bank Accounts
      if (bankAccountsRes?.success && bankAccountsRes.data?.accounts) {
        setBankAccounts(bankAccountsRes.data.accounts.map((a: BankAccountApiResponse) => ({
          id: a.id,
          name: a.name,
          account_number: a.code || "****",
          balance: a.balance || 0,
          unreconciled_count: a.unreconciled_count || 0,
          last_reconciled: a.last_reconciled || null,
        })));
      } else {
        // SSoT: No fallback data
        setBankAccounts([]);
      }

      // Process Receivables
      if (receivablesRes?.success && receivablesRes.data) {
        const r = receivablesRes.data;
        setReceivables({
          total: r.summary?.total || 0,
          overdue: r.summary?.overdue || 0,
          overdue_percent: r.summary?.overdue_percent || 0,
          average_days: r.summary?.average_days || 0,
          aging: (r.aging || []).map((a: AgingApiResponse) => ({
            label: a.label || a.bucket || "Unknown",
            amount: a.amount || 0,
            count: a.count || 0,
            percent: a.percent || 0,
          })),
        });
      } else {
        // SSoT: No fallback data
        setReceivables({ total: 0, overdue: 0, overdue_percent: 0, average_days: 0, aging: [] });
      }

      // Process Payables
      if (payablesRes?.success && payablesRes.data) {
        const p = payablesRes.data;
        setPayables({
          total: p.summary?.total || 0,
          overdue: p.summary?.overdue || 0,
          overdue_percent: p.summary?.overdue_percent || 0,
          average_days: p.summary?.average_days || 0,
          aging: (p.aging || []).map((a: AgingApiResponse) => ({
            label: a.label || a.bucket || "Unknown",
            amount: a.amount || 0,
            count: a.count || 0,
            percent: a.percent || 0,
          })),
        });
      } else {
        // SSoT: No fallback data
        setPayables({ total: 0, overdue: 0, overdue_percent: 0, average_days: 0, aging: [] });
      }

      // Process Receivables by Customer
      if (receivablesCustomersRes?.success && Array.isArray(receivablesCustomersRes.data)) {
        setReceivablesContacts(receivablesCustomersRes.data.map((c: AgedContactApiResponse) => ({
          contact_id: c.contact_id,
          contact_name: c.contact_name,
          total: c.total || 0,
          current: c.current || 0,
          overdue: c.overdue || 0,
          oldest_days: c.oldest_invoice_days || c.oldest_days || 0,
          phone: c.phone,
          email: c.email,
        })));
      } else {
        // SSoT: No fallback data
        setReceivablesContacts([]);
      }

      // Process Payables by Supplier
      if (payablesSuppliersRes?.success && Array.isArray(payablesSuppliersRes.data)) {
        setPayablesContacts(payablesSuppliersRes.data.map((c: AgedContactApiResponse) => ({
          contact_id: c.contact_id,
          contact_name: c.contact_name,
          total: c.total || 0,
          current: c.current || 0,
          overdue: c.overdue || 0,
          oldest_days: c.oldest_bill_days || c.oldest_days || 0,
        })));
      } else {
        // SSoT: No fallback data
        setPayablesContacts([]);
      }

      // Process Cash Flow Forecast
      if (cashFlowRes?.success && cashFlowRes.data?.weeks) {
        setCashForecast(cashFlowRes.data.weeks.map((w: CashFlowWeekApiResponse) => ({
          week_start: w.week_start,
          week_end: w.week_end,
          inflows: w.inflows || w.total_inflows || 0,
          outflows: w.outflows || w.total_outflows || 0,
          net: w.net || w.net_flow || 0,
          running_balance: w.running_balance || w.closing_balance || 0,
        })));
      } else {
        // SSoT: No fallback data
        setCashForecast([]);
      }

      // Process BAS Periods
      if (basPeriodsRes?.success && basPeriodsRes.data?.periods) {
        setBasPeriods(basPeriodsRes.data.periods.map((p: BasPeriodApiResponse) => ({
          period: p.period,
          financial_year: p.financial_year,
          label: p.label,
          start_date: p.start_date,
          end_date: p.end_date,
          due_date: p.due_date,
          status: p.status,
        })));
      } else {
        // SSoT: No fallback data
        setBasPeriods([]);
      }

      // Process BAS Data
      if (basDataRes?.success && basDataRes.data) {
        const b = basDataRes.data;
        setBasData({
          gst_collected: b.gst?.collected || b.gst_on_sales || 0,
          gst_paid: b.gst?.paid || b.gst_on_purchases || 0,
          net_gst: b.gst?.net || b.net_gst || 0,
          total_sales: b.gst?.total_sales || b.total_sales || 0,
          total_purchases: b.gst?.total_purchases || b.total_purchases || 0,
          payg_withholding: b.payg?.withholding || b.payg_withholding || 0,
          payg_instalment: b.payg?.instalment || b.payg_instalment || 0,
          total_payable: b.total_payable || ((b.gst?.net || 0) + (b.payg?.withholding || 0) + (b.payg?.instalment || 0)),
        });
      } else {
        // SSoT: No fallback data
        setBasData({
          gst_collected: 0, gst_paid: 0, net_gst: 0,
          total_sales: 0, total_purchases: 0,
          payg_withholding: 0, payg_instalment: 0, total_payable: 0,
        });
      }

      // Process Jobs
      if (jobsRes?.success && jobsRes.data?.jobs) {
        setJobs(jobsRes.data.jobs.map((j: JobApiResponse) => ({
          job_id: j.job_id || j.id || 0,
          job_number: j.job_number || j.number || "Unknown",
          job_title: j.job_title || j.title || j.name || "Untitled Job",
          revenue: j.revenue || j.actual_revenue || 0,
          cost: j.cost || j.actual_cost || 0,
          profit: j.profit || j.gross_profit || 0,
          margin: j.margin || j.profit_margin || 0,
          status: j.status || "active",
          budget: j.budget || j.budgeted_revenue || 0,
          budget_variance: j.budget_variance || j.variance || 0,
        })));
      } else {
        // SSoT: No fallback data
        setJobs([]);
      }

      // Fetch Xero Sync Status (separate call for specific company)
      if (selectedCompany !== "all") {
        try {
          // API returns status fields at top level (not nested under 'data')
          const xeroStatusRes = await api.get<XeroSyncStatus & { success: boolean }>(`/api/v1/companies/${selectedCompany}/xero/status`);
          if (xeroStatusRes?.success) {
            // Also fetch tab stats for counts (includes GL accounts for SSoT consistency with GL page)
            const tabStatsRes = await api.get<{ success: boolean; contacts?: number; invoices?: number; bills?: number; bank_accounts?: number; gl_accounts?: number }>(`/api/v1/companies/${selectedCompany}/xero/tab_stats`).catch(() => null);
            // Extract status fields from response (excluding 'success')
            const { success: _, ...statusData } = xeroStatusRes;
            setXeroSyncStatus({
              ...statusData,
              counts: tabStatsRes?.success ? {
                contacts: tabStatsRes.contacts || 0,
                invoices: tabStatsRes.invoices || 0,
                bills: tabStatsRes.bills || 0,
                bank_accounts: tabStatsRes.bank_accounts || 0,
                gl_accounts: tabStatsRes.gl_accounts || 0, // SSoT: from Gl::Account table
              } : undefined,
            });
          } else {
            setXeroSyncStatus(null);
          }
        } catch {
          setXeroSyncStatus(null);
        }
      } else {
        setXeroSyncStatus(null);
      }

    } catch (error) {
      console.error("Error fetching financial data:", error);
      // Set fallback data on error
      setSummary({
        revenue: 0, revenue_change: 0, expenses: 0, expenses_change: 0,
        profit: 0, profit_margin: 0, cash_on_hand: 0,
        accounts_receivable: 0, accounts_payable: 0,
        overdue_receivables: 0, overdue_payables: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleNavigate = (tab: string) => {
    handleTabChange(tab);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Spinner size={32} className="mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Loading financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Complete accounting overview for your business
          </p>
        </div>
        <div className="flex items-center gap-2">
          {companies.length > 0 && (
            <Select value={selectedCompany} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-[200px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Xero Sync Status */}
      {xeroSyncStatus && selectedCompany !== "all" && (
        <XeroSyncStatusCard
          status={xeroSyncStatus}
          companyId={selectedCompany}
        />
      )}

      {/* Show prompt to select company when "All Companies" is selected */}
      {selectedCompany === "all" && companies.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                  <Briefcase className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium">Select a company to view Xero sync status</p>
                  <p className="text-sm text-muted-foreground">Choose a company from the dropdown to see connection details and access the GL system</p>
                </div>
              </div>
              <Link href="/financial/tas">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                  <Briefcase className="h-4 w-4 mr-1" />
                  T.A.S.
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Bank</span>
          </TabsTrigger>
          <TabsTrigger value="aged" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">AR/AP</span>
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-2">
            <TrendUp className="h-4 w-4" />
            <span className="hidden sm:inline">Cash Flow</span>
          </TabsTrigger>
          <TabsTrigger value="bas" className="gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">BAS</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="dashboard">
            <DashboardTab summary={summary} jobs={jobs} onNavigate={handleNavigate} />
          </TabsContent>

          <TabsContent value="bank">
            <BankReconciliationTab accounts={bankAccounts} />
          </TabsContent>

          <TabsContent value="aged">
            <AgedReportsTab
              receivables={receivables}
              payables={payables}
              receivablesContacts={receivablesContacts}
              payablesContacts={payablesContacts}
              selectedCompany={selectedCompany}
            />
          </TabsContent>

          <TabsContent value="cashflow">
            <CashFlowTab forecast={cashForecast} />
          </TabsContent>

          <TabsContent value="bas">
            <BasTaxTab periods={basPeriods} basData={basData} />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
