/**
 * Placeholder Components - SSoT for placeholder/template builders
 *
 * This module provides standardized components for building template strings
 * with placeholder tokens. Used for document naming, file paths, email templates, etc.
 *
 * See: frontend-next/lib/component-registry.ts
 * See: frontend-next/lib/placeholders.ts (placeholder definitions)
 *
 * Components:
 * - PlaceholderBadge: Individual placeholder token display
 * - PlaceholderPalette: Searchable palette of available placeholders
 * - PlaceholderBuilder: Complete template builder with tokens and preview
 *
 * Usage:
 * ```tsx
 * import { PlaceholderBuilder, PlaceholderPalette, PlaceholderBadge } from "@/components/ui/placeholders";
 *
 * // Full template builder
 * <PlaceholderBuilder
 *   value="{CompanyCode} - {Description}"
 *   onChange={setValue}
 *   scope="company"
 *   showPreview
 * />
 *
 * // Just the palette (for custom implementations)
 * <PlaceholderPalette
 *   scope="job"
 *   onSelect={(code) => insertAtCursor(code)}
 *   showLongVariants
 * />
 *
 * // Individual placeholder badge
 * <PlaceholderBadge
 *   code="{JobCode}"
 *   color="orange"
 *   removable
 *   onRemove={() => remove()}
 * />
 * ```
 */

// Components - NEW names (use these)
export { PlaceholderBadge, type PlaceholderBadgeProps } from "./PlaceholderBadge";
export { PlaceholderPalette, type PlaceholderPaletteProps } from "./PlaceholderPalette";
export { PlaceholderBuilder, type PlaceholderBuilderProps } from "./PlaceholderBuilder";

// Re-export placeholder utilities for convenience
export {
  // Types
  type PlaceholderToken,
  type PlaceholderColor,
  type PlaceholderScope,
  // Placeholder collections
  COMPANY_PLACEHOLDERS,
  DATE_PLACEHOLDERS,
  JOB_PLACEHOLDERS,
  DOCUMENT_PLACEHOLDERS,
  STORAGE_PLACEHOLDERS,
  PLACEHOLDERS_BY_SCOPE,
  // Utility functions
  getPlaceholders,
  getPlaceholderByCode,
  getPlaceholderColor,
  getShortToLongMap,
  getLongToShortMap,
  resolveWithExamples,
  parseTemplate,
  buildTemplate,
  // Color classes
  PLACEHOLDER_COLOR_CLASSES,
} from "@/lib/placeholders";
