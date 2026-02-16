/**
 * Adaptive Form Schema Types
 *
 * Defines the JSON schema format stored in bpmn_nodes.config.form_schema.
 * Used by both the designer (authoring) and renderer (runtime).
 */

import {
  Type,
  TextCursorInput,
  AlignLeft,
  Hash,
  Mail,
  Phone,
  Link,
  List,
  ListChecks,
  CheckSquare,
  CircleDot,
  ToggleLeft,
  Calendar,
  Heading,
  Text,
  Minus,
  ListPlus,
  type LucideIcon,
} from "lucide-react";

// ─── Field Types ───────────────────────────────────────────────────────────────

export type InputFieldType = "text" | "textarea" | "number" | "email" | "phone" | "url";
export type ChoiceFieldType = "select" | "multi_select" | "checkbox" | "radio" | "switch";
export type DateFieldType = "date";
export type DisplayFieldType = "heading" | "paragraph" | "separator";
export type GroupFieldType = "repeater";

export type FieldType = InputFieldType | ChoiceFieldType | DateFieldType | DisplayFieldType | GroupFieldType;

export type FieldCategory = "input" | "choice" | "date" | "display" | "group";

// ─── Field Option (for select, radio, multi_select) ────────────────────────────

export interface FieldOption {
  value: string;
  label: string;
}

// ─── Form Field Definition ─────────────────────────────────────────────────────

export interface FormFieldDef {
  id: string;
  type: FieldType;
  label: string;
  name: string; // form data key
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean | string[];
  options?: FieldOption[]; // for select, radio, multi_select
  // Display-only fields
  content?: string; // for heading, paragraph
  // Validation
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string; // regex
  // Repeater fields
  subFields?: FormFieldDef[];
  itemLabel?: string; // e.g. "Director" → renders as "Director 1", "Director 2"
  addLabel?: string; // e.g. "Add Director"
  minItems?: number;
  maxItems?: number;
}

// ─── Form Schema (stored in bpmn_nodes.config.form_schema) ─────────────────────

export interface AdaptiveFormSchema {
  version: 1;
  form_type: "adaptive";
  title?: string;
  description?: string;
  submitLabel?: string;
  fields: FormFieldDef[];
}

// ─── Field Type Metadata ───────────────────────────────────────────────────────

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  icon: LucideIcon;
  category: FieldCategory;
  hasOptions?: boolean; // shows options editor in properties
  isDisplay?: boolean; // non-data field (no form value)
}

export const FIELD_TYPE_META: FieldTypeMeta[] = [
  // Input
  { type: "text", label: "Text", icon: TextCursorInput, category: "input" },
  { type: "textarea", label: "Text Area", icon: AlignLeft, category: "input" },
  { type: "number", label: "Number", icon: Hash, category: "input" },
  { type: "email", label: "Email", icon: Mail, category: "input" },
  { type: "phone", label: "Phone", icon: Phone, category: "input" },
  { type: "url", label: "URL", icon: Link, category: "input" },
  // Choice
  { type: "select", label: "Dropdown", icon: List, category: "choice", hasOptions: true },
  { type: "multi_select", label: "Multi Select", icon: ListChecks, category: "choice", hasOptions: true },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare, category: "choice" },
  { type: "radio", label: "Radio Group", icon: CircleDot, category: "choice", hasOptions: true },
  { type: "switch", label: "Toggle", icon: ToggleLeft, category: "choice" },
  // Date
  { type: "date", label: "Date", icon: Calendar, category: "date" },
  // Display
  { type: "heading", label: "Heading", icon: Heading, category: "display", isDisplay: true },
  { type: "paragraph", label: "Paragraph", icon: Text, category: "display", isDisplay: true },
  { type: "separator", label: "Separator", icon: Minus, category: "display", isDisplay: true },
  // Group
  { type: "repeater", label: "Repeater", icon: ListPlus, category: "group" },
];

export function getFieldMeta(type: FieldType): FieldTypeMeta | undefined {
  return FIELD_TYPE_META.find((m) => m.type === type);
}

export function isDisplayField(type: FieldType): boolean {
  return getFieldMeta(type)?.isDisplay === true;
}

export function isChoiceField(type: FieldType): boolean {
  return getFieldMeta(type)?.hasOptions === true;
}

export function isRepeaterField(type: FieldType): boolean {
  return type === "repeater";
}
