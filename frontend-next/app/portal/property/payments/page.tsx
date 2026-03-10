"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import {
  DollarSign,
  CalendarClock,
  Receipt,
  TrendingUp,
  Building2,
  Landmark,
  Wallet,
  Home,
  Users,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";

// ── Shared types ──

interface PaymentRecord {
  id: number;
  payment_type: string;
  invoice_number: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  status: string;
  invoice_date: string;
  due_date: string;
  description: string;
}

// ── Tenant types ──

interface TenantPaymentsData {
  rent_payments?: PaymentRecord[];
  sda_payments?: PaymentRecord[];
  next_payment?: { type: string; amount: number; frequency: string; next_due: string } | null;
  rent?: { weekly_rent: number; rent_frequency: string; annual_rent: number } | null;
  is_sda?: boolean;
  sda_breakdown?: { sda_weekly_rate: number; participant_contribution: number; ndia_payment: number; total_weekly: number } | null;
}

// ── Owner types ──

interface OwnerPaymentsData {
  summary: {
    total_properties: number;
    occupied: number;
    vacant: number;
    sda_properties: number;
    total_potential_weekly: number;
    total_actual_weekly: number;
    total_potential_annual: number;
    total_actual_annual: number;
    income_gap_weekly: number;
    portfolio_value: number;
  };
  properties: OwnerPropertyData[];
}

interface OwnerPropertyData {
  id: number;
  property_code: string;
  address: string;
  suburb: string;
  bedrooms: number;
  bathrooms: number;
  property_type: string;
  is_sda: boolean;
  sda_category: string | null;
  sda_building_type: string | null;
  sda_enrolled: boolean;
  vacant: boolean;
  potential_weekly_income: number;
  actual_weekly_income: number;
  occupancy_rate: number;
  valuation: number;
  gross_yield: number | null;
  net_yield: number | null;
  tenant: {
    name: string;
    status: string;
    lease_type: string;
    lease_start: string;
    lease_end: string | null;
    days_remaining: number | null;
    weekly_rent: number;
    rent_frequency: string;
    sda?: {
      sda_weekly_rate: number;
      ndia_payment: number;
      participant_contribution: number;
      participant_name: string;
      plan_number: string | null;
    } | null;
  } | null;
}

