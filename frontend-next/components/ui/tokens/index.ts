/**
 * Token Components - SSoT for placeholder/template builders
 *
 * This module provides standardized components for building template strings
 * with placeholder tokens. Used for document naming, file paths, email templates, etc.
 *
 * See: frontend-next/lib/component-registry.ts
 * See: frontend-next/lib/placeholders.ts (placeholder definitions)
 *
 * Components:
 * - TokenBadge: Individual placeholder token display
 * - TokenPalette: Searchable palette of available placeholders
 * - TokenBuilder: Complete template builder with tokens and preview
 *
 * Usage:
 * ```tsx
 * import { TokenBuilder, TokenPalette, TokenBadge } from "@/components/ui/tokens";
 *
 * // Full template builder
 * <TokenBuilder
 *   value="{CompanyCode} - {Description}"
 *   onChange={setValue}
 *   scope="company"
 *   showPreview
 * />
 *
 * // Just the palette (for custom implementations)
 * <TokenPalette
 *   scope="job"
 *   onSelect={(code) => insertAtCursor(code)}
 *   showLongVariants
 * />
 *
 * // Individual token badge
 * <TokenBadge
 *   code="{JobCode}"
 *   color="orange"
 *   removable
 *   onRemove={() => remove()}
 * />
 * ```
 */

// Components
export { TokenBadge, type TokenBadgeProps } from "./TokenBadge";
export { TokenPalette, type TokenPaletteProps } from "./TokenPalette";
export { TokenBuilder, type TokenBuilderProps } from "./TokenBuilder";

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
  SHAREPOINT_PLACEHOLDERS,
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
