"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const SubProcessNode = memo(
  ({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
    return (
      <div
        className={cn(
          "w-[180px] rounded border bg-white px-3 py-2 shadow-sm transition-all dark:bg-slate-900",
          selected
            ? "border-blue-500 ring-2 ring-blue-300"
            : "border-border dark:border-border"
        )}
      >
        {/* Left handle for incoming */}
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2 !w-2 !border !border-border !bg-white dark:!bg-slate-900"
        />

        {/* Simple content */}
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground dark:text-muted-foreground">
              {data.name || "Sub-Process"}
            </p>
            {data.description && (
              <p className="truncate text-xs text-muted-foreground">
                {data.description}
              </p>
            )}
          </div>
        </div>

        {/* Right handle for outgoing */}
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2 !w-2 !border !border-border !bg-white dark:!bg-slate-900"
        />
      </div>
    );
  }
);

SubProcessNode.displayName = "SubProcessNode";
