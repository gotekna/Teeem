/**
 * Column Type Registry - SSoT Consumer
 *
 * This module fetches column type definitions from the backend API and caches them.
 * The backend ColumnTypeDefinition table is the SINGLE SOURCE OF TRUTH.
 *
 * Usage:
 *   import { getTypeDefinition, loadTypeDefinitions } from '@/lib/column-type-registry';
 *
 *   // On app load (in AuthContext or root layout)
 *   await loadTypeDefinitions();
 *
 *   // When rendering a cell
 *   const typeDef = getTypeDefinition('currency');
 *   // Use typeDef.display_formatter, typeDef.validation_regex, etc.
 */

import { api } from './api';
import {
  FileText,
  Hash,
  Mail,
  Phone,
  Smartphone,
  Calendar,
  Clock,
  CheckCircle,
  DollarSign,
  Link,
  AlignLeft,
  User,
  Calculator,
  Layers,
  ArrowRightLeft,
  Wrench,
  Braces,
  List,
  Search,
  Building2,
  Landmark,
  CreditCard,
  MapPin,
  FileDigit,
  Palette,
  Paperclip,
  type LucideIcon,
} from "lucide-react";

export interface ColumnTypeDefinition {
  id: number;
  type_key: string;
  display_name: string;
  category: string;
  sql_type: string;
  rails_type: string | null;

  // Validation
  validation_regex: string | null;
  validation_message: string | null;
  default_max_length: number | null;
  default_min_length: number | null;
  default_min_value: number | null;
  default_max_value: number | null;

  // Display - These are what the generic formatters use
  display_formatter: string;  // Key for formatter lookup (e.g., "currency", "australian_spaced")
  display_format: string | null;  // Format pattern (e.g., "XX XXX XXX XXX", "$#,##0.00")
  link_template: string | null;  // URL template with {value} placeholder
  input_mask: string | null;  // Input mask pattern
  locale: string;  // Locale for formatting (default: "en-AU")

  // Meta
  icon: string | null;
  emoji: string | null;
  example_values: string | null;
  used_for: string | null;
  needs_config: boolean;
  is_active: boolean;
  version: number;

  // Stats (from API)
  column_count: number;
  compliance_percentage: number;
}

interface TypeDefinitionsResponse {
  success: boolean;
  data: ColumnTypeDefinition[];
  meta: {
    total: number;
    categories: string[];
  };
}

// In-memory cache of type definitions
let typeDefinitions: Map<string, ColumnTypeDefinition> = new Map();
let categories: string[] = [];
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Load type definitions from the backend API.
 * Call this once on app initialization (e.g., in AuthContext).
 * Safe to call multiple times - will only fetch once.
 */
