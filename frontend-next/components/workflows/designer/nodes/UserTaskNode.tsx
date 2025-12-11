"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const UserTaskNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div
      className={cn(
        "min-w-[200px] rounded-lg border-2 bg-white shadow-sm transition-all hover:shadow-md dark:bg-slate-900",
        selected
          ? "border-blue-500 ring-2 ring-blue-400 ring-offset-2"
          : "border-blue-200 hover:border-blue-300 dark:border-blue-800 dark:hover:border-blue-700"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-blue-500 !bg-white dark:!bg-slate-900"
      />

      {/* Header with solid color like Rapid Platform */}
      <div className="flex items-center gap-2 rounded-t-md bg-blue-600 px-3 py-2 text-white">
        <User className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          User Task
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium text-slate-900 dark:text-white">
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
