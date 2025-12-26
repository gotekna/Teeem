"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  DollarSign,
  Percent,
  Target,
  Calendar,
  AlertCircle,
  TrendingUp,
  Building2,
  Flag,
  Receipt,
  ArrowRight,
  Eye,
  CheckSquare,
  Play,
} from "lucide-react";
import { api } from "@/lib/api";

// Types
interface ProgressClaim {
  id: number;
  claim_number: string;
  claim_sequence: number;
  claim_date: string;
  period_from: string;
  period_to: string;
  job_id: number;
  job_name: string;
  contact_id: number;
  contact_name: string;
  contract_value: number;
  variations_approved: number;
  adjusted_contract_value: number;
  previous_claimed_pct: number;
  this_claim_pct: number;
  total_claimed_pct: number;
  previous_claimed_amount: number;
  this_claim_amount: number;
  total_claimed_amount: number;
  retainage_pct: number;
  retainage_amount: number;
  retainage_released: number;
  gst_amount: number;
  net_claim_amount: number;
  total_payable: number;
  remaining_to_claim: number;
  remaining_pct: number;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  certified_at: string | null;
  invoice_id: number | null;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
}

interface BillingMilestone {
  id: number;
  name: string;
  description: string | null;
  job_id: number;
  job_name: string;
  contact_id: number;
  contact_name: string;
  amount: number;
  is_percentage: boolean;
  percentage_of_contract: number | null;
  target_date: string | null;
  completed_date: string | null;
  status: string;
  progress_status: string;
  days_until_target: number | null;
  auto_invoice: boolean;
  invoice_id: number | null;
  invoiced_at: string | null;
  completed_by: string | null;
  completion_notes: string | null;
  sort_order: number;
  created_at: string;
}

interface RetainageSummary {
  total_held: number;
  total_released: number;
  total_outstanding: number;
  by_job: {
    job_id: number;
    job_name: string;
    retainage_held: number;
    retainage_released: number;
    retainage_outstanding: number;
  }[];
}

