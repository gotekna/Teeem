"use client";

/**
 * AdaptiveFieldRenderer
 *
 * Maps a FormFieldDef type to the corresponding Shadcn UI component.
 * Used by AdaptiveFormRenderer for runtime rendering and FormPreview for design-time.
 */

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import type { FormFieldDef } from "@/lib/workflow-forms/types";
import { isDisplayField } from "@/lib/workflow-forms/types";

interface AdaptiveFieldRendererProps {
  field: FormFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

export function AdaptiveFieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled = false,
}: AdaptiveFieldRendererProps) {
  switch (field.type) {
    // ── Input Types ──────────────────────────────────────────────────────────
    case "text":
    case "email":
    case "phone":
    case "url":
      return (
        <Input
          type={field.type === "phone" ? "tel" : field.type === "text" ? "text" : field.type}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={cn(error && "border-destructive")}
        />
      );

    case "number":
      return (
        <Input
          type="number"
          value={value !== undefined && value !== null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          disabled={disabled}
          className={cn(error && "border-destructive")}
        />
      );

    case "textarea":
      return (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={4}
          className={cn(error && "border-destructive")}
        />
      );

    // ── Choice Types ─────────────────────────────────────────────────────────
    case "select":
      return (
        <Select
          value={(value as string) ?? ""}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger className={cn(error && "border-destructive")}>
            <SelectValue placeholder={field.placeholder || "Select..."} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multi_select": {
      const selectedValues = (value as string[]) ?? [];
      return (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={selectedValues.includes(opt.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selectedValues, opt.value]);
                  } else {
                    onChange(selectedValues.filter((v) => v !== opt.value));
                  }
                }}
                disabled={disabled}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      );
    }

    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={(value as boolean) ?? false}
            onCheckedChange={onChange}
            disabled={disabled}
          />
          {field.placeholder && (
            <span className="text-sm text-muted-foreground">
              {field.placeholder}
            </span>
          )}
        </div>
      );

    case "radio":
      return (
        <RadioGroup
          value={(value as string) ?? ""}
          onValueChange={onChange}
          disabled={disabled}
          className="space-y-2"
        >
          {(field.options ?? []).map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <RadioGroupItem value={opt.value} id={`${field.id}-${opt.value}`} />
              <Label htmlFor={`${field.id}-${opt.value}`} className="font-normal cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "switch":
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={(value as boolean) ?? false}
            onCheckedChange={onChange}
            disabled={disabled}
          />
          {field.placeholder && (
            <span className="text-sm text-muted-foreground">
              {field.placeholder}
            </span>
          )}
        </div>
      );

    // ── Date Type ────────────────────────────────────────────────────────────
    case "date": {
      const dateValue = value ? parseISO(value as string) : undefined;
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !value && "text-muted-foreground",
                error && "border-destructive"
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateValue ? format(dateValue, "PPP") : (field.placeholder || "Pick a date")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
            />
          </PopoverContent>
        </Popover>
      );
    }

    // ── Display Types ────────────────────────────────────────────────────────
    case "heading":
      return (
        <h3 className="text-lg font-semibold text-foreground">
          {field.content || field.label}
        </h3>
      );

    case "paragraph":
      return (
        <p className="text-sm text-muted-foreground">
          {field.content || ""}
        </p>
      );

    case "separator":
      return <Separator />;

    // ── Group Types ───────────────────────────────────────────────────────
    case "repeater": {
      const items = (value as Record<string, unknown>[]) ?? [{}];
      const canRemove = items.length > (field.minItems ?? 0);
      const canAdd = !field.maxItems || items.length < field.maxItems;

      const addItem = () => onChange([...items, {}]);
      const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));
      const updateItem = (idx: number, key: string, val: unknown) => {
        const updated = [...items];
        updated[idx] = { ...updated[idx], [key]: val };
        onChange(updated);
      };

      return (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <Card key={idx} className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between py-2.5 px-4 space-y-0 bg-muted/30">
                <span className="text-sm font-medium">
                  {field.itemLabel || "Item"} {idx + 1}
                </span>
                {canRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(idx)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3 pt-3 px-4 pb-4">
                {(field.subFields ?? []).map((subField) => {
                  if (isDisplayField(subField.type)) {
                    return (
                      <AdaptiveFieldRenderer
                        key={subField.id}
                        field={subField}
                        value={undefined}
                        onChange={() => {}}
                        disabled={disabled}
                      />
                    );
                  }
                  return (
                    <FormField
                      key={subField.id}
                      label={subField.label}
                      required={subField.required}
                    >
                      <AdaptiveFieldRenderer
                        field={subField}
                        value={item[subField.name]}
                        onChange={(val) => updateItem(idx, subField.name, val)}
                        disabled={disabled}
                      />
                    </FormField>
                  );
                })}
              </CardContent>
            </Card>
          ))}
          {canAdd && (
            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              disabled={disabled}
              className="w-full border-dashed"
            >
              <Plus className="h-4 w-4 mr-2" />
              {field.addLabel || `Add ${field.itemLabel || "Item"}`}
            </Button>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
