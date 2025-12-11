"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const ExclusiveGatewayNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div className="relative flex flex-col items-center">
      {/* Top handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-amber-500 !bg-white dark:!bg-slate-900"
      />

      {/* Diamond shape */}
      <div
        className={cn(
          "flex h-12 w-12 rotate-45 items-center justify-center border-2 bg-white shadow-md transition-all dark:bg-slate-900",
          selected
            ? "border-amber-500 ring-2 ring-amber-500/30"
            : "border-amber-400 dark:border-amber-600"
        )}
      >
        {/* X marker inside diamond */}
        <span className="-rotate-45 text-lg font-bold text-amber-600 dark:text-amber-400">
          X
        </span>
      </div>

      {/* Label below */}
      <div className="mt-2 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">
        {data.name || "Decision"}
      </div>

      {/* Bottom handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!h-3 !w-3 !border-2 !border-amber-500 !bg-white dark:!bg-slate-900"
      />

      {/* Left handle for additional paths */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!h-3 !w-3 !border-2 !border-amber-500 !bg-white dark:!bg-slate-900"
        style={{ top: "50%" }}
      />

      {/* Right handle for additional paths */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!h-3 !w-3 !border-2 !border-amber-500 !bg-white dark:!bg-slate-900"
        style={{ top: "50%" }}
      />
    </div>
  );
});

ExclusiveGatewayNode.displayName = "ExclusiveGatewayNode";
