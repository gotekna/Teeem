/**
 * EditRecordModal Component
 *
 * Modal for editing existing records in Foundation tables.
 * Uses RecordFormRenderer for consistent form field rendering.
 * Auto-enabled when TeeemTableView has foundationIdNumeric set.
 *
 * @see RecordFormRenderer for form field logic
 * @see Phase 8 refactoring - Record CRUD Modals
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Pencil,
  Settings,
  Eye,
  EyeOff,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  List,
} from "lucide-react";
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Spinner } from "@/components/ui/spinner";
import { RecordFormField, type ColumnDefinition } from './RecordFormRenderer';
import type { TableColumn, TableRow } from '../types';
import { isSystemGeneratedType, SYSTEM_VISIBLE_COLUMNS } from "@/lib/constants/system-columns";
import { updateCachedEditModalConfig } from '../utils/columns-cache';

// Alias for consistency
type TableRowType = TableRow;

// Columns to exclude from the form (system-managed or UI-only)
// SSoT: Uses SYSTEM_VISIBLE_COLUMNS + UI-specific columns
const EXCLUDED_COLUMNS = [...SYSTEM_VISIBLE_COLUMNS, "actions", "select"];

// Sortable field item for drag and drop
interface SortableFieldItemProps {
  id: string;
  col: TableColumn;
  isVisible: boolean;
  order: number;
  onToggleVisibility: (columnKey: string) => void;
  onUpdateOrder: (columnKey: string, order: number) => void;
}

function SortableFieldItem({
  id,
  col,
  isVisible,
  order,
  onToggleVisibility,
  onUpdateOrder,
}: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-xs rounded border transition-colors",
        isVisible
          ? "bg-primary/10 border-primary/30 text-foreground"
          : "bg-background border-border text-muted-foreground",
        isDragging && "opacity-50 shadow-lg z-50 bg-background"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      <button
        onClick={() => onToggleVisibility(col.key)}
        className="flex items-center gap-2 flex-1 text-left hover:opacity-70"
      >
        {isVisible ? (
          <Eye className="h-3 w-3 flex-shrink-0" />
        ) : (
          <EyeOff className="h-3 w-3 flex-shrink-0" />
        )}
        <span className="truncate">{col.label}</span>
      </button>
      <input
        type="number"
        min="1"
        value={order < 100 ? order : ''}
        onChange={(e) => onUpdateOrder(col.key, parseInt(e.target.value) || 0)}
        className="w-10 h-6 text-center text-xs border rounded bg-background"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/**
 * Shows a checkbox to reveal existing values for a field.
 * Auto-expands when there's a uniqueness error. User can also toggle manually.
 */
