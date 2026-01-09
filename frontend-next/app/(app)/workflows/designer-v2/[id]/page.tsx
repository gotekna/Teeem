"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import BpmnJsDesigner from "@/components/workflows/designer/BpmnJsDesigner";
import { Spinner } from "@/components/ui/spinner";

export default function BpmnJsDesignerPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const processId = parseInt(id as string, 10);

  // Fetch process data
  const { data: process, isLoading, error } = useQuery({
    queryKey: ["bpmn_process", processId],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { bpmn_xml: string; name: string } }>(`/api/v1/bpmn_processes/${processId}`);
      return response?.data;
    },
    enabled: !isNaN(processId),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ xml, svg }: { xml: string; svg: string }) => {
      const response = await api.patch(`/api/v1/bpmn_processes/${processId}`, {
        bpmn_process: {
          bpmn_xml: xml,
          svg_preview: svg,
        },
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bpmn_process", processId] });
    },
  });

  const handleSave = async (xml: string, svg: string) => {
    await saveMutation.mutateAsync({ xml, svg });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        Failed to load process
      </div>
    );
  }

  return (
    <div className="h-full">
      <BpmnJsDesigner
        processId={processId}
        initialXml={process?.bpmn_xml}
        processName={process?.name || "New Process"}
        onSave={handleSave}
      />
    </div>
  );
}
