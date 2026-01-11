"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const StartEventNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div className="relative flex items-center">
      {/* Circle node with thin border */}
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-all dark:bg-slate-900",
          selected
            ? "border-green-500 ring-2 ring-green-300"
            : "border-green-500 dark:border-green-500"
        )}
      >
        <Play className="h-4 w-4 fill-green-500 text-green-500" />
      </div>

      {/* Label to the right */}
      <div className="ml-2 whitespace-nowrap text-sm text-foreground dark:text-muted-foreground">
        {data.name || "Start"}
      </div>

      {/* Right handle for outgoing */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border !border-border !bg-white dark:!bg-slate-900"
      />
    </div>
  );
});

StartEventNode.displayName = "StartEventNode";
