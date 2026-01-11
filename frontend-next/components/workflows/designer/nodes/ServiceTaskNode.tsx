"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Cog, Mail, FileText, Database, Globe, Variable } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  send_email: Mail,
  generate_document: FileText,
  update_record: Database,
  call_webhook: Globe,
  set_variable: Variable,
  default: Cog,
};

export const ServiceTaskNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  const taskType = (data.config?.task_type as string) || "default";
  const Icon = SERVICE_ICONS[taskType] || SERVICE_ICONS.default;

  return (
    <div
      className={cn(
        "w-[350px] h-[140px] rounded border-2 border-red-500 bg-red-50/50 px-3 py-2 shadow-sm transition-all dark:bg-red-900/20 relative flex items-center",
        selected
          ? "ring-2 ring-blue-300"
          : ""
      )}
    >
      {/* UI DEBUG LABEL */}
      <div className="absolute -top-6 left-0 bg-red-600 text-white px-2 py-0.5 text-[10px] font-bold rounded whitespace-nowrap">
        [NODE] w-[350px] h-[140px] - ServiceTask
      </div>

      {/* Left handle for incoming */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border !border-border !bg-white dark:!bg-slate-900"
      />

      {/* Simple content like Rapid Platform */}
      <div className="flex items-center gap-2">
        <Cog className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground dark:text-muted-foreground break-words leading-tight">
            {data.name || "Service Task"}
          </p>
          {taskType !== "default" && (
            <p className="text-xs text-muted-foreground break-words leading-tight mt-1">
              {taskType.replace(/_/g, " ")}
            </p>
          )}
        </div>
      </div>

      {/* Right handle for outgoing */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border !border-border !bg-white dark:!bg-slate-900"
      />
    </div>
  );
});

ServiceTaskNode.displayName = "ServiceTaskNode";
