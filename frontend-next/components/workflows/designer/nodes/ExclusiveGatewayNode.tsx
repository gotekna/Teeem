"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const ExclusiveGatewayNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
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
            ? "border-amber-500 ring-2 ring-amber-300"
            : "border-amber-500 dark:border-amber-500"
        )}
      >
        {/* X marker inside diamond */}
        <span className="-rotate-45 text-sm font-bold text-amber-600 dark:text-amber-400">
          X
        </span>
      </div>

      {/* Label to the right */}
      <div className="ml-2 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
        {data.name || "Decision"}
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

ExclusiveGatewayNode.displayName = "ExclusiveGatewayNode";
