"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  RefreshCw,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Users,
  FileText,
  DollarSign,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Trash2,
  Edit,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/utils/formatters";

interface ApprovalStep {
  id: number;
  step_order: number;
  approver_type: "user" | "role" | "manager";
  approver_id: number | null;
  approver_name: string;
  threshold_min: number | null;
  threshold_max: number | null;
  required: boolean;
}

interface ApprovalWorkflow {
  id: number;
  name: string;
  description: string | null;
  document_type: string;
  is_active: boolean;
  priority: number;
  steps: ApprovalStep[];
  created_at: string;
}

interface PendingApproval {
  id: number;
  document_type: string;
  document_id: number;
  document_number: string;
  document_description: string;
  amount: number;
  contact_name: string;
  requested_by: string;
  requested_at: string;
  current_step: number;
  total_steps: number;
  status: "pending" | "approved" | "rejected";
  workflow_name: string;
}

interface ApprovalHistory {
  id: number;
  document_type: string;
  document_number: string;
  amount: number;
  status: string;
  approved_by: string;
  approved_at: string;
  notes: string | null;
}

export default function ApprovalsTab() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [history, setHistory] = useState<ApprovalHistory[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [workflowsRes, pendingRes, historyRes] = await Promise.all([
        api.get<{ success: boolean; data: ApprovalWorkflow[] }>("/api/v1/gl/approvals/workflows"),
        api.get<{ success: boolean; data: PendingApproval[] }>("/api/v1/gl/approvals/pending"),
        api.get<{ success: boolean; data: ApprovalHistory[] }>("/api/v1/gl/approvals/history?limit=50"),
      ]);

      if (workflowsRes?.success) setWorkflows(workflowsRes.data || []);
      if (pendingRes?.success) setPendingApprovals(pendingRes.data || []);
      if (historyRes?.success) setHistory(historyRes.data || []);
    } catch (error) {
      console.error("Failed to fetch approvals data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (approval: PendingApproval) => {
    setProcessing(true);
    try {
      await api.post(`/api/v1/gl/approvals/${approval.id}/approve`, {
        notes: approvalNotes,
      });
      setSelectedApproval(null);
      setApprovalNotes("");
      fetchData();
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (approval: PendingApproval) => {
    setProcessing(true);
    try {
      await api.post(`/api/v1/gl/approvals/${approval.id}/reject`, {
        notes: approvalNotes,
      });
      setSelectedApproval(null);
      setApprovalNotes("");
      fetchData();
    } catch (error) {
      console.error("Failed to reject:", error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const pendingCount = pendingApprovals.length;
  const activeWorkflows = workflows.filter((w) => w.is_active).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">awaiting your review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(pendingApprovals.reduce((sum, a) => sum + a.amount, 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">total pending amount</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Workflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeWorkflows}</div>
            <p className="text-xs text-muted-foreground mt-1">of {workflows.length} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {history.filter((h) => new Date(h.approved_at).toDateString() === new Date().toDateString()).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">documents processed</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Workflows
          </TabsTrigger>
        </TabsList>

        {/* Pending Approvals */}
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-sm mt-1">No pending approvals</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead className="text-center">Step</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApprovals.map((approval) => (
                      <TableRow key={approval.id}>
                        <TableCell>
                          <div className="font-medium">{approval.document_number}</div>
                          <div className="text-xs text-muted-foreground">{approval.document_type}</div>
                        </TableCell>
                        <TableCell>{approval.contact_name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(approval.amount)}
                        </TableCell>
                        <TableCell>
                          <div>{approval.requested_by}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(approval.requested_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{approval.workflow_name}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">
                            {approval.current_step}/{approval.total_steps}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedApproval(approval)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove(approval)}
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedApproval(approval);
                              }}
                            >
                              <ThumbsDown className="h-4 w-4" />
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

        {/* Approval History */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Approval History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No approval history yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.document_number}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                        <TableCell>
                          {item.status === "approved" ? (
                            <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approved
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Rejected
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{item.approved_by}</TableCell>
                        <TableCell>{formatDateTime(item.approved_at)}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {item.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflows */}
        <TabsContent value="workflows" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Approval Workflows</CardTitle>
              <Button onClick={() => setShowWorkflowDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Workflow
              </Button>
            </CardHeader>
            <CardContent>
              {workflows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No workflows configured</p>
                  <p className="text-sm mt-1">Create an approval workflow to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Document Type</TableHead>
                      <TableHead className="text-center">Steps</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workflows.map((workflow) => (
                      <TableRow key={workflow.id}>
                        <TableCell>
                          <div className="font-medium">{workflow.name}</div>
                          {workflow.description && (
                            <div className="text-xs text-muted-foreground">{workflow.description}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{workflow.document_type}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{workflow.steps?.length || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          {workflow.is_active ? (
                            <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
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
      </Tabs>

      {/* Approval Detail Dialog */}
      <Dialog open={!!selectedApproval} onOpenChange={() => setSelectedApproval(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Approval</DialogTitle>
            <DialogDescription>
              {selectedApproval?.document_type} - {selectedApproval?.document_number}
            </DialogDescription>
          </DialogHeader>

          {selectedApproval && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <div className="text-lg font-bold">{formatCurrency(selectedApproval.amount)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Contact</Label>
                  <div>{selectedApproval.contact_name}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Requested By</Label>
                  <div>{selectedApproval.requested_by}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Workflow</Label>
                  <div>{selectedApproval.workflow_name}</div>
                </div>
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add any notes for this approval..."
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedApproval(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedApproval && handleReject(selectedApproval)}
              disabled={processing}
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => selectedApproval && handleApprove(selectedApproval)}
              disabled={processing}
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
