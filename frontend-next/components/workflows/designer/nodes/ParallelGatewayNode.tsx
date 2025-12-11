"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const ParallelGatewayNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div className="relative flex items-center">
      {/* Left handle for incoming */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border !border-slate-400 !bg-white dark:!bg-slate-900"
      />

      {/* Diamond shape */}
      <div
        className={cn(
          "flex h-10 w-10 rotate-45 items-center justify-center border-2 bg-white shadow-sm transition-all dark:bg-slate-900",
          selected
            ? "border-emerald-500 ring-2 ring-emerald-300"
            : "border-emerald-500 dark:border-emerald-500"
        )}
      >
        {/* + marker inside diamond */}
        <span className="-rotate-45 text-lg font-bold text-emerald-600 dark:text-emerald-400">
          +
        </span>
      </div>

      {/* Label to the right */}
      <div className="ml-2 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
        {data.name || "Parallel"}
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

ParallelGatewayNode.displayName = "ParallelGatewayNode";
