/**
 * TableToolbar Component
 *
 * Renders the table toolbar with:
 * - Header (title, record count, view selector)
 * - Left actions (Add button, bulk actions)
 * - Search input
 * - Right actions (Filters, Refresh, More menu)
 *
 * Part of Layer 3: Render Components
 *
 * @example
 * <TableToolbar
 *   title="Jobs"
 *   totalCount={150}
 *   onAdd={() => setShowCreateModal(true)}
 *   onRefresh={handleRefresh}
 * />
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Filter,
  RefreshCw,
  MoreVertical,
  Columns,
  Download,
  Upload,
  Settings,
  PlusCircle,
  MinusCircle,
  Trash2,
  Pencil,
  Merge,
  ArrowLeftRight,
  Check,
  Expand,
  Minimize2,
  Search,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { SavedView } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface TableToolbarProps {
  /** Table title displayed in header */
  title?: string;

  /** Total record count (displayed in header) */
  totalCount?: number | null;

  /** Currently displayed record count (after filtering) */
  displayedCount?: number;

  /** Whether data is loading */
  isLoading?: boolean;

  /** Current search query */
  searchQuery?: string;

  /** Search input change handler */
  onSearchChange?: (value: string) => void;

  /** Placeholder for search input */
  searchPlaceholder?: string;

  // Header options
  showHeader?: boolean;

  // Views
  /** Saved views list */
  savedViews?: SavedView[];

  /** Active view ID */
  activeViewId?: number | string | null;

  /** Active view name */
  activeViewName?: string | null;

  /** Handler to open view manager */
  onOpenViewManager?: () => void;

  // Left actions
  /** Left side custom content */
  leftActions?: React.ReactNode;

  /** Add button handler (shows Add button if provided) */
  onAdd?: () => void;

  /** Add button label */
  addLabel?: string;

  // Selection and bulk actions
  /** Number of selected rows */
  selectedCount?: number;

  /** Bulk edit handler */
  onBulkEdit?: () => void;

  /** Bulk delete handler */
  onBulkDelete?: () => void;

  /** Bulk merge handler */
  onBulkMerge?: () => void;

  /** Xero transfer handler (shown when exactly 2 selected) */
  onXeroTransfer?: () => void;

  /** Custom bulk actions renderer */
  customBulkActions?: React.ReactNode;

  /** Clear selection handler */
  onClearSelection?: () => void;

  // Right actions
  /** Custom actions (rendered before Filters button) */
  customActions?: React.ReactNode;

  /** Filter count (badge on Filters button) */
  filterCount?: number;

  /** Handler to open filter panel */
  onOpenFilters?: () => void;

  /** Refresh handler */
  onRefresh?: () => void;

  // Fullscreen
  /** Enable fullscreen toggle */
  enableFullscreen?: boolean;

  /** Current fullscreen state */
  isFullscreen?: boolean;

  /** Toggle fullscreen handler */
  onToggleFullscreen?: () => void;

  // More menu options
  /** Handler to open columns modal */
  onOpenColumns?: () => void;

  /** Enable schema editor menu items */
  enableSchemaEditor?: boolean;

  /** Handler to create column */
  onCreateColumn?: () => void;

  /** Handler to edit columns */
  onEditColumns?: () => void;

  /** Handler to delete column */
  onDeleteColumn?: () => void;

  /** Column edit mode state */
  columnEditMode?: boolean;

  /** Toggle column edit mode */
  onToggleColumnEditMode?: () => void;

  /** Enable import */
  enableImport?: boolean;

  /** Import handler */
  onImport?: () => void;

  /** Enable export */
  enableExport?: boolean;

  /** Export handler */
  onExport?: () => void;

  /** Show column filters toggle */
  showColumnFilters?: boolean;

  /** Toggle column filters */
  onToggleColumnFilters?: () => void;

  /** Foundation ID (for table info display) */
  foundationId?: string | number;

  /** View only mode (disables editing actions) */
  viewOnly?: boolean;

  /** Custom table info content */
  tableInfo?: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Table toolbar component
 *
 * Provides a consistent toolbar layout with configurable sections.
 */
