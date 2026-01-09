"use client";

import React from "react";
import {
  MousePointer,
  Hand,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ToolMode = "select" | "pan";

interface Tool {
  id: ToolMode;
  icon: React.ElementType;
  label: string;
  shortcut: string;
}

const TOOLS: Tool[] = [
  {
    id: "select",
    icon: MousePointer,
    label: "Select",
    shortcut: "V",
  },
  {
    id: "pan",
    icon: Hand,
    label: "Pan",
    shortcut: "H",
  },
];

interface ToolPaletteProps {
  toolMode: ToolMode;
  onToolModeChange: (mode: ToolMode) => void;
  selectedNodeIds: string[];
  onAlignHorizontal: () => void;
  onAlignVertical: () => void;
}

export function ToolPalette({
  toolMode,
  onToolModeChange,
  selectedNodeIds,
  onAlignHorizontal,
  onAlignVertical,
}: ToolPaletteProps) {
  const canAlign = selectedNodeIds.length >= 2;

  return (
    <div className="mb-4 border-b pb-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        Tools
      </h3>
      <div className="flex flex-wrap gap-1">
        {TOOLS.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant={toolMode === tool.id ? "default" : "outline"}
                size="sm"
                onClick={() => onToolModeChange(tool.id)}
                className={cn(
                  "h-9 w-9 p-0",
                  toolMode === tool.id &&
                    "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                <tool.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>
                {tool.label} ({tool.shortcut})
              </p>
            </TooltipContent>
          </Tooltip>
        ))}

        <div className="mx-1 h-9 w-px bg-slate-200 dark:bg-slate-700" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onAlignHorizontal}
              disabled={!canAlign}
              className="h-9 w-9 p-0"
            >
              <AlignHorizontalJustifyCenter className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Align horizontal {!canAlign && "(select 2+ nodes)"}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onAlignVertical}
              disabled={!canAlign}
              className="h-9 w-9 p-0"
            >
              <AlignVerticalJustifyCenter className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Align vertical {!canAlign && "(select 2+ nodes)"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      {selectedNodeIds.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {selectedNodeIds.length} node{selectedNodeIds.length !== 1 ? "s" : ""}{" "}
          selected
        </p>
      )}
    </div>
  );
}
