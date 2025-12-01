"use client";

import * as React from "react";
import { ZoomIn, ZoomOut, Calendar, Maximize2, Minimize2, RotateCcw, LayoutGrid, GanttChartSquare, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useGantt } from "./context";
import type { GanttRange, HoldState } from "./types";
import { holdReasons } from "./types";
import { GanttFilterPanel, type GanttFilters } from "./gantt-filter-panel";
import { GanttViewSelector, type GanttGroupMode } from "./gantt-view-selector";
import { GanttColumnConfig, type ColumnConfig, defaultColumnConfig } from "./gantt-column-config";

export type GanttViewMode = "timeline" | "table";

type GanttControlsProps = {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  title?: string;
  viewMode?: GanttViewMode;
  onViewModeChange?: (mode: GanttViewMode) => void;
  holdState?: HoldState;
  // Filter props
  filters?: GanttFilters;
  onFiltersChange?: (filters: GanttFilters) => void;
  trades?: string[];
  // Group mode props
  groupMode?: GanttGroupMode;
  onGroupModeChange?: (mode: GanttGroupMode) => void;
  // Column config props
  columnConfig?: ColumnConfig;
  onColumnConfigChange?: (config: ColumnConfig) => void;
  showFilters?: boolean;
};

export function GanttControls({
  isFullscreen,
  onToggleFullscreen,
  title,
  viewMode = "timeline",
  onViewModeChange,
  holdState,
  filters,
  onFiltersChange,
  trades,
  groupMode,
  onGroupModeChange,
  columnConfig,
  onColumnConfigChange,
  showFilters = true,
}: GanttControlsProps) {
  const { range, setRange, zoom, setZoom } = useGantt();

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.25, 2));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  // Get hold reason label
  const holdReasonLabel = holdState?.reason
    ? holdReasons.find((r) => r.id === holdState.reason)?.label
    : null;

  return (
    <div className="flex flex-col">
      {/* Hold Banner - shown when job is on hold */}
      {holdState?.isOnHold && (
        <div className="flex items-center gap-2 px-4 py-2 bg-status-warning/10 border-b border-status-warning/20">
          <PauseCircle className="h-4 w-4 text-status-warning" />
          <span className="text-[12px] font-medium text-status-warning">
            Job On Hold
          </span>
          {holdReasonLabel && (
            <span className="text-[11px] text-muted-foreground">
              — {holdReasonLabel}
            </span>
          )}
          {holdState.heldAt && (
            <span className="text-[10px] text-muted-foreground ml-auto font-mono">
              Since {holdState.heldAt.toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-background">
        {/* Left side - Title (in fullscreen) or Range selector */}
        <div className="flex items-center gap-3">
          {isFullscreen && title && (
            <h3 className="text-[14px] font-medium mr-4">{title}</h3>
          )}

        {/* Range selector */}
        <Select value={range} onValueChange={(v) => setRange(v as GanttRange)}>
          <SelectTrigger className="w-[140px] h-8">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>

        {/* Group mode selector */}
        {onGroupModeChange && groupMode && (
          <GanttViewSelector
            value={groupMode}
            onChange={onGroupModeChange}
          />
        )}
      </div>

      {/* Center - Filters */}
      {showFilters && filters && onFiltersChange && (
        <GanttFilterPanel
          filters={filters}
          onFiltersChange={onFiltersChange}
          trades={trades}
        />
      )}

      {/* Right side - View toggle, Zoom controls and fullscreen */}
      <div className="flex items-center gap-2">
        {/* View mode toggle */}
        {onViewModeChange && (
          <div className="flex items-center border border-border">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                viewMode === "timeline" && "bg-secondary"
              )}
              onClick={() => onViewModeChange("timeline")}
              title="Timeline view"
            >
              <GanttChartSquare className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8",
                viewMode === "table" && "bg-secondary"
              )}
              onClick={() => onViewModeChange("table")}
              title="Table view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Zoom controls - only show in timeline view */}
        {viewMode === "timeline" && (
          <div className="flex items-center border border-border">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <button
              onClick={handleZoomReset}
              className="text-[11px] font-mono w-12 text-center hover:bg-secondary transition-colors"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomIn}
              disabled={zoom >= 2}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Today button - only show in timeline view */}
        {viewMode === "timeline" && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-[11px]"
            onClick={() => {
              // Could scroll to today - for now just reset zoom
              handleZoomReset();
            }}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Today
          </Button>
        )}

        {/* Column config - only show in table view */}
        {viewMode === "table" && onColumnConfigChange && columnConfig && (
          <GanttColumnConfig
            config={columnConfig}
            onConfigChange={onColumnConfigChange}
          />
        )}

        {/* Fullscreen toggle */}
        {onToggleFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        )}
        </div>
      </div>
    </div>
  );
}
