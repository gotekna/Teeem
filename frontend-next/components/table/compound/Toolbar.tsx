/**
 * Table Toolbar Compound Component
 *
 * Composable toolbar for table actions, search, and filters.
 * Can be used with sub-components for full customization.
 *
 * @example
 * // Simple usage (auto-renders everything)
 * <Table.Toolbar />
 *
 * @example
 * // Custom composition
 * <Table.Toolbar>
 *   <Table.Search />
 *   <Table.FilterButton />
 *   <Button onClick={myAction}>Custom Action</Button>
 * </Table.Toolbar>
 */

'use client';

import React from 'react';
import { useTableContext } from './TableContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Filter,
  RefreshCw,
  Search as SearchIcon,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TOOLBAR ROOT
// ============================================================================

export interface ToolbarProps {
  /** Children to render (if provided, replaces default content) */
  children?: React.ReactNode;

  /** Additional className */
  className?: string;

  /** Show the header row with title and count */
  showHeader?: boolean;

  /** Add button handler */
  onAdd?: () => void;

  /** Add button label */
  addLabel?: string;
}

/**
 * Table toolbar container
 */
export function Toolbar({
  children,
  className,
  showHeader = true,
  onAdd,
  addLabel = 'Add',
}: ToolbarProps) {
  const {
    title,
    rows,
    processedRows,
    search,
    filtering,
    isLoading,
    onRefresh,
    viewOnly,
  } = useTableContext();

  // If children provided, render custom content
  if (children) {
    return (
      <div className={cn('flex flex-col gap-2', className)} data-table-toolbar="">
        {children}
      </div>
    );
  }

  // Default toolbar layout
  return (
    <div className={cn('flex flex-col gap-2', className)} data-table-toolbar="">
      {/* Header row */}
      {showHeader && (
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            <Badge variant="secondary" className="text-xs">
              {processedRows.length !== rows.length
                ? `${processedRows.length} / ${rows.length}`
                : rows.length}{' '}
              records
            </Badge>
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Add button */}
          {onAdd && !viewOnly && (
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4 mr-1" />
              {addLabel}
            </Button>
          )}

          {/* Search */}
          <div className="flex-1 max-w-md ml-auto">
            <ToolbarSearch />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Filter count badge */}
          {filtering.state.filterCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {filtering.state.filterCount} filter{filtering.state.filterCount > 1 ? 's' : ''}
            </Badge>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh data"
              className="h-9 w-9"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

Toolbar.displayName = 'Table.Toolbar';

// ============================================================================
// SEARCH
// ============================================================================

export interface ToolbarSearchProps {
  /** Placeholder text */
  placeholder?: string;

  /** Additional className */
  className?: string;
}

/**
 * Search input for the toolbar
 */
export function ToolbarSearch({
  placeholder = 'Search...',
  className,
}: ToolbarSearchProps) {
  const { search } = useTableContext();
  const { query } = search.state;
  const { setQuery } = search.actions;

  return (
    <div className={cn('relative', className)}>
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9 pr-9"
        aria-label="Search table"
      />
      {query && (
        <button
          onClick={() => setQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

ToolbarSearch.displayName = 'Table.Search';

// ============================================================================
// FILTER BUTTON
// ============================================================================

export interface FilterButtonProps {
  /** Click handler */
  onClick?: () => void;

  /** Additional className */
  className?: string;
}

/**
 * Filter button that shows active filter count
 */
export function FilterButton({ onClick, className }: FilterButtonProps) {
  const { filtering } = useTableContext();
  const count = filtering.state.filterCount;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={className}
    >
      <Filter className="h-4 w-4 mr-2" />
      Filters
      {count > 0 && (
        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
          {count}
        </Badge>
      )}
    </Button>
  );
}

FilterButton.displayName = 'Table.FilterButton';

// ============================================================================
// ADD BUTTON
// ============================================================================

export interface AddButtonProps {
  /** Click handler */
  onClick?: () => void;

  /** Button label */
  label?: string;

  /** Additional className */
  className?: string;
}

/**
 * Add record button
 */
export function AddButton({
  onClick,
  label = 'Add',
  className,
}: AddButtonProps) {
  const { viewOnly } = useTableContext();

  if (viewOnly) return null;

  return (
    <Button size="sm" onClick={onClick} className={className}>
      <Plus className="h-4 w-4 mr-1" />
      {label}
    </Button>
  );
}

AddButton.displayName = 'Table.AddButton';

// ============================================================================
// REFRESH BUTTON
// ============================================================================

export interface RefreshButtonProps {
  /** Override click handler (defaults to context onRefresh) */
  onClick?: () => void;

  /** Additional className */
  className?: string;
}

/**
 * Refresh data button
 */
export function RefreshButton({ onClick, className }: RefreshButtonProps) {
  const { onRefresh, isLoading } = useTableContext();
  const handler = onClick ?? onRefresh;

  if (!handler) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handler}
      disabled={isLoading}
      title="Refresh data"
      className={cn('h-9 w-9', className)}
    >
      <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
    </Button>
  );
}

RefreshButton.displayName = 'Table.RefreshButton';

// ============================================================================
// RECORD COUNT
// ============================================================================

export interface RecordCountProps {
  /** Additional className */
  className?: string;
}

/**
 * Display record count badge
 */
export function RecordCount({ className }: RecordCountProps) {
  const { rows, processedRows } = useTableContext();

  const text =
    processedRows.length !== rows.length
      ? `${processedRows.length} / ${rows.length}`
      : String(rows.length);

  return (
    <Badge variant="secondary" className={cn('text-xs', className)}>
      {text} records
    </Badge>
  );
}

RecordCount.displayName = 'Table.RecordCount';

// ============================================================================
// TITLE
// ============================================================================

export interface TitleProps {
  /** Override title (defaults to context title) */
  children?: React.ReactNode;

  /** Additional className */
  className?: string;
}

/**
 * Table title
 */
export function Title({ children, className }: TitleProps) {
  const { title } = useTableContext();
  const displayTitle = children ?? title;

  if (!displayTitle) return null;

  return (
    <h2 className={cn('text-lg font-semibold', className)}>{displayTitle}</h2>
  );
}

Title.displayName = 'Table.Title';

export default Toolbar;
