"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const EndEventNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div className="relative">
      {/* Only incoming connection */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-red-500 !bg-white dark:!bg-slate-900"
      />

      {/* Circle node with thick border */}
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border-4 bg-white shadow-md transition-all dark:bg-slate-900",
          selected
            ? "border-red-500 ring-2 ring-red-500/30"
            : "border-red-400 dark:border-red-600"
        )}
      >
        <Square className="h-4 w-4 fill-red-500 text-red-500" />
      </div>

      {/* Label below */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">
        {data.name || "End"}
      </div>
    </div>
  );
});

EndEventNode.displayName = "EndEventNode";
