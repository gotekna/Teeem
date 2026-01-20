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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Calendar,
  User,
  FileText,
  Users,
  Eye,
  CheckCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";
import Link from "next/link";

interface Invoice {
  id: number;
  type: string;
  invoice_number: string;
  contact_id: number;
  contact_name: string;
  total: number;
  amount_due?: number;
  due_date: string;
  invoice_date: string;
  status: string;
  days_overdue: number;
}

interface ContactHistory {
  total_invoices: number;
  late_rate: number;
  average_days_late: number;
}

interface AtRiskInvoice {
  invoice: Invoice;
  risk_score: number;
  risk_level: "high" | "medium" | "low" | "unknown";
  predicted_days_late: number;
  amount_at_risk: number;
  factors: string[];
  contact_history: ContactHistory | null;
}

interface Summary {
  total_unpaid: number;
  with_predictions: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  total_at_risk_amount: number;
}

interface ContactBehavior {
  contact_id: number;
  contact_name: string;
  total_invoices: number;
  late_invoices: number;
  late_rate: number;
  average_days_to_pay: number;
  average_days_late: number;
  max_days_late: number;
  recent_trend: "worsening" | "improving" | "stable_late" | "stable_good" | "unknown";
  total_amount: number;
  risk_level: "high" | "medium" | "low" | "unknown";
}

// Trend labels and icons
const TREND_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  worsening: {
    label: "Worsening",
    icon: <TrendingUp className="h-3 w-3" />,
    className: "text-red-600 dark:text-red-400",
  },
  improving: {
    label: "Improving",
    icon: <TrendingDown className="h-3 w-3" />,
    className: "text-green-600 dark:text-green-400",
  },
  stable_late: {
    label: "Consistently Late",
    icon: <Minus className="h-3 w-3" />,
    className: "text-amber-600 dark:text-amber-400",
  },
  stable_good: {
    label: "Stable",
    icon: <Minus className="h-3 w-3" />,
    className: "text-green-600 dark:text-green-400",
  },
  unknown: {
    label: "Unknown",
    icon: <Minus className="h-3 w-3" />,
    className: "text-muted-foreground",
  },
};

