"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const EndEventNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div className="relative flex items-center">
      {/* Left handle for incoming */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border !border-border !bg-white dark:!bg-slate-900"
      />

      {/* Circle node with thick border */}
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-4 bg-white shadow-sm transition-all dark:bg-slate-900",
          selected
            ? "border-red-500 ring-2 ring-red-300"
            : "border-red-500 dark:border-red-500"
        )}
      >
        <Square className="h-3 w-3 fill-red-500 text-red-500" />
      </div>

      {/* Label to the right */}
      <div className="ml-2 whitespace-nowrap text-sm text-foreground dark:text-muted-foreground">
        {data.name || "End"}
      </div>
    </div>
  );
});

EndEventNode.displayName = "EndEventNode";
