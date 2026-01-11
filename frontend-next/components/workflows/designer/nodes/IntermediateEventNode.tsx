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
      <div className="relative flex items-center">
        {/* Left handle for incoming */}
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2 !w-2 !border !border-border !bg-white dark:!bg-slate-900"
        />

        {/* Double-ring circle (characteristic of intermediate events) */}
        <div
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-all dark:bg-slate-900",
            selected
              ? "border-amber-500 ring-2 ring-amber-300"
              : "border-amber-500 dark:border-amber-500"
          )}
        >
          {/* Inner ring */}
          <div
            className={cn(
              "absolute inset-1 rounded-full border",
              selected
                ? "border-amber-500"
                : "border-amber-400 dark:border-amber-500"
            )}
          />
          <Icon
            className={cn(
              "relative z-10 h-3 w-3",
              isThrowing
                ? "fill-amber-500 text-amber-600"
                : "text-amber-600 dark:text-amber-400"
            )}
          />
        </div>

        {/* Label to the right */}
        <div className="ml-2 min-w-0">
          <p className="whitespace-nowrap text-sm text-foreground dark:text-muted-foreground">
            {data.name || "Intermediate Event"}
          </p>
          <p className="text-xs capitalize text-muted-foreground">
            {isThrowing ? "Throw" : "Catch"} {eventType}
          </p>
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

IntermediateEventNode.displayName = "IntermediateEventNode";
