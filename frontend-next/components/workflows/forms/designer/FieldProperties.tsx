"use client";

/**
 * FieldProperties
 *
 * Property editor for the selected field in the designer.
 * Edits label, name, required, placeholder, options, etc.
 */

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormFieldDef, FieldOption, FieldType } from "@/lib/workflow-forms/types";
import {
  getFieldMeta,
  isDisplayField,
  isChoiceField,
  isRepeaterField,
  FIELD_TYPE_META,
} from "@/lib/workflow-forms/types";
import {
  addOption,
  removeOption,
  updateOption,
  createField,
} from "@/lib/workflow-forms/schema-utils";

interface FieldPropertiesProps {
  field: FormFieldDef;
  onChange: (updates: Partial<FormFieldDef>) => void;
  onDelete: () => void;
}

export function FieldProperties({ field, onChange, onDelete }: FieldPropertiesProps) {
  const meta = getFieldMeta(field.type);
  const isDisplay = isDisplayField(field.type);
  const hasOptions = isChoiceField(field.type);
  const isRepeater = isRepeaterField(field.type);

  return (
    <div className="space-y-4">
      {/* Field type badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {meta && <meta.icon className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-medium">{meta?.label || field.type}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Label */}
      {field.type !== "separator" && (
        <FormField label="Label">
          <Input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Field label..."
          />
        </FormField>
      )}

      {/* Content for display fields */}
      {(field.type === "heading" || field.type === "paragraph") && (
        <FormField label="Content">
          {field.type === "paragraph" ? (
            <Textarea
              value={field.content || ""}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="Enter text..."
              rows={3}
            />
          ) : (
            <Input
              value={field.content || ""}
              onChange={(e) => onChange({ content: e.target.value })}
              placeholder="Heading text..."
            />
          )}
        </FormField>
      )}

      {/* Data field properties */}
      {!isDisplay && (
        <>
          {/* Name (form key) */}
          <FormField
            label="Field Name"
            hint="Used as the data key when form is submitted"
          >
            <Input
              value={field.name}
              onChange={(e) =>
                onChange({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() })
              }
              placeholder="field_name"
              className="font-mono text-xs"
            />
          </FormField>

          {/* Required */}
          <FormField label="Required" orientation="horizontal">
            <Switch
              checked={field.required ?? false}
              onCheckedChange={(checked) => onChange({ required: checked })}
            />
          </FormField>

          {/* Placeholder */}
          {!["checkbox", "switch"].includes(field.type) && (
            <FormField label="Placeholder">
              <Input
                value={field.placeholder || ""}
                onChange={(e) => onChange({ placeholder: e.target.value })}
                placeholder="Placeholder text..."
              />
            </FormField>
          )}

          {/* Checkbox/Switch description */}
          {["checkbox", "switch"].includes(field.type) && (
            <FormField label="Description" hint="Text shown next to the toggle">
              <Input
                value={field.placeholder || ""}
                onChange={(e) => onChange({ placeholder: e.target.value })}
                placeholder="Description text..."
              />
            </FormField>
          )}

          {/* Number min/max */}
          {field.type === "number" && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Min">
                <Input
                  type="number"
                  value={field.min ?? ""}
                  onChange={(e) =>
                    onChange({ min: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                />
              </FormField>
              <FormField label="Max">
                <Input
                  type="number"
                  value={field.max ?? ""}
                  onChange={(e) =>
                    onChange({ max: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                />
              </FormField>
            </div>
          )}

          {/* Text min/max length */}
          {(field.type === "text" || field.type === "textarea") && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Min Length">
                <Input
                  type="number"
                  value={field.minLength ?? ""}
                  onChange={(e) =>
                    onChange({
                      minLength: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  min={0}
                />
              </FormField>
              <FormField label="Max Length">
                <Input
                  type="number"
                  value={field.maxLength ?? ""}
                  onChange={(e) =>
                    onChange({
                      maxLength: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  min={0}
                />
              </FormField>
            </div>
          )}
        </>
      )}

      {/* Options editor for select/radio/multi_select */}
      {hasOptions && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Options</Label>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange({ options: addOption(field.options ?? []) })}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="space-y-1.5">
            {(field.options ?? []).map((opt, idx) => (
              <OptionRow
                key={idx}
                option={opt}
                onUpdate={(updates) =>
                  onChange({ options: updateOption(field.options ?? [], idx, updates) })
                }
                onRemove={() =>
                  onChange({ options: removeOption(field.options ?? [], idx) })
                }
                canRemove={(field.options?.length ?? 0) > 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Repeater config */}
      {isRepeater && (
        <RepeaterProperties
          field={field}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function OptionRow({
  option,
  onUpdate,
  onRemove,
  canRemove,
}: {
  option: FieldOption;
  onUpdate: (updates: Partial<FieldOption>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Input
        value={option.label}
        onChange={(e) => {
          const label = e.target.value;
          // Auto-generate value from label
          const value = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
          onUpdate({ label, value: value || option.value });
        }}
        placeholder="Option label"
        className="h-7 text-xs"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        disabled={!canRemove}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Repeater Properties ──────────────────────────────────────────────────────

// Field types allowed as sub-fields (no nested repeaters, no display)
const SUB_FIELD_TYPES = FIELD_TYPE_META.filter(
  (m) => m.category !== "group" && m.category !== "display"
);

function RepeaterProperties({
  field,
  onChange,
}: {
  field: FormFieldDef;
  onChange: (updates: Partial<FormFieldDef>) => void;
}) {
  const subFields = field.subFields ?? [];

  const handleAddSubField = (type: FieldType) => {
    const newField = createField(type, subFields);
    onChange({ subFields: [...subFields, newField] });
  };

  const handleUpdateSubField = (idx: number, updates: Partial<FormFieldDef>) => {
    const updated = subFields.map((f, i) => (i === idx ? { ...f, ...updates } : f));
    onChange({ subFields: updated });
  };

  const handleRemoveSubField = (idx: number) => {
    onChange({ subFields: subFields.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4 pt-2 border-t">
      {/* Item label */}
      <FormField label="Item Label" hint="e.g. &quot;Director&quot; → Director 1, Director 2">
        <Input
          value={field.itemLabel || ""}
          onChange={(e) => onChange({ itemLabel: e.target.value })}
          placeholder="Item"
        />
      </FormField>

      {/* Add button label */}
      <FormField label="Add Button Label">
        <Input
          value={field.addLabel || ""}
          onChange={(e) => onChange({ addLabel: e.target.value })}
          placeholder="Add Item"
        />
      </FormField>

      {/* Min/Max items */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Min Items">
          <Input
            type="number"
            value={field.minItems ?? ""}
            onChange={(e) =>
              onChange({ minItems: e.target.value === "" ? undefined : Number(e.target.value) })
            }
            min={0}
          />
        </FormField>
        <FormField label="Max Items">
          <Input
            type="number"
            value={field.maxItems ?? ""}
            onChange={(e) =>
              onChange({ maxItems: e.target.value === "" ? undefined : Number(e.target.value) })
            }
            min={1}
          />
        </FormField>
      </div>

      {/* Sub-fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Sub-fields ({subFields.length})
          </Label>
        </div>

        {subFields.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            No sub-fields yet. Add fields that repeat for each item.
          </p>
        )}

        <div className="space-y-3">
          {subFields.map((subField, idx) => (
            <SubFieldEditor
              key={subField.id}
              field={subField}
              index={idx}
              onUpdate={(updates) => handleUpdateSubField(idx, updates)}
              onRemove={() => handleRemoveSubField(idx)}
            />
          ))}
        </div>

        {/* Add sub-field */}
        <Select onValueChange={(val) => handleAddSubField(val as FieldType)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="+ Add sub-field..." />
          </SelectTrigger>
          <SelectContent>
            {SUB_FIELD_TYPES.map((meta) => {
              const Icon = meta.icon;
              return (
                <SelectItem key={meta.type} value={meta.type}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{meta.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function SubFieldEditor({
  field,
  index,
  onUpdate,
  onRemove,
}: {
  field: FormFieldDef;
  index: number;
  onUpdate: (updates: Partial<FormFieldDef>) => void;
  onRemove: () => void;
}) {
  const meta = getFieldMeta(field.type);
  const hasOptions = isChoiceField(field.type);
  const Icon = meta?.icon;

  return (
    <div className="rounded-md border bg-background p-2.5 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-xs font-medium text-muted-foreground">{meta?.label}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Label */}
      <Input
        value={field.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        placeholder="Label"
        className="h-7 text-xs"
      />

      {/* Name */}
      <Input
        value={field.name}
        onChange={(e) =>
          onUpdate({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() })
        }
        placeholder="field_name"
        className="h-7 text-xs font-mono"
      />

      {/* Required toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Required</span>
        <Switch
          checked={field.required ?? false}
          onCheckedChange={(checked) => onUpdate({ required: checked })}
          className="scale-75"
        />
      </div>

      {/* Options for choice fields */}
      {hasOptions && (
        <div className="space-y-1.5 pt-1 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Options</span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => onUpdate({ options: addOption(field.options ?? []) })}
            >
              <Plus className="h-2.5 w-2.5 mr-0.5" />
              Add
            </Button>
          </div>
          {(field.options ?? []).map((opt, optIdx) => (
            <div key={optIdx} className="flex items-center gap-1">
              <Input
                value={opt.label}
                onChange={(e) => {
                  const label = e.target.value;
                  const value = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
                  onUpdate({
                    options: updateOption(field.options ?? [], optIdx, {
                      label,
                      value: value || opt.value,
                    }),
                  });
                }}
                placeholder="Option"
                className="h-6 text-[10px]"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onUpdate({ options: removeOption(field.options ?? [], optIdx) })}
                disabled={(field.options?.length ?? 0) <= 1}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
