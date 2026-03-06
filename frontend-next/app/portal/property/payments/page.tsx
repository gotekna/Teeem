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
} from "lucide-react";

interface PaymentsData {
  rent_payments?: PaymentRecord[];
  sda_payments?: PaymentRecord[];
  next_payment?: NextPayment | null;
  rent?: RentInfo | null;
  is_sda?: boolean;
  sda_breakdown?: SdaBreakdown | null;
}

interface RentInfo {
  weekly_rent: number;
  rent_frequency: string;
  annual_rent: number;
  lease_start: string;
  lease_end: string | null;
  lease_type: string;
}

interface SdaBreakdown {
  sda_weekly_rate: number;
  participant_contribution: number;
  ndia_payment: number;
  total_weekly: number;
}

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

interface NextPayment {
  type: string;
  amount: number;
  frequency: string;
  next_due: string;
}

function portalFetch(path: string) {
  const baseUrl = getApiBaseUrl();
  const token = getStorageItem<string>(STORAGE_KEYS.PORTAL_TOKEN, "");
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  }).then((r) => r.json());
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return "$0.00";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

const statusStyles: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  authorised: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  voided: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function PaymentsPage() {
  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalFetch("/api/v1/portal/property/payments")
      .then((res) => { if (res.success) setData(res.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!data) return <p className="text-center py-10 text-muted-foreground">No payment data available</p>;

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

      {/* Rent Summary - always show if tenancy exists */}
      {rent && (
        <Card>
          <CardContent className="pt-6">
            {isSda && sda ? (
              <>
                {/* SDA Property - show full breakdown */}
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                    SDA Property
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Specialist Disability Accommodation
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Weekly */}
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">Total Weekly Rent</p>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(sda.total_weekly)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency((sda.total_weekly || 0) * 52)} / year
                    </p>
                  </div>

                  {/* NDIA / Government Payment */}
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Landmark className="h-4 w-4 text-emerald-600" />
                      <p className="text-sm font-medium text-muted-foreground">NDIA Payment</p>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(sda.ndia_payment)}</p>
                    <p className="text-xs text-muted-foreground mt-1">per week (government funded)</p>
                  </div>

                  {/* Participant Contribution */}
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-medium text-muted-foreground">Your Contribution</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(sda.participant_contribution)}</p>
                    <p className="text-xs text-muted-foreground mt-1">per week (rent subsidy)</p>
                  </div>

                  {/* SDA Rate */}
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
              <>
                {/* Standard rental - simple summary */}
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Weekly Rent</p>
                    <p className="text-3xl font-bold">{formatCurrency(rent.weekly_rent)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(rent.annual_rent)} / year &middot; {rent.rent_frequency}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Next Payment */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm text-muted-foreground">Next Payment Due</p>
                {data.next_payment ? (
                  <>
                    <p className="text-2xl font-bold">{formatCurrency(data.next_payment.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(data.next_payment.next_due)} ({data.next_payment.frequency})
                    </p>
                  </>
                ) : (
                  <p className="text-lg text-muted-foreground">No upcoming payments</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Paid */}
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

        {/* Outstanding */}
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
          <TabsContent value="all">
            <PaymentList payments={allPayments} />
          </TabsContent>
          <TabsContent value="rent">
            <PaymentList payments={rentPayments} />
          </TabsContent>
          <TabsContent value="sda">
            <PaymentList payments={sdaPayments} />
          </TabsContent>
        </Tabs>
      ) : (
        <PaymentList payments={rentPayments} title="Payment History" />
      )}
    </div>
  );
}

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
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? "" : "pt-6"}>
        {/* Desktop table */}
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
                    <Badge variant="outline" className="capitalize">
                      {payment.payment_type === "sda" ? "SDA" : "Rent"}
                    </Badge>
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">{payment.invoice_number || "—"}</td>
                  <td className="py-3 text-sm text-right font-medium">{formatCurrency(payment.amount)}</td>
                  <td className="py-3 text-sm text-right text-green-600">{formatCurrency(payment.amount_paid)}</td>
                  <td className="py-3 text-sm text-right">
                    {payment.amount_due > 0 ? (
                      <span className="text-amber-600 font-medium">{formatCurrency(payment.amount_due)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 text-center">
                    <Badge className={statusStyles[payment.status] || ""}>
                      {payment.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {payments.map((payment) => (
            <div key={payment.id} className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {payment.payment_type === "sda" ? "SDA" : "Rent"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{formatDate(payment.invoice_date)}</span>
                </div>
                <Badge className={statusStyles[payment.status] || ""}>
                  {payment.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {payment.invoice_number && `#${payment.invoice_number}`}
                </span>
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
