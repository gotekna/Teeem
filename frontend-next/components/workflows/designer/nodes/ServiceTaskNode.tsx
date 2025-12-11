"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
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

export const ServiceTaskNode = memo(({ data, selected }: NodeProps<BpmnNodeData>) => {
  const taskType = data.config?.task_type || "default";
  const Icon = SERVICE_ICONS[taskType] || SERVICE_ICONS.default;

  return (
    <div
      className={cn(
        "min-w-[180px] rounded-lg border-2 bg-white shadow-md transition-all dark:bg-slate-900",
        selected
          ? "border-purple-500 ring-2 ring-purple-500/30"
          : "border-slate-200 dark:border-slate-700"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-purple-500 !bg-white dark:!bg-slate-900"
      />

      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-purple-50 px-3 py-2 dark:bg-purple-950/30">
        <Cog className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <span className="text-xs font-medium uppercase tracking-wide text-purple-600 dark:text-purple-400">
          Service Task
        </span>
      </div>

      {/* Body */}
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
          <Icon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <p className="font-medium text-slate-900 dark:text-white">
            {data.name || "Service Task"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {taskType.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-purple-500 !bg-white dark:!bg-slate-900"
      />
    </div>
  );
});

ServiceTaskNode.displayName = "ServiceTaskNode";
