"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const TimerEventNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div className="relative flex flex-col items-center">
      {/* Top handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-cyan-500 !bg-white dark:!bg-slate-900"
      />

      {/* Circle with clock */}
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed bg-white shadow-md transition-all dark:bg-slate-900",
          selected
            ? "border-cyan-500 ring-2 ring-cyan-500/30"
            : "border-cyan-400 dark:border-cyan-600"
        )}
      >
        <Clock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
      </div>

      {/* Label below */}
      <div className="mt-2 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">
        {data.name || "Timer"}
      </div>
      {data.config?.duration && (
        <div className="text-xs text-slate-400 dark:text-slate-500">
          {data.config.duration}
        </div>
      )}

      {/* Bottom handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-cyan-500 !bg-white dark:!bg-slate-900"
      />
    </div>
  );
});

TimerEventNode.displayName = "TimerEventNode";
