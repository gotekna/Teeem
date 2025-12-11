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
        "min-w-[200px] rounded-lg border-2 bg-white shadow-sm transition-all hover:shadow-md dark:bg-slate-900",
        selected
          ? "border-purple-500 ring-2 ring-purple-400 ring-offset-2"
          : "border-purple-200 hover:border-purple-300 dark:border-purple-800 dark:hover:border-purple-700"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-purple-500 !bg-white dark:!bg-slate-900"
      />

      {/* Header with solid color like Rapid Platform */}
      <div className="flex items-center gap-2 rounded-t-md bg-purple-600 px-3 py-2 text-white">
        <Cog className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          Service Task
        </span>
      </div>

      {/* Body */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
          <Icon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {data.name || "Service Task"}
          </p>
          {taskType !== "default" && (
            <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
              {taskType.replace(/_/g, " ")}
            </p>
          )}
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
