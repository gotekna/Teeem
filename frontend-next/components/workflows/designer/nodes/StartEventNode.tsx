"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

export const StartEventNode = memo(({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
  return (
    <div className="relative flex flex-col items-center">
      {/* Circle node with thin border (BPMN standard) */}
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border-[3px] bg-white shadow-sm transition-all hover:shadow-md dark:bg-slate-900",
          selected
            ? "border-green-500 ring-2 ring-green-400 ring-offset-2"
            : "border-green-500 hover:border-green-600 dark:border-green-500"
        )}
      >
        <Play className="h-5 w-5 fill-green-500 text-green-500" />
      </div>

      {/* Label below */}
      <div className="mt-2 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">
        {data.name || "Start"}
      </div>

      {/* Only outgoing connection */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-green-500 !bg-white dark:!bg-slate-900"
      />
    </div>
  );
});

StartEventNode.displayName = "StartEventNode";
