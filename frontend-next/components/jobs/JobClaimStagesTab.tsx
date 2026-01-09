"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CheckCircle2,
  Clock,
  AlertCircle,
  Link2,
  Unlink,
  FileText,
  DollarSign,
  Receipt,
  TrendingUp,
  Plus,
  ExternalLink,
  FileDown,
  Lock,
  Unlock,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface ClaimStage {
  id: number;
  job_id: number;
  name: string;
  percentage: number | null;
  expected_amount: number | null;
  sequence_order: number;
  is_custom: boolean;

  // Matching
  match_status: "unmatched" | "auto_matched" | "manual_matched";
  matched_at: string | null;
  matched: boolean;
  auto_matched: boolean;

  // Payment
  payment_status: "pending" | "partial" | "paid";
  amount_invoiced: number | null;
  amount_paid: number | null;
  payment_date: string | null;

  // Variance
  variance_amount: number | null;
  variance_percent: number | null;
  has_variance: boolean;

  // Retainage
  retainage_percentage: number | null;
  retainage_amount: number | null;
  retainage_held: boolean;
  retainage_released_at: string | null;
  retainage_status: "none" | "held" | "released";
  net_payable: number | null;

  // Invoice details
  invoice: {
    id: number;
    external_id: string | null;
    invoice_number: string;
    reference: string | null;
    total: number;
    amount_due: number;
    amount_paid: number;
    status: string;
    date: string;
    due_date: string | null;
    fully_paid_date: string | null;
  } | null;
}

interface AvailableInvoice {
  id: number;
  invoice_number: string;
  reference: string | null;
  total: number;
  amount_paid: number;
  status: string;
  date: string;
}

interface Summary {
  contract_value: number;
  total_expected: number;
  total_invoiced: number;
  total_paid: number;
  remaining: number;
  paid_percentage: number;
  // Retainage
  total_retainage_held: number;
  total_retainage_released: number;
  net_receivable: number;
}

interface JobClaimStagesTabProps {
  jobId: number;
  contractValue?: number;
}

