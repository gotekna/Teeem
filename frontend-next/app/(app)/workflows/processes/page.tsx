"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Play,
  Pause,
  Copy,
  Trash2,
  MoreHorizontal,
  Workflow,
  CheckCircle,
  XCircle,
  Upload,
  Clock,
  AlertCircle,
  StopCircle,
  Building,
  RefreshCw,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";

interface BpmnProcessSummary {
  id: number;
  name: string;
  description?: string;
  isPublished: boolean;
  publishedAt?: string;
  nodeCount: number;
  instanceCount: number;
  activeInstanceCount: number;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse {
  success: boolean;
  bpmn_processes?: Array<Record<string, unknown>>;
  bpmn_process?: Record<string, unknown>;
  errors?: string[];
}

interface WorkflowInstance {
  id: number;
  process_id: number;
  process_name: string;
  subject_type: string;
  subject_id: number;
  subject_name: string;
  status: "active" | "completed" | "failed" | "cancelled" | "suspended";
  progress: number;
  current_node?: string;
  current_nodes: string[];
  pending_tasks: number;
  active_tokens: number;
  waiting_tokens: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  created_at: string;
}

interface InstancesApiResponse {
  success: boolean;
  instances: WorkflowInstance[];
  total: number;
}

export default function BpmnProcessesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processes, setProcesses] = useState<BpmnProcessSummary[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [instancesTotal, setInstancesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("processes");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchProcesses = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse>("/api/v1/bpmn_processes");
      if (response?.success && response.bpmn_processes) {
        setProcesses(
          response.bpmn_processes.map((p) => ({
            id: p.id as number,
            name: p.name as string,
            description: p.description as string | undefined,
            isPublished: p.is_published as boolean,
            publishedAt: p.published_at as string | undefined,
            nodeCount: p.node_count as number,
            instanceCount: p.instance_count as number,
            activeInstanceCount: p.active_instance_count as number,
            triggerCount: p.trigger_count as number,
            createdAt: p.created_at as string,
            updatedAt: p.updated_at as string,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch processes:", error);
      toast({ title: "Error", description: "Failed to load workflows", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchInstances = useCallback(async () => {
    setInstancesLoading(true);
    try {
      const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
      const response = await api.get<InstancesApiResponse>(
        `/api/v1/bpmn_process_instances?limit=50${statusParam}`
      );
      if (response?.success) {
        setInstances(response.instances || []);
        setInstancesTotal(response.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch instances:", error);
      toast({ title: "Error", description: "Failed to load workflow instances", variant: "destructive" });
    } finally {
      setInstancesLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  useEffect(() => {
    if (activeTab === "instances") {
      fetchInstances();
    }
  }, [activeTab, fetchInstances]);

  const handleCancelInstance = async (instanceId: number) => {
    if (!confirm("Are you sure you want to cancel this workflow instance?")) return;
    try {
      const response = await api.post<{ success: boolean }>(`/api/v1/bpmn_process_instances/${instanceId}/cancel`, {
        reason: "Cancelled by user",
      });
      if (response?.success) {
        toast({ title: "Success", description: "Workflow instance cancelled" });
        fetchInstances();
      }
    } catch (error) {
      console.error("Failed to cancel instance:", error);
      toast({ title: "Error", description: "Failed to cancel workflow instance", variant: "destructive" });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="h-4 w-4 text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "cancelled":
        return <StopCircle className="h-4 w-4 text-gray-500" />;
      case "suspended":
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      suspended: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    };
    return (
      <Badge className={variants[status] || variants.cancelled}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleCreate = async () => {
    try {
      const response = await api.post<ApiResponse>("/api/v1/bpmn_processes", {
        bpmn_process: {
          name: "New Workflow",
          description: "",
        },
      });
      if (response?.success && response.bpmn_process) {
        router.push(`/workflows/designer/${response.bpmn_process.id}`);
      }
    } catch (error) {
      console.error("Failed to create process:", error);
      toast({ title: "Error", description: "Failed to create workflow", variant: "destructive" });
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      const response = await api.post<ApiResponse>(`/api/v1/bpmn_processes/${id}/duplicate`);
      if (response?.success) {
        toast({ title: "Success", description: "Workflow duplicated" });
        fetchProcesses();
      }
    } catch (error) {
      console.error("Failed to duplicate:", error);
      toast({ title: "Error", description: "Failed to duplicate workflow", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;

    try {
      const response = await api.delete<ApiResponse>(`/api/v1/bpmn_processes/${id}`);
      if (response?.success) {
        toast({ title: "Success", description: "Workflow deleted" });
        fetchProcesses();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({ title: "Error", description: "Failed to delete workflow", variant: "destructive" });
    }
  };

  const handlePublish = async (id: number) => {
    try {
      const response = await api.post<ApiResponse>(`/api/v1/bpmn_processes/${id}/publish`);
      if (response?.success) {
        toast({ title: "Success", description: "Workflow published" });
        fetchProcesses();
      } else if (response) {
        toast({ title: "Error", description: response.errors?.join(", ") || "Failed to publish", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to publish:", error);
      toast({ title: "Error", description: "Failed to publish workflow", variant: "destructive" });
    }
  };

  const handleUnpublish = async (id: number) => {
    try {
      const response = await api.post<ApiResponse>(`/api/v1/bpmn_processes/${id}/unpublish`);
      if (response?.success) {
        toast({ title: "Success", description: "Workflow unpublished" });
        fetchProcesses();
      }
    } catch (error) {
      console.error("Failed to unpublish:", error);
      toast({ title: "Error", description: "Failed to unpublish workflow", variant: "destructive" });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".bpmn") && !file.name.endsWith(".xml")) {
      toast({ title: "Error", description: "Please select a BPMN (.bpmn) or XML file", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const xmlContent = await file.text();
      const response = await api.post<ApiResponse & { message?: string }>("/api/v1/bpmn_processes/import", {
        xml_content: xmlContent,
        name: file.name.replace(/\.(bpmn|xml)$/, ""),
      });

      if (response?.success && response.bpmn_process) {
        toast({ title: "Success", description: response.message || "Workflow imported" });
        router.push(`/workflows/designer/${response.bpmn_process.id}`);
      } else {
        toast({ title: "Error", description: "Import failed", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to import:", error);
      toast({ title: "Error", description: "Failed to import workflow", variant: "destructive" });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-slate-500">Loading workflows...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">BPMN Workflows</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Design and manage automated business processes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImportClick} disabled={importing}>
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Importing..." : "Import BPMN"}
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Workflow
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".bpmn,.xml"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="processes" className="gap-2">
            <Workflow className="h-4 w-4" />
            Processes
            {processes.length > 0 && (
              <Badge variant="secondary" className="ml-1">{processes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="instances" className="gap-2">
            <Play className="h-4 w-4" />
            Instances
            {instancesTotal > 0 && (
              <Badge variant="secondary" className="ml-1">{instancesTotal}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Processes Tab */}
        <TabsContent value="processes">
          {processes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Workflow className="mb-4 h-12 w-12 text-slate-400" />
                <h3 className="mb-2 text-lg font-medium">No workflows yet</h3>
                <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                  Create your first workflow to automate business processes
                </p>
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Workflow
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {processes.map((process) => (
            <Card key={process.id} className="group relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      <Link
                        href={`/workflows/designer/${process.id}`}
                        className="hover:underline"
                      >
                        {process.name}
                      </Link>
                    </CardTitle>
                    {process.description && (
                      <CardDescription className="mt-1">
                        {process.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/workflows/designer/${process.id}`)
                        }
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDuplicate(process.id)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </DropdownMenuItem>
                      {process.isPublished ? (
                        <DropdownMenuItem
                          onClick={() => handleUnpublish(process.id)}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Unpublish
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handlePublish(process.id)}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Publish
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleDelete(process.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {process.isPublished ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="mr-1 h-3 w-3" />
                      Draft
                    </Badge>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-slate-100 p-2 dark:bg-slate-800">
                    <div className="font-semibold">{process.nodeCount}</div>
                    <div className="text-slate-500">Nodes</div>
                  </div>
                  <div className="rounded-md bg-slate-100 p-2 dark:bg-slate-800">
                    <div className="font-semibold">{process.instanceCount}</div>
                    <div className="text-slate-500">Runs</div>
                  </div>
                  <div className="rounded-md bg-slate-100 p-2 dark:bg-slate-800">
                    <div className="font-semibold">
                      {process.activeInstanceCount}
                    </div>
                    <div className="text-slate-500">Active</div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Updated{" "}
                  {new Date(process.updatedAt).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
            </div>
          )}
        </TabsContent>

        {/* Instances Tab */}
        <TabsContent value="instances">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Workflow Instances</CardTitle>
                  <CardDescription>All workflow executions</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={fetchInstances} disabled={instancesLoading}>
                    <RefreshCw className={`h-4 w-4 ${instancesLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {instancesLoading && instances.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-slate-500 dark:text-slate-400">Loading instances...</div>
                </div>
              ) : instances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Play className="mb-4 h-12 w-12 text-slate-400" />
                  <h3 className="mb-2 text-lg font-medium">No workflow instances</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Run a workflow from the designer or from a job page
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {instances.map((instance) => (
                    <div
                      key={instance.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
                          {getStatusIcon(instance.status)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{instance.process_name}</p>
                            <span className="text-xs text-slate-500 dark:text-slate-400">#{instance.id}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Building className="h-3 w-3" />
                            <span>{instance.subject_name || `${instance.subject_type} #${instance.subject_id}`}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <span>Started {formatDistanceToNow(new Date(instance.started_at), { addSuffix: true })}</span>
                            {instance.current_node && (
                              <>
                                <span>•</span>
                                <span>At: {instance.current_node}</span>
                              </>
                            )}
                          </div>
                          {instance.error_message && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{instance.error_message}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {instance.pending_tasks > 0 && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300 dark:border-orange-700">
                            {instance.pending_tasks} pending
                          </Badge>
                        )}
                        {getStatusBadge(instance.status)}
                        {instance.status !== "completed" && instance.status !== "cancelled" && instance.status !== "failed" && (
                          <Badge variant="outline">{Math.round(instance.progress)}%</Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/workflows/designer/${instance.process_id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Process
                            </DropdownMenuItem>
                            {instance.status === "active" && (
                              <DropdownMenuItem
                                onClick={() => handleCancelInstance(instance.id)}
                                className="text-red-600"
                              >
                                <StopCircle className="mr-2 h-4 w-4" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
