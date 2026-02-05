"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  MousePointer2,
  Hand,
  Ruler,
  Hash,
  Square,
  Minus,
  Pentagon,
  MinusSquare,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Layers,
  ChevronDown,
} from "lucide-react";
import type { TakeoffTool, TakeoffLayer } from "./types";
import { TAKEOFF_TOOLS } from "./types";

// =============================================================================
// Props
// =============================================================================

interface TakeoffToolbarProps {
  currentTool: TakeoffTool;
  onToolChange: (tool: TakeoffTool) => void;

  // Zoom
  zoom: number;
  onZoomChange: (zoom: number) => void;

  // Layer
  activeLayer: TakeoffLayer | null;
  layers: TakeoffLayer[];
  onLayerChange: (layer: TakeoffLayer) => void;

  // Undo/Redo (optional)
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;

  // Scale status
  isCalibrated: boolean;
  scaleLabel?: string;
}

// =============================================================================
// Icon Map
// =============================================================================

const TOOL_ICONS: Record<TakeoffTool, React.ReactNode> = {
  select: <MousePointer2 className="h-4 w-4" />,
  pan: <Hand className="h-4 w-4" />,
  calibrate: <Ruler className="h-4 w-4" />,
  count: <Hash className="h-4 w-4" />,
  area: <Square className="h-4 w-4" />,
  linear: <Minus className="h-4 w-4" />,
  perimeter: <Pentagon className="h-4 w-4" />,
  deduction: <MinusSquare className="h-4 w-4" />,
};

// =============================================================================
// Component
// =============================================================================

export function TakeoffToolbar({
  currentTool,
  onToolChange,
  zoom,
  onZoomChange,
  activeLayer,
  layers,
  onLayerChange,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  isCalibrated,
  scaleLabel,
}: TakeoffToolbarProps) {
  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toUpperCase();

      // Tool shortcuts
      const toolEntry = Object.entries(TAKEOFF_TOOLS).find(([, config]) => config.shortcut === key);
      if (toolEntry) {
        e.preventDefault();
        onToolChange(toolEntry[0] as TakeoffTool);
        return;
      }

      // Zoom shortcuts
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        onZoomChange(Math.min(zoom + 0.25, 3));
      } else if (e.key === "-") {
        e.preventDefault();
        onZoomChange(Math.max(zoom - 0.25, 0.25));
      }

      // Undo/Redo
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "z" && !e.shiftKey && onUndo && canUndo) {
          e.preventDefault();
          onUndo();
        } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          if (onRedo && canRedo) {
            e.preventDefault();
            onRedo();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTool, zoom, canUndo, canRedo, onToolChange, onZoomChange, onUndo, onRedo]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 p-2 bg-background border-b">
        {/* Selection Tools */}
        <ToolButton
          tool="select"
          current={currentTool}
          onClick={onToolChange}
        />
        <ToolButton
          tool="pan"
          current={currentTool}
          onClick={onToolChange}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Calibration */}
        <ToolButton
          tool="calibrate"
          current={currentTool}
          onClick={onToolChange}
          highlight={!isCalibrated}
        />

        {/* Scale indicator */}
        <div className="px-2 text-xs">
          {isCalibrated ? (
            <span className="text-green-600 dark:text-green-400">{scaleLabel}</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">Not calibrated</span>
          )}
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Measurement Tools */}
        <ToolButton
          tool="count"
          current={currentTool}
          onClick={onToolChange}
          disabled={!isCalibrated && false} // Count doesn't need scale
        />
        <ToolButton
          tool="area"
          current={currentTool}
          onClick={onToolChange}
          disabled={!isCalibrated}
        />
        <ToolButton
          tool="linear"
          current={currentTool}
          onClick={onToolChange}
          disabled={!isCalibrated}
        />
        <ToolButton
          tool="perimeter"
          current={currentTool}
          onClick={onToolChange}
          disabled={!isCalibrated}
        />
        <ToolButton
          tool="deduction"
          current={currentTool}
          onClick={onToolChange}
          disabled={!isCalibrated}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Layer Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Layers className="h-4 w-4" />
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: activeLayer?.color || "#6B7280" }}
              />
              <span className="max-w-[100px] truncate">
                {activeLayer?.name || "Layer"}
              </span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {layers.map((layer) => (
              <DropdownMenuItem
                key={layer.id}
                onClick={() => onLayerChange(layer)}
                className="gap-2"
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: layer.color }}
                />
                <span>{layer.name}</span>
                {layer.measurement_count > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {layer.measurement_count}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            {layers.length === 0 && (
              <DropdownMenuItem disabled>No layers</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        {/* Undo/Redo */}
        {onUndo && onRedo && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onUndo}
                  disabled={!canUndo}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Cmd+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRedo}
                  disabled={!canRedo}
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Cmd+Shift+Z)</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1" />
          </>
        )}

        {/* Zoom Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onZoomChange(Math.max(zoom - 0.25, 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out (-)</TooltipContent>
        </Tooltip>

        <span className="text-sm font-medium w-14 text-center">
          {Math.round(zoom * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onZoomChange(Math.min(zoom + 0.25, 3))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In (+)</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// Tool Button Component
// =============================================================================

interface ToolButtonProps {
  tool: TakeoffTool;
  current: TakeoffTool;
  onClick: (tool: TakeoffTool) => void;
  disabled?: boolean;
  highlight?: boolean;
}

function ToolButton({ tool, current, onClick, disabled, highlight }: ToolButtonProps) {
  const config = TAKEOFF_TOOLS[tool];
  const isActive = tool === current;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? "secondary" : "ghost"}
          size="icon"
          onClick={() => onClick(tool)}
          disabled={disabled}
          className={highlight ? "ring-2 ring-amber-500 ring-offset-1" : ""}
        >
          {TOOL_ICONS[tool]}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {config.label} ({config.shortcut})
      </TooltipContent>
    </Tooltip>
  );
}