export function JobClaimStagesTab({ jobId, contractValue }: JobClaimStagesTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [stages, setStages] = React.useState<ClaimStage[]>([]);
  const [availableInvoices, setAvailableInvoices] = React.useState<AvailableInvoice[]>([]);
  const [summary, setSummary] = React.useState<Summary | null>(null);

  const [autoMatching, setAutoMatching] = React.useState(false);
  const [matchingStageId, setMatchingStageId] = React.useState<number | null>(null);
  const [creatingInvoiceId, setCreatingInvoiceId] = React.useState<number | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = React.useState<number | null>(null);
  const [releasingRetainageId, setReleasingRetainageId] = React.useState<number | null>(null);
  const [showMatchDialog, setShowMatchDialog] = React.useState(false);
  const [selectedStage, setSelectedStage] = React.useState<ClaimStage | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string>("");

  const loadData = React.useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: {
          stages: ClaimStage[];
          summary: Summary;
          available_invoices: AvailableInvoice[];
        };
      }>(`/api/v1/jobs/${jobId}/claim_stages`);

      if (response.success && response.data) {
        setStages(response.data.stages || []);
        setSummary(response.data.summary);
        setAvailableInvoices(response.data.available_invoices || []);
      }
    } catch (error) {
      console.error("Failed to load claim stages:", error);
      toast({
        title: "Error",
        description: "Failed to load claim stages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [jobId, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const response = await api.post<{
        success: boolean;
        data: {
          matched: Array<{ stage_name: string; invoice_number: string }>;
          unmatched: Array<{ stage_name: string }>;
        };
      }>(`/api/v1/jobs/${jobId}/claim_stages/auto_match`, {});

      if (response?.success && response?.data) {
        const { matched, unmatched } = response.data;
        if (matched.length > 0) {
          toast({
            title: "Auto-match complete",
            description: `Matched ${matched.length} stage(s) to invoices`,
          });
        } else {
          toast({
            title: "No matches found",
            description: `${unmatched.length} stage(s) remain unmatched`,
          });
        }
        loadData();
      }
    } catch (error) {
      console.error("Failed to auto-match:", error);
      toast({
        title: "Error",
        description: "Failed to auto-match invoices",
        variant: "destructive",
      });
    } finally {
      setAutoMatching(false);
    }
  };

  const handleManualMatch = async () => {
    if (!selectedStage || !selectedInvoiceId) return;

    setMatchingStageId(selectedStage.id);
    try {
      await api.post(`/api/v1/jobs/${jobId}/claim_stages/${selectedStage.id}/match`, {
        invoice_id: parseInt(selectedInvoiceId, 10),
      });
      toast({ title: "Success", description: "Invoice matched to stage" });
      setShowMatchDialog(false);
      loadData();
    } catch (error) {
      console.error("Failed to match:", error);
      toast({
        title: "Error",
        description: "Failed to match invoice",
        variant: "destructive",
      });
    } finally {
      setMatchingStageId(null);
    }
  };

  const handleUnmatch = async (stageId: number) => {
    setMatchingStageId(stageId);
    try {
      await api.delete(`/api/v1/jobs/${jobId}/claim_stages/${stageId}/unmatch`);
      toast({ title: "Success", description: "Invoice unmatched" });
      loadData();
    } catch (error) {
      console.error("Failed to unmatch:", error);
      toast({
        title: "Error",
        description: "Failed to unmatch invoice",
        variant: "destructive",
      });
    } finally {
      setMatchingStageId(null);
    }
  };

  const openMatchDialog = (stage: ClaimStage) => {
    setSelectedStage(stage);
    setSelectedInvoiceId("");
    setShowMatchDialog(true);
  };

  const handleCreateInvoice = async (stage: ClaimStage) => {
    setCreatingInvoiceId(stage.id);
    try {
      const response = await api.post<{
        success: boolean;
        data?: {
          stage: ClaimStage;
          invoice: { invoice_number: string };
          message: string;
        };
        error?: string;
      }>(`/api/v1/jobs/${jobId}/claim_stages/${stage.id}/create_invoice`, {});

      if (!response) {
        toast({
          title: "Error",
          description: "No response from server",
          variant: "destructive",
        });
        return;
      }

      if (response.success && response.data) {
        toast({
          title: "Invoice Created",
          description: `Invoice ${response.data.invoice.invoice_number} created and synced to Xero`,
        });
        loadData();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to create invoice",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error("Failed to create invoice:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create invoice";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCreatingInvoiceId(null);
    }
  };

  const handleGeneratePdf = async (stage: ClaimStage) => {
    setGeneratingPdfId(stage.id);
    try {
      const response = await api.post<{
        success: boolean;
        data?: {
          document_id: number;
          filename: string;
          url: string;
          message: string;
        };
        error?: string;
      }>(`/api/v1/jobs/${jobId}/claim_stages/${stage.id}/generate_pdf`, {});

      if (!response) {
        toast({
          title: "Error",
          description: "No response from server",
          variant: "destructive",
        });
        return;
      }

      if (response.success && response.data) {
        toast({
          title: "PDF Generated",
          description: response.data.message,
        });
        // Open the PDF in a new tab
        if (response.data.url) {
          window.open(response.data.url, "_blank");
        }
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to generate PDF",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error("Failed to generate PDF:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate PDF";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const handleReleaseRetainage = async (stage: ClaimStage) => {
    if (!stage.retainage_held) return;

    setReleasingRetainageId(stage.id);
    try {
      const response = await api.post<{
        success: boolean;
        data?: {
          stage: ClaimStage;
          message: string;
        };
        error?: string;
      }>(`/api/v1/jobs/${jobId}/claim_stages/${stage.id}/release_retainage`, {});

      if (!response) {
        toast({
          title: "Error",
          description: "No response from server",
          variant: "destructive",
        });
        return;
      }

      if (response.success && response.data) {
        toast({
          title: "Retainage Released",
          description: response.data.message || `${formatCurrency(stage.retainage_amount || 0)} retainage released`,
        });
        loadData();
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to release retainage",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error("Failed to release retainage:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to release retainage";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setReleasingRetainageId(null);
    }
  };

  // Check if any stages have retainage
  const hasRetainage = stages.some(s => s.retainage_percentage && s.retainage_percentage > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Claim Stages</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No claim stages have been configured for this job type.
            <br />
            Configure templates in Admin &rarr; System &rarr; Job Setup.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Contract</div>
              <div className="text-xl font-bold">
                {formatCurrency(summary.contract_value)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Expected</div>
              <div className="text-xl font-bold">
                {formatCurrency(summary.total_expected)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Invoiced</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(summary.total_invoiced)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Paid</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(summary.total_paid)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Remaining</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(summary.remaining)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Retainage Summary - only show if there's retainage */}
      {summary && hasRetainage && (summary.total_retainage_held > 0 || summary.total_retainage_released > 0) && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              Retainage (Retention)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Held</div>
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(summary.total_retainage_held)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Released</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(summary.total_retainage_released)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Net Receivable</div>
                <div className="text-lg font-bold">
                  {formatCurrency(summary.net_receivable)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Bar */}
      {summary && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Payment Progress</span>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">
                {(Number(summary.paid_percentage) || 0).toFixed(1)}% Paid
              </span>
            </div>
            <Progress value={Number(summary.paid_percentage) || 0} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Main Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              Claim Stages
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoMatch}
              disabled={autoMatching}
            >
              {autoMatching ? (
                <Spinner size={16} className="mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Auto-Match Invoices
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table className="w-full">
              <TableHeader className="bg-muted/50">
                <TableRow className="text-left text-sm">
                  <TableHead className="px-4 py-3 font-medium">Stage</TableHead>
                  <TableHead className="px-4 py-3 font-medium text-right">Expected</TableHead>
                  <TableHead className="px-4 py-3 font-medium">Xero Invoice</TableHead>
                  <TableHead className="px-4 py-3 font-medium text-center">Sent</TableHead>
                  <TableHead className="px-4 py-3 font-medium text-center">Due</TableHead>
                  <TableHead className="px-4 py-3 font-medium text-center">Paid</TableHead>
                  {hasRetainage && (
                    <TableHead className="px-4 py-3 font-medium text-right">Retainage</TableHead>
                  )}
                  <TableHead className="px-4 py-3 font-medium text-right">Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y">
                {stages.map((stage) => (
                  <TableRow key={stage.id} className="hover:bg-muted/30">
                    {/* Stage Name */}
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{stage.name}</span>
                        {stage.percentage && (
                          <Badge variant="outline" className="text-xs">
                            {stage.percentage}%
                          </Badge>
                        )}
                        {stage.is_custom && (
                          <Badge variant="secondary" className="text-xs">
                            Custom
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Expected Amount */}
                    <TableCell className="px-4 py-3 text-right">
                      <span className="font-mono text-sm">
                        {stage.expected_amount
                          ? formatCurrency(stage.expected_amount)
                          : "-"}
                      </span>
                    </TableCell>

                    {/* Invoice */}
                    <TableCell className="px-4 py-3">
                      {stage.matched && stage.invoice ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {stage.auto_matched ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <Link2 className="h-4 w-4 text-blue-500" />
                              )}
                              {stage.invoice.external_id ? (
                                <a
                                  href={`https://go.xero.com/AccountsReceivable/View.aspx?invoiceID=${stage.invoice.external_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                >
                                  {stage.invoice.invoice_number}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="font-medium text-sm">
                                  {stage.invoice.invoice_number}
                                </span>
                              )}
                              {stage.invoice.reference && (
                                <span className="text-xs text-muted-foreground">
                                  {stage.invoice.reference}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatCurrency(stage.invoice.total)} •{" "}
                              {formatDate(stage.invoice.date)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleGeneratePdf(stage)}
                              disabled={generatingPdfId === stage.id}
                              title="Generate Invoice PDF"
                            >
                              {generatingPdfId === stage.id ? (
                                <Spinner size={16} />
                              ) : (
                                <FileDown className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleUnmatch(stage.id)}
                              disabled={matchingStageId === stage.id}
                              title="Unmatch invoice"
                            >
                              {matchingStageId === stage.id ? (
                                <Spinner size={16} />
                              ) : (
                                <Unlink className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {availableInvoices.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => openMatchDialog(stage)}
                            >
                              <Link2 className="h-4 w-4 mr-1" />
                              Match
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8"
                            onClick={() => handleCreateInvoice(stage)}
                            disabled={creatingInvoiceId === stage.id}
                          >
                            {creatingInvoiceId === stage.id ? (
                              <Spinner size={16} className="mr-1" />
                            ) : (
                              <Plus className="h-4 w-4 mr-1" />
                            )}
                            Create Invoice
                          </Button>
                        </div>
                      )}
                    </TableCell>

                    {/* Sent Date - when invoice was created */}
                    <TableCell className="px-4 py-3 text-center">
                      {stage.invoice?.date ? (
                        <span className="text-sm">{formatDate(stage.invoice.date)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Due Date */}
                    <TableCell className="px-4 py-3 text-center">
                      {stage.invoice?.due_date ? (
                        <span className={cn(
                          "text-sm",
                          stage.payment_status !== "paid" && new Date(stage.invoice.due_date) < new Date()
                            ? "text-red-500 font-medium"
                            : ""
                        )}>
                          {formatDate(stage.invoice.due_date)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Paid Date */}
                    <TableCell className="px-4 py-3 text-center">
                      {stage.invoice?.fully_paid_date ? (
                        <span className="text-sm text-green-600 dark:text-green-400">
                          {formatDate(stage.invoice.fully_paid_date)}
                        </span>
                      ) : stage.payment_date ? (
                        <span className="text-sm text-green-600 dark:text-green-400">
                          {formatDate(stage.payment_date)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Retainage - only show column if any stage has retainage */}
                    {hasRetainage && (
                      <TableCell className="px-4 py-3 text-right">
                        {stage.retainage_percentage && stage.retainage_percentage > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            {/* Retainage Status Badge */}
                            {stage.retainage_status === "held" ? (
                              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                <Lock className="h-3 w-3 mr-1" />
                                Held
                              </Badge>
                            ) : stage.retainage_status === "released" ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <Unlock className="h-3 w-3 mr-1" />
                                Released
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                None
                              </Badge>
                            )}
                            {/* Retainage Amount */}
                            {stage.retainage_amount && stage.retainage_amount > 0 && (
                              <div className="flex items-center gap-1 text-xs">
                                <span className="text-muted-foreground">
                                  {stage.retainage_percentage}%
                                </span>
                                <span className={cn(
                                  "font-mono font-medium",
                                  stage.retainage_status === "held"
                                    ? "text-orange-600 dark:text-orange-400"
                                    : "text-green-600 dark:text-green-400"
                                )}>
                                  {formatCurrency(stage.retainage_amount)}
                                </span>
                              </div>
                            )}
                            {/* Release Date */}
                            {stage.retainage_released_at && (
                              <span className="text-xs text-muted-foreground">
                                {formatDate(stage.retainage_released_at)}
                              </span>
                            )}
                            {/* Release Button */}
                            {stage.retainage_held && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs mt-1"
                                onClick={() => handleReleaseRetainage(stage)}
                                disabled={releasingRetainageId === stage.id}
                              >
                                {releasingRetainageId === stage.id ? (
                                  <Spinner size={12} className="mr-1" />
                                ) : (
                                  <Unlock className="h-3 w-3 mr-1" />
                                )}
                                Release
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    )}

                    {/* Payment Status */}
                    <TableCell className="px-4 py-3 text-right">
                      {stage.matched && stage.invoice ? (
                        <div className="flex flex-col items-end gap-1">
                          <PaymentStatusBadge
                            status={stage.payment_status}
                            dueDate={stage.invoice.due_date}
                          />
                          {/* Amount Outstanding */}
                          {stage.invoice.amount_due > 0 && stage.payment_status !== "paid" && (
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-muted-foreground">Outstanding:</span>
                              <span className="font-mono font-medium text-amber-600 dark:text-amber-400">
                                {formatCurrency(stage.invoice.amount_due)}
                              </span>
                            </div>
                          )}
                          {/* Amount Paid */}
                          {stage.amount_paid && stage.amount_paid > 0 && (
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-muted-foreground">Paid:</span>
                              <span className="font-mono text-green-600 dark:text-green-400">
                                {formatCurrency(stage.amount_paid)}
                              </span>
                            </div>
                          )}
                          {stage.has_variance && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                (stage.variance_amount || 0) > 0
                                  ? "text-amber-600 bg-amber-50 dark:bg-amber-900/20"
                                  : "text-red-600 bg-red-50 dark:bg-red-900/20"
                              )}
                            >
                              {(stage.variance_amount || 0) > 0 ? "+" : ""}
                              {formatCurrency(stage.variance_amount || 0)}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Match Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Match Invoice to Stage</DialogTitle>
            <DialogDescription>
              Select a Xero invoice to match to &quot;{selectedStage?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Invoice</Label>
              <Select
                value={selectedInvoiceId}
                onValueChange={setSelectedInvoiceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an invoice..." />
                </SelectTrigger>
                <SelectContent>
                  {availableInvoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id.toString()}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{inv.invoice_number}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(inv.total)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(inv.date)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedInvoiceId && (
              <div className="p-3 bg-muted rounded-lg">
                {(() => {
                  const inv = availableInvoices.find(
                    (i) => i.id.toString() === selectedInvoiceId
                  );
                  if (!inv) return null;
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Invoice:</span>
                        <span className="font-medium">{inv.invoice_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-mono">{formatCurrency(inv.total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paid:</span>
                        <span className="font-mono text-green-600">
                          {formatCurrency(inv.amount_paid)}
                        </span>
                      </div>
                      {inv.reference && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Reference:</span>
                          <span>{inv.reference}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMatchDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleManualMatch}
              disabled={!selectedInvoiceId || matchingStageId !== null}
            >
              {matchingStageId ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Matching...
                </>
              ) : (
                "Match Invoice"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentStatusBadge({
  status,
  dueDate,
}: {
  status: string;
  dueDate?: string | null;
}) {
  // Check if overdue (unpaid and past due date)
  const isOverdue =
    status !== "paid" &&
    dueDate &&
    new Date(dueDate) < new Date();

  if (isOverdue) {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <AlertCircle className="h-3 w-3 mr-1" />
        Overdue
      </Badge>
    );
  }

  switch (status) {
    case "paid":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    case "partial":
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <DollarSign className="h-3 w-3 mr-1" />
          Partial
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
  }
}
