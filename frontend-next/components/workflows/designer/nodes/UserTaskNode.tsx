"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const UserTaskNode = memo(({ data, selected }: NodeProps<BpmnNodeData>) => {
  return (
    <div
      className={cn(
        "min-w-[180px] rounded-lg border-2 bg-white shadow-md transition-all dark:bg-slate-900",
        selected
          ? "border-blue-500 ring-2 ring-blue-500/30"
          : "border-slate-200 dark:border-slate-700"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-blue-500 !bg-white dark:!bg-slate-900"
      />

      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
          User Task
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="font-medium text-slate-900 dark:text-white">
          {data.name || "Unnamed Task"}
        </p>
        {data.config?.assignee_value && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Assigned to: {data.config.assignee_value}
          </p>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-blue-500 !bg-white dark:!bg-slate-900"
      />
    </div>
  );
});

UserTaskNode.displayName = "UserTaskNode";
