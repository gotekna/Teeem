"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const LaneNode = memo(
  ({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
    return (
      <div className="relative">
        {/* Lane container */}
        <div
          className={cn(
            "flex min-h-[120px] min-w-[500px] overflow-hidden rounded-md border-2 bg-white shadow-sm transition-all dark:bg-slate-900",
            selected
              ? "border-sky-500 ring-2 ring-sky-500/30"
              : "border-sky-200 dark:border-sky-800"
          )}
        >
          {/* Vertical label on left */}
          <div className="flex w-8 flex-shrink-0 items-center justify-center border-r bg-sky-50 dark:border-sky-800 dark:bg-sky-950/50">
            <div className="flex -rotate-90 items-center gap-1.5 whitespace-nowrap">
              <User className="h-3 w-3 rotate-90 text-sky-600 dark:text-sky-400" />
              <span className="text-xs font-medium text-sky-700 dark:text-sky-300">
                {data.name || "Lane"}
              </span>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 p-3">
            {data.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data.description}
              </p>
            )}
          </div>
        </div>

        {/* Connection handles */}
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-sky-500 !bg-white dark:!bg-slate-900"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-sky-500 !bg-white dark:!bg-slate-900"
        />
      </div>
    );
  }
);

LaneNode.displayName = "LaneNode";
