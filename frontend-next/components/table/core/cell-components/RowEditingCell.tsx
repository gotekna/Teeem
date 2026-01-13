/**
 * RowEditingCell Component
 *
 * Handles inline row-level editing for all column types in TeeemTableView.
 * Renders appropriate editor based on column type (boolean, choice, date, lookup, etc.)
 *
 * Extracted from TeeemTableView to improve code organization and reduce file size.
 *
 * @see Phase 4 refactoring - SSoT Cleanup
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ComboboxDropdown, type ComboboxItem } from '@/components/ui/combobox-dropdown';
import { Textarea } from '@/components/ui/textarea';
import MultipleSelector, { type Option } from '@/components/ui/multiple-selector';
import { CalendarIcon, Paperclip } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import type { TableColumn } from '../../types';
import { isLookupColumn } from '@/lib/constants/column-types';

export interface RowEditingCellProps {
  /** Row entry data */
  entry: { id: number | string; [key: string]: unknown };

  /** Column configuration */
  column: TableColumn;

  /** Current editing data for this row */
  rowEditingData: Record<string, unknown>;

  /** Update editing data callback */
  setEditingData: React.Dispatch<React.SetStateAction<Record<number | string, Record<string, unknown>>>>;

  /** Validation error for this cell */
  validationError?: string;

  /** Handle cell blur for validation */
  handleCellBlur: (rowId: number | string, columnKey: string, value: unknown, columnType?: string) => void;

  /** Lookup options for relation/lookup columns */
  lookupOptions?: Record<string, Array<{ id: number | string; display: string }>>;

  /** Lookup loading state */
  lookupLoading?: Record<string, boolean>;
}

/**
 * Renders appropriate editor for a cell based on column type
 */
