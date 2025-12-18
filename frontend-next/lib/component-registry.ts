/**
 * COMPONENT REGISTRY - THE SINGLE SOURCE OF TRUTH
 *
 * This file defines ALL standard UI components for the TEEEM application.
 * Both the app and CLAUDE.md reference this file.
 *
 * Before creating ANY new component:
 * 1. Check this registry first
 * 2. If THE ONE exists, use it. NEVER create duplicates.
 * 3. Visual reference: /admin/system?tab=components → UI Components tab
 *
 * To add a new standard component, tell Claude:
 * "Add [ComponentName] as a standard component"
 */

// =============================================================================
// TYPES
// =============================================================================

export type ComponentCategory =
  | "forms"
  | "display"
  | "feedback"
  | "overlays"
  | "navigation"
  | "layout"
  | "document"
  | "integration"
  | "finance"
  | "dnd"
  | "templates";

export type ComponentTier = 1 | 2 | 3 | 4 | 5;

export type ComponentStatus = "standard" | "deprecated" | "experimental";

export interface BrandGuidelines {
  cornerRadius: string; // e.g., "rounded-none"
  fontSize?: string; // e.g., "text-brand-md"
  spacing?: string; // e.g., "h-9 px-4"
}

export interface StandardComponent {
  id: string;
  name: string;
  displayName: string;
  category: ComponentCategory;
  tier: ComponentTier;
  status: ComponentStatus;
  importPath: string;
  description: string;
  whenToUse: string;
  deprecates?: string[];
  brandGuidelines?: BrandGuidelines;
  usageCount?: number; // Approximate import count
}

export interface DeprecatedComponent {
  id: string;
  name: string;
  importPath: string;
  replacedBy: string;
  reason: string;
  migrationGuide?: string;
}

// =============================================================================
// TIER 1: CORE PRIMITIVES (High Usage)
// =============================================================================

const TIER_1_COMPONENTS: StandardComponent[] = [
  {
    id: "button",
    name: "Button",
    displayName: "Button",
    category: "forms",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/button",
    description: "Primary action button with multiple variants",
    whenToUse: "Any clickable action - submit, cancel, navigation, etc.",
    usageCount: 266,
    brandGuidelines: {
      cornerRadius: "rounded-none",
      fontSize: "text-brand-md",
      spacing: "h-9 px-4",
    },
  },
  {
    id: "card",
    name: "Card",
    displayName: "Card",
    category: "layout",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/card",
    description: "Container with border and padding for grouping content",
    whenToUse: "Group related content, create visual sections",
    usageCount: 192,
    brandGuidelines: {
      cornerRadius: "rounded-none",
      spacing: "p-6",
    },
  },
  {
    id: "badge",
    name: "Badge",
    displayName: "Badge",
    category: "display",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/badge",
    description: "Small status indicator or label",
    whenToUse: "Status indicators, counts, tags, labels",
    usageCount: 179,
    brandGuidelines: {
      cornerRadius: "rounded-none",
      fontSize: "text-brand-base",
    },
  },
  {
    id: "input",
    name: "Input",
    displayName: "Input",
    category: "forms",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/input",
    description: "Single-line text input field",
    whenToUse: "Text entry, search, single-line user input",
    usageCount: 141,
    brandGuidelines: {
      cornerRadius: "rounded-none",
      fontSize: "text-brand-md",
    },
  },
  {
    id: "label",
    name: "Label",
    displayName: "Label",
    category: "forms",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/label",
    description: "Form field label with accessibility support",
    whenToUse: "Label any form input for accessibility",
    usageCount: 103,
  },
  {
    id: "select",
    name: "Select",
    displayName: "Simple Dropdown",
    category: "forms",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/select",
    description: "Simple dropdown with static options",
    whenToUse: "Simple dropdown with known, limited options (< 10 items)",
    usageCount: 77,
    brandGuidelines: {
      cornerRadius: "rounded-none",
    },
  },
  {
    id: "dialog",
    name: "Dialog",
    displayName: "Modal Dialog",
    category: "overlays",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/dialog",
    description: "Modal dialog for focused interactions",
    whenToUse: "Confirmations, forms that need focus, important actions",
    usageCount: 69,
    brandGuidelines: {
      cornerRadius: "rounded-none",
    },
  },
  {
    id: "tabs",
    name: "Tabs",
    displayName: "Tabs",
    category: "navigation",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/tabs",
    description: "Tabbed navigation for switching views",
    whenToUse: "Switch between related views without page navigation",
    usageCount: 56,
  },
  {
    id: "table",
    name: "Table",
    displayName: "Table Primitives",
    category: "display",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/table",
    description: "Base table primitives (Table, TableRow, TableCell, etc.)",
    whenToUse: "Custom tables, underlying primitives. For data tables use TeeemTableView.",
    usageCount: 53,
  },
  {
    id: "spinner",
    name: "Spinner",
    displayName: "Loading Spinner",
    category: "feedback",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/spinner",
    description: "Loading indicator spinner",
    whenToUse: "Show loading state for any async operation",
    deprecates: ["loader"],
    usageCount: 51,
  },
];