export default function ProgressBillingTab() {
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"claims" | "milestones" | "retainage">("claims");

  // Progress Claims state
  const [claims, setClaims] = useState<ProgressClaim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ProgressClaim | null>(null);
  const [claimDetailOpen, setClaimDetailOpen] = useState(false);

  // Milestones state
  const [milestones, setMilestones] = useState<BillingMilestone[]>([]);
  const [billableMilestones, setBillableMilestones] = useState<BillingMilestone[]>([]);

  // Retainage state
  const [retainageSummary, setRetainageSummary] = useState<RetainageSummary | null>(null);

  // Action state
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch progress claims
  const fetchClaims = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: ProgressClaim[] }>(
        "/api/v1/gl/progress_claims"
      );
      if (response?.success) {
        setClaims(response.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch claims:", err);
    }
  }, []);

  // Fetch milestones
  const fetchMilestones = useCallback(async () => {
    try {
      const [allResponse, billableResponse] = await Promise.all([
        api.get<{ success: boolean; data: BillingMilestone[] }>("/api/v1/gl/billing_milestones"),
        api.get<{ success: boolean; data: BillingMilestone[]; total_billable: number }>("/api/v1/gl/billing_milestones/billable"),
      ]);

      if (allResponse?.success) {
        setMilestones(allResponse.data || []);
      }
      if (billableResponse?.success) {
        setBillableMilestones(billableResponse.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch milestones:", err);
    }
  }, []);

  // Fetch retainage summary
  const fetchRetainage = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: RetainageSummary }>(
        "/api/v1/gl/progress_claims/retainage_summary"
      );
      if (response?.success) {
        setRetainageSummary(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch retainage:", err);
    }
  }, []);

  // Claim actions
  const submitClaim = async (claim: ProgressClaim) => {
    setActionLoading(claim.id);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/gl/progress_claims/${claim.id}/submit`
      );
      if (response?.success) {
        setSuccessMessage("Claim submitted for approval");
        await fetchClaims();
      }
    } catch (err) {
      setError("Failed to submit claim");
    } finally {
      setActionLoading(null);
    }
  };

  const approveClaim = async (claim: ProgressClaim) => {
    setActionLoading(claim.id);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/gl/progress_claims/${claim.id}/approve`
      );
      if (response?.success) {
        setSuccessMessage("Claim approved");
        await fetchClaims();
      }
    } catch (err) {
      setError("Failed to approve claim");
    } finally {
      setActionLoading(null);
    }
  };

  const certifyClaim = async (claim: ProgressClaim) => {
    setActionLoading(claim.id);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/gl/progress_claims/${claim.id}/certify`
      );
      if (response?.success) {
        setSuccessMessage("Claim certified");
        await fetchClaims();
      }
    } catch (err) {
      setError("Failed to certify claim");
    } finally {
      setActionLoading(null);
    }
  };

  const generateClaimInvoice = async (claim: ProgressClaim) => {
    setActionLoading(claim.id);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; message: string; invoice_id: number }>(
        `/api/v1/gl/progress_claims/${claim.id}/generate_invoice`
      );
      if (response?.success) {
        setSuccessMessage("Invoice generated");
        await fetchClaims();
        setClaimDetailOpen(false);
      }
    } catch (err) {
      setError("Failed to generate invoice");
    } finally {
      setActionLoading(null);
    }
  };

  // Milestone actions
  const startMilestone = async (milestone: BillingMilestone) => {
    setActionLoading(milestone.id);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/gl/billing_milestones/${milestone.id}/start`
      );
      if (response?.success) {
        setSuccessMessage("Milestone started");
        await fetchMilestones();
      }
    } catch (err) {
      setError("Failed to start milestone");
    } finally {
      setActionLoading(null);
    }
  };

  const completeMilestone = async (milestone: BillingMilestone) => {
    setActionLoading(milestone.id);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/gl/billing_milestones/${milestone.id}/complete`
      );
      if (response?.success) {
        setSuccessMessage("Milestone completed");
        await fetchMilestones();
      }
    } catch (err) {
      setError("Failed to complete milestone");
    } finally {
      setActionLoading(null);
    }
  };

  const generateMilestoneInvoice = async (milestone: BillingMilestone) => {
    setActionLoading(milestone.id);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; message: string; invoice_id: number }>(
        `/api/v1/gl/billing_milestones/${milestone.id}/generate_invoice`
      );
      if (response?.success) {
        setSuccessMessage("Invoice generated");
        await fetchMilestones();
      }
    } catch (err) {
      setError("Failed to generate invoice");
    } finally {
      setActionLoading(null);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchClaims(), fetchMilestones(), fetchRetainage()]);
      setLoading(false);
    };
    init();
  }, [fetchClaims, fetchMilestones, fetchRetainage]);

  // Clear messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; icon: React.ReactNode }> = {
      draft: { className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300", icon: <FileText className="h-3 w-3 mr-1" /> },
      submitted: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: <Send className="h-3 w-3 mr-1" /> },
      approved: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      certified: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: <CheckSquare className="h-3 w-3 mr-1" /> },
      invoiced: { className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400", icon: <Receipt className="h-3 w-3 mr-1" /> },
      paid: { className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <DollarSign className="h-3 w-3 mr-1" /> },
      pending: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: <Clock className="h-3 w-3 mr-1" /> },
      in_progress: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: <Play className="h-3 w-3 mr-1" /> },
      completed: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      cancelled: { className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle className="h-3 w-3 mr-1" /> },
    };
    const c = config[status] || config.pending;
    return (
      <Badge className={c.className}>
        {c.icon}
        <span className="capitalize">{status.replace(/_/g, " ")}</span>
      </Badge>
    );
  };

  // Calculate stats
  const claimStats = {
    total: claims.length,
    draft: claims.filter((c) => c.status === "draft").length,
    pending: claims.filter((c) => c.status === "submitted").length,
    approved: claims.filter((c) => c.status === "approved" || c.status === "certified").length,
    totalClaimed: claims.filter((c) => c.status !== "draft").reduce((sum, c) => sum + c.this_claim_amount, 0),
  };

  const milestoneStats = {
    total: milestones.length,
    pending: milestones.filter((m) => m.status === "pending").length,
    inProgress: milestones.filter((m) => m.status === "in_progress").length,
    completed: milestones.filter((m) => m.status === "completed").length,
    billable: billableMilestones.length,
    billableAmount: billableMilestones.reduce((sum, m) => sum + m.amount, 0),
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
      {/* Messages */}
      {successMessage && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Progress Claims
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{claimStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {claimStats.draft} draft, {claimStats.pending} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{milestoneStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {milestoneStats.billable} billable ({formatCurrency(milestoneStats.billableAmount)})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Claimed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(claimStats.totalClaimed)}</div>
            <p className="text-xs text-muted-foreground">From progress claims</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Retainage Held
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(retainageSummary?.total_outstanding || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(retainageSummary?.total_released || 0)} released
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
        <TabsList>
          <TabsTrigger value="claims" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Progress Claims
          </TabsTrigger>
          <TabsTrigger value="milestones" className="flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Milestones
          </TabsTrigger>
          <TabsTrigger value="retainage" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Retainage
          </TabsTrigger>
        </TabsList>

        {/* Progress Claims View */}
        <TabsContent value="claims">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Progress Claims (% Complete Billing)
                </span>
                <Button variant="outline" size="sm" onClick={fetchClaims}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {claims.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No progress claims yet</p>
                  <p className="text-sm mt-1">Create a progress claim from a job to bill by % complete</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Claim #</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-center">Progress</TableHead>
                      <TableHead className="text-right">This Claim</TableHead>
                      <TableHead className="text-right">Retainage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell className="font-mono font-medium">
                          {claim.claim_number}
                        </TableCell>
                        <TableCell>{claim.job_name}</TableCell>
                        <TableCell>{claim.contact_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={claim.total_claimed_pct} className="w-16 h-2" />
                            <span className="text-sm font-medium">{claim.total_claimed_pct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(claim.this_claim_amount)}
                          <div className="text-xs text-muted-foreground">
                            +{claim.this_claim_pct.toFixed(1)}%
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(claim.retainage_amount - claim.retainage_released)}
                          <div className="text-xs text-muted-foreground">
                            {claim.retainage_pct}% held
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(claim.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedClaim(claim);
                                      setClaimDetailOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View details</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {claim.status === "draft" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => submitClaim(claim)}
                                disabled={actionLoading === claim.id}
                              >
                                {actionLoading === claim.id ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                              </Button>
                            )}

                            {claim.status === "submitted" && (
                              <Button
                                size="sm"
                                onClick={() => approveClaim(claim)}
                                disabled={actionLoading === claim.id}
                              >
                                {actionLoading === claim.id ? <Spinner className="h-4 w-4" /> : "Approve"}
                              </Button>
                            )}

                            {claim.status === "approved" && !claim.invoice_id && (
                              <Button
                                size="sm"
                                onClick={() => generateClaimInvoice(claim)}
                                disabled={actionLoading === claim.id}
                              >
                                {actionLoading === claim.id ? <Spinner className="h-4 w-4" /> : <Receipt className="h-4 w-4 mr-1" />}
                                Invoice
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Milestones View */}
        <TabsContent value="milestones">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Flag className="h-5 w-5" />
                  Billing Milestones
                </span>
                <Button variant="outline" size="sm" onClick={fetchMilestones}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {milestones.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No milestones yet</p>
                  <p className="text-sm mt-1">Create milestones for jobs to bill when they&apos;re completed</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Milestone</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Target Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {milestones.map((milestone) => (
                      <TableRow key={milestone.id}>
                        <TableCell>
                          <div className="font-medium">{milestone.name}</div>
                          {milestone.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-48">
                              {milestone.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{milestone.job_name}</TableCell>
                        <TableCell>{milestone.contact_name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {milestone.is_percentage ? (
                            <span>{milestone.percentage_of_contract}%</span>
                          ) : (
                            formatCurrency(milestone.amount)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(milestone.target_date)}
                          </div>
                          {milestone.days_until_target !== null && milestone.days_until_target < 0 && (
                            <div className="text-xs text-red-600 dark:text-red-400">
                              {Math.abs(milestone.days_until_target)} days overdue
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(milestone.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {milestone.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startMilestone(milestone)}
                                disabled={actionLoading === milestone.id}
                              >
                                {actionLoading === milestone.id ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                              </Button>
                            )}

                            {milestone.status === "in_progress" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => completeMilestone(milestone)}
                                disabled={actionLoading === milestone.id}
                              >
                                {actionLoading === milestone.id ? <Spinner className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                              </Button>
                            )}

                            {milestone.status === "completed" && !milestone.invoice_id && (
                              <Button
                                size="sm"
                                onClick={() => generateMilestoneInvoice(milestone)}
                                disabled={actionLoading === milestone.id}
                              >
                                {actionLoading === milestone.id ? <Spinner className="h-4 w-4" /> : <Receipt className="h-4 w-4 mr-1" />}
                                Invoice
                              </Button>
                            )}

                            {milestone.invoice_id && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <Receipt className="h-3 w-3 mr-1" />
                                Invoiced
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retainage View */}
        <TabsContent value="retainage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Retainage Tracking
                </span>
                <Button variant="outline" size="sm" onClick={fetchRetainage}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Held</p>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(retainageSummary?.total_held || 0)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Released</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(retainageSummary?.total_released || 0)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Outstanding</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(retainageSummary?.total_outstanding || 0)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* By Job Table */}
              {retainageSummary?.by_job && retainageSummary.by_job.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead className="text-right">Held</TableHead>
                      <TableHead className="text-right">Released</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {retainageSummary.by_job.map((job) => (
                      <TableRow key={job.job_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {job.job_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-amber-600 dark:text-amber-400">
                          {formatCurrency(job.retainage_held)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">
                          {formatCurrency(job.retainage_released)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(job.retainage_outstanding)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No retainage data</p>
                  <p className="text-sm mt-1">Retainage is tracked from approved progress claims</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Claim Detail Dialog */}
      <Dialog open={claimDetailOpen} onOpenChange={setClaimDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Progress Claim {selectedClaim?.claim_number}
            </DialogTitle>
            <DialogDescription>
              {selectedClaim?.job_name} - {selectedClaim?.contact_name}
            </DialogDescription>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-4">
                {getStatusBadge(selectedClaim.status)}
                <span className="text-sm text-muted-foreground">
                  Claim #{selectedClaim.claim_sequence}
                </span>
              </div>

              {/* Contract & Progress */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Contract Value</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedClaim.contract_value)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Variations</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedClaim.variations_approved)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Adjusted Contract Value</p>
                <p className="text-xl font-bold">{formatCurrency(selectedClaim.adjusted_contract_value)}</p>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Total Progress</span>
                  <span className="font-medium">{selectedClaim.total_claimed_pct.toFixed(1)}%</span>
                </div>
                <Progress value={selectedClaim.total_claimed_pct} className="h-3" />
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                  <span>Previous: {selectedClaim.previous_claimed_pct.toFixed(1)}%</span>
                  <span>This claim: +{selectedClaim.this_claim_pct.toFixed(1)}%</span>
                </div>
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">This Claim Amount</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedClaim.this_claim_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Retainage ({selectedClaim.retainage_pct}%)</p>
                  <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                    -{formatCurrency(selectedClaim.retainage_amount - selectedClaim.retainage_released)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">GST</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedClaim.gst_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Payable</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(selectedClaim.total_payable)}
                  </p>
                </div>
              </div>

              {/* Remaining */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm text-muted-foreground">Remaining to Claim</p>
                  <p className="font-medium">{formatCurrency(selectedClaim.remaining_to_claim)}</p>
                </div>
                <Badge variant="outline">{selectedClaim.remaining_pct.toFixed(1)}% left</Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimDetailOpen(false)}>
              Close
            </Button>
            {selectedClaim?.status === "approved" && !selectedClaim?.invoice_id && (
              <Button
                onClick={() => selectedClaim && generateClaimInvoice(selectedClaim)}
                disabled={actionLoading === selectedClaim?.id}
              >
                {actionLoading === selectedClaim?.id ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Receipt className="h-4 w-4 mr-2" />
                )}
                Generate Invoice
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
