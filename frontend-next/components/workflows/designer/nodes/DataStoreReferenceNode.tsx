"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const DataStoreReferenceNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div className="relative flex flex-col items-center">
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-slate-500 !bg-white dark:!bg-slate-900"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-slate-500 !bg-white dark:!bg-slate-900"
      />

      {/* Data store shape (cylinder) */}
      <div
        className={cn(
          "relative flex h-14 w-16 flex-col items-center justify-center rounded-t-[50%] border-2 bg-white shadow-md transition-all dark:bg-slate-900",
          selected
            ? "border-slate-500 ring-2 ring-slate-500/30"
            : "border-slate-400 dark:border-slate-600"
        )}
        style={{
          borderRadius: "50% 50% 0 0 / 30% 30% 0 0",
        }}
      >
        {/* Top ellipse to simulate cylinder */}
        <div
          className={cn(
            "absolute -top-1 left-0 right-0 h-3 rounded-[50%] border-2 bg-slate-50 dark:bg-slate-800",
            selected
              ? "border-slate-500"
              : "border-slate-400 dark:border-slate-600"
          )}
        />
        <Database className="mt-2 h-5 w-5 text-slate-600 dark:text-slate-400" />
      </div>

      {/* Bottom of cylinder */}
      <div
        className={cn(
          "h-4 w-16 rounded-b-[50%] border-2 border-t-0 bg-white dark:bg-slate-900",
          selected
            ? "border-slate-500"
            : "border-slate-400 dark:border-slate-600"
        )}
        style={{
          borderRadius: "0 0 50% 50% / 0 0 60% 60%",
        }}
      />

      {/* Label below */}
      <div className="mt-2 max-w-[120px] text-center text-xs font-medium text-slate-600 dark:text-slate-400">
        {data.name || "Data Store"}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-slate-500 !bg-white dark:!bg-slate-900"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-slate-500 !bg-white dark:!bg-slate-900"
      />
    </div>
  );
});

DataStoreReferenceNode.displayName = "DataStoreReferenceNode";
