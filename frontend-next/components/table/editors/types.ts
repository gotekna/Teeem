/**
 * Cell Editor Type Definitions
 *
 * Shared interfaces for all cell editor components in the registry.
 * Each editor receives the same base props and can add type-specific props.
 */

// ============================================================================
// COLUMN DEFINITION
// ============================================================================

/**
 * Column configuration passed to editors
 * Subset of full Column type with fields needed for editing
 */
export interface EditorColumn {
  id: number | string;
  key: string;
  name: string;
  column_type: string;
  options?: ColumnOptions;
  is_required?: boolean;
  is_readonly?: boolean;
}

/**
 * Column options that affect editor behavior
 */
export interface ColumnOptions {
  // Choice/Select options
  choices?: Array<{ label: string; value: string; color?: string }>;

  // Lookup options
  lookupTableId?: number;
  lookupDisplayField?: string;
  allowMultiple?: boolean;

  // Number options
  precision?: number;
  min?: number;
  max?: number;

  // Currency options
  currencySymbol?: string;
  currencyCode?: string;

  // Date options
  dateFormat?: string;
  includeTime?: boolean;

  // Text options
  maxLength?: number;
  placeholder?: string;

  // File options
  allowedTypes?: string[];
  maxFileSize?: number;

  // Rating options
  maxRating?: number;

  // Any additional options
  [key: string]: unknown;
}

// ============================================================================
// EDITOR PROPS
// ============================================================================

/**
 * Base props passed to all cell editor components
 */
export interface CellEditorProps<T = unknown> {
  /** Current cell value */
  value: T;

  /** Callback when value changes */
  onChange: (value: T) => void;

  /** Column definition */
  column: EditorColumn;

  /** Row ID for context */
  rowId: string | number;

  /** Whether the cell is focused */
  isFocused: boolean;

  /** Whether the cell is currently saving */
  isSaving: boolean;

  /** Validation error message if any */
  error: string | null;

  /** Called when editor loses focus (triggers save) */
  onBlur: () => void;

  /** Called to move focus to next cell (Tab) */
  onFocusNext: () => void;

  /** Called to move focus to previous cell (Shift+Tab) */
  onFocusPrev: () => void;

  /** Called to cancel editing (Escape) */
  onCancel: () => void;

  /** Whether the cell is disabled */
  disabled?: boolean;

  /** Optional className for styling */
  className?: string;

  /** Optional placeholder text */
  placeholder?: string;
}

/**
 * Props for text-based editors (single_line_text, email, phone, url)
 */
export interface TextEditorProps extends CellEditorProps<string> {
  /** Input type (text, email, tel, url) */
  inputType?: 'text' | 'email' | 'tel' | 'url';

  /** Maximum length */
  maxLength?: number;

  /** Whether to use textarea instead of input */
  multiline?: boolean;

  /** Number of rows for textarea */
  rows?: number;

  /** Enable AI spell check (default: false for performance) */
  enableSpellCheck?: boolean;
}

/**
 * Props for number-based editors (number, currency, percentage)
 */
export interface NumberEditorProps extends CellEditorProps<number | null> {
  /** Number of decimal places */
  precision?: number;

  /** Minimum value */
  min?: number;

  /** Maximum value */
  max?: number;

  /** Step value for increment/decrement */
  step?: number;

  /** Currency symbol prefix */
  prefix?: string;

  /** Percentage suffix */
  suffix?: string;
}

/**
 * Props for boolean editor (checkbox/switch)
 */
export interface BooleanEditorProps extends CellEditorProps<boolean> {
  /** Label for the switch */
  label?: string;
}

/**
 * Props for date editors
 */
export interface DateEditorProps extends CellEditorProps<string | Date | null> {
  /** Date format for display */
  dateFormat?: string;

  /** Whether to include time */
  includeTime?: boolean;

  /** Minimum date */
  minDate?: Date;

  /** Maximum date */
  maxDate?: Date;
}

/**
 * Choice option for select editors
 */
export interface ChoiceOption {
  label: string;
  value: string;
  color?: string;
  icon?: string;
}

/**
 * Props for choice/select editors
 */
export interface ChoiceEditorProps extends CellEditorProps<string | string[]> {
  /** Available options */
  options: ChoiceOption[];

  /** Allow multiple selection */
  multiple?: boolean;

  /** Allow creating new options */
  creatable?: boolean;

  /** Callback when new option is created */
  onCreateOption?: (label: string) => void;
}

/**
 * Lookup record for relation editors
 */
export interface LookupRecord {
  id: number | string;
  display_value: string;
  [key: string]: unknown;
}

/**
 * Props for lookup/relation editors
 */
export interface LookupEditorProps extends CellEditorProps<number | number[] | null> {
  /** Related table ID */
  lookupTableId: number;

  /** Field to display */
  displayField: string;

  /** Allow multiple selection */
  multiple?: boolean;

  /** Available records (if pre-loaded) */
  records?: LookupRecord[];

  /** Callback to search records */
  onSearch?: (query: string) => Promise<LookupRecord[]>;
}

/**
 * Props for file/image editors
 */
export interface FileEditorProps extends CellEditorProps<FileValue | FileValue[]> {
  /** Allow multiple files */
  multiple?: boolean;

  /** Accepted file types */
  accept?: string;

  /** Maximum file size in bytes */
  maxSize?: number;

  /** Callback to upload file */
  onUpload: (file: File) => Promise<FileValue>;

  /** Callback to delete file */
  onDelete: (fileId: string) => Promise<void>;
}

/**
 * File value structure
 */
export interface FileValue {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  thumbnailUrl?: string;
}

// ============================================================================
// EDITOR COMPONENT TYPE
// ============================================================================

/**
 * Base cell editor props with any value type (for registry)
 * Uses 'any' intentionally to allow different editor components in the registry
 */
 
export type AnyCellEditorProps = CellEditorProps<any>;

/**
 * Generic cell editor component type
 * Uses 'any' for the registry to allow mixing different value types
 */
 
export type CellEditorComponent = React.ComponentType<any>;

/**
 * Editor registry mapping column types to components
 */
export type EditorRegistryType = Record<string, CellEditorComponent>;

// ============================================================================
// KEYBOARD NAVIGATION
// ============================================================================

/**
 * Cell position for keyboard navigation
 */
export interface CellPosition {
  rowId: string | number;
  columnKey: string;
}

/**
 * Navigation direction
 */
export type NavigationDirection = 'next' | 'prev' | 'up' | 'down';

/**
 * Keyboard navigation hook return type
 */
export interface UseTableKeyboardNavReturn {
  /** Currently focused cell */
  focusedCell: CellPosition | null;

  /** Set focus to a specific cell */
  setFocusedCell: (cell: CellPosition | null) => void;

  /** Navigate in a direction */
  navigate: (direction: NavigationDirection) => void;

  /** Handle keydown event */
  handleKeyDown: (event: React.KeyboardEvent) => void;
}
