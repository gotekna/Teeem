"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const ParallelGatewayNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div className="relative flex flex-col items-center">
      {/* Top handle (target) */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!h-3 !w-3 !border-2 !border-emerald-500 !bg-white dark:!bg-slate-900"
      />

      {/* Left handle (target for join) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-in"
        className="!h-3 !w-3 !border-2 !border-emerald-500 !bg-white dark:!bg-slate-900"
        style={{ top: "50%" }}
      />

      {/* Diamond shape */}
      <div
        className={cn(
          "flex h-12 w-12 rotate-45 items-center justify-center border-2 bg-white shadow-md transition-all dark:bg-slate-900",
          selected
            ? "border-emerald-500 ring-2 ring-emerald-500/30"
            : "border-emerald-400 dark:border-emerald-600"
        )}
      >
        {/* + marker inside diamond */}
        <span className="-rotate-45 text-xl font-bold text-emerald-600 dark:text-emerald-400">
          +
        </span>
      </div>

      {/* Label below */}
      <div className="mt-2 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">
        {data.name || "Parallel"}
      </div>

      {/* Bottom handle (source) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!h-3 !w-3 !border-2 !border-emerald-500 !bg-white dark:!bg-slate-900"
      />

      {/* Right handle (source for split) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right-out"
        className="!h-3 !w-3 !border-2 !border-emerald-500 !bg-white dark:!bg-slate-900"
        style={{ top: "50%" }}
      />

      {/* Left handle (source for additional split) */}
      <Handle
        type="source"
        position={Position.Left}
        id="left-out"
        className="!h-3 !w-3 !border-2 !border-emerald-500 !bg-white dark:!bg-slate-900"
        style={{ top: "70%" }}
      />
    </div>
  );
});

ParallelGatewayNode.displayName = "ParallelGatewayNode";
