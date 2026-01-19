"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  DollarSign,
  TrendingUp,
  Award,
  AlertTriangle,
  RefreshCw,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { formatCurrency } from "@/utils/formatters";

interface Referrer {
  id: number;
  name: string;
  referrer_status: string | null;
  total_network_fees: number;
  total_commissions_earned: number;
  total_commissions_paid: number;
  l1_eligible: boolean;
  l2_eligible: boolean;
  training_completed: boolean;
  training_expires_at: string | null;
  l1_referrals_count: number;
  l2_referrals_count: number;
}

interface DashboardData {
  total_referrers: number;
  l1_eligible: number;
  l2_eligible: number;
  pending_commissions: number;
  eligible_commissions: number;
  paid_this_month: number;
  training_expiring_soon: number;
  top_referrers: Array<{ id: number; name: string; network_fees: number }>;
}

const L1_THRESHOLD = 10000;
const L2_THRESHOLD = 50000;

export default function ReferrersPage() {
  const router = useRouter();
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [referrersRes, dashboardRes] = await Promise.all([
        api.get<{ success: boolean; data: Referrer[] }>("/api/v1/referrers"),
        api.get<{ success: boolean; data: DashboardData }>("/api/v1/referrers/dashboard"),
      ]);

      if (referrersRes?.success) setReferrers(referrersRes.data);
      if (dashboardRes?.success) setDashboard(dashboardRes.data);
      setError(null);
    } catch (err) {
      console.error("Failed to load referrers:", err);
      setError("Failed to load referrers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getEligibilityBadge = (referrer: Referrer) => {
    if (referrer.l2_eligible) {
      return <Badge className="bg-purple-500">L2 Eligible</Badge>;
    }
    if (referrer.l1_eligible) {
      return <Badge className="bg-blue-500">L1 Eligible</Badge>;
    }
    if (!referrer.training_completed) {
      return <Badge variant="outline">Training Required</Badge>;
    }
    return <Badge variant="secondary">Building Network</Badge>;
  };

  const getProgressToNextLevel = (referrer: Referrer) => {
    if (referrer.l2_eligible) {
      return { level: "L2", progress: 100, target: L2_THRESHOLD };
    }
    if (referrer.l1_eligible) {
      const progress = Math.min((referrer.total_network_fees / L2_THRESHOLD) * 100, 100);
      return { level: "L2", progress, target: L2_THRESHOLD };
    }
    const progress = Math.min((referrer.total_network_fees / L1_THRESHOLD) * 100, 100);
    return { level: "L1", progress, target: L1_THRESHOLD };
  };

  const handleProcessPending = async () => {
    try {
      await api.post("/api/v1/referrers/process_pending");
      toast({
        title: "Success",
        description: "Pending commissions have been processed",
      });
      loadData();
    } catch (err) {
      console.error("Failed to process commissions:", err);
      toast({
        title: "Error",
        description: "Failed to process pending commissions",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading referrers...</div>
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
            <h1 className="text-2xl font-bold">Referrers & Commissions</h1>
            <p className="text-muted-foreground">
              Manage referral network, training, and commission payouts
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleProcessPending} variant="default">
              <DollarSign className="h-4 w-4 mr-2" />
              Process Pending
            </Button>
          </div>
        </div>

        {/* Dashboard Stats */}
        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Total Referrers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.total_referrers}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  L1 Eligible
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {dashboard.l1_eligible}
                </div>
                <p className="text-xs text-muted-foreground">20% commission</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  L2 Eligible
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {dashboard.l2_eligible}
                </div>
                <p className="text-xs text-muted-foreground">10% upline</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(dashboard.pending_commissions)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Eligible to Pay
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(dashboard.eligible_commissions)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Training Expiring
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  dashboard.training_expiring_soon > 0
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-green-600 dark:text-green-400"
                }`}>
                  {dashboard.training_expiring_soon}
                </div>
                <p className="text-xs text-muted-foreground">Next 30 days</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Top Referrers */}
        {dashboard && dashboard.top_referrers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Top Referrers by Network Fees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {dashboard.top_referrers.slice(0, 5).map((referrer, index) => (
                  <div
                    key={referrer.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted"
                    onClick={() => router.push(`/admin/referrers/${referrer.id}`)}
                  >
                    <div className={`text-2xl font-bold ${
                      index === 0 ? "text-yellow-500" :
                      index === 1 ? "text-muted-foreground" :
                      index === 2 ? "text-amber-600" : "text-muted-foreground"
                    }`}>
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{referrer.name}</p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {formatCurrency(referrer.network_fees)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Referrers Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Referrers ({referrers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Network Fees</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-center">L1 / L2</TableHead>
                  <TableHead className="text-right">Earned</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Training</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No referrers found
                    </TableCell>
                  </TableRow>
                ) : (
                  referrers.map((referrer) => {
                    const progress = getProgressToNextLevel(referrer);
                    return (
                      <TableRow
                        key={referrer.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/admin/referrers/${referrer.id}`)}
                      >
                        <TableCell className="font-medium">{referrer.name}</TableCell>
                        <TableCell>{getEligibilityBadge(referrer)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(referrer.total_network_fees)}
                        </TableCell>
                        <TableCell className="min-w-32">
                          <div className="space-y-1">
                            <Progress value={progress.progress} className="h-2" />
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(referrer.total_network_fees)} / {formatCurrency(progress.target)} to {progress.level}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-blue-600 dark:text-blue-400">{referrer.l1_referrals_count}</span>
                          {" / "}
                          <span className="text-purple-600 dark:text-purple-400">{referrer.l2_referrals_count}</span>
                        </TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">
                          {formatCurrency(referrer.total_commissions_earned)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(referrer.total_commissions_paid)}
                        </TableCell>
                        <TableCell>
                          {referrer.training_completed ? (
                            <Badge variant="default" className="flex items-center gap-1 w-fit">
                              <GraduationCap className="h-3 w-3" />
                              Completed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <GraduationCap className="h-3 w-3" />
                              Required
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TablePage>
  );
}
