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
  | "templates"
  | "hooks";

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
// 🔴 STATE ARCHITECTURE PATTERNS - READ BEFORE ADDING STATE
// =============================================================================
//
// SSoT: lib/table-atoms.ts and lib/view-state-atoms.ts
//
// BEFORE adding useState or new atoms, check if a pattern exists:
//
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MODALS - Use TableModalType Registry (NOT individual boolean atoms)        │
// ├─────────────────────────────────────────────────────────────────────────────┤
// │ SSoT: activeTableModalAtom (only ONE modal open at a time)                 │
// │                                                                             │
// │ ❌ WRONG: const [showMyModal, setShowMyModal] = useState(false)            │
// │ ❌ WRONG: export const showMyModalAtom = atom<boolean>(false)              │
// │                                                                             │
// │ ✅ RIGHT: Use existing TableModalType or extend it:                        │
// │           setActiveModal({ modal: 'myNewModal', data: {...} })             │
// │                                                                             │
// │ Types: 'addRecord' | 'editRecord' | 'viewRecord' | 'deleteConfirm'         │
// │        'bulkUpdate' | 'merge' | 'emailContacts' | 'saveView'               │
// │        'createColumn' | 'editColumns' | 'export' | etc.                    │
// └─────────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ FILTER UI - Use FilterUIMode (NOT separate booleans)                       │
// ├─────────────────────────────────────────────────────────────────────────────┤
// │ SSoT: filterUIModeAtom: 'none' | 'inline' | 'panel'                        │
// │                                                                             │
// │ ❌ WRONG: Both filterPanelOpen AND showColumnFilters can be true           │
// │ ✅ RIGHT: They're mutually exclusive (derived from filterUIModeAtom)       │
// │                                                                             │
// │ The boolean atoms (filterPanelOpenAtom, showColumnFiltersAtom) are         │
// │ DERIVED from filterUIModeAtom for backward compatibility.                  │
// └─────────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ COLUMN CONFIG - Use Atomic Updates (NOT individual atom sets)              │
// ├─────────────────────────────────────────────────────────────────────────────┤
// │ SSoT: updateColumnConfigAtom (updates all column state atomically)         │
// │                                                                             │
// │ ❌ WRONG: Set columnWidths, columnOrder, visibleColumns separately         │
// │ ✅ RIGHT: setColumnConfig({ widths, order, visible, sort })                │
// │                                                                             │
// │ This prevents state desync when one update fails but others succeed.       │
// └─────────────────────────────────────────────────────────────────────────────┘
//
// =============================================================================

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
    id: "pill",
    name: "Pill",
    displayName: "Pill / Tag",
    category: "display",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/pill",
    description: "Compact status indicator with variants and optional remove button",
    whenToUse: "Status indicators, tags, labels with semantic colors, dismissible tags",
    usageCount: 2,
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
    id: "back-button",
    name: "BackButton",
    displayName: "Back Button",
    category: "navigation",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/back-button",
    description: "Smart back navigation with fallback to parent route",
    whenToUse: "All pages except top-level dashboards. Use fallbackHref for predictable navigation.",
    usageCount: 0,
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
  {
    id: "skeleton",
    name: "Skeleton",
    displayName: "Skeleton Loader",
    category: "feedback",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/skeleton",
    description: "Animated placeholder for loading content",
    whenToUse: "Show placeholder shapes while content is loading (tables, cards, text blocks)",
    usageCount: 7,
  },
  {
    id: "submit-button",
    name: "SubmitButton",
    displayName: "Submit Button",
    category: "forms",
    tier: 1,
    status: "standard",
    importPath: "@/components/ui/submit-button",
    description: "Form submit button with built-in loading state using Spinner",
    whenToUse: "Form submit actions that need automatic loading indicator",
    usageCount: 61,
  },
  // URL State Hooks
  {
    id: "use-url-tabs",
    name: "useUrlTabs",
    displayName: "URL Tabs Hook",
    category: "hooks",
    tier: 1,
    status: "standard",
    importPath: "@/hooks/useUrlTabs",
    description: "Simple hook for syncing tab state to URL params. Browser back/forward works.",
    whenToUse: "ANY tab state that should survive page refresh and support browser navigation.",
    usageCount: 12,
  },
  {
    id: "use-url-state",
    name: "useUrlState",
    displayName: "URL State Hook",
    category: "hooks",
    tier: 1,
    status: "standard",
    importPath: "@/hooks/useUrlState",
    description: "Complex hook for syncing multiple state values to URL params. Supports strings, arrays, nullable values.",
    whenToUse: "Multiple navigation state values (expanded items, edit mode, active IDs) that should persist in URL.",
    usageCount: 1,
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
  {
    id: "supplier-picker",
    name: "SupplierPicker",
    displayName: "Supplier Picker",
    category: "forms",
    tier: 2,
    status: "standard",
    importPath: "@/components/ui/supplier-picker",
    description: "Searchable supplier selector with server-side search",
    whenToUse: "Select a supplier from the contacts list",
    usageCount: 0,
  },
  {
    id: "pricebook-code-picker",
    name: "PricebookCodePicker",
    displayName: "Pricebook Code Picker",
    category: "forms",
    tier: 2,
    status: "standard",
    importPath: "@/components/ui/pricebook-code-picker",
    description: "Searchable pricebook item/code selector with price display",
    whenToUse: "Select a pricebook item code to pick a price",
    usageCount: 0,
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
    id: "view-table-view",
    name: "ViewTableView",
    displayName: "View Table",
    category: "display",
    tier: 3,
    status: "standard",
    importPath: "@/components/table/ViewTableView",
    description: "View-only table with TeeemTableView styling. Supports sorting, filtering, search. No Foundation required.",
    whenToUse: "Read-only tables, external API data, tables without Foundation backing.",
    usageCount: 0,
  },
  {
    id: "simple-table-view",
    name: "SimpleTableView",
    displayName: "Simple Table",
    category: "display",
    tier: 3,
    status: "standard",
    importPath: "@/components/table/SimpleTableView",
    description: "Lightweight read-only table with virtualization. ~400 lines vs TeeemTableView's 2500 lines.",
    whenToUse: "Simple data display without Foundation, sorting, or filtering. Lightweight alternative to ViewTableView.",
    usageCount: 2,
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
  },
  {
    id: "excel-viewer",
    name: "ExcelViewer",
    displayName: "Excel Viewer",
    category: "document",
    tier: 4,
    status: "standard",
    importPath: "@/components/ui/excel-viewer",
    description: "Spreadsheet viewer with tabs, search, CSV export. No Office 365 dependency.",
    whenToUse: "View Excel files (.xlsx, .xls) inline without external dependencies",
    usageCount: 1,
  },
  {
    id: "word-viewer",
    name: "WordViewer",
    displayName: "Word Viewer",
    category: "document",
    tier: 4,
    status: "standard",
    importPath: "@/components/ui/word-viewer",
    description: "Word document viewer with copy, print, export. No Office 365 dependency.",
    whenToUse: "View Word files (.docx, .doc) inline without external dependencies",
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
  {
    id: "teeem-document-view",
    name: "TeeemDocumentView",
    displayName: "Document Viewer",
    category: "document",
    tier: 4,
    status: "standard",
    importPath: "@/components/ui/teeem-document-view",
    description: "Split-view document viewer with 30% list / 70% preview layout. Supports selection, rename, approve, bulk actions.",
    whenToUse: "Document lists with preview (Job Plans, Corporate Documents, any PDF list)",
    usageCount: 1,
  },
  {
    id: "photo-gallery",
    name: "PhotoGallery",
    displayName: "Photo Gallery",
    category: "document",
    tier: 4,
    status: "standard",
    importPath: "@/components/ui/photo-gallery",
    description: "Grid view for displaying photo thumbnails with lazy loading, date grouping",
    whenToUse: "Display photos in a grid layout, job photos, site photos",
    usageCount: 1,
  },
  {
    id: "image-lightbox",
    name: "ImageLightbox",
    displayName: "Image Lightbox",
    category: "document",
    tier: 4,
    status: "standard",
    importPath: "@/components/ui/image-lightbox",
    description: "Fullscreen image viewer with navigation, keyboard shortcuts, touch gestures",
    whenToUse: "View photos fullscreen with prev/next navigation",
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
    id: "item-badge",
    name: "ItemBadge",
    displayName: "Item Badge",
    category: "dnd",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/dnd",
    description: "Flexible badge for sortable items - supports position, label, icon, or custom content",
    whenToUse: "Show position, label, icon, or custom content in sortable item",
    deprecates: ["position-badge"],
  },
  {
    id: "setup-table",
    name: "SetupTable",
    displayName: "Setup Table",
    category: "dnd",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/setup-table",
    description: "Editable config list with drag-and-drop reordering, add/edit/delete actions",
    whenToUse: "Configuration lists (Job Types, Categories, Statuses, etc.)",
    usageCount: 0,
  },
  {
    id: "kanban-board",
    name: "KanbanBoard",
    displayName: "Kanban Board",
    category: "dnd",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/kanban",
    description: "Full-featured Kanban board with columns, drag-drop cards, optional swimlanes and WIP limits",
    whenToUse: "Task boards, workflow visualization, status-based card layouts",
  },
  {
    id: "kanban-column",
    name: "KanbanColumn",
    displayName: "Kanban Column",
    category: "dnd",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/kanban",
    description: "Column drop zone with header, count badge, WIP indicator",
    whenToUse: "Individual column in a Kanban board",
  },
  {
    id: "kanban-card",
    name: "KanbanCard",
    displayName: "Kanban Card",
    category: "dnd",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/kanban",
    description: "Draggable card wrapper for Kanban boards",
    whenToUse: "Cards in a Kanban column",
  },
  {
    id: "gantt-chart",
    name: "GanttChart",
    displayName: "Gantt Chart",
    category: "display",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/gantt",
    description: "Timeline-based Gantt chart with drag-resize tasks and dependencies",
    whenToUse: "Project scheduling, timeline visualization, task dependencies",
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
  // Layout Container Components (Plans tab gold standard pattern)
  {
    id: "split-view-container",
    name: "SplitViewContainer",
    displayName: "Split View Container",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/layout-containers",
    description: "Container for 30/70 split view layout with absolute positioning",
    whenToUse: "Document viewers, list+preview layouts (based on Plans tab pattern)",
  },
  {
    id: "split-left-header",
    name: "SplitLeftHeader",
    displayName: "Split Left Header",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/layout-containers",
    description: "Header for left panel (30% width) in split view",
    whenToUse: "Title bar for list side of split view",
  },
  {
    id: "split-right-header",
    name: "SplitRightHeader",
    displayName: "Split Right Header",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/layout-containers",
    description: "Header for right panel (70% width) in split view",
    whenToUse: "Title bar for preview side of split view",
  },
  {
    id: "split-left-panel",
    name: "SplitLeftPanel",
    displayName: "Split Left Panel",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/layout-containers",
    description: "Left content panel (30% width) with scrolling",
    whenToUse: "List content in split view layout",
  },
  {
    id: "split-right-panel",
    name: "SplitRightPanel",
    displayName: "Split Right Panel",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/layout-containers",
    description: "Right content panel (70% width) for preview",
    whenToUse: "Document preview in split view layout",
  },
  {
    id: "full-height-container",
    name: "FullHeightContainer",
    displayName: "Full Height Container",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/layout-containers",
    description: "Container that fills available vertical space with flex layout",
    whenToUse: "Pages with scrollable tables or content that fills viewport",
  },
  {
    id: "sticky-header",
    name: "StickyHeader",
    displayName: "Sticky Header",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/layout-containers",
    description: "Header that stays at top while content scrolls",
    whenToUse: "Page headers in full-height containers",
  },
  {
    id: "scroll-content",
    name: "ScrollContent",
    displayName: "Scroll Content",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/layout-containers",
    description: "Scrollable content area that fills remaining space",
    whenToUse: "Main content area in full-height containers",
  },
  {
    id: "edge-to-edge-container",
    name: "EdgeToEdgeContainer",
    displayName: "Edge to Edge Container",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/layout-containers",
    description: "Container that fills entire area with no padding",
    whenToUse: "Full-bleed layouts, split views, immersive content",
  },
  // Page Wrapper Components (SSoT for layout mode)
  {
    id: "table-page",
    name: "TablePage",
    displayName: "Table Page",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/page-wrappers",
    description: "Page wrapper for TeeemTableView pages. Sets full-height layout mode.",
    whenToUse: "ANY page that displays a TeeemTableView. This is the SSoT for table page layout.",
    usageCount: 15,
  },
  {
    id: "tabbed-detail-page",
    name: "TabbedDetailPage",
    displayName: "Tabbed Detail Page",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/page-wrappers",
    description: "Page wrapper for detail pages with tabs. Sets full-height layout mode.",
    whenToUse: "Detail pages with tabs (e.g., Job detail, Contact detail).",
    usageCount: 3,
  },
  {
    id: "scrollable-page",
    name: "ScrollablePage",
    displayName: "Scrollable Page",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/page-wrappers",
    description: "Page wrapper for standard scrollable content. Uses default padded mode.",
    whenToUse: "Standard pages with scrollable content (forms, settings, etc.).",
    usageCount: 0,
  },
  {
    id: "fullscreen-page",
    name: "FullscreenPage",
    displayName: "Fullscreen Page",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/page-wrappers",
    description: "Page wrapper for fullscreen layouts. Hides sidebar.",
    whenToUse: "Fullscreen experiences like Schedule Master.",
    usageCount: 1,
  },
  // Tab Container Components (internal padding, NOT layout mode)
  {
    id: "edge-to-edge-tab-content",
    name: "EdgeToEdgeTabContent",
    displayName: "Edge to Edge Tab Content",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/tab-containers",
    description: "Tab content container for full-width content. Removes parent padding.",
    whenToUse: "Tabs with canvas views, full-width maps, immersive content.",
  },
  {
    id: "full-height-tab-content",
    name: "FullHeightTabContent",
    displayName: "Full Height Tab Content",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/tab-containers",
    description: "Tab content container that fills available height.",
    whenToUse: "Tabs with split views, chat interfaces, anything that shouldn't scroll the page.",
  },
  {
    id: "scrollable-tab-content",
    name: "ScrollableTabContent",
    displayName: "Scrollable Tab Content",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/tab-containers",
    description: "Tab content container for standard scrollable content.",
    whenToUse: "Default for most tabs - forms, lists, cards, standard content.",
  },
  {
    id: "table-tab-content",
    name: "TableTabContent",
    displayName: "Table Tab Content",
    category: "layout",
    tier: 5,
    status: "standard",
    importPath: "@/components/ui/tab-containers",
    description: "Tab content container for TeeemTableView in tabs.",
    whenToUse: "Tabs that display a data table.",
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
  {
    id: "position-badge",
    name: "PositionBadge",
    importPath: "@/components/ui/dnd",
    replacedBy: "item-badge",
    reason: "ItemBadge supports position, label, icon, and custom content",
    migrationGuide: "Replace PositionBadge with ItemBadge. Position prop works the same, add label/icon for more flexibility.",
  },
  // Navigation State Patterns (Anti-patterns)
  {
    id: "usestate-tabs",
    name: "useState for tabs",
    importPath: "react",
    replacedBy: "use-url-tabs",
    reason: "useState breaks browser back button navigation. URL state preserves navigation history.",
    migrationGuide: "Replace `const [tab, setTab] = useState('default')` with `const [tab, setTab] = useUrlTabs('default')`",
  },
  {
    id: "usestate-navigation",
    name: "useState for navigation state",
    importPath: "react",
    replacedBy: "use-url-state",
    reason: "useState breaks browser back button. Navigation state (dialogs, edit mode, expanded items) should be in URL.",
    migrationGuide: "Replace multiple useState calls with useUrlState({ param1: 'default', param2: null, param3: [] })",
  },
  {
    id: "router-back",
    name: "router.back()",
    importPath: "next/navigation",
    replacedBy: "back-button",
    reason: "router.back() fails when user arrives from external link. BackButton has smart fallback.",
    migrationGuide: "Replace `onClick={() => router.back()}` with `<BackButton fallbackHref='/parent-route' />`",
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
