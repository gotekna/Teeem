/**
 * Cell Editor Registry
 *
 * Maps column types to their editor components.
 * This provides a single source of truth for which editor handles each column type.
 *
 * Usage:
 *   const Editor = getEditor(column.column_type);
 *   return <Editor {...props} />;
 */

import type { CellEditorComponent } from './types';

// Import all editors
import TextEditor from './TextEditor';
import NumberEditor from './NumberEditor';
import BooleanEditor from './BooleanEditor';
import ChoiceEditor from './ChoiceEditor';
import DateEditor from './DateEditor';
import LookupEditor from './LookupEditor';

// Re-export types
export * from './types';

// Re-export editors for direct import if needed
export { TextEditor, NumberEditor, BooleanEditor, ChoiceEditor, DateEditor, LookupEditor };

/**
 * Editor Registry
 *
 * Maps column_type values to their editor components.
 * Based on GOLD_STANDARD_TABLE.md column types.
 */
export const EditorRegistry: Record<string, CellEditorComponent> = {
  // Text types -> TextEditor
  single_line_text: TextEditor,
  text: TextEditor, // alias
  email: TextEditor,
  phone: TextEditor,
  url: TextEditor,
  abn: TextEditor, // Australian Business Number

  // Multiline text -> TextEditor with multiline prop
  multiple_lines_text: TextEditor,
  long_text: TextEditor, // alias
  rich_text: TextEditor, // simplified - could have dedicated RichTextEditor

  // Number types -> NumberEditor
  number: NumberEditor,
  integer: NumberEditor,
  decimal: NumberEditor,
  currency: NumberEditor,
  percentage: NumberEditor,
  percent: NumberEditor, // alias
  rating: NumberEditor,
  duration: NumberEditor,

  // Boolean -> BooleanEditor
  boolean: BooleanEditor,
  checkbox: BooleanEditor, // alias

  // Choice types -> ChoiceEditor
  choice: ChoiceEditor,
  single_select: ChoiceEditor,
  multiple_select: ChoiceEditor,
  status: ChoiceEditor, // status is a choice with predefined colors
  priority: ChoiceEditor,

  // Date types -> DateEditor
  date: DateEditor,
  datetime: DateEditor,
  created_time: DateEditor,
  modified_time: DateEditor,

  // Lookup types -> LookupEditor
  lookup: LookupEditor,
  relation: LookupEditor,
  linked_record: LookupEditor, // alias
  user: LookupEditor, // user picker is a specialized lookup
  collaborator: LookupEditor, // alias for user

  // Computed types - read-only, no editor (render display only)
  formula: TextEditor, // fallback, will be disabled
  computed: TextEditor,
  rollup: TextEditor,
  count: TextEditor,
  autonumber: TextEditor,

  // Special types - use text editor as fallback
  color: TextEditor, // could have ColorEditor
  barcode: TextEditor,
  attachment: TextEditor, // could have FileEditor
  file: TextEditor,
  image: TextEditor,
};

/**
 * Get the editor component for a column type
 *
 * @param columnType - The column_type from the column definition
 * @returns The editor component, defaults to TextEditor for unknown types
 */
export function getEditor(columnType: string): CellEditorComponent {
  return EditorRegistry[columnType] || TextEditor;
}

/**
 * Check if a column type is editable
 *
 * Some column types are computed/read-only and should not be editable.
 */
export const READ_ONLY_COLUMN_TYPES = new Set([
  'formula',
  'computed',
  'rollup',
  'count',
  'autonumber',
  'created_time',
  'modified_time',
]);

export function isEditableColumnType(columnType: string): boolean {
  return !READ_ONLY_COLUMN_TYPES.has(columnType);
}

/**
 * Get editor props for a specific column type
 *
 * Some editors need additional props based on column type.
 * Returns a record that can include any editor-specific props.
 */
export function getEditorProps(columnType: string): Record<string, unknown> {
  switch (columnType) {
    case 'email':
      return { inputType: 'email' };

    case 'phone':
      return { inputType: 'tel' };

    case 'url':
      return { inputType: 'url' };

    case 'multiple_lines_text':
    case 'long_text':
    case 'rich_text':
      return { multiline: true, rows: 3 };

    case 'currency':
      return { prefix: '$', precision: 2 };

    case 'percentage':
    case 'percent':
      return { suffix: '%', precision: 1 };

    case 'integer':
      return { precision: 0 };

    case 'rating':
      return { min: 1, max: 5, precision: 0 };

    case 'datetime':
    case 'created_time':
    case 'modified_time':
      return { includeTime: true };

    case 'multiple_select':
      return { multiple: true };

    default:
      return {};
  }
}

/**
 * Default export for convenience
 */
export default {
  EditorRegistry,
  getEditor,
  isEditableColumnType,
  getEditorProps,
};
