"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  FileText,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  DollarSign,
  ArrowRight,
  Copy,
  TrendingUp,
  Percent,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface Quote {
  id: number;
  quote_number: string;
  contact: { id: number; name: string } | null;
  job: { id: number; name: string } | null;
  quote_date: string;
  expiry_date: string;
  status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  reference: string | null;
  created_at: string;
}

interface QuoteSummary {
  by_status: {
    draft: number;
    sent: number;
    pending: number;
    accepted: number;
    converted: number;
  };
  totals: {
    pending_value: number;
    accepted_value: number;
    win_rate: number;
  };
  recent: Quote[];
}

export default function QuotesTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [summary, setSummary] = useState<QuoteSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const statusParam = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const [quotesRes, summaryRes] = await Promise.all([
        api.get<{ success: boolean; data: Quote[] }>(`/api/v1/gl/quotes${statusParam}`),
        api.get<{ success: boolean; data: QuoteSummary }>("/api/v1/gl/quotes/summary"),
      ]);

      if (quotesRes?.success) setQuotes(quotesRes.data || []);
      if (summaryRes?.success) setSummary(summaryRes.data || null);
    } catch (error) {
      console.error("Failed to fetch quotes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSend = async (quote: Quote) => {
    try {
      await api.post(`/api/v1/gl/quotes/${quote.id}/send`);
      fetchData();
    } catch (error) {
      console.error("Failed to send quote:", error);
    }
  };

  const handleConvert = async (quote: Quote) => {
    try {
      await api.post(`/api/v1/gl/quotes/${quote.id}/convert`);
      fetchData();
    } catch (error) {
      console.error("Failed to convert quote:", error);
    }
  };

  const handleDuplicate = async (quote: Quote) => {
    try {
      await api.post(`/api/v1/gl/quotes/${quote.id}/duplicate`);
      fetchData();
    } catch (error) {
      console.error("Failed to duplicate quote:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case "sent":
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400">
            <Send className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-status-warning text-status-warning-foreground dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "converted":
        return (
          <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 dark:bg-purple-900/30 dark:text-purple-400">
            <ArrowRight className="h-3 w-3 mr-1" />
            Converted
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.by_status?.draft || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">to be sent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {(summary?.by_status?.sent || 0) + (summary?.by_status?.pending || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totals?.pending_value || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">potential revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Accepted Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(summary?.totals?.accepted_value || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">won quotes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Percent className="h-4 w-4" />
              Win Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((summary?.totals?.win_rate || 0) * 100).toFixed(0)}%
            </div>
            <Progress value={(summary?.totals?.win_rate || 0) * 100} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Quotes List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Sales Quotes
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No quotes found</p>
              <p className="text-sm mt-1">Create a quote to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">{quote.quote_number}</TableCell>
                    <TableCell>
                      {quote.contact ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{quote.contact.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{quote.reference || "-"}</TableCell>
                    <TableCell>{formatDate(quote.quote_date)}</TableCell>
                    <TableCell>
                      <span className={isExpiringSoon(quote.expiry_date) ? "text-orange-600 dark:text-orange-400 font-medium" : ""}>
                        {formatDate(quote.expiry_date)}
                      </span>
                      {isExpiringSoon(quote.expiry_date) && (
                        <Badge variant="outline" className="ml-2 text-orange-600 dark:text-orange-400 border-orange-300">
                          Soon
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(quote.total)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(quote.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {quote.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSend(quote)}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Send
                          </Button>
                        )}
                        {quote.status === "accepted" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConvert(quote)}
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Invoice
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDuplicate(quote)}
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