function ExistingValuesToggle({
  columnKey,
  columnLabel,
  foundationId,
  existingValues,
  setExistingValues,
  showExisting,
  setShowExisting,
  fieldError,
  currentValue,
}: {
  columnKey: string;
  columnLabel: string;
  foundationId: number | string;
  existingValues: Record<string, string[]>;
  setExistingValues: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  showExisting: Record<string, boolean>;
  setShowExisting: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  fieldError?: string;
  currentValue: string;
}) {
  const isOpen = showExisting[columnKey] ?? false;
  const values = existingValues[columnKey];
  const [loading, setLoading] = useState(false);

  // Auto-expand when there's a uniqueness error
  useEffect(() => {
    if (fieldError?.toLowerCase().includes('already been taken') && !isOpen) {
      setShowExisting((prev) => ({ ...prev, [columnKey]: true }));
    }
  }, [fieldError, columnKey, isOpen, setShowExisting]);

  const handleToggle = (checked: boolean) => {
    setShowExisting((prev) => ({ ...prev, [columnKey]: checked }));

    // Fetch existing values on first open (if not already loaded)
    if (checked && !values) {
      setLoading(true);
      api.get<{ success: boolean; records: Record<string, unknown>[] }>(
        `/api/v1/foundations/${foundationId}/records?per_page=1000`
      ).then((response) => {
        const records = response?.records || [];
        const vals = records
          .map((r) => r[columnKey])
          .filter((v): v is string | number => v != null && v !== '')
          .map(String);
        // Sort: numbers first (numerically), then strings (alphabetically)
        const nums = vals.filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(a) - Number(b));
        const strs = vals.filter((v) => !/^\d+$/.test(v)).sort((a, b) => a.localeCompare(b));
        setExistingValues((prev) => ({ ...prev, [columnKey]: [...nums, ...strs] }));
      }).catch(() => {
        setExistingValues((prev) => ({ ...prev, [columnKey]: [] }));
      }).finally(() => {
        setLoading(false);
      });
    }
  };

  return (
    <div className="mt-1">
      <div className="flex items-center gap-1.5">
        <Checkbox
          id={`show-existing-${columnKey}`}
          checked={isOpen}
          onCheckedChange={(checked) => handleToggle(checked === true)}
          className="h-3.5 w-3.5"
        />
        <Label
          htmlFor={`show-existing-${columnKey}`}
          className="text-[11px] text-muted-foreground cursor-pointer select-none"
        >
          Show existing {columnLabel.toLowerCase()} values
        </Label>
      </div>
      {isOpen && (
        <div className="mt-1.5 max-h-[120px] overflow-y-auto rounded border bg-muted/30 p-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner size={12} /> Loading...
            </div>
          ) : values && values.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {values.map((val) => (
                <span
                  key={val}
                  className={cn(
                    "inline-block px-1.5 py-0.5 rounded text-[11px] font-mono",
                    val === currentValue
                      ? "bg-destructive/15 text-destructive font-semibold ring-1 ring-destructive/30"
                      : "bg-background text-foreground border"
                  )}
                >
                  {val}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No existing values</span>
          )}
        </div>
      )}
    </div>
  );
}

export interface EditRecordModalProps {
  /** Whether modal is open */
  open: boolean;

  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;

  /** Foundation ID for API calls (numeric ID or slug string) */
  foundationId: number | string;

  /** Table name for display */
  tableName: string;

  /** Column definitions */
  columns: TableColumn[];

  /** Record being edited */
  record: TableRowType | null;

  /** Edit modal field config from server (tenant-wide, saved on foundations table) */
  editModalConfig?: { visible_fields?: string[]; field_order?: Record<string, number> };

  /** Callback after successful save */
  onSuccess?: () => void;

  /** Extra content rendered below form fields (e.g., PO Task picker) */
  renderExtraContent?: (record: TableRowType, helpers?: { onClose: () => void }) => React.ReactNode;

  /** Called after successful save with the record data */
  onAfterSave?: (record: Record<string, unknown>) => Promise<void>;
}

/**
 * Modal for editing existing records
 */
