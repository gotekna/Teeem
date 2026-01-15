/**
 * Z-INDEX HIERARCHY (SSoT)
 * ========================
 *
 * All z-index values in the app should reference this file.
 *
 * IMPORTANT: Radix UI components (Popover, Select, DropdownMenu, Tooltip)
 * use portals that render to document.body. The WRAPPER z-index in globals.css
 * determines their global stacking, not the individual component z-index values.
 *
 * @see globals.css `[data-radix-popper-content-wrapper]` rule
 *
 * HIERARCHY (ascending order):
 * ────────────────────────────
 *
 * LAYER 0: Base content (no z-index)
 *   - Normal page content, tables, forms
 *
 * LAYER 1: Toast notifications (z-100)
 *   - Non-blocking notifications at screen edge
 *
 * LAYER 2: Fullscreen overlays (z-120)
 *   - EntityConfigurationTab fullscreen mode
 *
 * LAYER 3: Side panels (z-130)
 *   - Sheet component (slide-out panels)
 *
 * LAYER 4: External libraries (z-1000)
 *   - Leaflet map controls (EXTERNAL - cannot change)
 *
 * LAYER 5: Modal dialogs (z-1100)
 *   - Dialog component (centered modals)
 *   - Must be above Leaflet
 *
 * LAYER 6: Dropdowns (z-1200)
 *   - ALL Radix popper-based components via globals.css wrapper
 *   - Popover, Select, DropdownMenu, Tooltip, ComboboxDropdown
 *   - Must be above modals so dropdowns inside dialogs work
 *
 * LAYER 7: Debug tools (z-9999)
 *   - Debug toolbar, dev-only overlays
 */

// ============================================
// Z-INDEX VALUES (use these in components)
// ============================================

/** Toast notifications - non-blocking, screen edge */
export const Z_TOAST = 100;

/** Fullscreen overlays - EntityConfigurationTab */
export const Z_FULLSCREEN_OVERLAY = 120;

/** Side panels - Sheet component */
export const Z_SHEET = 130;

/** External: Leaflet map controls (DO NOT CHANGE) */
export const Z_LEAFLET = 1000;

/** Modal dialogs - Dialog component */
export const Z_MODAL = 1100;

/**
 * Dropdowns - Popover, Select, DropdownMenu, Tooltip
 *
 * NOTE: This value is applied via globals.css to [data-radix-popper-content-wrapper]
 * Individual component z-index values are overridden by this.
 */
export const Z_DROPDOWN = 1200;

/** Debug tools - only visible in development */
export const Z_DEBUG = 9999;

// ============================================
// TAILWIND CLASS HELPERS (derived from values)
// ============================================
// These are derived automatically - change the value above,
// the class updates automatically. No manual sync needed.

/** Use in className for toast positioning */
export const Z_TOAST_CLASS = `z-[${Z_TOAST}]` as const;

/** Use in className for fullscreen overlays */
export const Z_FULLSCREEN_CLASS = `z-[${Z_FULLSCREEN_OVERLAY}]` as const;

/** Use in className for side panels */
export const Z_SHEET_CLASS = `z-[${Z_SHEET}]` as const;

/** Use in className for modal dialogs */
export const Z_MODAL_CLASS = `z-[${Z_MODAL}]` as const;

/** Use in className for dropdowns */
export const Z_DROPDOWN_CLASS = `z-[${Z_DROPDOWN}]` as const;

/** Use in className for debug tools */
export const Z_DEBUG_CLASS = `z-[${Z_DEBUG}]` as const;
