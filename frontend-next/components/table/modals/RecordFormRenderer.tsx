/**
 * RecordFormRenderer Component
 *
 * Renders form fields based on column type for Add/Edit record modals.
 * Extracted from GoldStandardTab to achieve SSoT - all tables use the same form rendering.
 *
 * Supports all column types from GOLD_STANDARD_TABLE.md:
 * - string, long_text, boolean, number, whole_number
 * - currency, percentage, date, date_and_time
 * - email, url, color_picker, dropdown (lookup_foundation_id)
 *
 * @see TeeemTableView modals folder for other SSoT modal components
 */

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface ColumnDefinition {
  column_name: string;
  name?: string;
  column_type: string;
  lookup_foundation_id?: number;
  choices?: string[];
  required?: boolean;
  system?: boolean;
}

export interface RecordFormFieldProps {
  column: ColumnDefinition;
  value: unknown;
  onChange: (columnName: string, value: unknown) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

/**
 * Renders a single form field based on column type
 */
export function RecordFormField({
  column,
  value,
  onChange,
  disabled = false,
  error,
  className,
}: RecordFormFieldProps) {
  const { column_name, column_type, name } = column;
  const label = name || column_name;
  const isSystem = column.system || ['id', 'created_at', 'updated_at'].includes(column_name);
  const isDisabled = disabled || isSystem;

  const handleChange = (newValue: unknown) => {
    if (!isDisabled) {
      onChange(column_name, newValue);
    }
  };

  const renderField = () => {
    switch (column_type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={column_name}
              checked={value === true}
              onCheckedChange={(checked) => handleChange(checked === true)}
              disabled={isDisabled}
            />
            <Label htmlFor={column_name} className={cn("cursor-pointer", isDisabled && "text-muted-foreground")}>
              {label}
            </Label>
          </div>
        );

      case 'long_text':
        return (
          <div className="space-y-2">
            <Label htmlFor={column_name} className={cn(isDisabled && "text-muted-foreground")}>
              {label}
            </Label>
            <Textarea
              id={column_name}
              value={String(value || '')}
              onChange={(e) => handleChange(e.target.value)}
              rows={3}
              disabled={isDisabled}
              className={cn(isDisabled && "bg-muted")}
            />
          </div>
        );

      case 'number':
      case 'whole_number':
      case 'currency':
      case 'percentage':
        return (
          <div className="space-y-2">
            <Label htmlFor={column_name} className={cn(isDisabled && "text-muted-foreground")}>
              {label}
              {column_type === 'currency' && ' ($)'}
              {column_type === 'percentage' && ' (%)'}
            </Label>
            <Input
              id={column_name}
              type="number"
              step={column_type === 'whole_number' ? '1' : 'any'}
              value={String(value ?? '')}
              onChange={(e) => handleChange(e.target.value)}
              disabled={isDisabled}
              className={cn(isDisabled && "bg-muted")}
            />
          </div>
        );

      case 'date':
        return (
          <div className="space-y-2">
            <Label htmlFor={column_name} className={cn(isDisabled && "text-muted-foreground")}>
              {label}
            </Label>
            <Input
              id={column_name}
              type="date"
              value={String(value || '')}
              onChange={(e) => handleChange(e.target.value)}
              disabled={isDisabled}
              className={cn(isDisabled && "bg-muted")}
            />
          </div>
        );

      case 'date_and_time':
        return (
          <div className="space-y-2">
            <Label htmlFor={column_name} className={cn(isDisabled && "text-muted-foreground")}>
              {label}
            </Label>
            <Input
              id={column_name}
              type="datetime-local"
              value={String(value || '')}
              onChange={(e) => handleChange(e.target.value)}
              disabled={isDisabled}
              className={cn(isDisabled && "bg-muted")}
            />
          </div>
        );

      case 'email':
        return (
          <div className="space-y-2">
            <Label htmlFor={column_name} className={cn(isDisabled && "text-muted-foreground")}>
              {label}
            </Label>
            <Input
              id={column_name}
              type="email"
              value={String(value || '')}
              onChange={(e) => handleChange(e.target.value)}
              disabled={isDisabled}
              className={cn(isDisabled && "bg-muted")}
            />
          </div>
        );

      case 'url':
        return (
          <div className="space-y-2">
            <Label htmlFor={column_name} className={cn(isDisabled && "text-muted-foreground")}>
              {label}
            </Label>
            <Input
              id={column_name}
              type="url"
              value={String(value || '')}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="https://"
              disabled={isDisabled}
              className={cn(isDisabled && "bg-muted")}
            />
          </div>
        );

      case 'color_picker':
        return (
          <div className="space-y-2">
            <Label htmlFor={column_name} className={cn(isDisabled && "text-muted-foreground")}>
              {label}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={column_name}
                type="color"
                value={String(value || '#000000')}
                onChange={(e) => handleChange(e.target.value)}
                className="w-16 h-10 p-1"
                disabled={isDisabled}
              />
              <Input
                value={String(value || '')}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="#000000"
                className={cn("flex-1", isDisabled && "bg-muted")}
                disabled={isDisabled}
              />
            </div>
          </div>
        );

      case 'dropdown':
        // If choices provided, render select
        if (column.choices && column.choices.length > 0) {
          return (
            <div className="space-y-2">
              <Label htmlFor={column_name} className={cn(isDisabled && "text-muted-foreground")}>
                {label}
              </Label>
              <Select
                value={String(value || '')}
                onValueChange={(v) => handleChange(v)}
                disabled={isDisabled}
              >
                <SelectTrigger className={cn(isDisabled && "bg-muted")}>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {column.choices.map((choice) => (
                    <SelectItem key={choice} value={choice}>
                      {choice}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        // Fall through to default text input if no choices
        // (lookup_foundation_id handling would go here in future)
        return (
          <div className="space-y-2">
            <Label htmlFor={column_name} className={cn(isDisabled && "text-muted-foreground")}>
              {label}
            </Label>
            <Input
              id={column_name}
              value={String(value || '')}
              onChange={(e) => handleChange(e.target.value)}
              disabled={isDisabled}
              className={cn(isDisabled && "bg-muted")}
            />
          </div>
        );

      default:
        // Default: string/short_text input
        return (
          <div className="space-y-2">
            <Label htmlFor={column_name} className={cn(isDisabled && "text-muted-foreground")}>
              {label}
            </Label>
            <Input
              id={column_name}
              value={String(value || '')}
              onChange={(e) => handleChange(e.target.value)}
              disabled={isDisabled}
              className={cn(isDisabled && "bg-muted")}
            />
          </div>
        );
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {renderField()}
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}

export interface RecordFormRendererProps {
  columns: ColumnDefinition[];
  formData: Record<string, unknown>;
  onChange: (columnName: string, value: unknown) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  visibleColumns?: Set<string>;
  gridCols?: 1 | 2 | 3;
}

/**
 * Renders a complete form with all columns
 */
export function RecordFormRenderer({
  columns,
  formData,
  onChange,
  errors = {},
  disabled = false,
  visibleColumns,
  gridCols = 2,
}: RecordFormRendererProps) {
  const gridClass = gridCols === 1 ? 'grid-cols-1' : gridCols === 2 ? 'grid-cols-2' : 'grid-cols-3';

  // Filter columns if visibleColumns provided
  const displayColumns = visibleColumns
    ? columns.filter(col => visibleColumns.has(col.column_name))
    : columns;

  return (
    <div className={cn("grid gap-4", gridClass)}>
      {displayColumns.map((column) => (
        <RecordFormField
          key={column.column_name}
          column={column}
          value={formData[column.column_name]}
          onChange={onChange}
          error={errors[column.column_name]}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/**
 * Format a value for display (read-only view)
 */
export function formatFieldValue(column: ColumnDefinition, value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  switch (column.column_type) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'currency':
      return typeof value === 'number'
        ? `$${value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : String(value);
    case 'percentage':
      return typeof value === 'number' ? `${value}%` : String(value);
    case 'date':
      if (!value) return '—';
      try {
        return new Date(String(value)).toLocaleDateString('en-AU');
      } catch {
        return String(value);
      }
    case 'date_and_time':
      if (!value) return '—';
      try {
        return new Date(String(value)).toLocaleString('en-AU');
      } catch {
        return String(value);
      }
    case 'color_picker':
      return (
        <span className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded border"
            style={{ backgroundColor: String(value) }}
          />
          {String(value)}
        </span>
      ) as unknown as string;
    default:
      return String(value);
  }
}