// =============================================================================
// TIER 2: FORM CONTROLS
// =============================================================================

const TIER_2_COMPONENTS: StandardComponent[] = [
  {
    id: "textarea",
    name: "Textarea",
    displayName: "Textarea",
    category: "forms",
    tier: 2,
    status: "standard",
    importPath: "@/components/ui/textarea",
    description: "Multi-line text input",
    whenToUse: "Multi-line text entry, descriptions, notes",
    usageCount: 43,
    brandGuidelines: {
      cornerRadius: "rounded-none",
    },
  },
  {
    id: "checkbox",
    name: "Checkbox",
    displayName: "Checkbox",
    category: "forms",
    tier: 2,
    status: "standard",
    importPath: "@/components/ui/checkbox",
    description: "Boolean checkbox input",
    whenToUse: "Toggle options, multi-select lists, agree/consent",
    usageCount: 42,
  },
  {
    id: "switch",
    name: "Switch",
    displayName: "Switch",
    category: "forms",
    tier: 2,
    status: "standard",
    importPath: "@/components/ui/switch",
    description: "Toggle switch for on/off states",
    whenToUse: "Settings toggles, enable/disable features",
    usageCount: 22,
  },
  {
    id: "combobox-dropdown",
    name: "ComboboxDropdown",
    displayName: "Searchable Select",
    category: "forms",
    tier: 2,
    status: "standard",
    importPath: "@/components/ui/combobox-dropdown",
    description: "Dropdown with search/filter capability",
    whenToUse: "When you need searchable options or > 10 items",
    deprecates: ["combobox"],
    usageCount: 15,
    brandGuidelines: {
      cornerRadius: "rounded-none",
    },
  },
  {
    id: "multiple-selector",
    name: "MultipleSelector",
    displayName: "Multi-Select",
    category: "forms",
    tier: 2,
    status: "standard",
    importPath: "@/components/ui/multiple-selector",
    description: "Select multiple items with tags",
    whenToUse: "Multiple selection from a list",
    usageCount: 5,
  },
];

// =============================================================================
// TIER 3: OVERLAYS & LAYOUT
// =============================================================================

const TIER_3_COMPONENTS: StandardComponent[] = [
  {
    id: "popover",
    name: "Popover",
    displayName: "Popover",
    category: "overlays",
    tier: 3,
    status: "standard",
    importPath: "@/components/ui/popover",
    description: "Small floating overlay anchored to trigger",
    whenToUse: "Small contextual content, mini forms, quick actions",
    usageCount: 21,
  },
  {
    id: "progress",
    name: "Progress",
    displayName: "Progress Bar",
    category: "feedback",
    tier: 3,
    status: "standard",
    importPath: "@/components/ui/progress",
    description: "Progress bar indicator",
    whenToUse: "Show progress of operations, uploads, completions",
    usageCount: 18,
  },
  {
    id: "teeem-table-view",
    name: "TeeemTableView",
    displayName: "Data Table",
    category: "display",
    tier: 3,
    status: "standard",
    importPath: "@/components/table/TeeemTableView",
    description: "Full-featured data table with sorting, filtering, pagination",
    whenToUse: "ANY data table in the app. No exceptions.",
    usageCount: 17,
  },
  {
    id: "sheet",
    name: "Sheet",
    displayName: "Side Panel",
    category: "overlays",
    tier: 3,
    status: "standard",
    importPath: "@/components/ui/sheet",
    description: "Side panel that slides in from edge",
    whenToUse: "Detail views, settings panels, secondary content",
    deprecates: ["drawer"],
    usageCount: 11,
  },
  {
    id: "accordion",
    name: "Accordion",
    displayName: "Accordion",
    category: "layout",
    tier: 3,
    status: "standard",
    importPath: "@/components/ui/accordion",
    description: "Expandable/collapsible content sections",
    whenToUse: "FAQs, grouped settings, expandable lists",
    deprecates: ["collapsible"],
    usageCount: 10,
  },
  {
    id: "tooltip",
    name: "Tooltip",
    displayName: "Tooltip",
    category: "overlays",
    tier: 3,
    status: "standard",
    importPath: "@/components/ui/tooltip",
    description: "Hover tooltip for additional info",
    whenToUse: "Explain icons, show full text, provide hints",
    usageCount: 6,
  },
];

