/**
 * BulkUpdateModal Component
 *
 * Modal for bulk updating a column value across multiple selected rows.
 * Supports text, choice, boolean, lookup, and multiple_lookups column types.
 * Extracted from TeeemTableView to improve code organization.
 *
 * @see Phase 7 refactoring - Modal Consolidation
 */

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

import { ComboboxDropdown } from '@/components/ui/combobox-dropdown';
import { Spinner } from "@/components/ui/spinner";
import type { TableColumn } from '../types';

export interface BulkUpdateModalProps {
  /** Whether modal is open */
  open: boolean;

  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;

  /** Number of selected rows */
  selectedRowsCount: number;

  /** All table columns */
  COLUMNS: TableColumn[];

  /** Selected column to update */
  bulkUpdateColumn: string;

  /** Set selected column */
  setBulkUpdateColumn: (column: string) => void;

  /** Value to set */
  bulkUpdateValue: string;

  /** Set value */
  setBulkUpdateValue: (value: string) => void;

  /** Whether bulk update is saving */
  bulkUpdateSaving: boolean;

  /** Lookup options for columns */
  lookupOptions: Record<string, Array<{ id: number | string; display: string }>>;

  /** Lookup loading state */
  lookupLoading: Record<string, boolean>;

  /** Bulk update handler */
  handleBulkUpdate: () => Promise<void>;
}

/**
 * Modal for bulk updating selected rows
 */
export function BulkUpdateModal({
  open,
  onOpenChange,
  selectedRowsCount,
  COLUMNS,
  bulkUpdateColumn,
  setBulkUpdateColumn,
  bulkUpdateValue,
  setBulkUpdateValue,
  bulkUpdateSaving,
  lookupOptions,
  lookupLoading,
  handleBulkUpdate,
}: BulkUpdateModalProps) {
  const handleClose = () => {
    onOpenChange(false);
    setBulkUpdateColumn("");
    setBulkUpdateValue("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Bulk Update</DialogTitle>
          <DialogDescription>
            Update {selectedRowsCount} selected row{selectedRowsCount !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Column to update</Label>
            <ComboboxDropdown
              items={Array.from(
                new Map(
                  COLUMNS.filter(
                    (c) =>
                      c.key !== "select" &&
                      c.key !== "actions" &&
                      c.key !== "id" &&
                      c.editable !== false &&
                      c.column_type !== "computed" &&
                      c.column_type !== "searchable_text"
                  ).map((col) => [col.key, col])
                ).values()
              )
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((col) => ({
                  id: col.key,
                  label: col.label,
                }))}
              selectedItem={bulkUpdateColumn ? { id: bulkUpdateColumn, label: COLUMNS.find(c => c.key === bulkUpdateColumn)?.label || bulkUpdateColumn } : undefined}
              onSelect={(item) => {
                setBulkUpdateColumn(item.id);
                setBulkUpdateValue(""); // Reset value when column changes
              }}
              placeholder="Select column..."
              searchPlaceholder="Search columns..."
            />
          </div>

          {bulkUpdateColumn && (
            <div className="space-y-2">
              <Label>New value</Label>
              {(() => {
                const selectedCol = COLUMNS.find(c => c.key === bulkUpdateColumn);
                const hasChoices = selectedCol?.choices && selectedCol.choices.length > 0;
                const isLookup = selectedCol?.column_type === 'lookup' || !!selectedCol?.lookup_foundation_id;
                const isMultipleLookups = selectedCol?.column_type === 'multiple_lookups';
                const isChoice = selectedCol?.column_type === 'choice' || selectedCol?.column_type === 'single_select';

                // For multiple_lookups columns, show checkboxes for multi-select
                if (isMultipleLookups) {
                  const options = lookupOptions[bulkUpdateColumn] || [];
                  const isLoading = lookupLoading[bulkUpdateColumn];
                  // bulkUpdateValue stores comma-separated IDs for multiple lookups
                  const selectedIds = bulkUpdateValue ? bulkUpdateValue.split(',').filter(Boolean) : [];

                  return (
                    <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
                      {isLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Spinner size={16} />
                          Loading options...
                        </div>
                      ) : options.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No options available</p>
                      ) : (
                        options.map((option) => (
                          <label key={option.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                            <Checkbox
                              checked={selectedIds.includes(String(option.id))}
                              onCheckedChange={(checked) => {
                                const newIds = checked
                                  ? [...selectedIds, String(option.id)]
                                  : selectedIds.filter(id => id !== String(option.id));
                                setBulkUpdateValue(newIds.join(','));
                              }}
                            />
                            <span className="text-sm">{option.display}</span>
                          </label>
                        ))
                      )}
                    </div>
                  );
                }

                // For single lookup columns, use the lookupOptions if available
                if (isLookup) {
                  const options = lookupOptions[bulkUpdateColumn] || [];
                  const isLoading = lookupLoading[bulkUpdateColumn];

                  return (
                    <Select
                      value={bulkUpdateValue}
                      onValueChange={setBulkUpdateValue}
                    >
                      <SelectTrigger className="w-full">
                        {isLoading ? (
                          <span className="text-muted-foreground">Loading...</span>
                        ) : (
                          <SelectValue placeholder="Select value..." />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {options.length === 0 && !isLoading && (
                          <SelectItem value="__no_options__" disabled>
                            No options available
                          </SelectItem>
                        )}
                        {options.map((option) => (
                          <SelectItem key={option.id} value={String(option.id)}>
                            {option.display}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }

                if (hasChoices || isChoice) {
                  // Dropdown for choice columns with predefined options
                  const options = selectedCol?.choices || [];
                  return (
                    <Select
                      value={bulkUpdateValue}
                      onValueChange={setBulkUpdateValue}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select value..." />
                      </SelectTrigger>
                      <SelectContent>
                        {options.length === 0 && (
                          <SelectItem value="__no_options__" disabled>
                            No options available
                          </SelectItem>
                        )}
                        {options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                } else if (selectedCol?.column_type === 'boolean') {
                  // Dropdown for boolean
                  return (
                    <Select
                      value={bulkUpdateValue}
                      onValueChange={setBulkUpdateValue}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select value..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  );
                } else {
                  // Text input for other columns
                  return (
                    <Input
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      placeholder="Enter new value..."
                      className="w-full"
                    />
                  );
                }
              })()}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleBulkUpdate}
            disabled={!bulkUpdateColumn || !bulkUpdateValue || bulkUpdateSaving}
          >
            {bulkUpdateSaving ? (
              <Spinner size={16} className="mr-1" />
            ) : null}
            Update {selectedRowsCount} row{selectedRowsCount !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
