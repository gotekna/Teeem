"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Plus,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { TablePage } from "@/components/ui/page-wrappers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EmailSubscription {
  id: number;
  contact_id: number;
  contact_name: string;
  domain: string;
  status: string;
  plan_type: string;
  mailbox_count: number;
  monthly_retail: number;
  monthly_wholesale: number;
  margin: number;
  current_period_end: string | null;
  created_at: string;
}

interface ProfitReport {
  period: { start: string; end: string };
  summary: {
    total_retail: number;
    total_wholesale: number;
    total_margin: number;
    margin_percent: number;
    invoice_count: number;
    subscription_count: number;
  };
}

export default function PolarisMailPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<EmailSubscription[]>([]);
  const [profitReport, setProfitReport] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [subsRes, profitRes] = await Promise.all([
        api.get<{ success: boolean; data: EmailSubscription[] }>("/api/v1/email_subscriptions"),
        api.get<{ success: boolean; data: ProfitReport }>("/api/v1/email_subscriptions/profit_report"),
      ]);

      if (subsRes?.success) {
        setSubscriptions(subsRes.data);
      }
      if (profitRes?.success) {
        setProfitReport(profitRes.data);
      }
      setError(null);
    } catch (err) {
      console.error("Failed to load email subscriptions:", err);
      setError("Failed to load email subscriptions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "$0";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      pending: "secondary",
      payment_pending: "secondary",
      payment_failed: "destructive",
      cancelled: "outline",
      suspended: "destructive",
    };
    const labels: Record<string, string> = {
      active: "Active",
      pending: "Pending",
      payment_pending: "Payment Pending",
      payment_failed: "Payment Failed",
      cancelled: "Cancelled",
      suspended: "Suspended",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  // Calculate dashboard stats
  const activeCount = subscriptions.filter(s => s.status === "active").length;
  const totalMRR = subscriptions
    .filter(s => s.status === "active")
    .reduce((sum, s) => sum + (s.monthly_retail || 0), 0);
  const totalMargin = subscriptions
    .filter(s => s.status === "active")
    .reduce((sum, s) => sum + (s.margin || 0), 0);
  const totalMailboxes = subscriptions.reduce((sum, s) => sum + (s.mailbox_count || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading email subscriptions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive">{error}</div>
        <Button onClick={loadData} variant="outline" className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <TablePage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6" />
              PolarisMail
            </h1>
            <p className="text-muted-foreground">
              Email hosting reseller - manage subscriptions and migrations
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => router.push("/admin/polaris-mail/new")}>
              <Plus className="h-4 w-4 mr-2" />
              New Subscription
            </Button>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Active Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCount}</div>
              <p className="text-xs text-muted-foreground">{totalMailboxes} mailboxes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Monthly Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalMRR)}
              </div>
              <p className="text-xs text-muted-foreground">/month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Monthly Margin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(totalMargin)}
              </div>
              <p className="text-xs text-muted-foreground">
                {totalMRR > 0 ? `${((totalMargin / totalMRR) * 100).toFixed(0)}% margin` : "0% margin"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Annual Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalMRR * 12)}
              </div>
              <p className="text-xs text-muted-foreground">/year projected</p>
            </CardContent>
          </Card>
        </div>

        {/* This Month's Profit */}
        {profitReport && profitReport.summary.invoice_count > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                This Month's Billing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Invoices</p>
                  <p className="font-medium">{profitReport.summary.invoice_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Revenue</p>
                  <p className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(profitReport.summary.total_retail)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cost</p>
                  <p className="font-medium">{formatCurrency(profitReport.summary.total_wholesale)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Profit</p>
                  <p className="font-medium text-blue-600 dark:text-blue-400">
                    {formatCurrency(profitReport.summary.total_margin)} ({profitReport.summary.margin_percent}%)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscriptions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions ({subscriptions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Mailboxes</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Period End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No email subscriptions yet. Click "New Subscription" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  subscriptions.map((sub) => (
                    <TableRow
                      key={sub.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/admin/polaris-mail/${sub.id}`)}
                    >
                      <TableCell className="font-medium">{sub.contact_name}</TableCell>
                      <TableCell>{sub.domain}</TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell className="text-center">{sub.mailbox_count}</TableCell>
                      <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(sub.monthly_retail)}
                      </TableCell>
                      <TableCell className="text-right text-blue-600 dark:text-blue-400">
                        {formatCurrency(sub.margin)}
                      </TableCell>
                      <TableCell>
                        {sub.current_period_end
                          ? new Date(sub.current_period_end).toLocaleDateString("en-AU")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TablePage>
  );
}