export function EditRecordModal({
  open,
  onOpenChange,
  foundationId,
  tableName,
  columns,
  record,
  editModalConfig,
  onSuccess,
  renderExtraContent,
  onAfterSave,
}: EditRecordModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [existingValues, setExistingValues] = useState<Record<string, string[]>>({});
  const [showExisting, setShowExisting] = useState<Record<string, boolean>>({});
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);

  // Form data state - initialized from record
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Field visibility and order state
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [fieldOrder, setFieldOrder] = useState<Record<string, number>>({});

  // Debounce timer for saving config to server
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether user has made changes (skip save on initial load)
  const hasUserChangedConfig = useRef(false);

  // Filter columns to show in form
  const editableColumns = useMemo(() => {
    return columns.filter((col) => {
      // Exclude system columns
      if (EXCLUDED_COLUMNS.includes(col.key)) return false;
      // Exclude system-generated types
      if (col.column_type && isSystemGeneratedType(col.column_type)) return false;
      return true;
    });
  }, [columns]);

  // Initialize form data and visibility when record changes
  useEffect(() => {
    if (record && open) {
      // Reset user-changed flag on open
      hasUserChangedConfig.current = false;

      // Initialize form data from record
      const initialData: Record<string, unknown> = {};
      editableColumns.forEach((col) => {
        initialData[col.key] = record[col.key as keyof typeof record] ?? '';
      });
      setFormData(initialData);

      // Try to load saved field preferences from server (tenant-wide)
      const saved = editModalConfig;
      if (saved && saved.visible_fields && saved.visible_fields.length > 0) {
        const { visible_fields, field_order } = saved;
        // Validate that saved fields still exist in current columns
        const validVisible = new Set<string>();
        const columnKeys = new Set(editableColumns.map(c => c.key));
        visible_fields.forEach((key: string) => {
          if (columnKeys.has(key)) validVisible.add(key);
        });
        // Only use saved if we have valid visible fields
        if (validVisible.size > 0) {
          setVisibleFields(validVisible);
          // Merge saved order with current columns (new columns get high order)
          const mergedOrder: Record<string, number> = {};
          editableColumns.forEach((col, idx) => {
            mergedOrder[col.key] = field_order?.[col.key] ?? (idx + 100);
          });
          setFieldOrder(mergedOrder);
          return; // Skip default initialization
        }
      }

      // Default: show first 8 non-system columns
      const defaultVisible = new Set<string>();
      let count = 0;
      for (const col of editableColumns) {
        if (count < 8) {
          defaultVisible.add(col.key);
          count++;
        }
      }
      setVisibleFields(defaultVisible);

      // Initialize field order
      const initialOrder: Record<string, number> = {};
      editableColumns.forEach((col, idx) => {
        initialOrder[col.key] = idx + 1;
      });
      setFieldOrder(initialOrder);
    }
  }, [record, open, editableColumns, editModalConfig]);

  // Save field preferences to server (debounced) when user changes config
  useEffect(() => {
    if (!open || visibleFields.size === 0 || !hasUserChangedConfig.current) return;

    // Clear previous timer
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    // Debounce: save 800ms after last change (avoids rapid API calls during field toggling)
    saveTimerRef.current = setTimeout(() => {
      const config = {
        visible_fields: Array.from(visibleFields),
        field_order: fieldOrder,
      };
      // Update local cache immediately so next modal open uses new config
      updateCachedEditModalConfig(foundationId, config);
      // Persist to server (tenant-wide)
      api.patch(`/api/v1/foundations/${foundationId}/update_edit_modal_config`, {
        edit_modal_config: config,
      }).catch((err: unknown) => {
        console.error('[EditRecordModal] Failed to save field config:', err);
      });
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [visibleFields, fieldOrder, foundationId, open]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for field reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = editableColumns.findIndex((c) => c.key === active.id);
    const newIndex = editableColumns.findIndex((c) => c.key === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedColumns = arrayMove(editableColumns, oldIndex, newIndex);
      const newOrder: Record<string, number> = {};
      reorderedColumns.forEach((col, idx) => {
        newOrder[col.key] = idx + 1;
      });
      hasUserChangedConfig.current = true;
      setFieldOrder(newOrder);
    }
  }, [editableColumns]);

  // Get sorted columns based on field order
  const getSortedColumns = useCallback(() => {
    return [...editableColumns].sort((a, b) => {
      const orderA = fieldOrder[a.key] || 999;
      const orderB = fieldOrder[b.key] || 999;
      return orderA - orderB;
    });
  }, [editableColumns, fieldOrder]);

  // Toggle field visibility
  const toggleFieldVisibility = useCallback((columnKey: string) => {
    hasUserChangedConfig.current = true;
    setVisibleFields((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(columnKey)) {
        newSet.delete(columnKey);
      } else {
        newSet.add(columnKey);
      }
      return newSet;
    });
  }, []);

  // Update field order
  const updateFieldOrder = useCallback((columnKey: string, order: number) => {
    hasUserChangedConfig.current = true;
    setFieldOrder((prev) => ({ ...prev, [columnKey]: order }));
  }, []);

  // Show all fields
  const showAllFields = useCallback(() => {
    hasUserChangedConfig.current = true;
    setVisibleFields(new Set(editableColumns.map((c) => c.key)));
  }, [editableColumns]);

  // Hide all fields
  const hideAllFields = useCallback(() => {
    hasUserChangedConfig.current = true;
    setVisibleFields(new Set());
  }, []);

  // Handle form field change
  const handleFieldChange = useCallback((columnName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [columnName]: value }));
    setSaveError(null);
    setFieldErrors((prev) => {
      if (prev[columnName]) {
        const next = { ...prev };
        delete next[columnName];
        return next;
      }
      return prev;
    });
  }, []);

  // Handle form submission
  const handleSave = async () => {
    if (!record) return;

    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      await api.patch(`/api/v1/foundations/${foundationId}/records/${record.id}`, {
        record: formData,
      });

      // Call onAfterSave with the record data (includes the record ID for API calls)
      if (onAfterSave) {
        await onAfterSave({ ...formData, id: record.id });
      }

      toast({
        title: "Success",
        description: "Record updated successfully",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Use console.warn for 422 validation errors (expected behavior, not bugs)
      // console.error would increment the sidebar error counter unnecessarily
      const apiErr = error as { status?: number };
      if (apiErr.status === 422) {
        console.warn("Validation error on save:", error);
      } else {
        console.error("Failed to update record:", error);
      }
      const errorMessage = error instanceof Error ? error.message : "Failed to update record. Please try again.";
      setSaveError(errorMessage);

      // Parse field-level errors from Rails full_messages format
      // e.g. "Code has already been taken" → field "code", error "has already been taken"
      const apiError = error as { data?: { errors?: string[] } };
      const serverErrors = apiError?.data?.errors;
      if (Array.isArray(serverErrors)) {
        const newFieldErrors: Record<string, string> = {};
        for (const errMsg of serverErrors) {
          if (typeof errMsg !== 'string') continue;
          // Try to match against column labels (Rails humanizes attribute names)
          for (const col of editableColumns) {
            const label = col.label || col.key;
            if (errMsg.startsWith(label + ' ') || errMsg.toLowerCase().startsWith(label.toLowerCase() + ' ')) {
              newFieldErrors[col.key] = errMsg;
              break;
            }
          }
        }
        if (Object.keys(newFieldErrors).length > 0) {
          setFieldErrors(newFieldErrors);

          // For uniqueness errors ("already been taken"), fetch existing values
          const uniquenessFields = Object.entries(newFieldErrors)
            .filter(([, msg]) => msg.toLowerCase().includes('already been taken'))
            .map(([key]) => key);

          if (uniquenessFields.length > 0) {
            api.get<{ success: boolean; records: Record<string, unknown>[] }>(
              `/api/v1/foundations/${foundationId}/records?per_page=1000`
            ).then((response) => {
              const records = response?.records || [];
              const newExisting: Record<string, string[]> = {};
              for (const fieldKey of uniquenessFields) {
                const values = records
                  .map((r) => r[fieldKey])
                  .filter((v): v is string | number => v != null && v !== '')
                  .map(String);
                // Sort: numbers first (numerically), then strings (alphabetically)
                const nums = values.filter((v) => /^\d+$/.test(v)).sort((a, b) => Number(a) - Number(b));
                const strs = values.filter((v) => !/^\d+$/.test(v)).sort((a, b) => a.localeCompare(b));
                newExisting[fieldKey] = [...nums, ...strs];
              }
              setExistingValues((prev) => ({ ...prev, ...newExisting }));
            }).catch(() => {
              // Silently fail - existing values are a nice-to-have
            });
          }
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // Convert TableColumn to ColumnDefinition for RecordFormField
  const toColumnDefinition = useCallback((col: TableColumn): ColumnDefinition => {
    // SSoT: column_type should always be set - log error if missing (skip system columns)
    const systemColumns = ['id', 'created_at', 'updated_at'];
    if (!col.column_type && !systemColumns.includes(col.key)) {
      console.error(`[SSoT] Column "${col.key}" missing column_type - defaulting to single_line_text`);
    }
    return {
    column_name: col.key,
    name: col.label,
    column_type: col.column_type || 'single_line_text',
    column_id: col.id,
    foundation_id: col.foundation_id,
    lookup_foundation_id: col.lookup_foundation_id,
    lookup_foundation_slug: col.lookup_foundation_slug,
    lookup_display_column: col.lookup_display_column,
    choices: col.choices,
    required: (col as { required?: boolean }).required,
    system: col.system,
  };}, []);

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={(openState) => {
      onOpenChange(openState);
      if (!openState) {
        setShowMoreFields(false);
        setShowFieldConfig(false);
        setSaveError(null);
        setFieldErrors({});
        setExistingValues({});
        setShowExisting({});
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Edit Record #{record.id}</DialogTitle>
              <DialogDescription>
                Update this record in {tableName}.
              </DialogDescription>
            </div>
            <Button
              variant={showFieldConfig ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowFieldConfig(!showFieldConfig)}
              className={showFieldConfig ? "" : "text-muted-foreground"}
            >
              {showFieldConfig ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Save &amp; Close
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-1" />
                  Fields
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* Field Configuration Panel */}
        {showFieldConfig && (
          <div className="border rounded-md p-4 mb-4 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Drag to reorder, or type order number</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={showAllFields} className="text-xs h-7">
                  Show All
                </Button>
                <Button variant="ghost" size="sm" onClick={hideAllFields} className="text-xs h-7">
                  Hide All
                </Button>
              </div>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={getSortedColumns().map(c => c.key)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {getSortedColumns().map((col) => (
                    <SortableFieldItem
                      key={col.key}
                      id={col.key}
                      col={col}
                      isVisible={visibleFields.has(col.key)}
                      order={fieldOrder[col.key] || 0}
                      onToggleVisibility={toggleFieldVisibility}
                      onUpdateOrder={updateFieldOrder}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {/* Visible Fields */}
        <div className="grid grid-cols-2 gap-4 py-4">
          {getSortedColumns()
            .filter((col) => visibleFields.has(col.key))
            .map((col) => (
              <div key={col.key}>
                <RecordFormField
                  column={toColumnDefinition(col)}
                  value={formData[col.key]}
                  onChange={handleFieldChange}
                  error={fieldErrors[col.key]}
                />
                <ExistingValuesToggle
                  columnKey={col.key}
                  columnLabel={col.label}
                  foundationId={foundationId}
                  existingValues={existingValues}
                  setExistingValues={setExistingValues}
                  showExisting={showExisting}
                  setShowExisting={setShowExisting}
                  fieldError={fieldErrors[col.key]}
                  currentValue={String(formData[col.key] ?? '')}
                />
              </div>
            ))}
        </div>

        {/* Hidden Fields - Accordion */}
        {getSortedColumns().filter((col) => !visibleFields.has(col.key)).length > 0 && (
          <Accordion
            type="single"
            collapsible
            value={showMoreFields ? "hidden-fields" : ""}
            onValueChange={(v) => setShowMoreFields(v === "hidden-fields")}
          >
            <AccordionItem value="hidden-fields" className="border-none">
              <AccordionTrigger className="text-muted-foreground hover:text-foreground py-0 hover:no-underline">
                Hidden Fields ({getSortedColumns().filter((col) => !visibleFields.has(col.key)).length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-2">
                  {getSortedColumns()
                    .filter((col) => !visibleFields.has(col.key))
                    .map((col) => (
                      <RecordFormField
                        key={col.key}
                        column={toColumnDefinition(col)}
                        value={formData[col.key]}
                        onChange={handleFieldChange}
                        error={fieldErrors[col.key]}
                      />
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {visibleFields.size === 0 && !showMoreFields && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No fields visible. Click &quot;Fields&quot; to configure which fields to show.</p>
          </div>
        )}

        {/* Extra content from parent (e.g., PO Task picker for Cost Centres) */}
        {record && renderExtraContent?.(record, { onClose: () => onOpenChange(false) })}

        {/* Spacer: ensures extra content can scroll above sticky footer (footer ~60px tall) */}
        {renderExtraContent && <div className="pb-14" />}

        <div className="sticky bottom-0 z-10 bg-background pt-2 space-y-3 -mx-6 px-6 -mb-6 pb-6 border-t">
          {saveError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Spinner size={16} className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EditRecordModal;
