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
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Columns,
  Activity,
  Download,
  Layers,
  Camera,
  Info,
  Check,
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

  // Column visibility
  columns?: TableColumn[];
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void;

  // Export
  onExportPNG?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function GanttToolbar({
  onZoomIn,
  onZoomOut,
  onZoomToFit,
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
  onExportPNG,
}: GanttToolbarProps) {
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
            <ChevronRight className="h-4 w-4" />
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
            <ChevronDown className="h-4 w-4" />
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
            <Camera className="h-4 w-4" />
          </Button>
        )}

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
            <PopoverContent className="w-56 p-2" align="end">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Show/Hide Columns
              </div>
              <div className="space-y-1">
                {columns
                  .filter((col) => col.id !== 'row_number' && col.id !== 'name') // Always show these
                  .map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={column.visible}
                        onCheckedChange={(checked) =>
                          onColumnVisibilityChange(column.id, checked === true)
                        }
                      />
                      <span className="text-sm">{column.label}</span>
                    </label>
                  ))}
              </div>
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
