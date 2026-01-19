"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  Link2,
  ExternalLink,
  Copy,
  Check,
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, copyToClipboard } from "@/utils/formatters";
import Link from "next/link";

interface PaymentLink {
  id: number;
  token: string;
  invoice_id: number;
  invoice_number: string;
  contact_name: string;
  amount: number;
  surcharge: number;
  total: number;
  currency: string;
  status: string;
  expires_at: string;
  created_at: string;
  payment_url: string;
  paid_at: string | null;
}

interface StripePayment {
  id: number;
  payment_link_id: number;
  stripe_payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  receipt_url: string | null;
  invoice_number: string;
  contact_name: string;
}

interface PaymentLinksStats {
  total_links: number;
  active_links: number;
  expired_links: number;
  paid_links: number;
  total_collected: number;
}

export default function PaymentLinksTab() {
  const [loading, setLoading] = useState(true);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [payments, setPayments] = useState<StripePayment[]>([]);
  const [stats, setStats] = useState<PaymentLinksStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"links" | "payments">("links");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch payment links
      const linksResponse = await api.get<{
        success: boolean;
        data: PaymentLink[];
        stats?: PaymentLinksStats;
      }>("/api/v1/payment_links");

      if (linksResponse?.success) {
        setPaymentLinks(linksResponse.data || []);
        if (linksResponse.stats) {
          setStats(linksResponse.stats);
        }
      }

      // Fetch payments
      const paymentsResponse = await api.get<{
        success: boolean;
        data: StripePayment[];
      }>("/api/v1/stripe_payments");

      if (paymentsResponse?.success) {
        setPayments(paymentsResponse.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch payment data:", err);
      setError(err instanceof Error ? err.message : "Failed to load payment data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopy = async (url: string, token: string) => {
    await copyToClipboard(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>;
      case "paid":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Paid</Badge>;
      case "expired":
        return <Badge variant="outline" className="bg-muted text-foreground border-border">Expired</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total_links}</div>
              <p className="text-xs text-muted-foreground">Total Links</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.active_links}</div>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{stats.paid_links}</div>
              <p className="text-xs text-muted-foreground">Paid</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-muted-foreground">{stats.expired_links}</div>
              <p className="text-xs text-muted-foreground">Expired</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-700">{formatCurrency(stats.total_collected)}</div>
              <p className="text-xs text-muted-foreground">Collected</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={activeView === "links" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("links")}
        >
          <Link2 className="h-4 w-4 mr-2" />
          Payment Links
        </Button>
        <Button
          variant={activeView === "payments" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("payments")}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Payments Received
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Payment Links Table */}
      {activeView === "links" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Payment Links
              </span>
              <Badge variant="secondary">{paymentLinks.length} links</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentLinks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No payment links created yet.</p>
                <p className="text-sm mt-1">
                  Create payment links from individual invoices to allow customers to pay online.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>
                        <Link
                          href={`/finance/invoices/${link.invoice_id}`}
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          {link.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{link.contact_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(link.total, link.currency)}
                        {link.surcharge > 0 && (
                          <span className="text-xs text-muted-foreground block">
                            (incl. {formatCurrency(link.surcharge, link.currency)} fee)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(link.status)}</TableCell>
                      <TableCell className="text-sm">
                        {link.status === "paid" ? (
                          <span className="text-green-600">Paid {formatDate(link.paid_at!)}</span>
                        ) : link.status === "expired" ? (
                          <span className="text-muted-foreground">Expired</span>
                        ) : (
                          formatDate(link.expires_at)
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(link.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleCopy(link.payment_url, link.token)}
                                  disabled={link.status !== "active"}
                                >
                                  {copiedToken === link.token ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy payment link</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => window.open(link.payment_url, "_blank")}
                                  disabled={link.status !== "active"}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Open payment link</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payments Table */}
      {activeView === "payments" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payments Received
              </span>
              <Badge variant="secondary">{payments.length} payments</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No payments received yet.</p>
                <p className="text-sm mt-1">
                  Payments will appear here when customers pay via payment links.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid At</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <span className="flex items-center gap-1 font-mono text-sm">
                          <FileText className="h-3 w-3" />
                          {payment.invoice_number}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{payment.contact_name}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-green-600">
                        {formatCurrency(payment.amount, payment.currency)}
                      </TableCell>
                      <TableCell>
                        {payment.status === "succeeded" ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Succeeded
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{payment.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.paid_at ? formatDateTime(payment.paid_at) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.receipt_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(payment.receipt_url!, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
