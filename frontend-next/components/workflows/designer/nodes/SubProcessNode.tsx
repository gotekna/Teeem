"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Minus, Plus, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const SubProcessNode = memo(
  ({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
    const isExpanded = (data.config?.isExpanded as boolean) || false;

    return (
      <div className="relative">
        {/* Top handle */}
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-indigo-500 !bg-white dark:!bg-slate-900"
        />

        {/* Sub-process container */}
        <div
          className={cn(
            "min-w-[250px] rounded-lg border-2 bg-white shadow-md transition-all dark:bg-slate-900",
            selected
              ? "border-indigo-500 ring-2 ring-indigo-500/30"
              : "border-indigo-300 dark:border-indigo-700"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 rounded-t-md border-b bg-indigo-50 px-3 py-2 dark:border-indigo-800 dark:bg-indigo-950/50">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                {data.name || "Sub-Process"}
              </span>
            </div>
            <div className="flex h-5 w-5 items-center justify-center rounded border border-indigo-300 text-indigo-600 dark:border-indigo-600 dark:text-indigo-400">
              {isExpanded ? (
                <Minus className="h-3 w-3" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </div>
          </div>

          {/* Content */}
          <div className="min-h-[60px] p-3">
            {data.description ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {data.description}
              </p>
            ) : (
              <p className="text-sm italic text-slate-400 dark:text-slate-500">
                {isExpanded
                  ? "Expand to view contents"
                  : "Click + to expand"}
              </p>
            )}
          </div>
        </div>

        {/* Bottom handle */}
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-indigo-500 !bg-white dark:!bg-slate-900"
        />
      </div>
    );
  }
);

SubProcessNode.displayName = "SubProcessNode";