export async function loadTypeDefinitions(): Promise<void> {
  // Already loaded
  if (isLoaded) {
    return;
  }

  // Loading in progress - wait for it
  if (loadPromise) {
    return loadPromise;
  }

  // Start loading
  loadPromise = (async () => {
    try {
      const response = await api.get<TypeDefinitionsResponse>('/api/v1/column_type_definitions');

      if (response.success && response.data) {
        typeDefinitions = new Map(
          response.data.map((def: ColumnTypeDefinition) => [def.type_key, def])
        );
        categories = response.meta?.categories || [];
        isLoaded = true;
        console.log(`[ColumnTypeRegistry] Loaded ${typeDefinitions.size} type definitions`);
      } else {
        console.error('[ColumnTypeRegistry] Failed to load type definitions:', response);
      }
    } catch (error) {
      console.error('[ColumnTypeRegistry] Error loading type definitions:', error);
      // Don't throw - app should still work with fallbacks
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * Get a type definition by type_key.
 * Returns undefined if not found or not loaded yet.
 */
export function getTypeDefinition(typeKey: string): ColumnTypeDefinition | undefined {
  return typeDefinitions.get(typeKey);
}

/**
 * Get all type definitions as an array.
 */
export function getAllTypeDefinitions(): ColumnTypeDefinition[] {
  return Array.from(typeDefinitions.values());
}

/**
 * Get type definitions by category.
 */
export function getTypeDefinitionsByCategory(category: string): ColumnTypeDefinition[] {
  return Array.from(typeDefinitions.values()).filter(def => def.category === category);
}

/**
 * Get all categories.
 */
export function getCategories(): string[] {
  return categories;
}

/**
 * Check if type definitions have been loaded.
 */
export function isTypeDefinitionsLoaded(): boolean {
  return isLoaded;
}

/**
 * Force reload of type definitions.
 * Use when admin updates a type definition.
 */
export async function reloadTypeDefinitions(): Promise<void> {
  isLoaded = false;
  loadPromise = null;
  typeDefinitions.clear();
  categories = [];
  return loadTypeDefinitions();
}

/**
 * Get the display formatter key for a column type.
 * Falls back to 'text' if not found.
 */
export function getDisplayFormatter(typeKey: string): string {
  return getTypeDefinition(typeKey)?.display_formatter || 'text';
}

/**
 * Get the validation regex for a column type.
 * Returns null if no validation required.
 */
export function getValidationRegex(typeKey: string): RegExp | null {
  const pattern = getTypeDefinition(typeKey)?.validation_regex;
  if (!pattern) return null;

  try {
    return new RegExp(pattern);
  } catch {
    console.error(`[ColumnTypeRegistry] Invalid regex for ${typeKey}: ${pattern}`);
    return null;
  }
}

/**
 * Get the validation error message for a column type.
 */
export function getValidationMessage(typeKey: string): string | null {
  return getTypeDefinition(typeKey)?.validation_message || null;
}

/**
 * Get the link template for a column type.
 * Returns null if the type doesn't have clickable links.
 */
export function getLinkTemplate(typeKey: string): string | null {
  return getTypeDefinition(typeKey)?.link_template || null;
}

/**
 * Generate a link URL from a template and value.
 * Example: "mailto:{value}" + "test@example.com" = "mailto:test@example.com"
 */
export function generateLink(typeKey: string, value: string): string | null {
  const template = getLinkTemplate(typeKey);
  if (!template || !value) return null;

  return template.replace('{value}', encodeURIComponent(value));
}

/**
 * Get the display format pattern for a column type.
 * Used by formatters to apply spacing/formatting.
 */
export function getDisplayFormat(typeKey: string): string | null {
  return getTypeDefinition(typeKey)?.display_format || null;
}

/**
 * Get the input mask for a column type.
 * Used by input fields for guided entry.
 */
export function getInputMask(typeKey: string): string | null {
  return getTypeDefinition(typeKey)?.input_mask || null;
}

/**
 * Get the locale for a column type (default: en-AU).
 */
export function getLocale(typeKey: string): string {
  return getTypeDefinition(typeKey)?.locale || 'en-AU';
}

// ============================================================================
// ICON AND EMOJI HELPERS
// These provide backward compatibility with the old lib/column-types.ts
// ============================================================================

/**
 * Map icon names (from database) to Lucide components.
 * The database stores icon names as strings like "Building2".
 */
const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  Hash,
  Mail,
  Phone,
  Smartphone,
  Calendar,
  Clock,
  CheckCircle,
  DollarSign,
  Link,
  AlignLeft,
  User,
  Calculator,
  Layers,
  ArrowRightLeft,
  Wrench,
  Braces,
  List,
  Search,
  Building2,
  Landmark,
  CreditCard,
  MapPin,
  FileDigit,
  Palette,
  Paperclip,
};

/**
 * Fallback emojis for types that don't have emoji set in the database.
 */
const EMOJI_FALLBACK: Record<string, string> = {
  single_line_text: "📝",
  multiple_lines_text: "📄",
  email: "📧",
  phone: "📞",
  mobile: "📱",
  url: "🔗",
  number: "#️⃣",
  whole_number: "🔢",
  currency: "💵",
  percentage: "%",
  date: "📅",
  date_and_time: "🕐",
  gps_coordinates: "📍",
  color_picker: "🎨",
  file_upload: "📎",
  action_buttons: "⚡",
  boolean: "☑️",
  choice: "📋",
  lookup: "🔗",
  multiple_lookups: "🔗",
  user: "👤",
  computed: "🧮",
  structured_data: "🗂️",
  array_of_items: "📚",
  searchable_text: "🔍",
  abn: "🏢",
  acn: "🏛️",
  bsb: "🏦",
  bank_account: "💳",
  postcode: "📮",
  tfn: "📋",
};

/**
 * Get the display label for a column type.
 * Falls back to the type key if not found.
 */
export function getColumnTypeLabel(typeKey: string): string {
  return getTypeDefinition(typeKey)?.display_name || typeKey;
}

/**
 * Get the SQL type for a column type.
 * Falls back to VARCHAR(255) if not found.
 */
export function getColumnTypeSqlType(typeKey: string): string {
  return getTypeDefinition(typeKey)?.sql_type || 'VARCHAR(255)';
}

/**
 * Get the validation rules description for a column type.
 * Returns the validation message or empty string.
 */
export function getColumnTypeValidationRules(typeKey: string): string {
  return getTypeDefinition(typeKey)?.validation_message || '';
}

/**
 * Get the Lucide icon component for a column type.
 * Falls back to FileText if not found.
 */
export function getColumnTypeIcon(typeKey: string): LucideIcon {
  const iconName = getTypeDefinition(typeKey)?.icon;
  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName];
  }
  return FileText;
}

/**
 * Get the emoji for a column type.
 * Uses fallback mapping if not set in database.
 */
export function getColumnTypeEmoji(typeKey: string): string {
  const emoji = getTypeDefinition(typeKey)?.emoji;
  if (emoji) return emoji;
  return EMOJI_FALLBACK[typeKey] || "📝";
}

/**
 * Get the "used for" description for a column type.
 */
export function getColumnTypeUsedFor(typeKey: string): string {
  return getTypeDefinition(typeKey)?.used_for || '';
}

/**
 * Get all column types as an array with label and icon.
 * This replaces the old COLUMN_TYPES array export.
 */
export function getColumnTypes(): Array<{
  value: string;
  label: string;
  icon: LucideIcon;
  category: string;
  description: string;
  sqlType: string;
  validationRules: string;
  example: string;
  usedFor: string;
  needsConfig?: boolean;
}> {
  return getAllTypeDefinitions().map(def => ({
    value: def.type_key,
    label: def.display_name,
    icon: getColumnTypeIcon(def.type_key),
    category: def.category,
    description: def.used_for || '',
    sqlType: def.sql_type,
    validationRules: def.validation_message || '',
    example: def.example_values || '',
    usedFor: def.used_for || '',
    needsConfig: def.needs_config,
  }));
}

// Re-export for backward compatibility
export { type LucideIcon };