function portalFetch(path: string) {
  const baseUrl = getApiBaseUrl();
  const token = getStorageItem<string>(STORAGE_KEYS.PORTAL_TOKEN, "");
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then((r) => r.json());
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return "$0";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function sdaCategoryLabel(cat: string | null) {
  if (!cat) return "—";
  return cat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const statusStyles: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  authorised: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  voided: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function PaymentsPage() {
  const [data, setData] = useState<TenantPaymentsData | OwnerPaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const portalUser = getStorageItem<{ portal_type?: string } | null>(STORAGE_KEYS.PORTAL_USER, null);
  const isOwner = portalUser?.portal_type === "owner";

  useEffect(() => {
    portalFetch("/api/v1/portal/property/payments")
      .then((res) => { if (res.success) setData(res.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!data) return <p className="text-center py-10 text-muted-foreground">No data available</p>;

  if (isOwner && "summary" in data) {
    return <OwnerRentView data={data as OwnerPaymentsData} />;
  }

  return <TenantRentView data={data as TenantPaymentsData} />;
}

// ════════════════════════════════════════
// OWNER VIEW - All properties with income
// ════════════════════════════════════════

function OwnerRentView({ data }: { data: OwnerPaymentsData }) {
  const { summary, properties } = data;
  const incomeUtilisation = summary.total_potential_weekly > 0
    ? Math.round((summary.total_actual_weekly / summary.total_potential_weekly) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Rental Income</h1>

      {/* Portfolio Income Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Actual Weekly Income</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_actual_weekly)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(summary.total_actual_annual)} / year</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Potential Weekly Income</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.total_potential_weekly)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(summary.total_potential_annual)} / year</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Income Gap</p>
            <p className={`text-2xl font-bold ${summary.income_gap_weekly > 0 ? "text-amber-600" : "text-green-600"}`}>
              {summary.income_gap_weekly > 0 ? `-${formatCurrency(summary.income_gap_weekly)}` : formatCurrency(0)}/wk
            </p>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${incomeUtilisation}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{incomeUtilisation}% utilisation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Home className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Properties</p>
                <p className="text-2xl font-bold">{summary.total_properties}</p>
                <div className="flex gap-3 text-xs mt-1">
                  <span className="text-green-600">{summary.occupied} occupied</span>
                  {summary.vacant > 0 && <span className="text-amber-600">{summary.vacant} vacant</span>}
                  {summary.sda_properties > 0 && <span className="text-purple-600">{summary.sda_properties} SDA</span>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Property Cards */}
      <h2 className="text-lg font-semibold">Properties</h2>
      <div className="space-y-4">
        {properties.map((prop) => (
          <OwnerPropertyCard key={prop.id} property={prop} />
        ))}
      </div>
    </div>
  );
}

function OwnerPropertyCard({ property: p }: { property: OwnerPropertyData }) {
  return (
    <Card>
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{p.address}</h3>
              {p.is_sda && (
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">SDA</Badge>
              )}
              {p.vacant && (
                <Badge variant="destructive">Vacant</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {p.suburb} &middot; {p.property_code}
              {p.bedrooms && ` · ${p.bedrooms} bed`}
              {p.bathrooms && ` · ${p.bathrooms} bath`}
            </p>
            {p.is_sda && p.sda_category && (
              <p className="text-xs text-purple-600 mt-1">
                {sdaCategoryLabel(p.sda_category)}
                {p.sda_building_type && ` · ${sdaCategoryLabel(p.sda_building_type)}`}
              </p>
            )}
          </div>
          {p.valuation > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Valuation</p>
              <p className="font-semibold">{formatCurrency(p.valuation)}</p>
              {p.net_yield != null && (
                <p className="text-xs text-green-600">{p.net_yield}% net yield</p>
              )}
            </div>
          )}
        </div>

        {/* Income Comparison */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Potential Income</p>
            <p className="text-lg font-bold">{formatCurrency(p.potential_weekly_income)}/wk</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(p.potential_weekly_income * 52)}/yr</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-xs text-muted-foreground">Actual Income</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(p.actual_weekly_income)}/wk</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(p.actual_weekly_income * 52)}/yr</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Occupancy</p>
            <p className="text-lg font-bold">{p.occupancy_rate}%</p>
            <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${p.occupancy_rate >= 80 ? "bg-green-500" : p.occupancy_rate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${p.occupancy_rate}%` }}
              />
            </div>
          </div>
          {p.potential_weekly_income - p.actual_weekly_income > 0 ? (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <p className="text-xs text-muted-foreground">Income Gap</p>
              <p className="text-lg font-bold text-amber-600">
                -{formatCurrency(p.potential_weekly_income - p.actual_weekly_income)}/wk
              </p>
              <p className="text-xs text-amber-600">
                -{formatCurrency((p.potential_weekly_income - p.actual_weekly_income) * 52)}/yr
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="text-xs text-muted-foreground">Income Gap</p>
              <p className="text-lg font-bold text-green-600">None</p>
              <p className="text-xs text-green-600">Fully utilised</p>
            </div>
          )}
        </div>

        {/* Tenant / SDA Info */}
        {p.tenant ? (
          <div className="border-t pt-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{p.tenant.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {p.tenant.lease_type === "sda" ? "SDA" : p.tenant.lease_type === "fixed_term" ? "Fixed Term" : "Periodic"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(p.tenant.lease_start)} — {p.tenant.lease_end ? formatDate(p.tenant.lease_end) : "Ongoing"}
                  {p.tenant.days_remaining != null && p.tenant.days_remaining > 0 && (
                    <span className={p.tenant.days_remaining < 60 ? " text-amber-600 font-medium" : ""}>
                      {" "}· {p.tenant.days_remaining} days remaining
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{formatCurrency(p.tenant.weekly_rent)}/{p.tenant.rent_frequency === "weekly" ? "wk" : p.tenant.rent_frequency}</p>
              </div>
            </div>

            {/* SDA Funding Details */}
            {p.tenant.sda && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-900/20 text-center">
                  <p className="text-xs text-muted-foreground">NDIA Funding</p>
                  <p className="text-sm font-semibold text-emerald-600">{formatCurrency(p.tenant.sda.ndia_payment)}/wk</p>
                </div>
                <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 text-center">
                  <p className="text-xs text-muted-foreground">Participant</p>
                  <p className="text-sm font-semibold text-blue-600">{formatCurrency(p.tenant.sda.participant_contribution)}/wk</p>
                </div>
                <div className="p-2 rounded bg-purple-50 dark:bg-purple-900/20 text-center">
                  <p className="text-xs text-muted-foreground">SDA Rate</p>
                  <p className="text-sm font-semibold text-purple-600">{formatCurrency(p.tenant.sda.sda_weekly_rate)}/wk</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border-t pt-3 flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">No active tenant — property is vacant</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════
// TENANT VIEW - Single property rent info
// ════════════════════════════════════════

function TenantRentView({ data }: { data: TenantPaymentsData }) {
  const rent = data.rent;
  const sda = data.sda_breakdown;
  const isSda = !!data.is_sda;
  const rentPayments = data.rent_payments || [];
  const sdaPayments = data.sda_payments || [];
  const allPayments = [...rentPayments, ...sdaPayments].sort(
    (a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
  );
  const totalPaid = allPayments.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount_paid, 0);
  const totalOutstanding = allPayments.reduce((sum, p) => sum + p.amount_due, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Rent & Payments</h1>

      {/* Rent Summary */}
      {rent && (
        <Card>
          <CardContent className="pt-6">
            {isSda && sda ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">SDA Property</Badge>
                  <span className="text-sm text-muted-foreground">Specialist Disability Accommodation</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">Total Weekly Rent</p>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(sda.total_weekly)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency((sda.total_weekly || 0) * 52)} / year</p>
                  </div>
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Landmark className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-medium text-muted-foreground">NDIA Payment</p>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(sda.ndia_payment)}</p>
                    <p className="text-xs text-muted-foreground mt-1">per week (government funded)</p>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-medium text-muted-foreground">Your Contribution</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(sda.participant_contribution)}</p>
                    <p className="text-xs text-muted-foreground mt-1">per week (rent subsidy)</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">SDA Weekly Rate</p>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(sda.sda_weekly_rate)}</p>
                    <p className="text-xs text-muted-foreground mt-1">approved SDA rate</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Weekly Rent</p>
                  <p className="text-3xl font-bold">{formatCurrency(rent.weekly_rent)}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(rent.annual_rent)} / year &middot; {rent.rent_frequency}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm text-muted-foreground">Next Payment Due</p>
                {data.next_payment ? (
                  <>
                    <p className="text-2xl font-bold">{formatCurrency(data.next_payment.amount)}</p>
                    <p className="text-xs text-muted-foreground">Due {formatDate(data.next_payment.next_due)} ({data.next_payment.frequency})</p>
                  </>
                ) : (
                  <p className="text-lg text-muted-foreground">No upcoming payments</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                <p className="text-xs text-muted-foreground">{allPayments.filter(p => p.status === "paid").length} payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalOutstanding)}</p>
                <p className="text-xs text-muted-foreground">{allPayments.filter(p => p.amount_due > 0).length} invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      {isSda ? (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Payments</TabsTrigger>
            <TabsTrigger value="rent">Rent</TabsTrigger>
            <TabsTrigger value="sda">SDA / NDIA</TabsTrigger>
          </TabsList>
          <TabsContent value="all"><PaymentList payments={allPayments} /></TabsContent>
          <TabsContent value="rent"><PaymentList payments={rentPayments} /></TabsContent>
          <TabsContent value="sda"><PaymentList payments={sdaPayments} /></TabsContent>
        </Tabs>
      ) : (
        <PaymentList payments={rentPayments} title="Payment History" />
      )}
    </div>
  );
}

// ════════════════════════════════════════
// Payment List (shared)
// ════════════════════════════════════════

function PaymentList({ payments, title }: { payments: PaymentRecord[]; title?: string }) {
  if (payments.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No payment records yet</p>
          <p className="text-xs text-muted-foreground mt-1">Payment history will appear here once invoices are generated</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {title && <CardHeader><CardTitle>{title}</CardTitle></CardHeader>}
      <CardContent className={title ? "" : "pt-6"}>
        <div className="hidden md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Invoice #</th>
                <th className="pb-3 font-medium text-right">Amount</th>
                <th className="pb-3 font-medium text-right">Paid</th>
                <th className="pb-3 font-medium text-right">Due</th>
                <th className="pb-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b last:border-0">
                  <td className="py-3 text-sm">{formatDate(payment.invoice_date)}</td>
                  <td className="py-3 text-sm">
                    <Badge variant="outline">{payment.payment_type === "sda" ? "SDA" : "Rent"}</Badge>
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">{payment.invoice_number || "—"}</td>
                  <td className="py-3 text-sm text-right font-medium">{formatCurrency(payment.amount)}</td>
                  <td className="py-3 text-sm text-right text-green-600">{formatCurrency(payment.amount_paid)}</td>
                  <td className="py-3 text-sm text-right">
                    {payment.amount_due > 0
                      ? <span className="text-amber-600 font-medium">{formatCurrency(payment.amount_due)}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3 text-center">
                    <Badge className={statusStyles[payment.status] || ""}>{payment.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-3">
          {payments.map((payment) => (
            <div key={payment.id} className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{payment.payment_type === "sda" ? "SDA" : "Rent"}</Badge>
                  <span className="text-sm text-muted-foreground">{formatDate(payment.invoice_date)}</span>
                </div>
                <Badge className={statusStyles[payment.status] || ""}>{payment.status}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{payment.invoice_number && `#${payment.invoice_number}`}</span>
                <span className="font-semibold">{formatCurrency(payment.amount)}</span>
              </div>
              {payment.amount_due > 0 && (
                <div className="flex justify-end mt-1">
                  <span className="text-xs text-amber-600">Outstanding: {formatCurrency(payment.amount_due)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