export default function LatePaymentPredictionTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [atRiskInvoices, setAtRiskInvoices] = useState<AtRiskInvoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [contactBehaviors, setContactBehaviors] = useState<ContactBehavior[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [activeView, setActiveView] = useState<"invoices" | "contacts">("invoices");

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<AtRiskInvoice | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      // Fetch at-risk invoices
      const invoicesResponse = await api.get<{
        success: boolean;
        data: { at_risk_invoices: AtRiskInvoice[]; count: number };
      }>("/api/v1/gl/payment_predictions?limit=100&min_risk=0");

      if (invoicesResponse?.success) {
        setAtRiskInvoices(invoicesResponse.data.at_risk_invoices || []);
      }

      // Fetch summary
      const summaryResponse = await api.get<{
        success: boolean;
        data: Summary;
      }>("/api/v1/gl/payment_predictions/summary");

      if (summaryResponse?.success) {
        setSummary(summaryResponse.data);
      }

      // Fetch contact behaviors
      const behaviorsResponse = await api.get<{
        success: boolean;
        data: { contact_behaviors: ContactBehavior[]; count: number };
      }>("/api/v1/gl/payment_predictions/contact_behaviors?limit=100");

      if (behaviorsResponse?.success) {
        setContactBehaviors(behaviorsResponse.data.contact_behaviors || []);
      }
    } catch (err) {
      console.error("Failed to fetch payment predictions:", err);
      setError(err instanceof Error ? err.message : "Failed to load payment predictions");
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    init();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const openDetailDialog = (invoice: AtRiskInvoice) => {
    setSelectedInvoice(invoice);
    setDetailDialogOpen(true);
  };

  const getRiskBadge = (level: string, score?: number) => {
    switch (level) {
      case "high":
        return (
          <Badge variant="outline" className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
            <AlertTriangle className="h-3 w-3 mr-1" />
            High{score !== undefined ? ` (${score})` : ""}
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Medium{score !== undefined ? ` (${score})` : ""}
          </Badge>
        );
      case "low":
        return (
          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Low{score !== undefined ? ` (${score})` : ""}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border dark:bg-card dark:text-muted-foreground">
            Unknown
          </Badge>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-red-600 dark:text-red-400";
    if (score >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-green-600 dark:text-green-400";
  };

  const getTrendBadge = (trend: string) => {
    const config = TREND_CONFIG[trend] || TREND_CONFIG.unknown;
    return (
      <span className={`flex items-center gap-1 text-sm ${config.className}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const filteredInvoices = atRiskInvoices.filter((inv) => {
    if (riskFilter === "all") return true;
    return inv.risk_level === riskFilter;
  });

  const filteredContacts = contactBehaviors.filter((c) => {
    if (riskFilter === "all") return true;
    return c.risk_level === riskFilter;
  });

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
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button variant="outline" onClick={handleRefresh}>
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
      {summary && (
        <div className="grid grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.total_unpaid}</div>
              <p className="text-xs text-muted-foreground">Unpaid Invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.with_predictions}</div>
              <p className="text-xs text-muted-foreground">With Predictions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.high_risk}</div>
              <p className="text-xs text-muted-foreground">High Risk</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">{summary.medium_risk}</div>
              <p className="text-xs text-muted-foreground">Medium Risk</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.low_risk}</div>
              <p className="text-xs text-muted-foreground">Low Risk</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-700">
                {formatCurrency(summary.total_at_risk_amount)}
              </div>
              <p className="text-xs text-muted-foreground">Amount at Risk</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Toggle and Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={activeView === "invoices" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("invoices")}
        >
          <FileText className="h-4 w-4 mr-2" />
          At-Risk Invoices
        </Button>
        <Button
          variant={activeView === "contacts" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("contacts")}
        >
          <Users className="h-4 w-4 mr-2" />
          Contact Behavior
        </Button>
        <div className="flex-1" />
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="high">High Risk</SelectItem>
            <SelectItem value="medium">Medium Risk</SelectItem>
            <SelectItem value="low">Low Risk</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* At-Risk Invoices Table */}
      {activeView === "invoices" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                At-Risk Invoices
              </span>
              <Badge variant="secondary">{filteredInvoices.length} invoices</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500 dark:text-green-400" />
                <p className="text-lg font-medium">No at-risk invoices</p>
                <p className="text-sm mt-1">
                  All unpaid invoices have low late-payment risk based on customer history.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risk</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Overdue</TableHead>
                    <TableHead>Predicted Late</TableHead>
                    <TableHead>Factors</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((item) => (
                    <TableRow key={`${item.invoice.type}-${item.invoice.id}`}>
                      <TableCell>
                        {getRiskBadge(item.risk_level, item.risk_score)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/finance/invoices/${item.invoice.id}`}
                          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          {item.invoice.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {item.invoice.contact_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.amount_at_risk)}
                      </TableCell>
                      <TableCell>
                        {formatDate(item.invoice.due_date)}
                      </TableCell>
                      <TableCell>
                        {item.invoice.days_overdue > 0 ? (
                          <Badge variant="outline" className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">
                            {item.invoice.days_overdue} days
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.predicted_days_late > 0 ? (
                          <span className={`font-medium ${getScoreColor(item.risk_score)}`}>
                            ~{item.predicted_days_late} days
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {item.factors.slice(0, 2).map((factor, idx) => (
                            <TooltipProvider key={idx}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs truncate max-w-[150px] cursor-help">
                                    {factor.length > 25 ? factor.slice(0, 25) + "..." : factor}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs max-w-[250px]">{factor}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                          {item.factors.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{item.factors.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openDetailDialog(item)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View details</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contact Behavior Table */}
      {activeView === "contacts" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Customer Payment Behavior
              </span>
              <Badge variant="secondary">{filteredContacts.length} customers</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No payment history</p>
                <p className="text-sm mt-1">
                  Payment behavior data requires at least 3 paid invoices per customer.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risk</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Late Rate</TableHead>
                    <TableHead className="text-right">Avg Days to Pay</TableHead>
                    <TableHead className="text-right">Avg Days Late</TableHead>
                    <TableHead className="text-right">Max Days Late</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead className="text-right">Total Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.contact_id}>
                      <TableCell>
                        {getRiskBadge(contact.risk_level)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/contacts/${contact.contact_id}`}
                          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          {contact.contact_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-muted-foreground">
                          {contact.late_invoices}/{contact.total_invoices}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={
                          contact.late_rate >= 50
                            ? "text-red-600 dark:text-red-400 font-medium"
                            : contact.late_rate >= 25
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-green-600 dark:text-green-400"
                        }>
                          {contact.late_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(contact.average_days_to_pay ?? 0).toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={
                          contact.average_days_late >= 14
                            ? "text-red-600 dark:text-red-400"
                            : contact.average_days_late >= 7
                            ? "text-amber-600 dark:text-amber-400"
                            : ""
                        }>
                          {contact.average_days_late > 0 ? contact.average_days_late.toFixed(0) : "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {contact.max_days_late > 0 ? (
                          <span className={contact.max_days_late >= 30 ? "text-red-600 dark:text-red-400" : ""}>
                            {contact.max_days_late}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getTrendBadge(contact.recent_trend)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(contact.total_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Payment Risk Details
            </DialogTitle>
            <DialogDescription>
              Detailed prediction analysis for this invoice.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              {/* Invoice Info */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice:</span>
                  <Link
                    href={`/finance/invoices/${selectedInvoice.invoice.id}`}
                    className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {selectedInvoice.invoice.invoice_number}
                  </Link>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{selectedInvoice.invoice.contact_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(selectedInvoice.amount_at_risk)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date:</span>
                  <span>{formatDate(selectedInvoice.invoice.due_date)}</span>
                </div>
                {selectedInvoice.invoice.days_overdue > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Overdue:</span>
                    <Badge variant="outline" className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300">
                      {selectedInvoice.invoice.days_overdue} days
                    </Badge>
                  </div>
                )}
              </div>

              {/* Risk Score */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Risk Score</div>
                  <div className={`text-3xl font-bold ${getScoreColor(selectedInvoice.risk_score)}`}>
                    {selectedInvoice.risk_score}
                  </div>
                </div>
                <div className="text-right">
                  {getRiskBadge(selectedInvoice.risk_level)}
                  {selectedInvoice.predicted_days_late > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Predicted ~{selectedInvoice.predicted_days_late} days late
                    </div>
                  )}
                </div>
              </div>

              {/* Risk Factors */}
              <div>
                <div className="text-sm font-medium mb-2">Risk Factors:</div>
                <div className="space-y-2">
                  {selectedInvoice.factors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-sm p-2 bg-muted/30 rounded"
                    >
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <span>{factor}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer History */}
              {selectedInvoice.contact_history && (
                <div>
                  <div className="text-sm font-medium mb-2">Customer Payment History:</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-muted/30 rounded">
                      <div className="text-xl font-bold">
                        {selectedInvoice.contact_history.total_invoices}
                      </div>
                      <div className="text-xs text-muted-foreground">Past Invoices</div>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded">
                      <div className={`text-xl font-bold ${
                        selectedInvoice.contact_history.late_rate >= 50
                          ? "text-red-600 dark:text-red-400"
                          : selectedInvoice.contact_history.late_rate >= 25
                          ? "text-amber-600"
                          : "text-green-600 dark:text-green-400"
                      }`}>
                        {selectedInvoice.contact_history.late_rate}%
                      </div>
                      <div className="text-xs text-muted-foreground">Late Rate</div>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded">
                      <div className="text-xl font-bold">
                        {(selectedInvoice.contact_history.average_days_late ?? 0).toFixed(0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Avg Days Late</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/finance/invoices/${selectedInvoice.invoice.id}`}>
                    <FileText className="h-4 w-4 mr-2" />
                    View Invoice
                  </Link>
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <Link href={`/contacts/${selectedInvoice.invoice.contact_id}`}>
                    <User className="h-4 w-4 mr-2" />
                    View Customer
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
