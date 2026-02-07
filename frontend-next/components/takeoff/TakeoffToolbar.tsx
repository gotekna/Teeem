"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Maximize2,
  Undo2,
  Redo2,
} from "lucide-react";
import type { TakeoffTool, TakeoffLayer } from "./types";
import { TAKEOFF_TOOLS } from "./types";
import { LayerManager } from "./LayerManager";
import { ScaleDetector } from "./ScaleDetector";
import { ElementDetector, type DetectedElement } from "./ElementDetector";
import { TemplateSelector, type TakeoffTemplate, type TemplateStep } from "./TemplateSelector";
import { OfflineIndicator } from "./OfflineIndicator";

// =============================================================================
// Props
// =============================================================================

interface TakeoffToolbarProps {
  currentTool: TakeoffTool;
  onToolChange: (tool: TakeoffTool) => void;

  // Zoom
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToView?: () => void;

  // Layer
  activeLayer: TakeoffLayer | null;
  layers: TakeoffLayer[];
  onLayerChange: (layer: TakeoffLayer) => void;
  onCreateLayer: (name: string, color: string) => Promise<void>;
  onUpdateLayer: (id: number, updates: Partial<TakeoffLayer>) => Promise<void>;
  onDeleteLayer: (id: number) => Promise<void>;
  onToggleLayerVisibility: (id: number, visible: boolean) => Promise<void>;
  onToggleLayerLock: (id: number, locked: boolean) => Promise<void>;

  // Undo/Redo (optional)
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;

  // Scale status
  isCalibrated: boolean;
  scaleLabel?: string;

  // AI Scale Detection
  pageCanvas: HTMLCanvasElement | null;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  planId?: string;
  docsortItemId?: string;
  onScaleDetected: (scaleText: string, referenceMm: number) => void;
  onElementsDetected: (elements: DetectedElement[]) => void;

  // Templates
  onTemplateSelect: (template: TakeoffTemplate, steps: TemplateStep[]) => void;

  // Offline
  pdfUrl?: string | null;
  onSyncComplete?: () => void;
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
  onFitToView,
  activeLayer,
  layers,
  onLayerChange,
  onCreateLayer,
  onUpdateLayer,
  onDeleteLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  isCalibrated,
  scaleLabel,
  pageCanvas,
  pageNumber,
  pageWidth,
  pageHeight,
  planId,
  docsortItemId,
  onScaleDetected,
  onElementsDetected,
  onTemplateSelect,
  pdfUrl,
  onSyncComplete,
}: TakeoffToolbarProps) {
  // Editable zoom input state
  const [isEditingZoom, setIsEditingZoom] = React.useState(false);
  const [zoomInputValue, setZoomInputValue] = React.useState("");
  const zoomInputRef = React.useRef<HTMLInputElement>(null);

  const handleZoomInputStart = () => {
    setZoomInputValue(String(Math.round(zoom * 100)));
    setIsEditingZoom(true);
    setTimeout(() => zoomInputRef.current?.select(), 0);
  };

  const handleZoomInputCommit = () => {
    setIsEditingZoom(false);
    const parsed = parseInt(zoomInputValue, 10);
    if (!isNaN(parsed) && parsed >= 10 && parsed <= 1000) {
      onZoomChange(parsed / 100);
    }
  };

  const handleZoomInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleZoomInputCommit();
    } else if (e.key === "Escape") {
      setIsEditingZoom(false);
    }
    e.stopPropagation(); // Prevent toolbar shortcuts while typing
  };

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

      // Zoom shortcuts (5% steps)
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        onZoomChange(Math.min(zoom + 0.05, 3));
      } else if (e.key === "-") {
        e.preventDefault();
        onZoomChange(Math.max(zoom - 0.05, 0.1));
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
      <div className="flex items-center gap-1 px-2 py-1 bg-background border-b">
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

        {/* AI Scale Detection */}
        <ScaleDetector
          planId={planId}
          docsortItemId={docsortItemId}
          pageNumber={pageNumber}
          pageCanvas={pageCanvas}
          onScaleDetected={onScaleDetected}
          isCalibrated={isCalibrated}
        />

        {/* AI Element Detection */}
        <ElementDetector
          planId={planId}
          docsortItemId={docsortItemId}
          pageNumber={pageNumber}
          pageCanvas={pageCanvas}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          onElementsDetected={onElementsDetected}
          isCalibrated={isCalibrated}
        />

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

        {/* Templates */}
        <TemplateSelector
          onTemplateSelect={onTemplateSelect}
          disabled={!isCalibrated}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Layer Manager */}
        <LayerManager
          layers={layers}
          activeLayer={activeLayer}
          onLayerChange={onLayerChange}
          onCreateLayer={onCreateLayer}
          onUpdateLayer={onUpdateLayer}
          onDeleteLayer={onDeleteLayer}
          onToggleVisibility={onToggleLayerVisibility}
          onToggleLock={onToggleLayerLock}
        />

        <div className="flex-1" />

        {/* Offline Status */}
        <OfflineIndicator
          planId={planId}
          docsortItemId={docsortItemId}
          pdfUrl={pdfUrl}
          onSyncComplete={onSyncComplete}
        />

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
              onClick={() => onZoomChange(Math.max(zoom - 0.05, 0.1))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out (-)</TooltipContent>
        </Tooltip>

        {isEditingZoom ? (
          <input
            ref={zoomInputRef}
            type="text"
            inputMode="numeric"
            value={zoomInputValue}
            onChange={(e) => setZoomInputValue(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={handleZoomInputCommit}
            onKeyDown={handleZoomInputKeyDown}
            className="w-14 text-sm font-medium text-center bg-muted border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        ) : (
          <button
            onClick={handleZoomInputStart}
            className="text-sm font-medium w-14 text-center hover:bg-muted rounded px-1 py-0.5 cursor-text"
            title="Click to type zoom %"
          >
            {Math.round(zoom * 100)}%
          </button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onZoomChange(Math.min(zoom + 0.05, 3))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In (+)</TooltipContent>
        </Tooltip>

        {onFitToView && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onFitToView}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to View</TooltipContent>
          </Tooltip>
        )}
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
