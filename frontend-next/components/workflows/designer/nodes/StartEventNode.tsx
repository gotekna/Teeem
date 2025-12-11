"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const StartEventNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div className="relative">
      {/* Circle node */}
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border-2 bg-white shadow-md transition-all dark:bg-slate-900",
          selected
            ? "border-green-500 ring-2 ring-green-500/30"
            : "border-green-400 dark:border-green-600"
        )}
      >
        <Play className="h-5 w-5 text-green-600 dark:text-green-400" />
      </div>

      {/* Label below */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">
        {data.name || "Start"}
      </div>

      {/* Only outgoing connection */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-green-500 !bg-white dark:!bg-slate-900"
      />
    </div>
  );
});

StartEventNode.displayName = "StartEventNode";
