"use client";

import React, { useEffect, memo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { isLookupColumn as checkIsLookup, isChoiceColumn as checkIsChoice } from "@/lib/constants/column-types";
import type { CascadeFilter, TableColumn } from "../../types";

interface CascadeFilterItemProps {
  filter: CascadeFilter;
  columns: TableColumn[];
  onUpdate: (id: string | number, updates: Partial<CascadeFilter>) => void;
  onRemove: (id: string | number) => void;
  lookupOptions?: Record<string, Array<{ id: number; display: string }>>;
  lookupLoading?: Record<string, boolean>;
  onFetchLookupOptions?: (column: TableColumn) => void;
}

export const CascadeFilterItem = memo(function CascadeFilterItem({
  filter,
  columns,
  onUpdate,
  onRemove,
  lookupOptions,
  lookupLoading,
  onFetchLookupOptions,
}: CascadeFilterItemProps) {
  const column = columns.find((c) => c.key === filter.column);

  // Fetch lookup options when column changes to a lookup type
  const colType = column?.column_type;
  useEffect(() => {
    if (column && (checkIsLookup(colType) || colType === 'relation') &&
        column.lookup_foundation_id && onFetchLookupOptions) {
      onFetchLookupOptions(column);
    }
  }, [column, colType, onFetchLookupOptions]);

  // Determine if this column should show a dropdown for values
  const isLookupColumn = checkIsLookup(colType) || colType === 'relation';
  const isChoiceColumn = checkIsChoice(colType);
  const isBooleanColumn = colType === 'boolean';
  const options = lookupOptions?.[filter.column] || [];
  const isLoading = lookupLoading?.[filter.column] || false;

  // Render value input based on column type
  const renderValueInput = () => {
    if (["is_empty", "is_not_empty"].includes(filter.operator)) {
      return null;
    }

    // Boolean column - show Yes/No dropdown
    if (isBooleanColumn) {
      return (
        <Select
          value={filter.value === true || filter.value === 'true' ? 'true' : filter.value === false || filter.value === 'false' ? 'false' : ''}
          onValueChange={(value) => onUpdate(filter.id, { value: value === 'true' })}
        >
          <SelectTrigger className="flex-1 h-8">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // Choice column - show searchable choices dropdown
    if (isChoiceColumn && column?.choices && column.choices.length > 0) {
      const choiceItems: ComboboxItem[] = column.choices.map((choice) => ({
        id: choice,
        label: choice,
      }));
      const selectedChoice = choiceItems.find((item) => item.id === String(filter.value || ''));

      return (
        <div className="flex-1">
          <ComboboxDropdown
            items={choiceItems}
            selectedItem={selectedChoice}
            onSelect={(item) => onUpdate(filter.id, { value: item.id })}
            placeholder="Select..."
            searchPlaceholder="Search choices..."
          />
        </div>
      );
    }

    // Lookup column - show lookup values dropdown
    if (isLookupColumn && column?.lookup_foundation_id) {
      if (isLoading) {
        return (
          <div className="flex-1 h-8 flex items-center px-3 text-sm text-muted-foreground bg-muted rounded-md">
            Loading...
          </div>
        );
      }

      if (options.length > 0) {
        // Use display value for filtering since data contains display values, not IDs
        const lookupItems: ComboboxItem[] = options
          .filter((opt) => opt.display != null && String(opt.display) !== '')
          .map((opt) => ({
            id: String(opt.display),
            label: opt.display,
          }));
        const selectedLookup = lookupItems.find((item) => item.id === String(filter.value || ''));

        return (
          <div className="flex-1">
            <ComboboxDropdown
              items={lookupItems}
              selectedItem={selectedLookup}
              onSelect={(item) => onUpdate(filter.id, { value: item.id })}
              placeholder="Select..."
              searchPlaceholder="Search records..."
            />
          </div>
        );
      }
    }

    // Default text input
    return (
      <Input
        className="flex-1 h-8"
        value={String(filter.value || "")}
        onChange={(e) => onUpdate(filter.id, { value: e.target.value })}
        placeholder="Value..."
      />
    );
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <Select
        value={filter.column}
        onValueChange={(value) => onUpdate(filter.id, { column: value, value: '' })}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder="Column" />
        </SelectTrigger>
        <SelectContent>
          {columns
            .filter((c) => c.filterable !== false && c.key !== "select" && c.key !== "actions")
            .map((col) => (
              <SelectItem key={col.key} value={col.key}>
                {col.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Select
        value={filter.operator}
        onValueChange={(value) => onUpdate(filter.id, { operator: value as CascadeFilter["operator"] })}
      >
        <SelectTrigger className="w-[100px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="=">equals</SelectItem>
          <SelectItem value="!=">not equals</SelectItem>
          <SelectItem value="contains">contains</SelectItem>
          <SelectItem value="not_contains">not contains</SelectItem>
          <SelectItem value="starts_with">starts with</SelectItem>
          <SelectItem value="ends_with">ends with</SelectItem>
          <SelectItem value="is_empty">is empty</SelectItem>
          <SelectItem value="is_not_empty">is not empty</SelectItem>
          {column?.column_type && ["number", "currency", "percentage", "date"].includes(column.column_type) && (
            <>
              <SelectItem value=">">greater than</SelectItem>
              <SelectItem value="<">less than</SelectItem>
              <SelectItem value=">=">greater or equal</SelectItem>
              <SelectItem value="<=">less or equal</SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      {renderValueInput()}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onRemove(filter.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
});
