/**
 * Adaptive Form Schema Utilities
 *
 * Pure functions for manipulating form schemas.
 * Used by the designer to add/remove/reorder fields,
 * and by the renderer to build Zod validation schemas.
 */

import { z } from "zod";
import type {
  AdaptiveFormSchema,
  FormFieldDef,
  FieldType,
  FieldOption,
} from "./types";
import { isDisplayField, isChoiceField } from "./types";

// ─── Schema Manipulation ───────────────────────────────────────────────────────

let fieldCounter = 0;

export function generateFieldId(): string {
  fieldCounter++;
  return `field_${Date.now()}_${fieldCounter}`;
}

export function generateFieldName(type: FieldType, existingFields: FormFieldDef[]): string {
  const existingNames = new Set(existingFields.map((f) => f.name));
  const base = type.replace(/_/g, "");
  let name = base;
  let counter = 1;
  while (existingNames.has(name)) {
    name = `${base}_${counter}`;
    counter++;
  }
  return name;
}

export function createField(type: FieldType, existingFields: FormFieldDef[]): FormFieldDef {
  const id = generateFieldId();
  const name = generateFieldName(type, existingFields);

  const field: FormFieldDef = {
    id,
    type,
    label: defaultLabel(type),
    name,
  };

  // Add default options for choice fields
  if (isChoiceField(type)) {
    field.options = [
      { value: "option_1", label: "Option 1" },
      { value: "option_2", label: "Option 2" },
    ];
  }

  // Add default content for display fields
  if (type === "heading") {
    field.content = "Section Heading";
  } else if (type === "paragraph") {
    field.content = "Instructions or description text here.";
  }

  return field;
}

function defaultLabel(type: FieldType): string {
  const labels: Record<FieldType, string> = {
    text: "Text Field",
    textarea: "Text Area",
    number: "Number",
    email: "Email",
    phone: "Phone",
    url: "URL",
    select: "Dropdown",
    multi_select: "Multi Select",
    checkbox: "Checkbox",
    radio: "Radio Group",
    switch: "Toggle",
    date: "Date",
    heading: "Section Heading",
    paragraph: "Paragraph",
    separator: "",
  };
  return labels[type];
}

export function addField(
  schema: AdaptiveFormSchema,
  type: FieldType,
  atIndex?: number
): AdaptiveFormSchema {
  const field = createField(type, schema.fields);
  const fields = [...schema.fields];

  if (atIndex !== undefined && atIndex >= 0 && atIndex <= fields.length) {
    fields.splice(atIndex, 0, field);
  } else {
    fields.push(field);
  }

  return { ...schema, fields };
}

export function removeField(
  schema: AdaptiveFormSchema,
  fieldId: string
): AdaptiveFormSchema {
  return {
    ...schema,
    fields: schema.fields.filter((f) => f.id !== fieldId),
  };
}

export function updateField(
  schema: AdaptiveFormSchema,
  fieldId: string,
  updates: Partial<FormFieldDef>
): AdaptiveFormSchema {
  return {
    ...schema,
    fields: schema.fields.map((f) =>
      f.id === fieldId ? { ...f, ...updates } : f
    ),
  };
}

export function reorderFields(
  schema: AdaptiveFormSchema,
  fromIndex: number,
  toIndex: number
): AdaptiveFormSchema {
  const fields = [...schema.fields];
  const [moved] = fields.splice(fromIndex, 1);
  fields.splice(toIndex, 0, moved);
  return { ...schema, fields };
}

// ─── Zod Schema Builder ────────────────────────────────────────────────────────

export function buildZodSchema(fields: FormFieldDef[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    if (isDisplayField(field.type)) continue;

    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case "number": {
        let num = z.coerce.number();
        if (field.min !== undefined) num = num.min(field.min);
        if (field.max !== undefined) num = num.max(field.max);
        fieldSchema = field.required ? num : num.optional();
        break;
      }
      case "checkbox":
      case "switch": {
        fieldSchema = z.boolean().default(false);
        break;
      }
      case "multi_select": {
        const arr = z.array(z.string());
        fieldSchema = field.required ? arr.min(1, "Select at least one option") : arr.default([]);
        break;
      }
      case "date": {
        let str = z.string();
        if (field.required) str = str.min(1, "Required");
        fieldSchema = field.required ? str : str.optional();
        break;
      }
      case "email": {
        if (field.required) {
          fieldSchema = z.string().min(1, "Required").email("Invalid email");
        } else {
          fieldSchema = z.union([
            z.string().email("Invalid email"),
            z.literal(""),
          ]).optional();
        }
        break;
      }
      case "url": {
        if (field.required) {
          fieldSchema = z.string().min(1, "Required").url("Invalid URL");
        } else {
          fieldSchema = z.union([
            z.string().url("Invalid URL"),
            z.literal(""),
          ]).optional();
        }
        break;
      }
      default: {
        // text, textarea, phone, select, radio
        let str = z.string();
        if (field.required) str = str.min(1, "Required");
        if (field.minLength) str = str.min(field.minLength);
        if (field.maxLength) str = str.max(field.maxLength);
        if (field.pattern) str = str.regex(new RegExp(field.pattern), "Invalid format");
        fieldSchema = field.required ? str : str.optional();
        break;
      }
    }

    shape[field.name] = fieldSchema;
  }

  return z.object(shape);
}

// ─── Default Schema ────────────────────────────────────────────────────────────

export function createEmptySchema(): AdaptiveFormSchema {
  return {
    version: 1,
    form_type: "adaptive",
    title: "",
    description: "",
    submitLabel: "Complete",
    fields: [],
  };
}

// ─── Option Helpers ────────────────────────────────────────────────────────────

export function addOption(options: FieldOption[]): FieldOption[] {
  const num = options.length + 1;
  return [...options, { value: `option_${num}`, label: `Option ${num}` }];
}

export function removeOption(options: FieldOption[], index: number): FieldOption[] {
  return options.filter((_, i) => i !== index);
}

export function updateOption(
  options: FieldOption[],
  index: number,
  updates: Partial<FieldOption>
): FieldOption[] {
  return options.map((opt, i) => (i === index ? { ...opt, ...updates } : opt));
}
