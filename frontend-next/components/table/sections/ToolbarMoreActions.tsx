/**
 * ToolbarMoreActions - More actions dropdown menu
 *
 * Extracted from TeeemTableView to reduce main component size.
 * Contains schema, data, contacts, and display sections.
 *
 * Migration Note (Phase 6.5):
 * This component now reads from TableContext when available for:
 * - foundationId, resolvedFoundation (from meta)
 * - hasEmailColumns (derived from columns)
 * Feature flags, UI state, and callbacks remain as props.
 */

'use client';

import React, { useMemo } from 'react';
import {
  MoreVertical,
  Columns,
  PlusCircle,
  Settings,
  MinusCircle,
  Download,
  Upload,
  UserPlus,
  Search,
  Filter,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTableMaybe } from '../context';

export interface ToolbarMoreActionsProps {
  /** Show schema editor options */
  enableSchemaEditor?: boolean;
  /** Show import option */
  enableImport?: boolean;
  /** Show export option */
  enableExport?: boolean;
  /** @deprecated Use TableContext instead. Whether table has email columns */
  hasEmailColumns?: boolean;
  /** @deprecated Use TableContext instead. Foundation ID/slug for table info */
  foundationId?: string | number | null;
  /** @deprecated Use TableContext instead. Resolved foundation info for display */
  resolvedFoundation?: { id: number; slug: string } | null;
  /** Whether column edit mode is on */
  columnEditMode?: boolean;
  /** Whether column filters are shown */
  showColumnFilters?: boolean;
  /** Whether ABN search is in progress */
  isFindingAbns?: boolean;

  // Callbacks
  onShowEditColumns?: () => void;
  onShowCreateColumn?: () => void;
  onEditColumns?: () => void;
  onShowDeleteColumn?: () => void;
  onToggleColumnEditMode?: () => void;
  onImport?: () => void;
  onShowExport?: () => void;
  onShowEmailToContacts?: () => void;
  onFindMissingAbns?: () => void;
  onToggleColumnFilters?: () => void;
  onCopyTableId?: () => void;
}

export function ToolbarMoreActions({
  enableSchemaEditor = false,
  enableImport = false,
  enableExport = false,
  hasEmailColumns: propHasEmailColumns,
  foundationId: propFoundationId,
  resolvedFoundation: propResolvedFoundation,
  columnEditMode = false,
  showColumnFilters = false,
  isFindingAbns = false,
  onShowEditColumns,
  onShowCreateColumn,
  onEditColumns,
  onShowDeleteColumn,
  onToggleColumnEditMode,
  onImport,
  onShowExport,
  onShowEmailToContacts,
  onFindMissingAbns,
  onToggleColumnFilters,
  onCopyTableId,
}: ToolbarMoreActionsProps) {
  // Try to get values from context first
  const table = useTableMaybe();

  // Derive hasEmailColumns from context columns if available
  const contextHasEmailColumns = useMemo(() => {
    if (!table) return false;
    return table.columns.some(col => col.column_type === 'email');
  }, [table]);

  // Resolve values: context first, props as fallback
  const effectiveFoundationId = table?.meta.foundationId ?? propFoundationId;
  const effectiveResolvedFoundation = useMemo(() => {
    if (table?.meta.foundationIdNumeric && table?.meta.foundationId) {
      return { id: table.meta.foundationIdNumeric, slug: table.meta.foundationId };
    }
    return propResolvedFoundation ?? null;
  }, [table, propResolvedFoundation]);
  const effectiveHasEmailColumns = table ? contextHasEmailColumns : (propHasEmailColumns ?? false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onShowEditColumns}>
          <Columns className="h-4 w-4 mr-2" />
          Columns
        </DropdownMenuItem>

        {/* Schema Section - auto-enabled when foundationIdNumeric is set */}
        {enableSchemaEditor && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
              SCHEMA
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={onShowCreateColumn}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create New Column
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEditColumns || onShowEditColumns}>
              <Settings className="h-4 w-4 mr-2" />
              Edit Columns
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShowDeleteColumn}>
              <MinusCircle className="h-4 w-4 mr-2" />
              Delete Column
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleColumnEditMode}>
              <Settings className="h-4 w-4 mr-2" />
              {columnEditMode ? "Exit Edit Mode" : "Edit Individual"}
              {columnEditMode && (
                <Badge variant="secondary" className="ml-2 text-xs">ON</Badge>
              )}
            </DropdownMenuItem>
          </>
        )}

        {/* Data Section */}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
          DATA
        </DropdownMenuLabel>
        {enableImport && (
          <DropdownMenuItem onClick={onImport}>
            <Download className="h-4 w-4 mr-2" />
            Import
          </DropdownMenuItem>
        )}
        {enableExport && (
          <DropdownMenuItem onClick={onShowExport}>
            <Upload className="h-4 w-4 mr-2" />
            Export
          </DropdownMenuItem>
        )}

        {/* Email to Contacts Section - auto-enabled when table has email columns */}
        {effectiveHasEmailColumns && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
              CONTACTS
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={onShowEmailToContacts}>
              <UserPlus className="h-4 w-4 mr-2" />
              Extract Contacts from Emails
            </DropdownMenuItem>
            {/* SSoT: Use slug check only, not numeric ID (which differs per environment) */}
            {effectiveFoundationId === "contacts" && (
              <DropdownMenuItem onClick={onFindMissingAbns} disabled={isFindingAbns}>
                {isFindingAbns ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Find Missing ABNs
              </DropdownMenuItem>
            )}
          </>
        )}

        {/* Display Options Section */}
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

        {/* Table Info Section */}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
          TABLE INFO
        </DropdownMenuLabel>

        {effectiveFoundationId && (
          <>
            <div className="px-2 py-1.5 flex items-center justify-between">
              <span className="text-[11px]">
                Table ID: <span className="font-mono font-medium">
                  {effectiveResolvedFoundation ? `${effectiveResolvedFoundation.slug} (${effectiveResolvedFoundation.id})` : effectiveFoundationId}
                </span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onCopyTableId}
              >
                Copy
              </Button>
            </div>
            <DropdownMenuItem
              onClick={() => window.open(`/admin/system/components`, '_blank')}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Configure Table
              <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

ToolbarMoreActions.displayName = 'ToolbarMoreActions';

export default ToolbarMoreActions;
