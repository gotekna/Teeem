"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { BpmnDesigner } from "@/components/workflows/designer";
import type { BpmnProcess } from "@/components/workflows/designer/types";
import { api } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function WorkflowDesignerPage() {
  const params = useParams();
  const router = useRouter();
  const processId = params.id as string;

  const [process, setProcess] = useState<BpmnProcess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProcess = async () => {
      try {
        const response = await api.get(`/api/v1/bpmn_processes/${processId}`) as { data: { success: boolean; bpmn_process: Record<string, unknown> } };
        if (response.data.success) {
          const p = response.data.bpmn_process;
          const nodes = (p.nodes || []) as Record<string, unknown>[];
          const edges = (p.edges || []) as Record<string, unknown>[];
          const triggers = (p.triggers || []) as BpmnProcess["triggers"];
          setProcess({
            id: p.id as number,
            name: p.name as string,
            description: p.description as string | undefined,
            isPublished: p.is_published as boolean,
            publishedAt: p.published_at as string | undefined,
            version: p.version as number | undefined,
            canvasData: (p.canvas_data || {}) as BpmnProcess["canvasData"],
            nodes: nodes.map((n) => ({
              id: n.node_key as string,
              nodeKey: n.node_key as string,
              nodeType: n.node_type as BpmnProcess["nodes"][0]["nodeType"],
              name: n.name as string,
              description: n.description as string | undefined,
              config: (n.config || {}) as BpmnProcess["nodes"][0]["config"],
              position: (n.position || { x: 0, y: 0 }) as { x: number; y: number },
            })),
            edges: edges.map((e) => ({
              id: e.edge_key as string,
              edgeKey: e.edge_key as string,
              source: e.source_key as string,
              target: e.target_key as string,
              name: e.name as string | undefined,
              conditionExpression: e.condition_expression as string | undefined,
              isDefault: e.is_default as boolean | undefined,
            })),
            triggers,
            createdAt: p.created_at as string | undefined,
            updatedAt: p.updated_at as string | undefined,
          });
        } else {
          setError("Failed to load workflow");
        }
      } catch (err) {
        console.error("Failed to fetch process:", err);
        setError("Failed to load workflow");
      } finally {
        setLoading(false);
      }
    };

    if (processId && processId !== "new") {
      fetchProcess();
    } else {
      // New process
      setProcess({
        name: "New Workflow",
        isPublished: false,
        canvasData: {},
        nodes: [],
        edges: [],
        triggers: [],
      });
      setLoading(false);
    }
  }, [processId]);

  const handleSave = useCallback(
    async (processData: Partial<BpmnProcess>) => {
      try {
        const payload = {
          bpmn_process: {
            name: processData.name,
            description: processData.description,
            canvas_data: processData.canvasData,
          },
          nodes: processData.nodes?.map((n) => ({
            node_key: n.nodeKey || n.id,
            node_type: n.nodeType,
            name: n.name,
            description: n.description,
            config: n.config,
            position: n.position,
          })),
          edges: processData.edges?.map((e) => ({
            edge_key: e.edgeKey || e.id,
            source_key: e.source,
            target_key: e.target,
            name: e.name,
            condition_expression: e.conditionExpression,
            is_default: e.isDefault,
          })),
        };

        let response: { data: { success: boolean; bpmn_process?: Record<string, unknown>; errors?: string[] } };
        if (process?.id) {
          response = await api.patch(`/api/v1/bpmn_processes/${process.id}`, payload) as typeof response;
        } else {
          response = await api.post("/api/v1/bpmn_processes", payload) as typeof response;
        }

        if (response.data.success) {
          toast({ title: "Success", description: "Workflow saved" });

          // Update local state
          const p = response.data.bpmn_process!;
          setProcess((prev) => ({
            ...prev!,
            id: p.id as number,
            name: p.name as string,
            updatedAt: p.updated_at as string,
          }));

          // If this was a new process, update the URL
          if (!process?.id && p.id) {
            router.replace(`/workflows/designer/${p.id}`);
          }
        } else {
          toast({ title: "Error", description: response.data.errors?.join(", ") || "Failed to save", variant: "destructive" });
        }
      } catch (err) {
        console.error("Failed to save:", err);
        toast({ title: "Error", description: "Failed to save workflow", variant: "destructive" });
      }
    },
    [process?.id, router]
  );

  const handlePublish = useCallback(
    async (id: number) => {
      try {
        const response = await api.post(`/api/v1/bpmn_processes/${id}/publish`) as { data: { success: boolean; errors?: string[] } };
        if (response.data.success) {
          toast({ title: "Success", description: "Workflow published" });
          setProcess((prev) => (prev ? { ...prev, isPublished: true } : prev));
        } else {
          toast({ title: "Error", description: response.data.errors?.join(", ") || "Failed to publish", variant: "destructive" });
        }
      } catch (err) {
        console.error("Failed to publish:", err);
        toast({ title: "Error", description: "Failed to publish workflow", variant: "destructive" });
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !process) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <p className="mb-4 text-red-500">{error || "Workflow not found"}</p>
        <Button asChild variant="outline">
          <Link href="/workflows/processes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workflows
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Back button */}
      <div className="flex items-center border-b bg-white px-4 py-2 dark:bg-slate-900">
        <Button asChild variant="ghost" size="sm">
          <Link href="/workflows/processes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workflows
          </Link>
        </Button>
      </div>

      {/* Designer */}
      <div className="flex-1">
        <BpmnDesigner
          process={process}
          onSave={handleSave}
          onPublish={process.id ? handlePublish : undefined}
        />
      </div>
    </div>
  );
}
