"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Mail, Clock, AlertCircle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeData } from "../types";

const EVENT_ICONS: Record<string, React.ElementType> = {
  message: Mail,
  timer: Clock,
  signal: Bell,
  conditional: AlertCircle,
};

export const IntermediateEventNode = memo(
  ({ data, selected }: NodeProps<Node<BpmnNodeData>>) => {
    const eventType = (data.config?.eventType as string) || "message";
    const isThrowing = (data.config?.isThrowing as boolean) || false;
    const Icon = EVENT_ICONS[eventType] || Mail;

    return (
      <div className="relative flex flex-col items-center">
        {/* Top handle */}
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-amber-500 !bg-white dark:!bg-slate-900"
        />

        {/* Double-ring circle (characteristic of intermediate events) */}
        <div
          className={cn(
            "relative flex h-12 w-12 items-center justify-center rounded-full border-2 bg-white shadow-md transition-all dark:bg-slate-900",
            selected
              ? "border-amber-500 ring-2 ring-amber-500/30"
              : "border-amber-400 dark:border-amber-600"
          )}
        >
          {/* Inner ring */}
          <div
            className={cn(
              "absolute inset-1 rounded-full border-2",
              selected
                ? "border-amber-500"
                : "border-amber-400 dark:border-amber-600"
            )}
          />
          <Icon
            className={cn(
              "relative z-10 h-4 w-4",
              isThrowing
                ? "fill-amber-500 text-amber-600"
                : "text-amber-600 dark:text-amber-400"
            )}
          />
        </div>

        {/* Label below */}
        <div className="mt-2 whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-400">
          {data.name || "Intermediate Event"}
        </div>
        <div className="text-xs capitalize text-slate-400 dark:text-slate-500">
          {isThrowing ? "Throw" : "Catch"} {eventType}
        </div>

        {/* Bottom handle */}
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-amber-500 !bg-white dark:!bg-slate-900"
        />
      </div>
    );
  }
);

IntermediateEventNode.displayName = "IntermediateEventNode";
