"use client";

import * as React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import {
  Plus,
  Settings,
  Eye,
  EyeOff,
  GripVertical,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { TableColumn } from "./types";
import { isSystemGeneratedType, SYSTEM_VISIBLE_COLUMNS } from "@/lib/constants/system-columns";
import { isLookupColumn } from "@/lib/constants/column-types";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import type { LookupOption } from "./utils/lookup-cache";
import { DocumentTypeLinker, type LinkedDocumentType, type DocumentType } from "@/components/schedule-master/DocumentTypeLinker";

interface CreateRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foundationId: number | string;
  tableName: string;
  columns: TableColumn[];
  onSuccess?: () => void;
}

// Columns to exclude from the form (system-managed or UI-only)
// SSoT: Uses SYSTEM_VISIBLE_COLUMNS + UI-specific columns
const EXCLUDED_COLUMNS = [...SYSTEM_VISIBLE_COLUMNS, "actions", "select"];

// Entity type field visibility mapping for Contacts foundation
// Maps field names to which entity_types they apply to
// Fields not in this map are shown for all entity_types
const CONTACTS_ENTITY_TYPE_FIELDS: Record<string, string[]> = {
  // Person-only fields
  first_name: ["person"],
  last_name: ["person"],
  middle_name: ["person"],
  preferred_name: ["person"],
  date_of_birth: ["person"],
  gender: ["person"],
  employment_status: ["person"],
  role: ["person"],
  employer_ids: ["person"],

  // Company-only fields
  abn: ["company", "trust"],
  acn: ["company"],
  abn_entity_name: ["company", "trust"],
  abn_entity_type: ["company", "trust"],
  abn_valid: ["company", "trust"],
  abn_gst_registered: ["company", "trust"],
  abn_verified_at: ["company", "trust"],
  acn_valid: ["company"],
  acn_verified_at: ["company"],
  website: ["company", "trust"],
  trading_name: ["company", "trust"],
  legal_name: ["company", "trust"],
  company_type: ["company"],
  trust_type: ["trust"],
};

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
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <Input
        type="number"
        value={order}
        onChange={(e) => onUpdateOrder(col.key, parseInt(e.target.value) || 0)}
        className="w-10 h-5 text-xs p-1 text-center"
        min={0}
      />
      <span className="flex-1 truncate">{col.label || col.key}</span>
      <button
        type="button"
        onClick={() => onToggleVisibility(col.key)}
        className="p-0.5 hover:bg-muted rounded"
      >
        {isVisible ? (
          <Eye className="h-3 w-3 text-primary" />
        ) : (
          <EyeOff className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

export function CreateRecordDialog({
  open,
  onOpenChange,
  foundationId,
  tableName,
  columns,
  onSuccess,
}: CreateRecordDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [fieldOrder, setFieldOrder] = useState<Record<string, number>>({});
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [fieldSearch, setFieldSearch] = useState("");
  const [linkedDocumentTypes, setLinkedDocumentTypes] = useState<LinkedDocumentType[]>([]);
  const [availableDocumentTypes, setAvailableDocumentTypes] = useState<DocumentType[]>([]);

  // SSoT: localStorage key for persisting field preferences per foundation
  const storageKey = `${STORAGE_KEYS.MODAL_FIELDS_PREFIX}${foundationId}`;

  // Detect if this is a Schedule Master foundation (supports document type linking)
  const isScheduleMaster = useMemo(() => {
    const nameCheck = tableName.toLowerCase().includes("schedule master");
    const slugCheck = typeof foundationId === "string" && foundationId.includes("schedule_master");
    return nameCheck || slugCheck;
  }, [tableName, foundationId]);

  // Detect if this is a Contacts foundation (supports entity_type field filtering)
  const isContacts = useMemo(() => {
    const nameCheck = tableName.toLowerCase() === "contacts";
    const slugCheck = typeof foundationId === "string" && foundationId === "contacts";
    return nameCheck || slugCheck;
  }, [tableName, foundationId]);

  // Get current entity_type from form data (for Contacts field filtering)
  const currentEntityType = isContacts ? (formData.entity_type as string) : undefined;

  // Lookup column state
  const [lookupOptions, setLookupOptions] = useState<Record<string, LookupOption[]>>({});
  const [lookupLoading, setLookupLoading] = useState<Record<string, boolean>>({});

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter columns (exclude system/UI-only columns and system-generated types)
  // Also filters by entity_type for Contacts foundation
  const filteredColumns = useMemo(() => {
    let result = columns
      .filter((col) => !EXCLUDED_COLUMNS.includes(col.key))
      .filter((col) => !col.system)
      .filter((col) => col.editable !== false)
      .filter((col) => !isSystemGeneratedType(col.column_type || ""))
      .filter((col) => col.label)
      // SSoT: Respect settings.show_in_create from Column model
      .filter((col) => col.settings?.show_in_create !== false);

    // For Contacts, filter fields based on selected entity_type
    if (isContacts && currentEntityType) {
      result = result.filter((col) => {
        const allowedTypes = CONTACTS_ENTITY_TYPE_FIELDS[col.key];
        // If field has no entity_type restriction, show it
        if (!allowedTypes) return true;
        // Otherwise, only show if current entity_type is in the allowed list
        return allowedTypes.includes(currentEntityType);
      });
    }

    return result;
  }, [columns, isContacts, currentEntityType]);

  // Track previous entity type to detect changes
  const prevEntityTypeRef = React.useRef<string | undefined>(undefined);

  // Initialize visible fields and order on first render or when columns change
  React.useEffect(() => {
    if (filteredColumns.length > 0 && visibleFields.size === 0) {
      // Try to load saved field preferences from localStorage (SSoT: storage-utils)
      const saved = getStorageItem<{ visible?: string[]; order?: Record<string, number> } | null>(storageKey, null);
      if (saved) {
        const { visible, order } = saved;
        // Validate that saved fields still exist in current columns
        const validVisible = new Set<string>();
        const columnKeys = new Set(filteredColumns.map(c => c.key));
        (visible || []).forEach((key: string) => {
          if (columnKeys.has(key)) validVisible.add(key);
        });
        // Also add any required fields that might be missing from saved preferences
        const requiredFields = filteredColumns.filter((col) => col.required);
        requiredFields.forEach((col) => validVisible.add(col.key));
        // Only use saved if we have valid visible fields
        if (validVisible.size > 0) {
          setVisibleFields(validVisible);
          // Merge saved order with current columns (new columns get high order)
          const mergedOrder: Record<string, number> = {};
          filteredColumns.forEach((col, idx) => {
            mergedOrder[col.key] = order?.[col.key] ?? (idx + 100);
          });
          setFieldOrder(mergedOrder);
          return; // Skip default initialization
        }
      }

      // Default: Find required fields - they MUST be visible
      const requiredFields = filteredColumns.filter((col) => col.required);

      // Show first 8 fields by default, but always include required fields
      const firstEight = new Set(
        filteredColumns.slice(0, 8).map((col) => col.key)
      );
      const initialVisible = new Set([
        ...Array.from(firstEight),
        ...requiredFields.map((col) => col.key),
      ]);
      setVisibleFields(initialVisible);

      // Set initial order: required fields first, then others by original order
      const requiredKeys = new Set(requiredFields.map((col) => col.key));
      const orderedCols = [
        ...requiredFields,
        ...filteredColumns.filter((col) => !requiredKeys.has(col.key)),
      ];
      const initialOrder: Record<string, number> = {};
      orderedCols.forEach((col, index) => {
        initialOrder[col.key] = index + 1;
      });
      setFieldOrder(initialOrder);
    }
  }, [filteredColumns, visibleFields.size, storageKey]);

  // Save field preferences to localStorage when they change (SSoT: storage-utils)
  useEffect(() => {
    if (visibleFields.size > 0) {
      const data = {
        visible: Array.from(visibleFields),
        order: fieldOrder,
      };
      setStorageItem(storageKey, data);
    }
  }, [visibleFields, fieldOrder, storageKey]);

  // Update visible fields when entity_type changes (Contacts only)
  React.useEffect(() => {
    if (!isContacts) return;

    // Only update if entity_type actually changed
    if (currentEntityType === prevEntityTypeRef.current) return;
    prevEntityTypeRef.current = currentEntityType;

    // When entity_type changes, reset visible fields to show appropriate fields
    if (currentEntityType && filteredColumns.length > 0) {
      const requiredFields = filteredColumns.filter((col) => col.required);
      const firstEight = new Set(
        filteredColumns.slice(0, 8).map((col) => col.key)
      );
      const newVisible = new Set([
        ...Array.from(firstEight),
        ...requiredFields.map((col) => col.key),
      ]);
      setVisibleFields(newVisible);

      // Update field order
      const requiredKeys = new Set(requiredFields.map((col) => col.key));
      const orderedCols = [
        ...requiredFields,
        ...filteredColumns.filter((col) => !requiredKeys.has(col.key)),
      ];
      const newOrder: Record<string, number> = {};
      orderedCols.forEach((col, index) => {
        newOrder[col.key] = index + 1;
      });
      setFieldOrder(newOrder);
    }
  }, [isContacts, currentEntityType, filteredColumns]);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setFormData({});
      setShowMoreFields(false);
      setShowFieldConfig(false);
      setValidationErrors(new Set());
      setFieldSearch("");
      setLinkedDocumentTypes([]);
      prevEntityTypeRef.current = undefined; // Reset entity type tracking
      setVisibleFields(new Set()); // Reset so it re-initializes based on current entity_type

      // Fetch available document types for Schedule Master
      if (isScheduleMaster) {
        api.get<{ success: boolean; data: DocumentType[] }>("/api/v1/document_types", {
          params: { scope: "job" },
        }).then((response) => {
          setAvailableDocumentTypes(response.data || []);
        }).catch((error) => {
          console.error("Failed to fetch document types:", error);
          setAvailableDocumentTypes([]);
        });
      }

      // Fetch lookup options for all lookup columns
      const lookupColumns = filteredColumns.filter(
        (col) => isLookupColumn(col.column_type) || col.lookup_foundation_id
      );

      lookupColumns.forEach(async (col) => {
        // SSoT: Use slug for API calls (portable), fallback to ID
        const targetFoundation = col.lookup_foundation_slug || col.lookup_foundation_id;
        if (!targetFoundation) return;

        // Skip if already loaded
        const cacheKey = col.key;
        if (lookupOptions[cacheKey]) return;

        setLookupLoading((prev) => ({ ...prev, [cacheKey]: true }));
        try {
          // Fetch directly using api - Foundation API accepts both IDs and slugs
          const response = await api.get<{ records: Record<string, unknown>[] }>(
            `/api/v1/foundations/${targetFoundation}/records`,
            { params: { per_page: 500 } }
          );
          const displayColumn = col.lookup_display_column || "name";
          const options: LookupOption[] = (response.records || []).map((record) => ({
            id: Number(record.id),
            display: String(record[displayColumn] || record.name || record.title || record.id || ""),
          }));
          setLookupOptions((prev) => ({ ...prev, [cacheKey]: options }));
        } catch (error) {
          console.error(`Failed to fetch lookup options for ${col.key}:`, error);
          setLookupOptions((prev) => ({ ...prev, [cacheKey]: [] }));
        } finally {
          setLookupLoading((prev) => ({ ...prev, [cacheKey]: false }));
        }
      });
    }
  }, [open, filteredColumns, isScheduleMaster]);

  // Get sorted columns based on field order
  const getSortedColumns = () => {
    return [...filteredColumns].sort((a, b) => {
      const orderA = fieldOrder[a.key] || 0;
      const orderB = fieldOrder[b.key] || 0;
      return orderA - orderB;
    });
  };

  // Toggle field visibility and auto-reorder so visible fields are at the top
  const toggleFieldVisibility = (columnKey: string) => {
    const newVisible = new Set(visibleFields);
    const wasVisible = newVisible.has(columnKey);

    if (wasVisible) {
      newVisible.delete(columnKey);
    } else {
      newVisible.add(columnKey);
    }
    setVisibleFields(newVisible);

    // Reorder: visible fields first (sorted by current order), then hidden fields
    const sortedCols = getSortedColumns();
    const visibleCols = sortedCols.filter(c => newVisible.has(c.key));
    const hiddenCols = sortedCols.filter(c => !newVisible.has(c.key));
    const reordered = [...visibleCols, ...hiddenCols];

    const newOrder: Record<string, number> = {};
    reordered.forEach((col, index) => {
      newOrder[col.key] = index + 1;
    });
    setFieldOrder(newOrder);
  };

  // Update field order
  const updateFieldOrder = (columnKey: string, order: number) => {
    setFieldOrder((prev) => ({ ...prev, [columnKey]: order }));
  };

  // Show all fields (keeps current order since all are visible)
  const showAllFields = () => {
    setVisibleFields(new Set(filteredColumns.map((col) => col.key)));
  };

  // Hide all fields (keeps current order)
  const hideAllFields = () => {
    setVisibleFields(new Set());
  };

  // Handle drag end for reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const sortedCols = getSortedColumns();
      const oldIndex = sortedCols.findIndex((c) => c.key === active.id);
      const newIndex = sortedCols.findIndex((c) => c.key === over.id);
      const reordered = arrayMove(sortedCols, oldIndex, newIndex);

      // Update field order
      const newOrder: Record<string, number> = {};
      reordered.forEach((col, index) => {
        newOrder[col.key] = index + 1;
      });
      setFieldOrder(newOrder);
    }
  };

  // Helper to check if a field value is empty
  const isFieldEmpty = (value: unknown): boolean => {
    if (value === undefined || value === null) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  };

  // Clear validation error when field is filled
  const handleFieldChange = (key: string, value: unknown) => {
    setFormData({ ...formData, [key]: value });
    // Clear error for this field if it now has a value
    if (validationErrors.has(key) && !isFieldEmpty(value)) {
      const newErrors = new Set(validationErrors);
      newErrors.delete(key);
      setValidationErrors(newErrors);
    }
  };

  // Render form field based on column type
  const renderFormField = (col: TableColumn) => {
    const value = formData[col.key];
    const label = col.label || col.key;
    const isRequired = col.required === true;
    const hasError = validationErrors.has(col.key);

    // Label component with required asterisk
    const FieldLabel = ({ htmlFor, children, className }: { htmlFor: string; children: React.ReactNode; className?: string }) => (
      <Label htmlFor={htmlFor} className={cn(className, hasError && "text-destructive")}>
        {children}
        {isRequired && <span className="text-destructive ml-0.5">*</span>}
      </Label>
    );

    // Error message
    const ErrorMessage = () =>
      hasError ? (
        <p className="text-xs text-destructive mt-1">This field is required</p>
      ) : null;

    // Check if column is a lookup type
    const colType = col.column_type;
    const isLookup = (isLookupColumn(colType) && colType !== "multiple_lookups") || !!col.lookup_foundation_id;
    const isMultipleLookup = colType === "multiple_lookups";

    // Handle multiple lookups (checkboxes for multi-select)
    if (isMultipleLookup) {
      const options = lookupOptions[col.key] || [];
      const isLoading = lookupLoading[col.key];
      // Value is an array of IDs
      const selectedIds = Array.isArray(value) ? value.map(String) : [];

      return (
        <div className="space-y-2">
          <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
          <div className={cn(
            "border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-2",
            hasError && "border-destructive"
          )}>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner size={16} />
                <span className="text-sm">Loading options...</span>
              </div>
            ) : options.length === 0 ? (
              <span className="text-sm text-muted-foreground">No options available</span>
            ) : (
              options.map((opt) => (
                <div key={opt.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${col.key}_${opt.id}`}
                    checked={selectedIds.includes(String(opt.id))}
                    onCheckedChange={(checked) => {
                      const newIds = checked
                        ? [...selectedIds, String(opt.id)]
                        : selectedIds.filter((id) => id !== String(opt.id));
                      handleFieldChange(col.key, newIds.map(Number));
                    }}
                  />
                  <Label htmlFor={`${col.key}_${opt.id}`} className="text-sm cursor-pointer">
                    {opt.display}
                  </Label>
                </div>
              ))
            )}
          </div>
          <ErrorMessage />
        </div>
      );
    }

    // Handle single lookup (searchable dropdown)
    if (isLookup) {
      const options = lookupOptions[col.key] || [];
      const isLoading = lookupLoading[col.key];
      const selectedOption = options.find(o => String(o.id) === String(value));

      return (
        <div className="space-y-2">
          <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
          <ComboboxDropdown
            items={options.map(o => ({ id: String(o.id), label: o.display }))}
            selectedItem={selectedOption ? { id: String(selectedOption.id), label: selectedOption.display } : undefined}
            onSelect={(item) => handleFieldChange(col.key, Number(item.id))}
            placeholder="Search..."
            searchPlaceholder="Type to search..."
            isLoading={isLoading}
            clearable
            onClear={() => handleFieldChange(col.key, null)}
            emptyResults="No options available"
            className={cn(hasError && "border-destructive")}
          />
          <ErrorMessage />
        </div>
      );
    }

    switch (col.column_type) {
      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={col.key}
              checked={value === true}
              onCheckedChange={(checked) =>
                handleFieldChange(col.key, checked === true)
              }
            />
            <FieldLabel htmlFor={col.key} className="cursor-pointer">
              {label}
            </FieldLabel>
          </div>
        );

      case "multiple_lines_text":
      case "long_text":
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
            <textarea
              id={col.key}
              value={String(value || "")}
              onChange={(e) => handleFieldChange(col.key, e.target.value)}
              rows={3}
              className={cn(
                "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                hasError && "border-destructive focus-visible:ring-destructive"
              )}
            />
            <ErrorMessage />
          </div>
        );

      case "number":
      case "whole_number":
      case "currency":
      case "percentage":
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
            <Input
              id={col.key}
              type="number"
              step={col.column_type === "whole_number" ? "1" : "any"}
              value={String(value || "")}
              onChange={(e) => handleFieldChange(col.key, e.target.value)}
              className={cn(hasError && "border-destructive focus-visible:ring-destructive")}
            />
            <ErrorMessage />
          </div>
        );

      case "date":
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
            <Input
              id={col.key}
              type="date"
              value={String(value || "")}
              onChange={(e) => handleFieldChange(col.key, e.target.value)}
              className={cn(hasError && "border-destructive focus-visible:ring-destructive")}
            />
            <ErrorMessage />
          </div>
        );

      case "date_and_time":
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
            <Input
              id={col.key}
              type="datetime-local"
              value={String(value || "")}
              onChange={(e) => handleFieldChange(col.key, e.target.value)}
              className={cn(hasError && "border-destructive focus-visible:ring-destructive")}
            />
            <ErrorMessage />
          </div>
        );

      case "email":
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
            <Input
              id={col.key}
              type="email"
              value={String(value || "")}
              onChange={(e) => handleFieldChange(col.key, e.target.value)}
              className={cn(hasError && "border-destructive focus-visible:ring-destructive")}
            />
            <ErrorMessage />
          </div>
        );

      case "url":
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
            <Input
              id={col.key}
              type="url"
              value={String(value || "")}
              onChange={(e) => handleFieldChange(col.key, e.target.value)}
              className={cn(hasError && "border-destructive focus-visible:ring-destructive")}
            />
            <ErrorMessage />
          </div>
        );

      case "color_picker":
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id={col.key}
                type="color"
                value={String(value || "#000000")}
                onChange={(e) => handleFieldChange(col.key, e.target.value)}
                className={cn("w-16 h-10 p-1", hasError && "border-destructive")}
              />
              <Input
                value={String(value || "")}
                onChange={(e) => handleFieldChange(col.key, e.target.value)}
                placeholder="#000000"
                className={cn("flex-1", hasError && "border-destructive focus-visible:ring-destructive")}
              />
            </div>
            <ErrorMessage />
          </div>
        );

      case "choice":
        // Handle choice columns with predefined options (searchable)
        if (col.choices && col.choices.length > 0) {
          const selectedChoice = col.choices.find(c => c === value);
          return (
            <div className="space-y-2">
              <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
              <ComboboxDropdown
                items={col.choices.map(c => ({ id: c, label: c }))}
                selectedItem={selectedChoice ? { id: selectedChoice, label: selectedChoice } : undefined}
                onSelect={(item) => handleFieldChange(col.key, item.id)}
                placeholder="Search options..."
                searchPlaceholder="Type to search..."
                clearable
                onClear={() => handleFieldChange(col.key, "")}
                emptyResults="No options available"
                className={cn(hasError && "border-destructive")}
              />
              <ErrorMessage />
            </div>
          );
        }
        // Fall through to default if no choices
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
            <Input
              id={col.key}
              value={String(value || "")}
              onChange={(e) => handleFieldChange(col.key, e.target.value)}
              className={cn(hasError && "border-destructive focus-visible:ring-destructive")}
            />
            <ErrorMessage />
          </div>
        );

      default:
        // Check if column has choices even if type isn't explicitly "choice"
        if (col.choices && col.choices.length > 0) {
          const selectedChoice = col.choices.find(c => c === value);
          return (
            <div className="space-y-2">
              <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
              <ComboboxDropdown
                items={col.choices.map(c => ({ id: c, label: c }))}
                selectedItem={selectedChoice ? { id: selectedChoice, label: selectedChoice } : undefined}
                onSelect={(item) => handleFieldChange(col.key, item.id)}
                placeholder="Search options..."
                searchPlaceholder="Type to search..."
                clearable
                onClear={() => handleFieldChange(col.key, "")}
                emptyResults="No options available"
                className={cn(hasError && "border-destructive")}
              />
              <ErrorMessage />
            </div>
          );
        }
        return (
          <div className="space-y-2">
            <FieldLabel htmlFor={col.key}>{label}</FieldLabel>
            <Input
              id={col.key}
              value={String(value || "")}
              onChange={(e) => handleFieldChange(col.key, e.target.value)}
              className={cn(hasError && "border-destructive focus-visible:ring-destructive")}
            />
            <ErrorMessage />
          </div>
        );
    }
  };

  // Handle form submission
  const handleCreate = async () => {
    // Validate required fields
    const requiredColumns = filteredColumns.filter((col) => col.required === true);
    const missingFields = requiredColumns.filter((col) => isFieldEmpty(formData[col.key]));

    // Schedule Master specific validation: require at least one template
    if (isScheduleMaster) {
      const templateIds = formData["sm_template_ids"];
      const hasTemplates = Array.isArray(templateIds) && templateIds.length > 0;
      if (!hasTemplates) {
        // Add sm_template_ids to missing fields for error display
        const templateCol = filteredColumns.find((col) => col.key === "sm_template_ids");
        if (templateCol && !missingFields.find((col) => col.key === "sm_template_ids")) {
          missingFields.push(templateCol);
        }
      }
    }

    if (missingFields.length > 0) {
      // Set validation errors
      setValidationErrors(new Set(missingFields.map((col) => col.key)));

      // Show toast with missing field names
      const fieldNames = missingFields.map((col) => col.label || col.key).join(", ");
      toast({
        title: "Required Fields Missing",
        description: `Please fill in: ${fieldNames}`,
        variant: "destructive",
      });

      // Ensure missing fields are visible by expanding hidden fields if needed
      const hiddenMissing = missingFields.filter((col) => !visibleFields.has(col.key));
      if (hiddenMissing.length > 0) {
        setShowMoreFields(true);
      }

      return;
    }

    setSaving(true);
    try {
      // Build payload with optional document types for Schedule Master
      const recordData: Record<string, unknown> = { ...formData };

      // Add document types as nested attributes for Schedule Master
      if (isScheduleMaster && linkedDocumentTypes.length > 0) {
        recordData.sm_schedule_master_document_types_attributes = linkedDocumentTypes.map((dt) => ({
          document_type_id: dt.document_type_id,
          lag_days: dt.lag_days,
          assigned_role: dt.assigned_role,
        }));
      }

      const payload = {
        record: recordData,
      };

      await api.post(`/api/v1/foundations/${foundationId}/records`, payload);

      toast({
        title: "Success",
        description: "Record created successfully",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create record:", error);
      toast({
        title: "Error",
        description: "Failed to create record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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
              <DialogTitle>Add New Item</DialogTitle>
              <DialogDescription>
                Create a new record in {tableName}.
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
            {/* Search and Actions Row */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search fields..."
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={showAllFields} className="text-xs h-7">
                  Show All
                </Button>
                <Button variant="ghost" size="sm" onClick={hideAllFields} className="text-xs h-7">
                  Hide All
                </Button>
              </div>
            </div>

            {/* Visible Fields Section */}
            {(() => {
              const searchLower = fieldSearch.toLowerCase();
              const visibleCols = getSortedColumns()
                .filter((col) => visibleFields.has(col.key))
                .filter((col) => !fieldSearch || (col.label || col.key).toLowerCase().includes(searchLower));
              const hiddenCols = filteredColumns
                .filter((col) => !visibleFields.has(col.key))
                .filter((col) => !fieldSearch || (col.label || col.key).toLowerCase().includes(searchLower))
                .sort((a, b) => (a.label || a.key).localeCompare(b.label || b.key));

              return (
                <>
                  {/* Visible Fields - Draggable */}
                  {visibleCols.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <Eye className="h-3 w-3" />
                        Visible ({visibleCols.length})
                      </div>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={visibleCols.map(c => c.key)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-1">
                            {visibleCols.map((col) => (
                              <SortableFieldItem
                                key={col.key}
                                id={col.key}
                                col={col}
                                isVisible={true}
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

                  {/* Hidden Fields - Alphabetical */}
                  {hiddenCols.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <EyeOff className="h-3 w-3" />
                        Hidden ({hiddenCols.length}) - Alphabetical
                      </div>
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {hiddenCols.map((col) => (
                          <div
                            key={col.key}
                            className="flex items-center gap-2 px-2 py-1.5 text-xs rounded border bg-background border-border text-muted-foreground"
                          >
                            <span className="w-6" /> {/* Spacer for alignment */}
                            <span className="w-10" /> {/* Spacer for order number */}
                            <span className="flex-1 truncate">{col.label || col.key}</span>
                            <button
                              type="button"
                              onClick={() => toggleFieldVisibility(col.key)}
                              className="p-0.5 hover:bg-muted rounded"
                            >
                              <EyeOff className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {visibleCols.length === 0 && hiddenCols.length === 0 && fieldSearch && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No fields match &quot;{fieldSearch}&quot;
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Visible Fields */}
        <div className="grid grid-cols-2 gap-4 py-4">
          {getSortedColumns()
            .filter((col) => visibleFields.has(col.key))
            .map((col) => (
            <div key={col.key}>
              {renderFormField(col)}
            </div>
          ))}
        </div>

        {/* Document Type Linker (Schedule Master only) */}
        {isScheduleMaster && (
          <div className="py-4 border-t">
            <DocumentTypeLinker
              linkedDocumentTypes={linkedDocumentTypes}
              documentTypes={availableDocumentTypes}
              onChange={setLinkedDocumentTypes}
            />
          </div>
        )}

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
                    <div key={col.key}>
                      {renderFormField(col)}
                    </div>
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
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? (
              <>
                <Spinner size={16} className="mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Item
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateRecordDialog;
