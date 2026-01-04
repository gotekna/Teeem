'use client';

/**
 * GanttToolbar - Toolbar for the unified Gantt chart
 *
 * Contains all toolbar buttons: zoom controls, navigation, view toggles, etc.
 * Matches the toolbar from the old GanttCanvasView for feature parity.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Calendar,
  GitBranch,
  Expand,
  X,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  Filter,
  Columns,
  Activity,
  Download,
  Layers,
  Camera,
  Bookmark,
  Info,
  Check,
  RefreshCw,
  GripVertical,
  FastForward,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TableColumn } from './UnifiedGanttCanvas';

// =============================================================================
// Types
// =============================================================================

interface GanttToolbarProps {
  // Zoom controls
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
  zoomLevel?: number; // Current zoom level (percentage, e.g., 100 = 100%)

  // Navigation
  onScrollToToday: () => void;

  // View toggles
  onToggleDependencies: () => void;
  onToggleFullscreen: () => void;

  // Collapse/expand
  onCollapseAll?: () => void;
  onExpandAll?: () => void;

  // Search & filter
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showGroupedOnly?: boolean;
  onToggleGroupedOnly?: () => void;

  // State
  showDependencies: boolean;
  isFullscreen: boolean;
  taskCount: number;

  // Critical path
  showCriticalPath?: boolean;
  onToggleCriticalPath?: () => void;

  // Baseline comparison
  showBaseline?: boolean;
  onToggleBaseline?: () => void;
  onCaptureBaseline?: () => void;

  // View filter
  viewSlug?: string;
  onViewClear?: () => void;

  // Column visibility & reordering
  columns?: TableColumn[];
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void;
  onColumnReorder?: (fromIndex: number, toIndex: number) => void;

  // Export
  onExportPNG?: () => void;

  // Refresh
  onRefresh?: () => void;

  // Rollover - SSoT: POST /api/v1/jobs/{jobId}/sm_tasks/validate_dates
  onRollover?: () => void;
  isRollingOver?: boolean;

  // Job-specific: Photo panel toggle
  jobId?: number;
  showPhotoPanel?: boolean;
  onTogglePhotoPanel?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function GanttToolbar({
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  zoomLevel,
  onScrollToToday,
  onToggleDependencies,
  onToggleFullscreen,
  onCollapseAll,
  onExpandAll,
  searchQuery = '',
  onSearchChange,
  showGroupedOnly = false,
  onToggleGroupedOnly,
  showDependencies,
  isFullscreen,
  taskCount,
  showCriticalPath = false,
  onToggleCriticalPath,
  showBaseline = false,
  onToggleBaseline,
  onCaptureBaseline,
  viewSlug,
  onViewClear,
  columns,
  onColumnVisibilityChange,
  onColumnReorder,
  onExportPNG,
  onRefresh,
  onRollover,
  isRollingOver = false,
  jobId,
  showPhotoPanel,
  onTogglePhotoPanel,
}: GanttToolbarProps) {
  // Drag state for column reordering
  const [draggedColumnIndex, setDraggedColumnIndex] = React.useState<number | null>(null);
  const [dragOverColumnIndex, setDragOverColumnIndex] = React.useState<number | null>(null);
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b bg-muted/30">
      {/* Left Group: Zoom & Navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomOut}
          title="Zoom Out"
          className="h-8 w-8"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>

        {/* Zoom level display */}
        {zoomLevel !== undefined && (
          <span className="text-[10px] font-mono text-muted-foreground min-w-[36px] text-center">
            {Math.round(zoomLevel)}%
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomIn}
          title="Zoom In"
          className="h-8 w-8"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon"
          onClick={onScrollToToday}
          title="Go to Today"
          className="h-8 w-8"
        >
          <Calendar className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomToFit}
          title="Zoom to Fit"
          className="h-8 w-8"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>

        {/* Refresh Button */}
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            title="Refresh Data"
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}

        {/* Rollover Button - SSoT: moves past-due tasks forward */}
        {onRollover && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRollover}
            disabled={isRollingOver}
            title="Rollover: Move past-due tasks to today"
            className="h-8 w-8"
          >
            <FastForward className={`h-4 w-4 ${isRollingOver ? 'animate-pulse' : ''}`} />
          </Button>
        )}

        <div className="w-px h-4 bg-border mx-1" />

        {/* Collapse/Expand */}
        {onCollapseAll && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapseAll}
            title="Collapse All"
            className="h-8 w-8"
          >
            <ChevronsDownUp className="h-4 w-4" />
          </Button>
        )}

        {onExpandAll && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onExpandAll}
            title="Expand All"
            className="h-8 w-8"
          >
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Center Group: Search & Filters */}
      <div className="flex items-center gap-2">
        {/* Search Input */}
        {onSearchChange && (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 w-40 pl-7 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Grouped Only Toggle */}
        {onToggleGroupedOnly && (
          <Button
            variant={showGroupedOnly ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onToggleGroupedOnly}
            title={showGroupedOnly ? 'Show All Tasks' : 'Show Grouped Only'}
            className="h-8 text-xs gap-1"
          >
            <Filter className="h-3.5 w-3.5" />
            Grouped
          </Button>
        )}

        {/* Dependencies Toggle */}
        <Button
          variant={showDependencies ? 'secondary' : 'ghost'}
          size="icon"
          onClick={onToggleDependencies}
          title={showDependencies ? 'Hide Dependencies' : 'Show Dependencies'}
          className="h-8 w-8"
        >
          <GitBranch className="h-4 w-4" />
        </Button>

        {/* Critical Path Toggle */}
        {onToggleCriticalPath && (
          <Button
            variant={showCriticalPath ? 'secondary' : 'ghost'}
            size="icon"
            onClick={onToggleCriticalPath}
            title={showCriticalPath ? 'Hide Critical Path (C)' : 'Show Critical Path (C)'}
            className="h-8 w-8"
          >
            <Activity className="h-4 w-4" style={{ color: showCriticalPath ? '#ef4444' : undefined }} />
          </Button>
        )}

        {/* Baseline Comparison Toggle */}
        {onToggleBaseline && (
          <Button
            variant={showBaseline ? 'secondary' : 'ghost'}
            size="icon"
            onClick={onToggleBaseline}
            title={showBaseline ? 'Hide Baseline (B)' : 'Show Baseline (B)'}
            className="h-8 w-8"
          >
            <Layers className="h-4 w-4" style={{ color: showBaseline ? '#3b82f6' : undefined }} />
          </Button>
        )}

        {/* Capture Baseline */}
        {onCaptureBaseline && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCaptureBaseline}
            title="Capture Baseline"
            className="h-8 w-8"
          >
            <Bookmark className="h-4 w-4" />
          </Button>
        )}

        {/* Legend Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Color Legend"
              className="h-8 w-8"
            >
              <Info className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Task Bar Colors</h4>
              <p className="text-xs text-muted-foreground">Based on checkbox status (priority order)</p>
              <div className="grid gap-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-2.5 rounded" style={{ backgroundColor: 'rgba(31, 41, 55, 0.4)' }} />
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Done</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-2.5 rounded" style={{ backgroundColor: 'rgba(168, 85, 247, 0.3)' }} />
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Supplier Confirmed</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-2.5 rounded" style={{ backgroundColor: 'rgba(249, 115, 22, 0.35)' }} />
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Confirmed</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-2.5 rounded" style={{ backgroundColor: 'rgba(212, 165, 116, 0.4)' }} />
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">On Hold</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-2.5 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.35)' }} />
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Started</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-2.5 rounded" style={{ backgroundColor: '#9ca3af' }} />
                  <span className="text-muted-foreground">Not Started (default)</span>
                </div>
              </div>

              <div className="border-t pt-2 mt-2">
                <h4 className="font-medium text-sm mb-1.5">Background Shading</h4>
                <div className="grid gap-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-2.5 rounded" style={{ backgroundColor: '#ef4444' }} />
                    <span className="text-muted-foreground">Today marker</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-2.5 rounded" style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }} />
                    <span className="text-muted-foreground">Weekend</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-2.5 rounded" style={{ backgroundColor: 'rgba(254, 226, 226, 0.8)', border: '1px solid rgba(239, 68, 68, 0.2)' }} />
                    <span className="text-muted-foreground">Holiday</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-2.5 rounded" style={{ backgroundColor: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)' }} />
                    <span className="text-muted-foreground">Group row</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-2.5 rounded" style={{ backgroundColor: 'rgba(251, 191, 36, 0.3)', border: '1px solid rgba(251, 191, 36, 0.4)' }} />
                    <span className="text-muted-foreground">Weekend on group</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-2.5 rounded" style={{ backgroundColor: 'rgba(251, 146, 60, 0.4)', border: '1px solid rgba(217, 119, 6, 0.4)' }} />
                    <span className="text-muted-foreground">Holiday on group</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-2.5 rounded border border-red-400" style={{ boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)' }} />
                    <span className="text-muted-foreground">Critical path (press C)</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-2 mt-2">
                <h4 className="font-medium text-sm mb-1.5">Dependency Lines</h4>
                <div className="grid gap-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg, #000 0px, #000 3px, #fbbf24 3px, #fbbf24 6px)' }} />
                    <span className="text-muted-foreground">Predecessor (on click)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg, #000 0px, #000 3px, #60a5fa 3px, #60a5fa 6px)' }} />
                    <span className="text-muted-foreground">Successor (on click)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      <div className="w-6 h-[3px]" style={{ background: 'repeating-linear-gradient(90deg, #000 0px, #000 3px, #ef4444 3px, #ef4444 6px)' }} />
                      <span className="text-red-500 text-[10px] font-bold">✕</span>
                    </div>
                    <span className="text-muted-foreground">Broken dependency</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-2 mt-2">
                <h4 className="font-medium text-sm mb-1.5">Task Shapes</h4>
                <div className="grid gap-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-2.5 rounded" style={{ backgroundColor: '#9ca3af' }} />
                    <span className="text-muted-foreground">Regular task (bar)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg width="16" height="12" viewBox="0 0 16 12">
                      <polygon points="8,1 15,6 8,11 1,6" fill="#ea580c" stroke="#9a3412" strokeWidth="1" />
                      <text x="8" y="7" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">O</text>
                    </svg>
                    <span className="text-muted-foreground">Order task (spawned)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg width="16" height="12" viewBox="0 0 16 12">
                      <polygon points="8,1 15,6 8,11 1,6" fill="#2563eb" stroke="#1e40af" strokeWidth="1" />
                      <text x="8" y="7" textAnchor="middle" fontSize="6" fill="white" fontWeight="bold">C</text>
                    </svg>
                    <span className="text-muted-foreground">Call task (spawned)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg width="16" height="12" viewBox="0 0 16 12">
                      {/* Camera body */}
                      <rect x="2" y="3" width="12" height="8" rx="1.5" fill="#9333ea" stroke="#7c3aed" strokeWidth="0.5" />
                      {/* Viewfinder bump */}
                      <rect x="6" y="1" width="4" height="2" rx="0.5" fill="#9333ea" />
                      {/* Lens outer */}
                      <circle cx="8" cy="7" r="3" fill="white" />
                      {/* Lens inner */}
                      <circle cx="8" cy="7" r="1.5" fill="#9333ea" />
                    </svg>
                    <span className="text-muted-foreground">Photo task (spawned)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-2.5 rounded overflow-hidden relative"
                      style={{ backgroundColor: '#a855f7' }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `
                            linear-gradient(45deg, rgba(255,255,255,0.3) 25%, transparent 25%),
                            linear-gradient(-45deg, rgba(255,255,255,0.3) 25%, transparent 25%),
                            linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.3) 75%),
                            linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.3) 75%)
                          `,
                          backgroundSize: '4px 4px',
                          backgroundPosition: '0 0, 0 2px, 2px -2px, -2px 0px'
                        }}
                      />
                    </div>
                    <span className="text-muted-foreground">Broken dependency (checkered)</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-2 mt-2 text-xs text-muted-foreground">
                <p className="font-medium mb-1">Keyboard Shortcuts</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <span>T - Go to Today</span>
                  <span>C - Critical Path</span>
                  <span>B - Baseline</span>
                  <span>M - Minimap</span>
                  <span>+/- - Zoom In/Out</span>
                  <span>V - Cycle Zoom</span>
                  <span>1 - Day View</span>
                  <span>2 - Week View</span>
                  <span>3 - Month View</span>
                  <span>↑↓ - Navigate</span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Column Visibility Toggle */}
        {columns && onColumnVisibilityChange && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Toggle Columns"
                className="h-8 w-8"
              >
                <Columns className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="end">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Show/Hide & Reorder Columns
              </div>
              <div className="space-y-0.5">
                {columns
                  .filter((col) => col.id !== 'row_number' && col.id !== 'name') // Always show these
                  .map((column, index) => {
                    // Get the actual index in the full columns array for reordering
                    const actualIndex = columns.findIndex((c) => c.id === column.id);
                    return (
                      <div
                        key={column.id}
                        draggable={!!onColumnReorder}
                        onDragStart={(e) => {
                          if (!onColumnReorder) return;
                          setDraggedColumnIndex(actualIndex);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          if (!onColumnReorder || draggedColumnIndex === null) return;
                          e.preventDefault();
                          setDragOverColumnIndex(actualIndex);
                        }}
                        onDragLeave={() => {
                          setDragOverColumnIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (
                            onColumnReorder &&
                            draggedColumnIndex !== null &&
                            draggedColumnIndex !== actualIndex
                          ) {
                            onColumnReorder(draggedColumnIndex, actualIndex);
                          }
                          setDraggedColumnIndex(null);
                          setDragOverColumnIndex(null);
                        }}
                        onDragEnd={() => {
                          setDraggedColumnIndex(null);
                          setDragOverColumnIndex(null);
                        }}
                        className={`flex items-center gap-1 px-1 py-1 rounded transition-colors ${
                          dragOverColumnIndex === actualIndex
                            ? 'bg-primary/20 border-2 border-dashed border-primary'
                            : 'hover:bg-muted'
                        } ${draggedColumnIndex === actualIndex ? 'opacity-50' : ''}`}
                      >
                        {/* Drag handle */}
                        {onColumnReorder && (
                          <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                            <GripVertical className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <Checkbox
                            checked={column.visible}
                            onCheckedChange={(checked) =>
                              onColumnVisibilityChange(column.id, checked === true)
                            }
                          />
                          <span className="text-sm">{column.label}</span>
                        </label>
                      </div>
                    );
                  })}
              </div>
              {onColumnReorder && (
                <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t">
                  Drag to reorder columns
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Right Group: Info & Fullscreen */}
      <div className="flex items-center gap-2">
        {/* View Badge */}
        {viewSlug && (
          <Badge variant="secondary" className="gap-1">
            {viewSlug}
            {onViewClear && (
              <button
                onClick={onViewClear}
                className="ml-1 hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        )}

        {/* Task Count */}
        <span className="text-xs text-muted-foreground">
          {taskCount} tasks
        </span>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Export PNG Button */}
        {onExportPNG && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onExportPNG}
            title="Export as PNG"
            className="h-8 w-8"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}

        {/* Photo Panel Toggle (only for jobs) */}
        {jobId && onTogglePhotoPanel && (
          <Button
            variant={showPhotoPanel ? 'secondary' : 'ghost'}
            size="icon"
            onClick={onTogglePhotoPanel}
            title={showPhotoPanel ? 'Hide Photos' : 'Show Photos'}
            className="h-8 w-8"
          >
            <Camera className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          className="h-8 w-8"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Expand className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export default GanttToolbar;
