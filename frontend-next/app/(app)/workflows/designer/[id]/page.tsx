"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import BpmnJsDesigner from "@/components/workflows/designer/BpmnJsDesigner";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/ui/back-button";

export default function WorkflowDesignerPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const processId = params.id as string;
  const isNew = processId === "new";

  // Fetch process data
  const { data: process, isLoading, error } = useQuery({
    queryKey: ["bpmn_process", processId],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; bpmn_process: Record<string, unknown> }>(
        `/api/v1/bpmn_processes/${processId}`
      );
      if (response?.success) {
        return response.bpmn_process;
      }
      throw new Error("Failed to load workflow");
    },
    enabled: !isNew,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ xml, svg, name }: { xml: string; svg: string; name: string }) => {
      if (isNew) {
        // Create new process
        const response = await api.post<{ success: boolean; bpmn_process: Record<string, unknown> }>(
          "/api/v1/bpmn_processes",
          {
            bpmn_process: {
              name,
              bpmn_xml: xml,
              svg_preview: svg,
            },
          }
        );
        return response;
      } else {
        // Update existing
        const response = await api.patch<{ success: boolean; bpmn_process: Record<string, unknown> }>(
          `/api/v1/bpmn_processes/${processId}`,
          {
            bpmn_process: {
              name,
              bpmn_xml: xml,
              svg_preview: svg,
            },
          }
        );
        return response;
      }
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["bpmn_process", processId] });
      // Redirect to the new process if created
      if (isNew && response?.bpmn_process?.id) {
        router.replace(`/workflows/designer/${response.bpmn_process.id}`);
      }
    },
  });

  const handleSave = async (xml: string, svg: string, name: string) => {
    await saveMutation.mutateAsync({ xml, svg, name });
  };

  if (isLoading && !isNew) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error && !isNew) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <p className="mb-4 text-red-500">Failed to load workflow</p>
        <BackButton fallbackHref="/workflows/processes" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Back button */}
      <div className="flex items-center border-b bg-white px-4 py-2 dark:bg-slate-900">
        <BackButton fallbackHref="/workflows/processes" />
      </div>

      {/* Designer */}
      <div className="flex-1">
        <BpmnJsDesigner
          processId={isNew ? undefined : parseInt(processId, 10)}
          initialXml={process?.bpmn_xml as string | undefined}
          processName={(process?.name as string) || "New Workflow"}
          onSave={handleSave}
          dataLoaded={isNew || !!process}
        />
      </div>
    </div>
  );
}