export function TableToolbar({
  title,
  totalCount,
  displayedCount,
  isLoading,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  showHeader = true,
  savedViews,
  activeViewId,
  activeViewName,
  onOpenViewManager,
  leftActions,
  onAdd,
  addLabel = 'Add',
  selectedCount = 0,
  onBulkEdit,
  onBulkDelete,
  onBulkMerge,
  onXeroTransfer,
  customBulkActions,
  onClearSelection,
  customActions,
  filterCount = 0,
  onOpenFilters,
  onRefresh,
  enableFullscreen,
  isFullscreen,
  onToggleFullscreen,
  onOpenColumns,
  enableSchemaEditor,
  onCreateColumn,
  onEditColumns,
  onDeleteColumn,
  columnEditMode,
  onToggleColumnEditMode,
  enableImport,
  onImport,
  enableExport,
  onExport,
  showColumnFilters,
  onToggleColumnFilters,
  foundationId,
  viewOnly,
  tableInfo,
}: TableToolbarProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Header row: Title, count, view selector */}
      {showHeader && (
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {title && (
              <h2 className="text-lg font-semibold">{title}</h2>
            )}
            {totalCount !== null && totalCount !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {displayedCount !== undefined && displayedCount !== totalCount
                  ? `${displayedCount} / ${totalCount}`
                  : totalCount} records
              </Badge>
            )}
            {activeViewName && (
              <Badge variant="outline" className="text-xs">
                View: {activeViewName}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Toolbar row: Actions, search, buttons */}
      <div className="flex items-center justify-between gap-4 px-4">
        {/* Left side: Custom actions, Add button, Bulk actions */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Custom left actions */}
          {leftActions}

          {/* Add button */}
          {onAdd && !viewOnly && (
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4 mr-1" />
              {addLabel}
            </Button>
          )}

          {/* Bulk actions - shown when rows are selected */}
          {hasSelection && !viewOnly && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l">
              <Badge variant="secondary" className="text-xs">
                {selectedCount} selected
              </Badge>

              {onClearSelection && (
                <Button variant="ghost" size="sm" onClick={onClearSelection}>
                  Clear
                </Button>
              )}

              {customBulkActions}

              {onBulkEdit && (
                <Button variant="outline" size="sm" onClick={onBulkEdit}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}

              {onBulkMerge && selectedCount >= 2 && (
                <Button variant="outline" size="sm" onClick={onBulkMerge}>
                  <Merge className="h-4 w-4 mr-1" />
                  Merge
                </Button>
              )}

              {onXeroTransfer && selectedCount === 2 && (
                <Button variant="outline" size="sm" onClick={onXeroTransfer}>
                  <ArrowLeftRight className="h-4 w-4 mr-1" />
                  Xero
                </Button>
              )}

              {onBulkDelete && (
                <Button variant="destructive" size="sm" onClick={onBulkDelete}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          )}

          {/* Search input */}
          {onSearchChange && (
            <div className="flex-1 max-w-md ml-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 pl-9 pr-9"
                  aria-label="Search table"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right side: Filters, Fullscreen, Refresh, More */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Custom actions */}
          {customActions}

          {/* Filters button */}
          {onOpenFilters && (
            <Button variant="outline" size="sm" onClick={onOpenFilters}>
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {filterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {filterCount}
                </Badge>
              )}
            </Button>
          )}

          {/* Fullscreen toggle */}
          {enableFullscreen && onToggleFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'}
              className="h-9 w-9"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Expand className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              title="Refresh data"
              className="h-9 w-9"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}

          {/* More actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Columns */}
              {onOpenColumns && (
                <DropdownMenuItem onClick={onOpenColumns}>
                  <Columns className="h-4 w-4 mr-2" />
                  Columns
                </DropdownMenuItem>
              )}

              {/* Schema section */}
              {enableSchemaEditor && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                    SCHEMA
                  </DropdownMenuLabel>
                  {onCreateColumn && (
                    <DropdownMenuItem onClick={onCreateColumn}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Create New Column
                    </DropdownMenuItem>
                  )}
                  {onEditColumns && (
                    <DropdownMenuItem onClick={onEditColumns}>
                      <Settings className="h-4 w-4 mr-2" />
                      Edit Columns
                    </DropdownMenuItem>
                  )}
                  {onDeleteColumn && (
                    <DropdownMenuItem onClick={onDeleteColumn}>
                      <MinusCircle className="h-4 w-4 mr-2" />
                      Delete Column
                    </DropdownMenuItem>
                  )}
                  {onToggleColumnEditMode && (
                    <DropdownMenuItem onClick={onToggleColumnEditMode}>
                      <Settings className="h-4 w-4 mr-2" />
                      {columnEditMode ? 'Exit Edit Mode' : 'Edit Individual'}
                      {columnEditMode && (
                        <Badge variant="secondary" className="ml-2 text-xs">ON</Badge>
                      )}
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {/* Data section */}
              {(enableImport || enableExport) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                    DATA
                  </DropdownMenuLabel>
                  {enableImport && onImport && (
                    <DropdownMenuItem onClick={onImport}>
                      <Download className="h-4 w-4 mr-2" />
                      Import
                    </DropdownMenuItem>
                  )}
                  {enableExport && onExport && (
                    <DropdownMenuItem onClick={onExport}>
                      <Upload className="h-4 w-4 mr-2" />
                      Export
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {/* Display section */}
              {onToggleColumnFilters && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                    DISPLAY
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={onToggleColumnFilters}
                    className="flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Column Filters
                    </span>
                    {showColumnFilters && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                </>
              )}

              {/* Table info section */}
              {(foundationId || tableInfo) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                    TABLE INFO
                  </DropdownMenuLabel>
                  {foundationId && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Foundation ID: <span className="font-mono">{foundationId}</span>
                    </div>
                  )}
                  {tableInfo}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export default TableToolbar;
