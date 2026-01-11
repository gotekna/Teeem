"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const TimerEventNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div className="relative flex items-center">
      {/* Left handle for incoming */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border !border-border !bg-white dark:!bg-slate-900"
      />

      {/* Circle with clock */}
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed bg-white shadow-sm transition-all dark:bg-slate-900",
          selected
            ? "border-cyan-500 ring-2 ring-cyan-300"
            : "border-cyan-500 dark:border-cyan-500"
        )}
      >
        <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
      </div>

      {/* Label to the right */}
      <div className="ml-2 min-w-0">
        <p className="whitespace-nowrap text-sm text-foreground dark:text-muted-foreground">
          {data.name || "Timer"}
        </p>
        {data.config?.duration && (
          <p className="text-xs text-muted-foreground">
            {data.config.duration}
          </p>
        )}
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

TimerEventNode.displayName = "TimerEventNode";