// =============================================================================
// TIER 4: SPECIALIZED COMPONENTS (Domain-Specific)
// =============================================================================

const TIER_4_COMPONENTS: StandardComponent[] = [
  {
    id: "pdf-viewer",
    name: "PDFViewer",
    displayName: "PDF Viewer",
    category: "document",
    tier: 4,
    status: "standard",
    importPath: "@/components/ui/pdf-viewer",
    description: "PDF document viewer with zoom, pagination, field highlights",
    whenToUse: "View PDF documents, invoices, contracts",
    usageCount: 5,
  },
  {
    id: "pdf-editor",
    name: "PDFEditor",
    displayName: "PDF Editor",
    category: "document",
    tier: 4,
    status: "standard",
    importPath: "@/components/ui/pdf-editor",
    description: "PDF editor with annotations, drawing, page management",
    whenToUse: "Edit PDF documents, add annotations",
    usageCount: 1,
  },
  {
    id: "sharepoint-folder-browser",
    name: "SharePointFolderBrowser",
    displayName: "SharePoint Browser",
    category: "integration",
    tier: 4,
    status: "standard",
    importPath: "@/components/ui/sharepoint-folder-browser",
    description: "Tree view browser for SharePoint/OneDrive folders",
    whenToUse: "Browse and select SharePoint folders",
    usageCount: 7,
  },
  {
    id: "sharepoint-path-configurator",
    name: "SharePointPathConfigurator",
    displayName: "SharePoint Path Config",
    category: "integration",
    tier: 4,
    status: "standard",
    importPath: "@/components/ui/sharepoint-path-configurator",
    description: "Configure SharePoint path templates with placeholders",
    whenToUse: "Set up SharePoint folder paths with {{placeholders}}",
    usageCount: 7,
  },
  {
    id: "bills-invoice-viewer",
    name: "BillsInvoiceViewer",
    displayName: "Invoice Viewer",
    category: "finance",
    tier: 4,
    status: "standard",
    importPath: "@/components/invoice/BillsInvoiceViewer",
    description: "Invoice viewer with PDF, extraction data, approval actions",
    whenToUse: "View and process invoices/bills",
    usageCount: 3,
  },
  {
    id: "document-preview-modal",
    name: "DocumentPreviewModal",
    displayName: "Document Preview",
    category: "document",
    tier: 4,
    status: "standard",
    importPath: "@/components/corporate/DocumentPreviewModal",
    description: "Full document preview modal with PDF viewer and metadata",
    whenToUse: "Preview documents with full context",
    usageCount: 1,
  },
];

// =============================================================================
// TIER 5: PATTERN COMPONENTS (Reusable Patterns)
// =============================================================================

const TIER_5_COMPONENTS: StandardComponent[] = [
  // DnD Pattern Components
  {
    id: "drag-handle",
    name: "DragHandle",
    displayName: "Drag Handle",
    category: "dnd",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/dnd",
    description: "6-dot grip icon for drag-and-drop reordering",
    whenToUse: "Any sortable/reorderable list item",
  },
  {
    id: "sortable-list",
    name: "SortableList",
    displayName: "Sortable List",
    category: "dnd",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/dnd",
    description: "DnD wrapper with standard sensors and collision detection",
    whenToUse: "Wrap items that need drag-and-drop reordering",
  },
  {
    id: "sortable-item",
    name: "SortableItem",
    displayName: "Sortable Item",
    category: "dnd",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/dnd",
    description: "Base sortable item with handle, position, and actions",
    whenToUse: "Individual item in a sortable list",
  },
  {
    id: "position-badge",
    name: "PositionBadge",
    displayName: "Position Badge",
    category: "dnd",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/dnd",
    description: "Editable/read-only position number badge",
    whenToUse: "Show and optionally edit item position in sorted list",
  },
  // Token Pattern Components
  {
    id: "token-builder",
    name: "TokenBuilder",
    displayName: "Token Builder",
    category: "templates",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/tokens",
    description: "Draggable placeholder tokens with SHORT/LONG variants and preview",
    whenToUse: "Build template strings with placeholders (file names, display names)",
  },
  {
    id: "token-palette",
    name: "TokenPalette",
    displayName: "Token Palette",
    category: "templates",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/tokens",
    description: "Searchable palette of available placeholder tokens",
    whenToUse: "Show available placeholders for token builder",
  },
  {
    id: "token-badge",
    name: "TokenBadge",
    displayName: "Token Badge",
    category: "templates",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/tokens",
    description: "Individual draggable token badge with remove button",
    whenToUse: "Represent a single placeholder in token builder",
  },
];

