"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const DataStoreReferenceNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div
      className={cn(
        "w-[180px] rounded border bg-white px-3 py-2 shadow-sm transition-all dark:bg-slate-900",
        selected
          ? "border-blue-500 ring-2 ring-blue-300"
          : "border-slate-300 dark:border-slate-600"
      )}
    >
      {/* Left handle for incoming */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border !border-slate-400 !bg-white dark:!bg-slate-900"
      />

      {/* Simple content */}
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 flex-shrink-0 text-slate-500" />
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-700 dark:text-slate-200">
            {data.name || "Data Store"}
          </p>
        </div>
      </div>

      {/* Right handle for outgoing */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border !border-slate-400 !bg-white dark:!bg-slate-900"
      />
    </div>
  );
});

DataStoreReferenceNode.displayName = "DataStoreReferenceNode";
