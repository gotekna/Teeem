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

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  Pencil,
  Settings,
  Eye,
  EyeOff,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Spinner } from "@/components/ui/spinner";
import { RecordFormField, type ColumnDefinition } from './RecordFormRenderer';
import type { TableColumn, TableRow } from '../types';
import { isSystemGeneratedType, SYSTEM_VISIBLE_COLUMNS } from "@/lib/constants/system-columns";

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

  /** Callback after successful save */
  onSuccess?: () => void;
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
  onSuccess,
}: EditRecordModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);

  // Form data state - initialized from record
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Field visibility and order state
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [fieldOrder, setFieldOrder] = useState<Record<string, number>>({});

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
      // Initialize form data from record
      const initialData: Record<string, unknown> = {};
      editableColumns.forEach((col) => {
        initialData[col.key] = record[col.key as keyof typeof record] ?? '';
      });
      setFormData(initialData);

      // Initialize visible fields - show first 8 non-system columns by default
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
  }, [record, open, editableColumns]);

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
    setFieldOrder((prev) => ({ ...prev, [columnKey]: order }));
  }, []);

  // Show all fields
  const showAllFields = useCallback(() => {
    setVisibleFields(new Set(editableColumns.map((c) => c.key)));
  }, [editableColumns]);

  // Hide all fields
  const hideAllFields = useCallback(() => {
    setVisibleFields(new Set());
  }, []);

  // Handle form field change
  const handleFieldChange = useCallback((columnName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [columnName]: value }));
  }, []);

  // Handle form submission
  const handleSave = async () => {
    if (!record) return;

    setSaving(true);
    try {
      await api.patch(`/api/v1/foundations/${foundationId}/records/${record.id}`, {
        record: formData,
      });

      toast({
        title: "Success",
        description: "Record updated successfully",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to update record:", error);
      toast({
        title: "Error",
        description: "Failed to update record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Convert TableColumn to ColumnDefinition for RecordFormField
  const toColumnDefinition = useCallback((col: TableColumn): ColumnDefinition => ({
    column_name: col.key,
    name: col.label,
    column_type: col.column_type || 'string',
    lookup_foundation_id: col.lookup_foundation_id,
    choices: col.choices,
    required: (col as { required?: boolean }).required,
    system: col.system,
  }), []);

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={(openState) => {
      onOpenChange(openState);
      if (!openState) {
        setShowMoreFields(false);
        setShowFieldConfig(false);
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-6">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Edit Record #{record.id}</DialogTitle>
              <DialogDescription>
                Update this record in {tableName}.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFieldConfig(!showFieldConfig)}
              className="text-muted-foreground"
            >
              <Settings className="h-4 w-4 mr-1" />
              Fields
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
              <RecordFormField
                key={col.key}
                column={toColumnDefinition(col)}
                value={formData[col.key]}
                onChange={handleFieldChange}
              />
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
      </DialogContent>
    </Dialog>
  );
}

export default EditRecordModal;
