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
  Loader2,
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
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
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

  // Invoice details
  invoice: {
    id: number;
    external_id: string | null;
    invoice_number: string;
    reference: string | null;
    total: number;
    amount_paid: number;
    status: string;
    date: string;
    due_date: string | null;
  } | null;
}

interface AvailableInvoice {
  id: number;
  invoice_number: string;
  reference: string | null;
  description: string | null;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Auto-Match Invoices
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr className="text-left text-sm">
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium text-right">Expected</th>
                  <th className="px-4 py-3 font-medium">Xero Invoice</th>
                  <th className="px-4 py-3 font-medium text-right">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stages.map((stage) => (
                  <tr key={stage.id} className="hover:bg-muted/30">
                    {/* Stage Name */}
                    <td className="px-4 py-3">
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
                    </td>

                    {/* Expected Amount */}
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm">
                        {stage.expected_amount
                          ? formatCurrency(stage.expected_amount)
                          : "-"}
                      </span>
                    </td>

                    {/* Invoice */}
                    <td className="px-4 py-3">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleUnmatch(stage.id)}
                            disabled={matchingStageId === stage.id}
                            title="Unmatch invoice"
                          >
                            {matchingStageId === stage.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Unlink className="h-4 w-4" />
                            )}
                          </Button>
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
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4 mr-1" />
                            )}
                            Create Invoice
                          </Button>
                        </div>
                      )}
                    </td>

                    {/* Payment Status */}
                    <td className="px-4 py-3 text-right">
                      {stage.matched ? (
                        <div className="flex flex-col items-end gap-1">
                          <PaymentStatusBadge status={stage.payment_status} />
                          {stage.amount_paid && stage.amount_paid > 0 && (
                            <span className="text-xs font-mono text-green-600 dark:text-green-400">
                              {formatCurrency(stage.amount_paid)}
                            </span>
                          )}
                          {stage.payment_date && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(stage.payment_date)}
                            </span>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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

function PaymentStatusBadge({ status }: { status: string }) {
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