// =============================================================================
// DEPRECATED COMPONENTS
// =============================================================================

export const DEPRECATED_COMPONENTS: DeprecatedComponent[] = [
  {
    id: "combobox",
    name: "Combobox",
    importPath: "@/components/ui/combobox",
    replacedBy: "combobox-dropdown",
    reason: "ComboboxDropdown has more features and better UX",
    migrationGuide:
      "Change import to combobox-dropdown. Rename `options` prop items to use `id`/`label` instead of `id`/`name`.",
  },
  {
    id: "loader",
    name: "Loader",
    importPath: "@/components/ui/loader",
    replacedBy: "spinner",
    reason: "Spinner is the standard loading indicator",
    migrationGuide: "Replace <Loader /> with <Spinner />",
  },
  {
    id: "drawer",
    name: "Drawer",
    importPath: "@/components/ui/drawer",
    replacedBy: "sheet",
    reason: "Sheet is the standard side panel component",
    migrationGuide: "Replace Drawer with Sheet component",
  },
  {
    id: "collapsible",
    name: "Collapsible",
    importPath: "@/components/ui/collapsible",
    replacedBy: "accordion",
    reason: "Accordion provides more features and consistent UX",
    migrationGuide:
      "Replace <Collapsible> with <Accordion type='single' collapsible>. See collapsible.tsx for full guide.",
  },
  {
    id: "data-table",
    name: "DataTable",
    importPath: "@/components/ui/data-table",
    replacedBy: "teeem-table-view",
    reason: "TeeemTableView is the standard data table for all tables",
    migrationGuide: "Replace DataTable with TeeemTableView component",
  },
];

// =============================================================================
// COMBINED EXPORTS
// =============================================================================

export const STANDARD_COMPONENTS: StandardComponent[] = [
  ...TIER_1_COMPONENTS,
  ...TIER_2_COMPONENTS,
  ...TIER_3_COMPONENTS,
  ...TIER_4_COMPONENTS,
  ...TIER_5_COMPONENTS,
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get a standard component by ID
 */
export function getStandardComponent(id: string): StandardComponent | undefined {
  return STANDARD_COMPONENTS.find((c) => c.id === id);
}

/**
 * Get a deprecated component by ID
 */
export function getDeprecatedComponent(id: string): DeprecatedComponent | undefined {
  return DEPRECATED_COMPONENTS.find((c) => c.id === id);
}

/**
 * Check if an import path is deprecated
 */
export function isDeprecatedImport(importPath: string): DeprecatedComponent | undefined {
  return DEPRECATED_COMPONENTS.find((c) => importPath.includes(c.importPath));
}

/**
 * Get the replacement component for a deprecated one
 */
export function getReplacementFor(deprecatedId: string): StandardComponent | undefined {
  const deprecated = getDeprecatedComponent(deprecatedId);
  if (!deprecated) return undefined;
  return getStandardComponent(deprecated.replacedBy);
}

/**
 * Get all components by category
 */
export function getComponentsByCategory(category: ComponentCategory): StandardComponent[] {
  return STANDARD_COMPONENTS.filter((c) => c.category === category);
}

/**
 * Get all components by tier
 */
export function getComponentsByTier(tier: ComponentTier): StandardComponent[] {
  return STANDARD_COMPONENTS.filter((c) => c.tier === tier);
}

/**
 * Get component count by tier
 */
export function getComponentCountByTier(): Record<ComponentTier, number> {
  return {
    1: TIER_1_COMPONENTS.length,
    2: TIER_2_COMPONENTS.length,
    3: TIER_3_COMPONENTS.length,
    4: TIER_4_COMPONENTS.length,
    5: TIER_5_COMPONENTS.length,
  };
}

/**
 * Get total component count
 */
export function getTotalComponentCount(): number {
  return STANDARD_COMPONENTS.length;
}

// =============================================================================
// TYPE EXPORTS FOR EXTERNAL USE
// =============================================================================

export type StandardComponentId = (typeof STANDARD_COMPONENTS)[number]["id"];
export type DeprecatedComponentId = (typeof DEPRECATED_COMPONENTS)[number]["id"];
