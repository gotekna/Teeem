"use client";

/**
 * AdaptiveFormDesigner
 *
 * Main designer component: field palette + sortable canvas + property editor.
 * Opened from BpmnJsDesigner when editing a UserTask's form.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GripVertical,
  Trash2,
  Eye,
  Settings,
} from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { SortableList, SortableItem } from "@/components/ui/dnd";
import { FieldPalette } from "./FieldPalette";
import { FieldProperties } from "./FieldProperties";
import { FormPreview } from "./FormPreview";
import type {
  AdaptiveFormSchema,
  FormFieldDef,
  FieldType,
} from "@/lib/workflow-forms/types";
import {
  getFieldMeta,
  isDisplayField,
  isRepeaterField,
} from "@/lib/workflow-forms/types";
import {
  addField,
  removeField,
  updateField,
  createEmptySchema,
} from "@/lib/workflow-forms/schema-utils";

interface AdaptiveFormDesignerProps {
  initialSchema?: AdaptiveFormSchema;
  onSave: (schema: AdaptiveFormSchema) => void;
  onCancel: () => void;
}

export function AdaptiveFormDesigner({
  initialSchema,
  onSave,
  onCancel,
}: AdaptiveFormDesignerProps) {
  const [schema, setSchema] = useState<AdaptiveFormSchema>(
    initialSchema ?? createEmptySchema()
  );
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("design");

  const selectedField = schema.fields.find((f) => f.id === selectedFieldId) ?? null;

  // ── Field Operations ───────────────────────────────────────────────────────

  const handleAddField = useCallback(
    (type: FieldType) => {
      const updated = addField(schema, type);
      setSchema(updated);
      // Select the newly added field
      const newField = updated.fields[updated.fields.length - 1];
      setSelectedFieldId(newField.id);
      setActiveTab("design");
    },
    [schema]
  );

  const handleRemoveField = useCallback(
    (fieldId: string) => {
      setSchema((prev) => removeField(prev, fieldId));
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
      }
    },
    [selectedFieldId]
  );

  const handleUpdateField = useCallback(
    (fieldId: string, updates: Partial<FormFieldDef>) => {
      setSchema((prev) => updateField(prev, fieldId, updates));
    },
    []
  );

  const handleReorderFields = useCallback(
    (newFields: Array<FormFieldDef & { id: string }>) => {
      setSchema((prev) => ({ ...prev, fields: newFields }));
    },
    []
  );

  const handleSave = useCallback(() => {
    onSave(schema);
  }, [schema, onSave]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Form Designer</h3>
          <Badge variant="secondary" className="text-xs">
            {schema.fields.length} field{schema.fields.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave}>
            Save Form
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: Field palette */}
        <div className="w-52 border-r overflow-y-auto p-3 bg-muted/30">
          <h4 className="text-xs font-medium text-muted-foreground mb-3">Add Fields</h4>
          <FieldPalette onAddField={handleAddField} />
        </div>

        {/* Center: Canvas with tabs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
            <div className="border-b px-4">
              <TabsList>
                <TabsTrigger value="design" className="gap-1.5">
                  <Settings className="h-4 w-4" />
                  Design
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1.5">
                  <Eye className="h-4 w-4" />
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="design" className="flex-1 overflow-y-auto p-4 mt-0">
              {/* Form meta */}
              <div className="space-y-3 mb-6 pb-4 border-b">
                <FormField label="Form Title">
                  <Input
                    value={schema.title || ""}
                    onChange={(e) => setSchema((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Task Approval Form"
                  />
                </FormField>
                <FormField label="Description" hint="Instructions shown above the form">
                  <Textarea
                    value={schema.description || ""}
                    onChange={(e) =>
                      setSchema((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Instructions for the user..."
                    rows={2}
                  />
                </FormField>
                <FormField label="Submit Button Label">
                  <Input
                    value={schema.submitLabel || ""}
                    onChange={(e) =>
                      setSchema((prev) => ({ ...prev, submitLabel: e.target.value }))
                    }
                    placeholder="Complete"
                  />
                </FormField>
              </div>

              {/* Sortable field canvas */}
              {schema.fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p className="text-sm">No fields yet</p>
                  <p className="text-xs mt-1">
                    Click a field type from the left panel to add it
                  </p>
                </div>
              ) : (
                <SortableList
                  items={schema.fields.map((f) => ({ ...f, id: f.id }))}
                  onReorder={handleReorderFields}
                >
                  {schema.fields.map((field, index) => (
                    <CanvasFieldItem
                      key={field.id}
                      field={field}
                      index={index}
                      isSelected={field.id === selectedFieldId}
                      onSelect={() =>
                        setSelectedFieldId(
                          field.id === selectedFieldId ? null : field.id
                        )
                      }
                      onRemove={() => handleRemoveField(field.id)}
                    />
                  ))}
                </SortableList>
              )}
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-y-auto mt-0">
              <FormPreview schema={schema} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar: Properties */}
        <div className="w-64 border-l overflow-y-auto p-3 bg-muted/30">
          {selectedField ? (
            <>
              <h4 className="text-xs font-medium text-muted-foreground mb-3">
                Field Properties
              </h4>
              <FieldProperties
                field={selectedField}
                onChange={(updates) =>
                  handleUpdateField(selectedField.id, updates)
                }
                onDelete={() => handleRemoveField(selectedField.id)}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p className="text-xs text-center">
                Select a field to edit its properties
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Canvas Field Item ────────────────────────────────────────────────────────

function CanvasFieldItem({
  field,
  index,
  isSelected,
  onSelect,
  onRemove,
}: {
  field: FormFieldDef;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const meta = getFieldMeta(field.type);
  const isDisplay = isDisplayField(field.type);
  const isRepeater = isRepeaterField(field.type);
  const Icon = meta?.icon;
  const subFieldCount = field.subFields?.length ?? 0;

  return (
    <SortableItem
      id={field.id}
      position={index + 1}
      badgeColor={isSelected ? "blue" : "gray"}
      actions={
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      }
    >
      <div
        className={`flex-1 cursor-pointer rounded px-2 py-1 -mx-1 transition-colors ${
          isSelected
            ? "bg-primary/5 ring-1 ring-primary/20"
            : "hover:bg-accent/50"
        }`}
        onClick={onSelect}
      >
        <div className="flex items-center gap-2">
          {Icon && (
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">
            {field.type === "separator"
              ? "Separator"
              : field.label || field.content || meta?.label}
          </span>
          {!isDisplay && !isRepeater && field.required && (
            <span className="text-destructive text-xs">*</span>
          )}
          {isRepeater && (
            <span className="text-xs text-muted-foreground">
              ({subFieldCount} sub-field{subFieldCount !== 1 ? "s" : ""})
            </span>
          )}
        </div>
        {!isDisplay && (
          <div className="text-xs text-muted-foreground font-mono mt-0.5 ml-5.5">
            {field.name}
          </div>
        )}
      </div>
    </SortableItem>
  );
}
