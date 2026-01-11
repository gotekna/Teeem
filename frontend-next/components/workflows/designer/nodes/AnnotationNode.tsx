"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const AnnotationNode = memo(
  ({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
    return (
      <div className="relative">
        {/* Connection handle on left (annotations typically connect to elements) */}
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-border !bg-white dark:!bg-slate-900"
        />

        {/* Annotation box with left bracket styling */}
        <div
          className={cn(
            "min-w-[150px] max-w-[250px] rounded-r-md border-l-4 border-dashed bg-yellow-50 p-3 shadow-sm transition-all dark:bg-yellow-950/30",
            selected
              ? "border-l-yellow-500 ring-2 ring-yellow-500/30"
              : "border-l-yellow-400 dark:border-l-yellow-600"
          )}
        >
          <div className="mb-1 flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400">
            <StickyNote className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Note
            </span>
          </div>
          <p className="text-sm text-foreground dark:text-muted-foreground">
            {data.name || data.description || "Add annotation text..."}
          </p>
        </div>

        {/* Also allow source connections for linking to multiple elements */}
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-border !bg-white dark:!bg-slate-900"
        />
      </div>
    );
  }
);

AnnotationNode.displayName = "AnnotationNode";
