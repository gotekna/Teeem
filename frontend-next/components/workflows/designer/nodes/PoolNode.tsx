"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const PoolNode = memo(
  ({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
    return (
      <div className="relative">
        {/* Pool container */}
        <div
          className={cn(
            "flex min-h-[300px] min-w-[600px] overflow-hidden rounded-lg border-2 bg-white shadow-md transition-all dark:bg-slate-900",
            selected
              ? "border-teal-500 ring-2 ring-teal-500/30"
              : "border-teal-300 dark:border-teal-700"
          )}
        >
          {/* Vertical header on left */}
          <div className="flex w-10 flex-shrink-0 items-center justify-center border-r bg-teal-50 dark:border-teal-800 dark:bg-teal-950/50">
            <div className="flex -rotate-90 items-center gap-2 whitespace-nowrap">
              <Users className="h-4 w-4 rotate-90 text-teal-600 dark:text-teal-400" />
              <span className="text-sm font-medium text-teal-700 dark:text-teal-300">
                {data.name || "Pool"}
              </span>
            </div>
          </div>

          {/* Main content area for lanes */}
          <div className="flex flex-1 flex-col">
            <div className="flex-1 p-4">
              {data.description ? (
                <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                  {data.description}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground dark:text-muted-foreground">
                  Drop lanes or elements here
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Connection handles */}
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-teal-500 !bg-white dark:!bg-slate-900"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-teal-500 !bg-white dark:!bg-slate-900"
        />
      </div>
    );
  }
);

PoolNode.displayName = "PoolNode";
