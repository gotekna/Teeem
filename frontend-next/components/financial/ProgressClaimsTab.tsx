"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
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
import {
  RefreshCw,
  FileText,
  CheckCircle,
  Clock,
  DollarSign,
  Building2,
  Briefcase,
  Send,
  Shield,
  Percent,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { safePercent } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/utils/formatters";

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

interface RetainageSummary {
  total_held: number;
  total_released: number;
  total_outstanding: number;
  by_job: Array<{
    job_id: number;
    job_name: string;
    retainage_held: number;
    retainage_released: number;
    retainage_outstanding: number;
  }>;
}

export default function ProgressClaimsTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claims, setClaims] = useState<ProgressClaim[]>([]);
  const [retainage, setRetainage] = useState<RetainageSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);

      const [claimsRes, retainageRes] = await Promise.all([
        api.get<{ success: boolean; data: ProgressClaim[] }>(`/api/v1/gl/progress_claims?${params}`),
        api.get<{ success: boolean; data: RetainageSummary }>("/api/v1/gl/progress_claims/retainage_summary"),
      ]);

      if (claimsRes?.success) setClaims(claimsRes.data || []);
      if (retainageRes?.success) setRetainage(retainageRes.data || null);
    } catch (error) {
      console.error("Failed to fetch progress claims:", error);
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

  const handleSubmit = async (claim: ProgressClaim) => {
    try {
      await api.post(`/api/v1/gl/progress_claims/${claim.id}/submit`);
      fetchData();
    } catch (error) {
      console.error("Failed to submit claim:", error);
    }
  };

  const handleApprove = async (claim: ProgressClaim) => {
    try {
      await api.post(`/api/v1/gl/progress_claims/${claim.id}/approve`);
      fetchData();
    } catch (error) {
      console.error("Failed to approve claim:", error);
    }
  };

  const handleCertify = async (claim: ProgressClaim) => {
    try {
      await api.post(`/api/v1/gl/progress_claims/${claim.id}/certify`);
      fetchData();
    } catch (error) {
      console.error("Failed to certify claim:", error);
    }
  };

  const handleGenerateInvoice = async (claim: ProgressClaim) => {
    try {
      await api.post(`/api/v1/gl/progress_claims/${claim.id}/generate_invoice`);
      fetchData();
    } catch (error) {
      console.error("Failed to generate invoice:", error);
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
      case "submitted":
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400">
            <Send className="h-3 w-3 mr-1" />
            Submitted
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "certified":
        return (
          <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 dark:bg-purple-900/30 dark:text-purple-400">
            <Shield className="h-3 w-3 mr-1" />
            Certified
          </Badge>
        );
      case "invoiced":
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400">
            <FileText className="h-3 w-3 mr-1" />
            Invoiced
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const totalContractValue = claims.reduce((sum, c) => sum + c.contract_value, 0);
  const totalClaimed = claims.reduce((sum, c) => sum + c.total_claimed_amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Claimed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalClaimed)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              from {formatCurrency(totalContractValue)} contract value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Retainage Held
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(retainage?.total_held || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(retainage?.total_released || 0)} released
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Outstanding Retainage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(retainage?.total_outstanding || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              across {retainage?.by_job?.length || 0} jobs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Claims
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{claims.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {claims.filter((c) => c.status === "draft").length} drafts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Claims List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Progress Claims
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="certified">Certified</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No progress claims found</p>
              <p className="text-sm mt-1">Create a progress claim to track project billing</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim #</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-center">Progress</TableHead>
                  <TableHead className="text-right">This Claim</TableHead>
                  <TableHead className="text-right">Retainage</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">{claim.claim_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span>{claim.job_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{claim.contact_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDate(claim.period_from)} - {formatDate(claim.period_to)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="w-24">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>{safePercent(claim.total_claimed_pct, 0)}</span>
                        </div>
                        <Progress value={claim.total_claimed_pct ?? 0} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(claim.this_claim_amount)}
                      <div className="text-xs text-muted-foreground">
                        +{safePercent(claim.this_claim_pct)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-orange-600 dark:text-orange-400">
                        {formatCurrency(claim.retainage_amount - claim.retainage_released)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(claim.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {claim.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => handleSubmit(claim)}>
                            <Send className="h-4 w-4 mr-1" />
                            Submit
                          </Button>
                        )}
                        {claim.status === "submitted" && (
                          <Button size="sm" variant="outline" onClick={() => handleApprove(claim)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        )}
                        {claim.status === "approved" && (
                          <Button size="sm" variant="outline" onClick={() => handleCertify(claim)}>
                            <Shield className="h-4 w-4 mr-1" />
                            Certify
                          </Button>
                        )}
                        {claim.status === "certified" && !claim.invoice_id && (
                          <Button size="sm" onClick={() => handleGenerateInvoice(claim)}>
                            <FileText className="h-4 w-4 mr-1" />
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
    </div>
  );
}
