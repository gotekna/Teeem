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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

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

export default function BpmnProcessesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [processes, setProcesses] = useState<BpmnProcessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
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

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

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
          <p className="text-sm text-slate-500">
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

      {processes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Workflow className="mb-4 h-12 w-12 text-slate-400" />
            <h3 className="mb-2 text-lg font-medium">No workflows yet</h3>
            <p className="mb-4 text-sm text-slate-500">
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

                <div className="mt-3 text-xs text-slate-500">
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
    </div>
  );
}
