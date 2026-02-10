"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Brain,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Target,
  Copy,
  TrendingUp,
  Users,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Edit,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";

interface AIDashboard {
  categorization: {
    total_predictions: number;
    accepted: number;
    rejected: number;
    accuracy_rate: number;
  };
  anomalies: {
    open_count: number;
    high_severity: number;
    resolved_this_week: number;
  };
  duplicates: {
    pending: number;
    resolved_this_week: number;
  };
  payment_predictions: {
    high_risk_invoices: number;
    accuracy: number;
  };
  at_risk_customers: number;
}

interface Prediction {
  id: number;
  bank_transaction: { description: string; amount: number };
  predicted_category: { name: string } | null;
  predicted_account: { name: string; code: string } | null;
  confidence: number;
  status: string;
}

interface Anomaly {
  id: number;
  anomaly_type: string;
  description: string;
  severity: string;
  status: string;
  detected_at: string;
  assigned_to: { name: string } | null;
}

interface DuplicateGroup {
  id: number;
  entity_type: string;
  member_count: number;
  similarity_score: number;
  status: string;
}

export default function AITab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState<AIDashboard | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [dashboardRes, predictionsRes, anomaliesRes, duplicatesRes] = await Promise.all([
        api.get<{ success: boolean; data: AIDashboard }>("/api/v1/gl/ai/dashboard"),
        api.get<{ success: boolean; data: Prediction[] }>("/api/v1/gl/ai/predictions?pending_only=true&limit=20"),
        api.get<{ success: boolean; data: Anomaly[] }>("/api/v1/gl/ai/anomalies?open_only=true&limit=20"),
        api.get<{ success: boolean; data: DuplicateGroup[] }>("/api/v1/gl/ai/duplicates?pending_only=true&limit=20"),
      ]);

      if (dashboardRes?.success) setDashboard(dashboardRes.data);
      if (predictionsRes?.success) setPredictions(predictionsRes.data || []);
      if (anomaliesRes?.success) setAnomalies(anomaliesRes.data || []);
      if (duplicatesRes?.success) setDuplicates(duplicatesRes.data || []);
    } catch (error) {
      console.error("Failed to fetch AI data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAcceptPrediction = async (prediction: Prediction) => {
    try {
      await api.post(`/api/v1/gl/ai/predictions/${prediction.id}/accept`);
      fetchData();
    } catch (error) {
      console.error("Failed to accept prediction:", error);
    }
  };

  const handleRejectPrediction = async (prediction: Prediction) => {
    try {
      await api.post(`/api/v1/gl/ai/predictions/${prediction.id}/reject`);
      fetchData();
    } catch (error) {
      console.error("Failed to reject prediction:", error);
    }
  };

  const handleResolveAnomaly = async (anomaly: Anomaly) => {
    try {
      await api.post(`/api/v1/gl/ai/anomalies/${anomaly.id}/resolve`);
      fetchData();
    } catch (error) {
      console.error("Failed to resolve anomaly:", error);
    }
  };

  const handleDismissAnomaly = async (anomaly: Anomaly) => {
    try {
      await api.post(`/api/v1/gl/ai/anomalies/${anomaly.id}/dismiss`);
      fetchData();
    } catch (error) {
      console.error("Failed to dismiss anomaly:", error);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 dark:bg-orange-900/30 dark:text-orange-400">High</Badge>;
      case "medium":
        return <Badge className="bg-status-warning text-status-warning-foreground dark:bg-yellow-900/30 dark:text-yellow-400">Medium</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">High ({(confidence * 100).toFixed(0)}%)</Badge>;
    } else if (confidence >= 0.7) {
      return <Badge className="bg-status-warning text-status-warning-foreground dark:bg-yellow-900/30 dark:text-yellow-400">Medium ({(confidence * 100).toFixed(0)}%)</Badge>;
    } else {
      return <Badge variant="outline">Low ({(confidence * 100).toFixed(0)}%)</Badge>;
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Categorization Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((dashboard?.categorization?.accuracy_rate || 0) * 100).toFixed(0)}%
            </div>
            <Progress value={(dashboard?.categorization?.accuracy_rate || 0) * 100} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Open Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {dashboard?.anomalies?.open_count || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboard?.anomalies?.high_severity || 0} high severity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Pending Duplicates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {dashboard?.duplicates?.pending || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboard?.duplicates?.resolved_this_week || 0} resolved this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              High Risk Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {dashboard?.payment_predictions?.high_risk_invoices || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">late payment risk</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              At-Risk Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {dashboard?.at_risk_customers || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="categorization" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Categorization
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Anomalies
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Duplicates
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Dashboard */}
        <TabsContent value="dashboard">
          <Card>
            <CardHeader>
              <CardTitle>AI Intelligence Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">AI Features Active</p>
                <p className="text-sm mt-1">
                  Transaction categorization, anomaly detection, duplicate detection, and payment prediction are all running.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categorization */}
        <TabsContent value="categorization">
          <Card>
            <CardHeader>
              <CardTitle>Pending Categorization Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              {predictions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No pending predictions</p>
                  <p className="text-sm mt-1">All transactions have been categorized</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Predicted Category</TableHead>
                      <TableHead>Predicted Account</TableHead>
                      <TableHead className="text-center">Confidence</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {predictions.map((prediction) => (
                      <TableRow key={prediction.id}>
                        <TableCell className="max-w-xs truncate">
                          {prediction.bank_transaction?.description}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(prediction.bank_transaction?.amount || 0)}
                        </TableCell>
                        <TableCell>{prediction.predicted_category?.name || "-"}</TableCell>
                        <TableCell>
                          {prediction.predicted_account ? (
                            <span className="text-sm">
                              {prediction.predicted_account.code} - {prediction.predicted_account.name}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {getConfidenceBadge(prediction.confidence)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleAcceptPrediction(prediction)}>
                              <ThumbsUp className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleRejectPrediction(prediction)}>
                              <ThumbsDown className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost">
                              <Edit className="h-4 w-4" />
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
        </TabsContent>

        {/* Anomalies */}
        <TabsContent value="anomalies">
          <Card>
            <CardHeader>
              <CardTitle>Open Anomalies</CardTitle>
            </CardHeader>
            <CardContent>
              {anomalies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No open anomalies</p>
                  <p className="text-sm mt-1">Everything looks normal</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Severity</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anomalies.map((anomaly) => (
                      <TableRow key={anomaly.id}>
                        <TableCell className="capitalize">{anomaly.anomaly_type.replace(/_/g, " ")}</TableCell>
                        <TableCell className="max-w-md truncate">{anomaly.description}</TableCell>
                        <TableCell className="text-center">{getSeverityBadge(anomaly.severity)}</TableCell>
                        <TableCell>{anomaly.assigned_to?.name || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleResolveAnomaly(anomaly)}>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDismissAnomaly(anomaly)}>
                              <XCircle className="h-4 w-4" />
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
        </TabsContent>

        {/* Duplicates */}
        <TabsContent value="duplicates">
          <Card>
            <CardHeader>
              <CardTitle>Pending Duplicate Groups</CardTitle>
            </CardHeader>
            <CardContent>
              {duplicates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Copy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No pending duplicates</p>
                  <p className="text-sm mt-1">All duplicate groups have been reviewed</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity Type</TableHead>
                      <TableHead className="text-center">Members</TableHead>
                      <TableHead className="text-center">Similarity</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicates.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="capitalize">{group.entity_type}</TableCell>
                        <TableCell className="text-center">{group.member_count}</TableCell>
                        <TableCell className="text-center">
                          {((group.similarity_score ?? 0) * 100).toFixed(0)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{group.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline">
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