export function RowEditingCell({
  entry,
  column,
  rowEditingData,
  setEditingData,
  validationError,
  handleCellBlur,
  lookupOptions = {},
  lookupLoading = {},
}: RowEditingCellProps) {
  const { toast } = useToast();

  // SSoT: column_type should always be set - log error if missing (skip system columns)
  const systemColumns = ['id', 'created_at', 'updated_at'];
  if (!column.column_type && !systemColumns.includes(column.key)) {
    console.error(`[SSoT] Column "${column.key}" missing column_type - defaulting to single_line_text`);
  }
  const columnType = column.column_type || 'single_line_text';
  const hasError = validationError;

  // Prevent click propagation to avoid row navigation when editing
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Boolean - Switch toggle
  if (columnType === 'boolean') {
    const boolValue = rowEditingData[column.key] === true || rowEditingData[column.key] === 'true' || rowEditingData[column.key] === 1;
    return (
      <div className="flex items-center justify-center" onClick={handleClick}>
        <Switch
          checked={boolValue}
          onCheckedChange={(checked) =>
            setEditingData((prev) => ({
              ...prev,
              [entry.id]: { ...prev[entry.id], [column.key]: checked },
            }))
          }
        />
      </div>
    );
  }

  // Choice - Searchable dropdown with predefined options
  if (columnType === 'choice') {
    const choices = column.choices || [];
    const choiceItems: ComboboxItem[] = choices.map((choice) => ({
      id: choice,
      label: choice,
    }));
    const currentValue = String(rowEditingData[column.key] ?? "");
    const selectedChoice = choiceItems.find((item) => item.id === currentValue);

    return (
      <div onClick={handleClick}>
        <ComboboxDropdown
          items={choiceItems}
          selectedItem={selectedChoice}
          onSelect={(item) =>
            setEditingData((prev) => ({
              ...prev,
              [entry.id]: { ...prev[entry.id], [column.key]: item.id },
            }))
          }
          placeholder="Select..."
          searchPlaceholder="Search choices..."
        />
      </div>
    );
  }

  // User - Dropdown (would need users fetched, for now use text input)
  if (columnType === 'user') {
    // TODO: Fetch users from API and show dropdown
    return (
      <Input
        className="h-7 text-sm"
        placeholder="User..."
        value={String(rowEditingData[column.key] ?? "")}
        onChange={(e) =>
          setEditingData((prev) => ({
            ...prev,
            [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
          }))
        }
        onBlur={() => handleCellBlur(entry.id, column.key, rowEditingData[column.key], columnType)}
      />
    );
  }

  // Date - Date picker
  if (columnType === 'date') {
    const dateValue = rowEditingData[column.key];
    let parsedDate: Date | undefined;
    try {
      if (dateValue) {
        parsedDate = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue as number);
      }
    } catch {
      parsedDate = undefined;
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 w-full justify-start text-left font-normal text-sm",
              !parsedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-3 w-3" />
            {parsedDate ? format(parsedDate, "yyyy-MM-dd") : "Pick date..."}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parsedDate}
            onSelect={(date) =>
              setEditingData((prev) => ({
                ...prev,
                [entry.id]: { ...prev[entry.id], [column.key]: date ? format(date, "yyyy-MM-dd") : null },
              }))
            }
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Date and Time - DateTime picker
  if (columnType === 'date_and_time' || columnType === 'datetime') {
    const dateValue = rowEditingData[column.key];
    let parsedDate: Date | undefined;
    try {
      if (dateValue) {
        parsedDate = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue as number);
      }
    } catch {
      parsedDate = undefined;
    }

    return (
      <Input
        type="datetime-local"
        className="h-7 text-sm"
        value={parsedDate ? format(parsedDate, "yyyy-MM-dd'T'HH:mm") : ""}
        onChange={(e) =>
          setEditingData((prev) => ({
            ...prev,
            [entry.id]: { ...prev[entry.id], [column.key]: e.target.value ? new Date(e.target.value).toISOString() : null },
          }))
        }
        onBlur={() => handleCellBlur(entry.id, column.key, rowEditingData[column.key], columnType)}
      />
    );
  }

  // File Upload - Show paperclip button
  if (columnType === 'file_upload' || columnType === 'file' || columnType === 'attachment') {
    return (
      <div className="flex items-center gap-1">
        <Input
          className="h-7 text-sm flex-1"
          placeholder="File URL..."
          value={String(rowEditingData[column.key] ?? "")}
          onChange={(e) =>
            setEditingData((prev) => ({
              ...prev,
              [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
            }))
          }
          onBlur={() => handleCellBlur(entry.id, column.key, rowEditingData[column.key], columnType)}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => {
            // TODO: Open file picker dialog
            toast({ title: "File upload coming soon" });
          }}
        >
          <Paperclip className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Lookup - Searchable dropdown from related table
  if (isLookupColumn(columnType)) {
    const options = lookupOptions[column.key] || [];
    const isLoading = lookupLoading[column.key];
    const currentValue = rowEditingData[column.key];
    const lookupItems: ComboboxItem[] = options.map((opt) => ({
      id: String(opt.id),
      label: opt.display,
    }));
    const selectedItem = lookupItems.find((item) => item.id === String(currentValue));

    return (
      <div onClick={handleClick}>
        <ComboboxDropdown
          items={lookupItems}
          selectedItem={selectedItem}
          onSelect={(item) =>
            setEditingData((prev) => ({
              ...prev,
              [entry.id]: { ...prev[entry.id], [column.key]: item.id },
            }))
          }
          placeholder={isLoading ? "Loading..." : "Select..."}
          searchPlaceholder="Search..."
          disabled={isLoading}
        />
      </div>
    );
  }

  // Multiple Lookups - Multi-select from related table (compact badge display)
  if (columnType === 'multiple_lookups') {
    const options = lookupOptions[column.key] || [];
    const isLoading = lookupLoading[column.key];
    const currentValue = rowEditingData[column.key];
    // Handle both comma-separated string and array formats
    const selectedIds = Array.isArray(currentValue)
      ? currentValue.map(String)
      : currentValue
      ? String(currentValue).split(',').filter(Boolean)
      : [];

    // Convert to Option format for MultipleSelector
    const selectorOptions: Option[] = options.map((opt) => ({
      value: String(opt.id),
      label: opt.display,
    }));

    const selectedOptions: Option[] = selectorOptions.filter((opt) =>
      selectedIds.includes(opt.value)
    );

    return (
      <div onClick={handleClick} className="min-h-[32px]">
        <MultipleSelector
          value={selectedOptions}
          onChange={(selected) => {
            const newIds = selected.map((opt) => opt.value);
            setEditingData((prev) => ({
              ...prev,
              [entry.id]: { ...prev[entry.id], [column.key]: newIds.join(',') },
            }));
          }}
          options={selectorOptions}
          placeholder={isLoading ? "Loading..." : "Select..."}
          emptyIndicator={
            <p className="text-center text-sm text-muted-foreground">No options</p>
          }
          disabled={isLoading}
          hidePlaceholderWhenSelected
        />
      </div>
    );
  }

  // Color Picker - Show color input
  if (columnType === 'color_picker' || columnType === 'color') {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="color"
          className="h-7 w-12 p-0.5 cursor-pointer"
          value={String(rowEditingData[column.key] || "#000000")}
          onChange={(e) =>
            setEditingData((prev) => ({
              ...prev,
              [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
            }))
          }
        />
        <Input
          className="h-7 text-sm flex-1"
          placeholder="#000000"
          value={String(rowEditingData[column.key] ?? "")}
          onChange={(e) =>
            setEditingData((prev) => ({
              ...prev,
              [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
            }))
          }
          onBlur={() => handleCellBlur(entry.id, column.key, rowEditingData[column.key], columnType)}
        />
      </div>
    );
  }

  // GPS Coordinates - Two inputs for lat/lng
  if (columnType === 'gps_coordinates' || columnType === 'location') {
    const coordValue = String(rowEditingData[column.key] ?? "");
    const [lat, lng] = coordValue.split(',').map(s => s.trim());

    return (
      <div className="flex items-center gap-1">
        <Input
          className="h-7 text-sm w-20"
          placeholder="Lat"
          value={lat || ""}
          onChange={(e) => {
            const newLat = e.target.value;
            const newCoords = lng ? `${newLat}, ${lng}` : newLat;
            setEditingData((prev) => ({
              ...prev,
              [entry.id]: { ...prev[entry.id], [column.key]: newCoords },
            }));
          }}
          onBlur={() => handleCellBlur(entry.id, column.key, rowEditingData[column.key], columnType)}
        />
        <Input
          className="h-7 text-sm w-20"
          placeholder="Lng"
          value={lng || ""}
          onChange={(e) => {
            const newLng = e.target.value;
            const newCoords = lat ? `${lat}, ${newLng}` : newLng;
            setEditingData((prev) => ({
              ...prev,
              [entry.id]: { ...prev[entry.id], [column.key]: newCoords },
            }));
          }}
          onBlur={() => handleCellBlur(entry.id, column.key, rowEditingData[column.key], columnType)}
        />
      </div>
    );
  }

  // Rich Text / Long Text - Textarea
  if (columnType === 'rich_text' || columnType === 'long_text' || columnType === 'multi_line_text') {
    return (
      <Textarea
        className="min-h-[60px] text-sm resize-none"
        value={String(rowEditingData[column.key] ?? "")}
        onChange={(e) =>
          setEditingData((prev) => ({
            ...prev,
            [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
          }))
        }
        onBlur={() => handleCellBlur(entry.id, column.key, rowEditingData[column.key], columnType)}
      />
    );
  }

  // Default - Text input for all other types (single_line_text, email, phone, url, number, etc.)
  return (
    <div className="relative" onClick={handleClick}>
      <Input
        className={cn(
          "h-7 text-sm",
          hasError && "border-red-500 focus-visible:ring-red-500"
        )}
        type={
          columnType === 'number' || columnType === 'percentage' || columnType === 'currency' ? 'number' :
          columnType === 'email' ? 'email' :
          columnType === 'phone' ? 'tel' :
          columnType === 'url' ? 'url' :
          'text'
        }
        placeholder={
          columnType === 'email' ? 'email@example.com' :
          columnType === 'phone' ? '+1 (555) 000-0000' :
          columnType === 'url' ? 'https://...' :
          columnType === 'percentage' ? '0-100' :
          `Enter ${column.label.toLowerCase()}...`
        }
        value={String(rowEditingData[column.key] ?? "")}
        onChange={(e) =>
          setEditingData((prev) => ({
            ...prev,
            [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
          }))
        }
        onBlur={() => handleCellBlur(entry.id, column.key, rowEditingData[column.key], columnType)}
      />
      {hasError && (
        <span className="absolute -bottom-4 left-0 text-[10px] text-red-500 whitespace-nowrap">
          {hasError}
        </span>
      )}
    </div>
  );
}
