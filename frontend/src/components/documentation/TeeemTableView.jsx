import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react'
import RichTextEditor from '../common/RichTextEditor'
import ColumnEditorModal from '../schema/ColumnEditorModal'
import SavedViewsKanban from './SavedViewsKanban'
import LocationMapCard from '../job-detail/LocationMapCard'
import { getColumnTypeEmoji, getColumnTypeSqlType, getColumnTypeLabel, COLUMN_TYPES } from '../../constants/columnTypes'
import { api } from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  FunnelIcon,
  EyeIcon,
  EyeSlashIcon,
  Bars3Icon,
  ChevronUpIcon,
  ChevronDownIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ViewColumnsIcon,
  Cog8ToothIcon,
  WrenchScrewdriverIcon,
  PlayIcon,
  PlusCircleIcon,
  MinusCircleIcon
} from '@heroicons/react/24/outline'

const CHAPTER_NAMES = {
  1: 'Overview & System-Wide Rules',
  2: 'Authentication & Users',
  3: 'System Administration',
  4: 'Contacts & Relationships',
  5: 'Price Books & Suppliers',
  6: 'Jobs & Construction Management',
  7: 'Estimates & Quoting',
  8: 'AI Plan Review',
  9: 'Purchase Orders',
  10: 'Gantt & Schedule Master',
  11: 'Project Tasks & Checklists',
  12: 'Weather & Public Holidays',
  13: 'OneDrive Integration',
  14: 'Outlook/Email Integration',
  15: 'Chat & Communications',
  16: 'Xero Accounting Integration',
  17: 'Payments & Financials',
  18: 'Workflows & Automation',
  19: 'Custom Tables & Formulas',
  20: 'UI/UX Standards & Patterns',
  21: 'Agent System & Automation'
}

const STATUS_COLORS = {
  open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  fixed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  by_design: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  monitoring: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
}

const STATUS_ICONS = {
  open: '⚡',
  fixed: '✅',
  by_design: '⚠️',
  monitoring: '🔄'
}

const SEVERITY_COLORS = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
}

// Get dynamic sort direction label based on column type
const getSortDirectionLabel = (columnType, direction) => {
  // Numeric types
  const numericTypes = ['number', 'whole_number', 'currency', 'percentage', 'computed']
  if (numericTypes.includes(columnType)) {
    return direction === 'asc' ? '1-9' : '9-1'
  }

  // Date types
  const dateTypes = ['date', 'date_and_time']
  if (dateTypes.includes(columnType)) {
    return direction === 'asc' ? 'Old→New' : 'New→Old'
  }

  // Boolean type
  if (columnType === 'boolean') {
    return direction === 'asc' ? '☐→☑' : '☑→☐'
  }

  // Default to alphabetical for text and other types
  return direction === 'asc' ? 'A-Z' : 'Z-A'
}

// Define default columns for Trinity documentation (Chapter 20: Checkbox column must be first, locked, and minimal size)
const DEFAULT_TRINITY_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'category', label: 'Category', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100, tooltip: 'Bible, Teacher, or Lexicon' },
  { key: 'chapter', label: 'Chapter', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 200, tooltip: 'Chapter number and name' },
  { key: 'section', label: 'Section', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 100, tooltip: 'Section number (e.g., 2.01)' },
  { key: 'type', label: 'Type', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120 },
  { key: 'title', label: 'Title', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 300 },
  { key: 'content', label: 'Content', resizable: true, sortable: false, filterable: true, filterType: 'text', width: 400 },
  { key: 'component', label: 'Component', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 180 },
  { key: 'dense_index', label: 'Dense Index', resizable: true, sortable: false, filterable: true, filterType: 'text', width: 400, tooltip: 'Searchable index (no formatting)' },
  { key: 'status', label: 'Status', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 140 },
  { key: 'severity', label: 'Severity', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120 },
  { key: 'price', label: 'Price', resizable: true, sortable: true, filterable: false, width: 140, showSum: true, sumType: 'currency', tooltip: 'Price in AUD - shows total in footer' },
  { key: 'quantity', label: 'Qty', resizable: true, sortable: true, filterable: false, width: 100, showSum: true, sumType: 'number', tooltip: 'Quantity - shows total in footer' },
  { key: 'audit', label: 'Audit', resizable: true, sortable: true, filterable: false, width: 180, tooltip: 'Last modification date and user' }
]

export default function TeeemTableView({
  entries,
  onEdit,
  onDelete,
  onBulkDelete,
  stats,
  category = null,
  customActions = null,
  enableImport = false,
  enableExport = false,
  onImport = null,
  onExport = null,
  columns = null,  // NEW: Custom columns definition (if not provided, uses DEFAULT_TRINITY_COLUMNS)
  foundationId = 'default',  // NEW: Unique identifier for this table (for saving filters per table)
  enableSchemaEditor = false,  // NEW: Enable schema editor menu items
  foundationIdNumeric = null,  // NEW: Numeric table ID for schema editor API calls
  tableName = 'Table',  // NEW: Human-readable table name for schema editor
  onRowDoubleClick = null,  // NEW: Custom handler for row double-click (overrides default edit modal)
  onView = null,  // NEW: Custom handler for View action button (e.g., navigate to detail page)
  onColumnUpdate = null,  // NEW: Callback when a column schema is updated (to refresh table data)
  viewOnly = false,  // NEW: When true, only show View button in action column (no edit/delete)
  onEditRelationships = null,  // NEW: Custom handler for editing relationships (adds extra action button)
  loadingMore = false,  // NEW: Shows loading indicator when more records are being fetched
  preloadedViews = null,  // NEW: Preloaded views from parent (skips API call if provided)
  hideUpdateViewButton = false,  // NEW: Hide the "Update [ViewName]" button (useful for reference tables)
  initialGroupByColumn = null  // NEW: Initial column to group by (for tables that default to grouped view)
}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated } = useAuth()

  // Use custom columns if provided, otherwise use default Trinity columns
  // Memoize to prevent recreating on every render (performance optimization)
  const COLUMNS = useMemo(() => columns || DEFAULT_TRINITY_COLUMNS, [columns])

  const DEFAULT_COLUMN_WIDTHS = COLUMNS.reduce((acc, col) => {
    acc[col.key] = col.width
    return acc
  }, {})

  const DEFAULT_COLUMN_ORDER = COLUMNS.map(c => c.key)

  const getDefaultVisibleColumns = () => COLUMNS.reduce((acc, col) => {
    acc[col.key] = true
    return acc
  }, {})
  const DEFAULT_VISIBLE_COLUMNS = getDefaultVisibleColumns()

  // Chapter 19 compliance: Load ALL table state from localStorage at initialization
  // This function MUST be defined before useState calls to avoid race conditions
  const getInitialTableState = () => {
    if (typeof window === 'undefined') {
      return {
        columnWidths: DEFAULT_COLUMN_WIDTHS,
        columnOrder: DEFAULT_COLUMN_ORDER,
        visibleColumns: getDefaultVisibleColumns()
      }
    }
    try {
      // Primary storage: teeemTableViewState (the main save location)
      const storageKey = `teeemTableViewState_${foundationId || category || 'default'}`
      const savedState = localStorage.getItem(storageKey)
      if (savedState) {
        const state = JSON.parse(savedState)
        // Merge saved visibleColumns with defaults to handle new columns added after save
        // For NEW columns (not in saved state), use default visibility
        // For EXISTING columns (in saved state), preserve user's choice
        const defaultVisible = getDefaultVisibleColumns()
        const savedVisible = state.visibleColumns || {}
        const mergedVisible = {}
        Object.keys(defaultVisible).forEach(key => {
          // Only use saved value if that column existed in saved state
          mergedVisible[key] = key in savedVisible ? savedVisible[key] : defaultVisible[key]
        })
        // Also merge column widths and order to handle new columns
        const mergedWidths = { ...DEFAULT_COLUMN_WIDTHS, ...(state.columnWidths || {}) }
        const mergedOrder = state.columnOrder || DEFAULT_COLUMN_ORDER
        // Add any new columns not in saved order
        COLUMNS.forEach(col => {
          if (!mergedOrder.includes(col.key)) {
            mergedOrder.push(col.key)
          }
        })
        return {
          columnWidths: mergedWidths,
          columnOrder: mergedOrder,
          visibleColumns: mergedVisible
        }
      }
      // Fallback: Check legacy default columns storage
      const legacyStored = localStorage.getItem(`teeem-default-columns-${foundationId}`)
      if (legacyStored) {
        const parsed = JSON.parse(legacyStored)
        if (parsed && typeof parsed === 'object') {
          // Merge with defaults to handle new columns
          // For NEW columns (not in saved state), use default visibility
          const defaultVisible = getDefaultVisibleColumns()
          const mergedVisible = {}
          Object.keys(defaultVisible).forEach(key => {
            mergedVisible[key] = key in parsed ? parsed[key] : defaultVisible[key]
          })
          return {
            columnWidths: DEFAULT_COLUMN_WIDTHS,
            columnOrder: DEFAULT_COLUMN_ORDER,
            visibleColumns: mergedVisible
          }
        }
      }
      return {
        columnWidths: DEFAULT_COLUMN_WIDTHS,
        columnOrder: DEFAULT_COLUMN_ORDER,
        visibleColumns: getDefaultVisibleColumns()
      }
    } catch (error) {
      console.error('Error loading table state from localStorage:', error)
      return {
        columnWidths: DEFAULT_COLUMN_WIDTHS,
        columnOrder: DEFAULT_COLUMN_ORDER,
        visibleColumns: getDefaultVisibleColumns()
      }
    }
  }

  // Initialize table state from single source to avoid race conditions
  const initialTableState = getInitialTableState()

  // category can be: null (show all), 'bible', 'teacher', or 'lexicon'
  // customActions: optional array of custom button elements to display after Columns button
  // enableImport/enableExport: show import/export options in three-dot menu
  // onImport/onExport: callback functions for import/export actions
  const [search, setSearch] = useState('')
  // Multi-column sorting: array of {column, dir} objects
  // First item is primary sort, second is secondary, etc.
  // Sort and group by are per-view settings, not persisted with table state
  // They start empty and are only populated when loading a saved view
  const [sortColumns, setSortColumns] = useState([])
  const [filters, setFilters] = useState({
    chapter: 'all',
    type: 'all',
    status: 'all',
    severity: 'all'
  })

  // Users list for user column dropdown
  const [users, setUsers] = useState([])

  // Column choices for choice/dropdown columns - keyed by column ID
  const [columnChoices, setColumnChoices] = useState({})

  // Search term for multiple_lookups checkbox list
  const [lookupSearch, setLookupSearch] = useState('')

  // Reset columnChoices when switching tables to prevent stale data from previous table
  useEffect(() => {
    setColumnChoices({})
  }, [foundationIdNumeric])

  // Fetch users from API (for user columns and view ownership)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/api/v1/users')
        if (response && Array.isArray(response)) {
          console.log('✅ Loaded users for dropdown:', response.length, 'users')
          setUsers(response)
        } else if (response?.users) {
          console.log('✅ Loaded users for dropdown:', response.users.length, 'users')
          setUsers(response.users)
        }
      } catch (error) {
        console.debug('Users unavailable:', error?.message || 'Unknown error')
      }
    }
    fetchUsers()
  }, [])

  // Fetch choices for all choice columns and lookup options for lookup columns
  useEffect(() => {
    const fetchColumnChoices = async () => {
      if (!foundationIdNumeric) {
        console.log('⚠️ No foundationIdNumeric, skipping choice/lookup fetch')
        return
      }

      // Find all choice columns that belong to this foundation
      // Filter out columns that don't have matching foundation_id to avoid 500 errors during table transitions
      const choiceColumns = COLUMNS.filter(col =>
        (col.column_type === 'choice' || col.column_type === 'single_select' || col.column_type === 'dropdown') &&
        (!col.foundation_id || col.foundation_id === foundationIdNumeric)
      )

      // Find all lookup columns (both single and multiple) that belong to this foundation
      const lookupColumns = COLUMNS.filter(col =>
        (col.column_type === 'lookup' || col.column_type === 'link_to_another_record' || col.column_type === 'multiple_lookups') &&
        (!col.foundation_id || col.foundation_id === foundationIdNumeric)
      )

      console.log('🔍 Fetching choices for', choiceColumns.length, 'choice columns:', choiceColumns.map(c => ({ key: c.key, id: c.id })))
      console.log('🔗 Fetching lookup options for', lookupColumns.length, 'lookup columns:', lookupColumns.map(c => ({ key: c.key, id: c.id })))

      // Fetch choices for choice columns
      for (const column of choiceColumns) {
        if (!column.id) {
          console.log('⚠️ Skipping column without ID:', column.key)
          continue
        }

        try {
          // Use api.get() to bypass Vite proxy cache issues
          console.log('📡 Fetching choices from API for column:', column.id)
          const data = await api.get(`/api/v1/foundations/${foundationIdNumeric}/columns/${column.id}/choices`, {
            params: { _: Date.now() } // Cache buster
          })
          console.log('✅ Received choices for column', column.id, ':', data.choices?.map(c => c.value))
          if (data.success && data.choices) {
            const choiceValues = data.choices.map(c => c.value)
            setColumnChoices(prev => {
              const updated = {
                ...prev,
                [column.id]: choiceValues
              }
              console.log('📦 Updated columnChoices:', updated)
              return updated
            })
          }
        } catch (error) {
          // Silently skip "Column not found" errors - expected during table transitions
          if (error.message && error.message.includes('Column not found')) {
            console.debug(`⏭️ Skipping column ${column.id} (from previous table)`)
          } else {
            console.error(`❌ Failed to fetch choices for column ${column.id}:`, error)
          }
        }
      }

      // Fetch lookup options for lookup columns
      for (const column of lookupColumns) {
        if (!column.id) {
          console.log('⚠️ Skipping lookup column without ID:', column.key)
          continue
        }

        try {
          console.log('📡 Fetching lookup options from API for column:', column.id)
          const data = await api.get(`/api/v1/foundations/${foundationIdNumeric}/columns/${column.id}/lookup_options`, {
            params: { _: Date.now() } // Cache buster
          })
          console.log('✅ Received lookup options for column', column.id, ':', data.options?.map(o => o.display))
          if (data.success && data.options) {
            // Store as {id, display} objects for lookups (different from choices which are just strings)
            setColumnChoices(prev => {
              const updated = {
                ...prev,
                [column.id]: data.options // Store full objects with id and display
              }
              console.log('📦 Updated columnChoices with lookup options:', updated)
              return updated
            })
          }
        } catch (error) {
          // Silently skip "Column not found" or "Not configured" errors
          if (error.message && (error.message.includes('Column not found') || error.message.includes('not configured'))) {
            console.debug(`⏭️ Skipping lookup column ${column.id} (not configured or from previous table)`)
          } else {
            console.error(`❌ Failed to fetch lookup options for column ${column.id}:`, error)
          }
        }
      }
    }

    fetchColumnChoices()
  }, [foundationIdNumeric, columns])

  // Get current user for audit trail
  const getCurrentUser = () => {
    try {
      const user = localStorage.getItem('user')
      if (user) {
        const userData = JSON.parse(user)
        return userData.name || userData.email || 'User'
      }
    } catch (e) {
      console.error('Failed to parse user from localStorage:', e)
    }
    return 'User'
  }

  // Helper to get user by ID
  const getUserById = (userId) => {
    if (!userId) return null
    const user = users.find(u => u.id === userId)
    return user || null
  }

  // Row selection state (Chapter 20: Always enabled for multi-select)
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartRow, setDragStartRow] = useState(null)

  // Display limit for rendering performance (too many DOM nodes = slow)
  // Data still loads in background, but we only render up to this limit
  // Increased to 10000 to support large tables like Price Books (5285 items)
  const MAX_RENDERED_ROWS = 10000

  // Bulk action state - show delete only after edit clicked
  const [showDeleteButton, setShowDeleteButton] = useState(false)

  // Bulk update modal state
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false)
  const [bulkUpdateColumn, setBulkUpdateColumn] = useState('')
  const [bulkUpdateValue, setBulkUpdateValue] = useState('')
  const [bulkUpdateSaving, setBulkUpdateSaving] = useState(false)

  // Edit mode state - when true, all cells are unlocked for editing
  const [editModeActive, setEditModeActive] = useState(false)

  // Inline editing state (Chapter 20.2)
  const [editingRowId, setEditingRowId] = useState(null)
  const [editingData, setEditingData] = useState({})
  const [validationError, setValidationError] = useState(null)

  // GPS map picker modal state
  const [showGpsModal, setShowGpsModal] = useState(false)
  const [gpsModalCoords, setGpsModalCoords] = useState({ lat: -27.4705, lng: 153.0260 }) // Default to Brisbane

  // Color picker modal state
  const [showColorModal, setShowColorModal] = useState(false)
  const [colorModalValue, setColorModalValue] = useState('#000000')

  // File upload modal state
  const [showFileModal, setShowFileModal] = useState(false)
  const [fileModalTab, setFileModalTab] = useState('upload') // 'upload' or 'url'
  const [fileModalValue, setFileModalValue] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  // Column visibility dropdown state
  const [showColumnsDropdown, setShowColumnsDropdown] = useState(false)

  // Schema modal state - shows full schema info for all columns
  const [showSchemaModal, setShowSchemaModal] = useState(false)

  // Delete column modal state
  const [showDeleteColumnModal, setShowDeleteColumnModal] = useState(false)
  const [deletingColumnId, setDeletingColumnId] = useState(null)

  // Inline column filters (Chapter 20.1)
  // Immediate input state for responsive typing
  const [columnFilterInputs, setColumnFilterInputs] = useState({})
  // Debounced filter state for actual filtering (300ms delay)
  const [columnFilters, setColumnFilters] = useState({})
  const [showFilters, setShowFilters] = useState(true) // Toggle to show/hide filter inputs

  // Debounce filter inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setColumnFilters(columnFilterInputs)
    }, 300)
    return () => clearTimeout(timer)
  }, [columnFilterInputs])

  // Cascade filters - Excel-style dropdown filters that can be applied in any order (per table)
  const [cascadeFilters, setCascadeFilters] = useState(() => {
    try {
      const key = `teeem-cascade-filters-${foundationId}`
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error loading cascade filters:', error)
      return []
    }
  })
  const [filterGroups, setFilterGroups] = useState(() => {
    try {
      const key = `teeem-filter-groups-${foundationId}`
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : [{ id: 'default', logic: 'AND' }]
    } catch (error) {
      console.error('Error loading filter groups:', error)
      return [{ id: 'default', logic: 'AND' }]
    }
  })
  const [interGroupLogic, setInterGroupLogic] = useState(() => {
    try {
      const key = `teeem-inter-group-logic-${foundationId}`
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : 'OR'
    } catch (error) {
      console.error('Error loading inter-group logic:', error)
      return 'OR'
    }
  })
  const [showCascadeDropdown, setShowCascadeDropdown] = useState(false)
  const [cascadeFullscreen, setCascadeFullscreen] = useState(false) // Fullscreen mode for cascade popup
  const [filterSectionCollapsed, setFilterSectionCollapsed] = useState(false) // Collapse View Filter section
  const [sortSectionCollapsed, setSortSectionCollapsed] = useState(false) // Collapse Sort By section
  const [groupSectionCollapsed, setGroupSectionCollapsed] = useState(false) // Collapse Group By section

  // Saved custom filters - load from localStorage on mount (per table)
  const [savedFilters, setSavedFilters] = useState([])
  const [filterName, setFilterName] = useState('') // Name for saving current filter combo

  const [selectedCascadeColumn, setSelectedCascadeColumn] = useState('') // Currently selected column in cascade filter
  const [cascadeInputValue, setCascadeInputValue] = useState('') // Input value for text-based filters
  const [cascadeOperator, setCascadeOperator] = useState('=') // Operator for numeric comparisons (=, >, <, >=, <=, !=)
  const [columnSearchQuery, setColumnSearchQuery] = useState('') // Search query for filtering column list
  const [columnVisibilityTab, setColumnVisibilityTab] = useState('visible') // 'visible' or 'hidden' tab in column selector
  const [draggedCascadeColumn, setDraggedCascadeColumn] = useState(null) // Column being dragged into cascade filter
  const [isDragOverValues, setIsDragOverValues] = useState(false) // Whether dragging over the values drop zone
  const [cascadeDateValue, setCascadeDateValue] = useState('') // First date value for date filters
  const [cascadeDateValue2, setCascadeDateValue2] = useState('') // Second date value for "between" date filter
  const [draggedFilterId, setDraggedFilterId] = useState(null) // Filter being dragged for reordering
  const [dragOverFilterId, setDragOverFilterId] = useState(null) // Filter being dragged over
  const [draggedVisibilityColumn, setDraggedVisibilityColumn] = useState(null) // Column being dragged in visibility list
  const [dragOverVisibilityColumn, setDragOverVisibilityColumn] = useState(null) // Column being dragged over in visibility list
  const [visibilityColumnOrder, setVisibilityColumnOrder] = useState(() => {
    // Load from localStorage per table, fallback to alphabetical order
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem(`teeem-visibility-column-order-${foundationId}`)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      return null
    }
  })
  const [activeViewId, setActiveViewId] = useState(null) // Track which saved view is currently active
  const [editingViewId, setEditingViewId] = useState(null) // Track which view is being edited
  const [creatingNewView, setCreatingNewView] = useState(false) // Track if creating a new view
  const [newViewName, setNewViewName] = useState('') // Name for new view being created
  const [editingFilterId, setEditingFilterId] = useState(null) // Track which filter is being edited
  const [editingFilterValue, setEditingFilterValue] = useState('') // Track the temporary value while editing
  const [groupByColumn, setGroupByColumn] = useState(initialGroupByColumn) // Track which column to group by (legacy single)
  const [groupByColumns, setGroupByColumns] = useState(initialGroupByColumn ? [initialGroupByColumn] : []) // Track multiple group by columns
  const [collapsedGroups, setCollapsedGroups] = useState(new Set()) // Track which groups are collapsed
  const [groupByDropdownOpen, setGroupByDropdownOpen] = useState(null) // Track which group by dropdown is open (by index)
  const [groupBySearchQuery, setGroupBySearchQuery] = useState('') // Search query for group by dropdown
  const [sortColumnDropdownOpen, setSortColumnDropdownOpen] = useState(null) // Track which sort column dropdown is open (by index)
  const [sortColumnSearchQuery, setSortColumnSearchQuery] = useState('') // Search query for sort column dropdown
  const [editingSortOrderIndex, setEditingSortOrderIndex] = useState(null) // Track which sort order number is being edited
  const [sortOrderInputValue, setSortOrderInputValue] = useState('') // Temp value for order number input
  const [editingGroupOrderIndex, setEditingGroupOrderIndex] = useState(null) // Track which group order number is being edited
  const [groupOrderInputValue, setGroupOrderInputValue] = useState('') // Temp value for group order number input
  const [filterColumnDropdownOpen, setFilterColumnDropdownOpen] = useState(null) // Track which filter column dropdown is open (by filter id)
  const [filterColumnSearchQuery, setFilterColumnSearchQuery] = useState('') // Search query for filter column dropdown
  const [collapsedColumnGroups, setCollapsedColumnGroups] = useState(() => {
    // Start with all groups collapsed by default
    // Will be populated with actual group names when columns load
    return new Set(['__all_collapsed__']) // Marker to indicate all should be collapsed initially
  })
  const [editingDefaultSetup, setEditingDefaultSetup] = useState(false) // Track if editing default column setup

  // Determine if filter/column editing should be disabled (not creating new or editing existing)
  const isViewEditingDisabled = !creatingNewView && editingViewId === null && !editingDefaultSetup

  // Helper to close cascade popup (without clearing filters - they persist per table)
  const closeCascadePopup = () => {
    setShowCascadeDropdown(false)
    setEditingViewId(null)
    setCreatingNewView(false)
    setEditingDefaultSetup(false)
    setCascadeFullscreen(false) // Reset fullscreen mode when closing
    setColumnSearchQuery('') // Clear column search when closing
  }

  // Helper to load a view's state (consolidated to avoid duplication)
  const loadViewState = (view, options = {}) => {
    console.log('[loadViewState] Called with view:', view?.name, 'options:', options)
    console.log('[loadViewState] View visibleColumns:', view?.visibleColumns)
    console.log('[loadViewState] View columnOrder:', view?.columnOrder)
    const {
      skipFilters = false,
      skipColumns = false,
      skipSort = false,
      skipGroup = false,
      setActive = true
    } = options

    // CRITICAL: Validate foundation_id to prevent cross-table contamination
    // Use loose equality (!=) to handle Integer vs String type mismatch
    if (view.foundation_id != null && foundationIdNumeric != null && view.foundation_id != foundationIdNumeric) {
      console.error('[loadViewState] ❌ BLOCKED: Attempted to load view from wrong table:', {
        viewId: view.id,
        viewName: view.name,
        viewTableId: view.foundation_id,
        currentTableId: foundationIdNumeric
      })
      return // ABORT - do not load view from wrong table
    }

    // Load filters
    if (!skipFilters) {
      setCascadeFilters(view.filters?.map(f => ({
        id: Date.now() + Math.random(),
        column: f.column,
        value: f.value,
        operator: f.operator || '=',
        label: f.label,
        groupId: f.groupId || 'default'
      })) || [])
      setFilterGroups(view.filterGroups || [{ id: 'default', logic: 'AND' }])
      setInterGroupLogic(view.interGroupLogic || 'OR')
    }

    // Load columns
    if (!skipColumns && view.visibleColumns) {
      setVisibleColumns(view.visibleColumns)
    }
    if (!skipColumns && view.columnOrder) {
      const dedupedColumnOrder = [...new Set(view.columnOrder)]
      setVisibilityColumnOrder(dedupedColumnOrder)
      setColumnOrder(dedupedColumnOrder)
    }
    // Load showFilters (default true if not specified)
    if (!skipColumns) {
      const newShowFilters = view.showFilters === undefined ? true : view.showFilters
      console.log('[loadViewState] Setting showFilters:', newShowFilters, 'from view.showFilters:', view.showFilters)
      setShowFilters(newShowFilters)
    }

    // Load sort (defensive validation)
    if (!skipSort) {
      setSortColumns(
        Array.isArray(view.sortColumns) && view.sortColumns.length > 0
          ? view.sortColumns
          : []
      )
    }

    // Load group by (defensive validation) - prefer groupByColumns array, fall back to single groupByColumn
    if (!skipGroup) {
      const groupCols = Array.isArray(view.groupByColumns) && view.groupByColumns.length > 0
        ? view.groupByColumns
        : (typeof view.groupByColumn === 'string' && view.groupByColumn.trim() !== '' ? [view.groupByColumn] : [])
      setGroupByColumns(groupCols)
      setGroupByColumn(groupCols[0] || null)  // Keep legacy single in sync
    }

    // Set as active view
    if (setActive && view.id) {
      setActiveViewId(view.id)
    }
  }

  // Helper to clear all cascade filters (separate from closing popup)
  const clearCascadeFilters = () => {
    setCascadeFilters([])
    setFilterGroups([{ id: 'default', logic: 'AND' }])
    setInterGroupLogic('OR')
    setSortColumns([])
    setGroupByColumn(null)
    setGroupByColumns([])
    setNewViewName('')
    setActiveViewId(null)
  }

  // Cascade popup resizing state
  const [cascadePopupSize, setCascadePopupSize] = useState(() => {
    if (typeof window === 'undefined') return { width: 50, height: 90 } // vw, vh
    try {
      const stored = localStorage.getItem(`teeem-cascade-popup-size-${foundationId}`)
      return stored ? JSON.parse(stored) : { width: 50, height: 90 }
    } catch { return { width: 50, height: 90 } }
  })
  const [isResizing, setIsResizing] = useState(null) // 'right', 'bottom', 'corner', or null
  const cascadePopupRef = useRef(null)

  // Cascade popup dragging state
  const [cascadePopupPosition, setCascadePopupPosition] = useState({ x: 0, y: 0 }) // Offset from center
  const [isDraggingPopup, setIsDraggingPopup] = useState(false)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })

  // Track previous foundationId to detect changes
  const prevTableIdRef = useRef(null)
  // Track if we're currently creating a Default view to prevent race conditions
  const creatingDefaultViewRef = useRef(false)

  // Load saved views from API when foundationId changes
  useEffect(() => {
    const loadSavedViews = async () => {
      if (!foundationIdNumeric) return

      // Check if table changed (will need to reset activeViewId and auto-apply new view)
      const tableChanged = prevTableIdRef.current !== null && prevTableIdRef.current !== foundationId
      if (tableChanged) {
        console.log('[Load Views] Table changed, will reset activeViewId and auto-apply')
        setActiveViewId(null)
      }

      try {
        console.log('[Load Views] Loading saved views for table:', foundationIdNumeric)
        console.log('[Load Views] prevTableIdRef:', prevTableIdRef.current, 'current foundationId:', foundationId)

        // Option 3: Use preloaded views if available (parallel loading optimization)
        // But first validate they're for the correct table
        let data
        if (preloadedViews && preloadedViews.length > 0) {
          // Check if preloaded views are for the current table
          const firstViewTableId = preloadedViews[0]?.foundation_id
          if (firstViewTableId == foundationIdNumeric) {
            console.log('[Load Views] ✅ Using preloaded views (parallel loading):', preloadedViews.length, 'views')
            data = { success: true, views: preloadedViews }
          } else {
            console.log('[Load Views] ⚠️ Preloaded views are for wrong table (', firstViewTableId, 'vs', foundationIdNumeric, '), loading via API instead')
            data = await api.get(`/api/v1/foundation_views`, {
              params: { foundation_id: foundationIdNumeric }
            })
          }
        } else {
          console.log('[Load Views] 🔄 Loading views via API (no preloaded data)')
          data = await api.get(`/api/v1/foundation_views`, {
            params: { foundation_id: foundationIdNumeric }
          })
        }

        if (data.success && data.views) {
          if (!preloadedViews) {
            console.log('[Load Views] Loaded saved views:', data.views.length, 'views')
          }

          // Validate that all views belong to the current table
          // Use loose equality (!=) to handle Integer vs String type mismatch
          const validViews = data.views.filter(view => {
            if (view.foundation_id != foundationIdNumeric) {
              console.warn('[Load Views] ⚠️ Filtering out view from wrong table:', {
                viewId: view.id,
                viewName: view.name,
                viewTableId: view.foundation_id,
                viewTableIdType: typeof view.foundation_id,
                currentTableId: foundationIdNumeric,
                currentTableIdType: typeof foundationIdNumeric
              })
              return false
            }
            return true
          })

          if (validViews.length !== data.views.length) {
            console.warn(`[Load Views] Filtered out ${data.views.length - validViews.length} views from wrong table`)
          }

          // Convert API format to frontend format
          const converted = validViews.map(view => {
            const filters = view.filters || {}
            const columns = view.columns || {}
            // Use group_by_columns array if available, otherwise fall back to single group_by_column
            const groupByColumns = Array.isArray(view.group_by_columns) && view.group_by_columns.length > 0
              ? view.group_by_columns
              : (view.group_by_column ? [view.group_by_column] : [])

            return {
              id: view.id,
              name: view.name,
              // Parse cascade filters structure
              filters: filters.cascadeFilters || [],
              filterGroups: filters.filterGroups || [],
              interGroupLogic: filters.interGroupLogic || 'AND',
              // Parse columns structure
              visibleColumns: columns.visible || {},
              columnOrder: columns.order || [],
              showFilters: columns.showFilters !== false, // default true
              sortColumns: Array.isArray(view.sort_order) ? view.sort_order : [],
              groupByColumn: view.group_by_column || null,  // Legacy single
              groupByColumns: groupByColumns,  // New array
              display_order: view.display_order || 0,
              isDefault: view.is_default || false
            }
          })
          setSavedFilters(converted)

          // Auto-apply the view with display_order = 0 (typically the Default view)
          const sortedViews = [...converted].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
          const defaultView = sortedViews.find(v => v.display_order === 0)

          // Auto-apply if: table just changed OR no active view yet
          if (defaultView && (tableChanged || !activeViewId)) {
            console.log('[Load Views] Auto-applying view with display_order = 0:', defaultView.name)
            loadViewState(defaultView)
          }

          // Auto-create "Setup" view if it doesn't exist
          const hasSetupView = converted.some(v => v.name === 'Setup')
          if (!hasSetupView) {
            console.log('[Load Views] No Setup view found, creating one')
            await createDefaultView()
          }
        }
      } catch (error) {
        console.error('Error loading saved views:', error)
        setSavedFilters([])
      }
    }

    // Helper function to create the Setup view with all columns selected
    const createDefaultView = async () => {
      // Check if user is authenticated before attempting to save view
      if (!isAuthenticated) {
        console.log('[Load Views] User not authenticated, skipping Setup view creation')
        return
      }

      // Prevent concurrent calls from React strict mode or rapid navigation
      if (creatingDefaultViewRef.current) {
        console.log('[Load Views] Already creating Setup view, skipping duplicate call')
        return
      }

      try {
        creatingDefaultViewRef.current = true

        // Double-check database to prevent race condition duplicates
        const checkData = await api.get(`/api/v1/foundation_views`, {
          params: { foundation_id: foundationIdNumeric }
        })

        const existingSetup = checkData.views?.find(v => v.name === 'Setup')
        if (existingSetup) {
          console.log('[Load Views] Setup view already exists in database, skipping creation')
          return existingSetup
        }

        // Try to fetch fresh columns from API, fall back to COLUMNS prop for custom tables
        let freshColumns = []
        try {
          const freshColumnsData = await api.get(`/api/v1/foundations/${foundationIdNumeric}`)
          freshColumns = freshColumnsData.table?.columns || []
        } catch (err) {
          console.log('[Load Views] Could not fetch columns from API, using COLUMNS prop')
        }

        const allColumnsVisible = {}
        const columnOrder = ['select', 'id', 'actions']

        // Add system columns to visible columns
        allColumnsVisible['select'] = true
        allColumnsVisible['id'] = true
        allColumnsVisible['actions'] = true

        // If API returned columns, use those
        if (freshColumns.length > 0) {
          freshColumns.forEach(col => {
            if (col.column_name && col.column_name !== 'select' && col.column_name !== 'id' && col.column_name !== 'actions') {
              allColumnsVisible[col.column_name] = true
              columnOrder.push(col.column_name)
            }
          })
        } else {
          // Fall back to COLUMNS prop (for custom tables like Feature Tracking)
          COLUMNS.forEach(col => {
            if (col.key && col.key !== 'select' && col.key !== 'id' && col.key !== 'actions') {
              allColumnsVisible[col.key] = true
              columnOrder.push(col.key)
            }
          })
        }

        const setupView = await saveNewView({
          name: 'Setup',
          filters: [],
          filterGroups: [{ id: 'default', logic: 'AND' }],
          interGroupLogic: 'OR',
          visibleColumns: allColumnsVisible,
          columnOrder: columnOrder,
          sortColumns: [],
          isDefault: true // Mark as system default view
        })

        console.log('[Load Views] Created Setup view:', setupView)
      } catch (error) {
        console.error('[Load Views] Error creating Setup view:', error)
      } finally {
        creatingDefaultViewRef.current = false
      }
    }

    if (prevTableIdRef.current !== foundationId || (preloadedViews && savedFilters.length === 0)) {
      console.log('[Load Views] foundationId changed or preloaded views available:', { from: prevTableIdRef.current, to: foundationId, hasPreloadedViews: !!preloadedViews })
      loadSavedViews()
      prevTableIdRef.current = foundationId
    } else {
      console.log('[Load Views] foundationId unchanged and no preloaded views, skipping load:', foundationId)
    }
  }, [foundationId, foundationIdNumeric, preloadedViews])

  // Note: Saved views are now persisted via API calls when creating/updating/deleting
  // No need for automatic localStorage sync

  // URL-based view selection - load view from URL on mount and when URL changes
  useEffect(() => {
    const viewParam = searchParams.get('view')
    console.log('[TeeemTableView] URL view check:', { viewParam, savedFiltersCount: savedFilters.length, foundationId, activeViewId })
    if (viewParam && savedFilters.length > 0) {
      // Find view by name (URL-friendly slug) - try multiple matching strategies
      let view = savedFilters.find(v =>
        v.name.toLowerCase().replace(/\s+/g, '-') === viewParam.toLowerCase() ||
        v.name.toLowerCase() === viewParam.toLowerCase() ||
        v.id.toString() === viewParam
      )

      // Handle legacy __default_setup__ -> redirect to Setup view
      if (!view && viewParam === '__default_setup__') {
        view = savedFilters.find(v => v.name === 'Setup')
        if (view) {
          console.log('[TeeemTableView] Redirecting legacy __default_setup__ to Setup view')
          // Update URL to use the correct view name
          const newParams = new URLSearchParams(searchParams)
          newParams.set('view', view.name.toLowerCase().replace(/\s+/g, '-'))
          setSearchParams(newParams, { replace: true })
        }
      }

      console.log('[TeeemTableView] URL view search result:', { viewParam, view: view?.name, found: !!view })
      if (view && activeViewId !== view.id) {
        loadViewState(view)
      }
    }
    // Note: We don't clear activeViewId when there's no URL param anymore
    // This allows auto-applied views (display_order = 0) to remain active
    // Users can manually clear the view using the Filters button or by applying a different view
  }, [searchParams, savedFilters]) // Re-run when URL or saved filters change

  // Sync URL when activeViewId changes to null (view cleared)
  useEffect(() => {
    if (activeViewId === null && searchParams.get('view')) {
      // Active view was cleared, remove from URL
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('view')
      setSearchParams(newParams, { replace: true })
    }
  }, [activeViewId])

  // Auto-load default view on mount (if one exists and no URL view param)
  const hasLoadedDefaultView = useRef(false)
  useEffect(() => {
    // Only run once on mount, and only if no URL view param
    if (hasLoadedDefaultView.current) return
    if (searchParams.get('view')) return // URL view takes precedence

    const defaultView = savedFilters.find(view => view.isDefault)
    if (defaultView) {
      hasLoadedDefaultView.current = true
      loadViewState(defaultView)
      // Update URL with default view
      const viewSlug = defaultView.name.toLowerCase().replace(/\s+/g, '-')
      const newParams = new URLSearchParams(searchParams)
      newParams.set('view', viewSlug)
      setSearchParams(newParams, { replace: true })
    }
  }, [savedFilters]) // Run when savedFilters loads

  // Component multi-select checkbox state
  const [selectedComponents, setSelectedComponents] = useState(new Set())
  const [showComponentDropdown, setShowComponentDropdown] = useState(false)

  // Modal state for viewing full row details
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [selectedColumn, setSelectedColumn] = useState(null)

  // Text editing modal state
  const [showTextEditModal, setShowTextEditModal] = useState(false)
  const [textEditField, setTextEditField] = useState('') // 'title' or 'content'
  const [textEditValue, setTextEditValue] = useState('')
  const textEditTextareaRef = useRef(null)

  // Validation state
  const [validationErrors, setValidationErrors] = useState({})

  // Editable modal state (for double-click row editing)
  const [showEditableModal, setShowEditableModal] = useState(false)
  const [modalEditData, setModalEditData] = useState(null)

  // Column schema editor state
  const [editIndividualMode, setEditIndividualMode] = useState(false)
  const [selectedColumnForEdit, setSelectedColumnForEdit] = useState(null)

  // Chapter 19 compliance: Column state from initialTableState (defined at top of component)
  const [columnWidths, setColumnWidths] = useState(initialTableState.columnWidths)
  const [columnOrder, setColumnOrder] = useState(initialTableState.columnOrder)
  const [visibleColumns, setVisibleColumns] = useState(initialTableState.visibleColumns)

  // Initialize default columns for new views from localStorage (will be updated from DB when views load)
  const getInitialDefaultColumns = () => {
    try {
      const stored = localStorage.getItem(`teeem-default-columns-${foundationId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with current defaults to handle new columns
        const defaultVisible = getDefaultVisibleColumns()
        const merged = {}
        Object.keys(defaultVisible).forEach(key => {
          merged[key] = key in parsed ? parsed[key] : defaultVisible[key]
        })
        return merged
      }
    } catch (error) {
      console.error('Error loading default columns:', error)
    }
    return initialTableState.visibleColumns
  }
  const [defaultColumnsForNewViews, setDefaultColumnsForNewViews] = useState(getInitialDefaultColumns())

  // Removed: Old __default_setup__ system

  // Sync columnOrder and visibleColumns when COLUMNS change (e.g., new columns added from API)
  // This ensures new columns appear in the table instead of being hidden due to stale localStorage
  useEffect(() => {
    const columnKeys = COLUMNS.map(c => c.key)

    // Find new columns that aren't in the current columnOrder
    const newColumns = columnKeys.filter(key => !columnOrder.includes(key))

    if (newColumns.length > 0) {
      // Add new columns to the end of columnOrder
      setColumnOrder(prev => [...prev.filter(k => columnKeys.includes(k)), ...newColumns])

      // Set new columns as visible by default
      setVisibleColumns(prev => {
        const updated = { ...prev }
        newColumns.forEach(key => {
          if (updated[key] === undefined) {
            updated[key] = true
          }
        })
        // Also remove visibility settings for columns that no longer exist
        Object.keys(updated).forEach(key => {
          if (!columnKeys.includes(key)) {
            delete updated[key]
          }
        })
        return updated
      })

      // Update column widths for new columns
      setColumnWidths(prev => {
        const updated = { ...prev }
        COLUMNS.forEach(col => {
          if (updated[col.key] === undefined) {
            updated[col.key] = col.width || 150
          }
        })
        return updated
      })
    }
  }, [COLUMNS])

  // Per-column minimum widths (default 75px for all columns)
  const [columnMinWidths, setColumnMinWidths] = useState(() => {
    if (typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem(`teeem-column-min-widths-${foundationId}`)
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })

  // Per-column filter visibility (true = show filter, default is true for all columns)
  const [columnShowFilters, setColumnShowFilters] = useState(() => {
    if (typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem(`teeem-column-show-filters-${foundationId}`)
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })

  // Save column min widths to localStorage whenever they change (per table)
  useEffect(() => {
    try {
      localStorage.setItem(`teeem-column-min-widths-${foundationId}`, JSON.stringify(columnMinWidths))
    } catch (error) {
      console.error('Error saving column min widths to localStorage:', error)
    }
  }, [columnMinWidths, foundationId])

  // Save column show filters to localStorage whenever they change (per table)
  useEffect(() => {
    try {
      localStorage.setItem(`teeem-column-show-filters-${foundationId}`, JSON.stringify(columnShowFilters))
    } catch (error) {
      console.error('Error saving column show filters to localStorage:', error)
    }
  }, [columnShowFilters, foundationId])

  // Removed: Old __default_setup__ system that conflicted with new "Default" view system

  // Save visibility column order to localStorage whenever it changes (per table)
  useEffect(() => {
    if (visibilityColumnOrder) {
      try {
        localStorage.setItem(`teeem-visibility-column-order-${foundationId}`, JSON.stringify(visibilityColumnOrder))
      } catch (error) {
        console.error('Error saving visibility column order to localStorage:', error)
      }
    }
  }, [visibilityColumnOrder, foundationId])

  // Sync visibility column order to table column order (dropdown controls table)
  useEffect(() => {
    // Build the full order: system columns (select, actions) + visibility order + any missing columns
    const systemCols = ['select', 'actions']
    const allColumnKeys = COLUMNS.map(c => c.key)
    const orderedKeys = [...systemCols.filter(k => allColumnKeys.includes(k))]

    if (visibilityColumnOrder && visibilityColumnOrder.length > 0) {
      // Add columns from visibility order
      visibilityColumnOrder.forEach(key => {
        if (!orderedKeys.includes(key) && allColumnKeys.includes(key)) {
          orderedKeys.push(key)
        }
      })
    }

    // Add any remaining columns not in visibility order
    allColumnKeys.forEach(key => {
      if (!orderedKeys.includes(key)) {
        orderedKeys.push(key)
      }
    })

    // Only update if order has actually changed (prevent render loops)
    setColumnOrder(prev => {
      const changed = JSON.stringify(prev) !== JSON.stringify(orderedKeys)
      if (changed) {
        console.log('[Visibility→Table] Synced column order:', orderedKeys)
      }
      return changed ? orderedKeys : prev
    })
  }, [visibilityColumnOrder, foundationId, COLUMNS])

  // Close group by dropdown when clicking outside
  useEffect(() => {
    if (groupByDropdownOpen === null) return

    const handleClickOutside = (e) => {
      // Check if click is inside any group-column-dropdown container
      const dropdown = e.target.closest('[data-group-column-dropdown]')
      if (dropdown) {
        // Clicked inside a dropdown container - check if it's a different one
        const clickedIndex = parseInt(dropdown.getAttribute('data-group-column-dropdown'), 10)
        if (clickedIndex !== groupByDropdownOpen) {
          // Clicking on a different dropdown - let its onClick handler open it
          setGroupByDropdownOpen(null)
          setGroupBySearchQuery('')
        }
        // Otherwise, clicked inside the currently open dropdown - do nothing
      } else {
        // Clicked completely outside - close the dropdown
        setGroupByDropdownOpen(null)
        setGroupBySearchQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [groupByDropdownOpen])

  // Close sort column dropdown when clicking outside
  useEffect(() => {
    if (sortColumnDropdownOpen === null) return

    const handleClickOutside = (e) => {
      const dropdown = e.target.closest('[data-sort-column-dropdown]')
      if (!dropdown) {
        setSortColumnDropdownOpen(null)
        setSortColumnSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sortColumnDropdownOpen])

  // Close filter column dropdown when clicking outside
  useEffect(() => {
    if (filterColumnDropdownOpen === null) return

    const handleClickOutside = (e) => {
      const dropdown = e.target.closest('[data-filter-column-dropdown]')
      if (!dropdown) {
        setFilterColumnDropdownOpen(null)
        setFilterColumnSearchQuery('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [filterColumnDropdownOpen])

  // Save cascade filters to localStorage whenever they change (per table)
  useEffect(() => {
    try {
      localStorage.setItem(`teeem-cascade-filters-${foundationId}`, JSON.stringify(cascadeFilters))
    } catch (error) {
      console.error('Error saving cascade filters to localStorage:', error)
    }
  }, [cascadeFilters, foundationId])

  // Save filter groups to localStorage whenever they change (per table)
  useEffect(() => {
    try {
      localStorage.setItem(`teeem-filter-groups-${foundationId}`, JSON.stringify(filterGroups))
    } catch (error) {
      console.error('Error saving filter groups to localStorage:', error)
    }
  }, [filterGroups, foundationId])

  // Save inter-group logic to localStorage whenever it changes (per table)
  useEffect(() => {
    try {
      localStorage.setItem(`teeem-inter-group-logic-${foundationId}`, JSON.stringify(interGroupLogic))
    } catch (error) {
      console.error('Error saving inter-group logic to localStorage:', error)
    }
  }, [interGroupLogic, foundationId])

  // Save cascade popup size to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`teeem-cascade-popup-size-${foundationId}`, JSON.stringify(cascadePopupSize))
    } catch (error) {
      console.error('Error saving cascade popup size to localStorage:', error)
    }
  }, [cascadePopupSize, foundationId])

  // Handle cascade popup resizing
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e) => {
      if (!cascadePopupRef.current) return

      const vw = window.innerWidth / 100
      const vh = window.innerHeight / 100

      if (isResizing === 'right' || isResizing === 'corner') {
        const centerX = window.innerWidth / 2
        const newWidth = Math.max(30, Math.min(95, ((e.clientX - centerX) * 2) / vw))
        setCascadePopupSize(prev => ({ ...prev, width: newWidth }))
      }

      if (isResizing === 'bottom' || isResizing === 'corner') {
        const centerY = window.innerHeight / 2
        const newHeight = Math.max(30, Math.min(95, ((e.clientY - centerY) * 2) / vh))
        setCascadePopupSize(prev => ({ ...prev, height: newHeight }))
      }
    }

    const handleMouseUp = () => {
      setIsResizing(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Handle cascade popup dragging
  useEffect(() => {
    if (!isDraggingPopup) return

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragStartPos.x
      const deltaY = e.clientY - dragStartPos.y

      // Calculate bounds to keep popup on screen
      const popupWidth = (cascadePopupSize.width / 100) * window.innerWidth
      const popupHeight = (cascadePopupSize.height / 100) * window.innerHeight
      const maxX = (window.innerWidth - popupWidth) / 2
      const maxY = (window.innerHeight - popupHeight) / 2

      setCascadePopupPosition(prev => ({
        x: Math.max(-maxX, Math.min(maxX, prev.x + deltaX)),
        y: Math.max(-maxY, Math.min(maxY, prev.y + deltaY))
      }))
      setDragStartPos({ x: e.clientX, y: e.clientY })
    }

    const handleMouseUp = () => {
      setIsDraggingPopup(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'move'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingPopup, dragStartPos, cascadePopupSize])

  // Column resizing state
  const [resizingColumn, setResizingColumn] = useState(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [forceUpdate, setForceUpdate] = useState(0) // Force re-render after resize

  // Column reordering state
  const [draggedColumn, setDraggedColumn] = useState(null)
  const [dropTargetColumn, setDropTargetColumn] = useState(null)

  const scrollContainerRef = useRef(null)

  // NOTE: Table state is now loaded from localStorage during initialization (via getInitialTableState)
  // This useEffect handles foundationId or category changes AFTER initial render
  // The initial load happens in useState initialization to avoid race conditions
  const prevCategoryRef = React.useRef(category)
  useEffect(() => {
    // Skip on initial mount - state is already loaded from localStorage via initialTableState
    if (prevTableIdRef.current === foundationId && prevCategoryRef.current === category) {
      return
    }
    prevTableIdRef.current = foundationId
    prevCategoryRef.current = category

    // Load state for new foundationId/category
    const storageKey = `teeemTableViewState_${foundationId || category || 'default'}`
    const savedState = localStorage.getItem(storageKey)
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        setColumnWidths(state.columnWidths || DEFAULT_COLUMN_WIDTHS)
        setColumnOrder(state.columnOrder || DEFAULT_COLUMN_ORDER)
        setVisibleColumns(state.visibleColumns || DEFAULT_VISIBLE_COLUMNS)
        // sortColumns and groupByColumn are per-view, not persisted with table state
        // Start with empty sort when switching tables
        setSortColumns([])
        setGroupByColumn(null)
        setGroupByColumns([])
      } catch (e) {
        console.error('Failed to load table state:', e)
      }
    } else {
      // Reset to defaults for new table
      setColumnWidths(DEFAULT_COLUMN_WIDTHS)
      setColumnOrder(DEFAULT_COLUMN_ORDER)
      setVisibleColumns(getDefaultVisibleColumns())
      setSortColumns([])
      setGroupByColumn(null)
      setGroupByColumns([])
    }
  }, [foundationId, category])

  // Save table state to localStorage whenever it changes (Chapter 20.5B)
  // NOTE: sortColumns and groupByColumn are NOT persisted here - they are per-view settings
  useEffect(() => {
    const storageKey = `teeemTableViewState_${foundationId || category || 'default'}`
    const state = {
      columnWidths,
      columnOrder,
      visibleColumns
    }
    localStorage.setItem(storageKey, JSON.stringify(state))
  }, [columnWidths, columnOrder, visibleColumns, foundationId, category])

  // Column resizing handlers (Chapter 20.4)
  const handleResizeStart = (e, columnKey) => {
    e.stopPropagation()
    setResizingColumn(columnKey)
    setResizeStartX(e.clientX)
    setResizeStartWidth(columnWidths[columnKey] || 200)
  }

  const handleResizeMove = (e) => {
    if (!resizingColumn) return
    const diff = e.clientX - resizeStartX
    const minWidth = columnMinWidths[resizingColumn] ?? 75 // Per-column min width, default 75px
    const newWidth = Math.max(minWidth, resizeStartWidth + diff)
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth
    }))
  }

  const handleResizeEnd = () => {
    setResizingColumn(null)
    // Force re-render to update column display
    setForceUpdate(prev => prev + 1)
  }

  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [resizingColumn, resizeStartX, resizeStartWidth])

  // Validation function for field values
  const validateField = (key, value) => {
    if (key === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(value)) {
        return 'Invalid email format. Example: example@domain.com'
      }
    }
    if (key === 'mobile' && value) {
      // Australian mobile: 04XX XXX XXX (10 digits)
      const mobileRegex = /^04\d{2}\s?\d{3}\s?\d{3}$/
      if (!mobileRegex.test(value.replace(/\s/g, ''))) {
        return 'Invalid mobile format. Example: 0407 397 541'
      }
    }
    if (key === 'phone' && value) {
      // Australian landline: (0X) XXXX XXXX or 1300/1800 numbers
      const phoneRegex = /^(\(0\d\)\s?\d{4}\s?\d{4}|1[38]00\s?\d{3}\s?\d{3})$/
      if (!phoneRegex.test(value.replace(/\s/g, ''))) {
        return 'Invalid phone format. Example: (03) 9123 4567 or 1300 123 456'
      }
    }
    if (key === 'is_active' && value !== undefined && value !== null) {
      // Boolean validation: must be true or false
      if (typeof value !== 'boolean') {
        return 'Invalid boolean value. Must be true or false'
      }
    }
    if (key === 'document_link' && value) {
      // URL validation: must be valid URL format
      try {
        new URL(value)
      } catch {
        return 'Invalid URL format. Example: https://example.com/document.pdf'
      }
    }
    if (key === 'user' && value !== undefined && value !== null && value !== '') {
      // User validation: must be a valid integer (user ID)
      const userId = typeof value === 'string' ? parseInt(value) : value
      if (isNaN(userId) || userId <= 0) {
        return 'Invalid user. Please select a valid user from the dropdown'
      }
    }
    return null
  }



  // Column reordering handlers (Chapter 20.5)
  const handleDragStart = (e, columnKey) => {
    setDraggedColumn(columnKey)
    setDropTargetColumn(null)
  }

  const handleDragOver = (e, targetColumnKey) => {
    e.preventDefault()
    if (draggedColumn && draggedColumn !== targetColumnKey) {
      setDropTargetColumn(targetColumnKey)
    }
  }

  const handleDragEnd = () => {
    setDraggedColumn(null)
    setDropTargetColumn(null)
    // Force a re-render to update the table display
    setTimeout(() => {
      // Trigger re-render by updating state
      setColumnOrder(prev => [...prev])
    }, 0)
  }

  const handleDrop = (e, targetColumnKey) => {
    e.preventDefault()
    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null)
      setDropTargetColumn(null)
      return
    }

    const draggedIndex = columnOrder.indexOf(draggedColumn)
    const targetIndex = columnOrder.indexOf(targetColumnKey)

    const newOrder = [...columnOrder]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumn)

    setColumnOrder(newOrder)
    setDraggedColumn(null)
    setDropTargetColumn(null)
    // Force a re-render to update the table display
    setTimeout(() => {
      // Trigger re-render by updating state
      setColumnOrder(prev => [...prev])
    }, 0)
  }

  // Column visibility toggle (Chapter 20.10)
  const handleToggleColumn = (columnKey) => {
    setVisibleColumns(prev => {
      const newVisibleColumns = {
        ...prev,
        [columnKey]: !prev[columnKey]
      }

      // RULE #20.37: Prevent hiding ALL columns
      const visibleCount = Object.values(newVisibleColumns).filter(Boolean).length
      if (visibleCount === 0) {
        console.warn('Cannot hide all columns - at least one must remain visible')
        return prev // Don't apply the change
      }

      return newVisibleColumns
    })
  }

  // Row selection handlers (Chapter 20: Multi-select with bulk actions)
  const handleSelectAll = () => {
    if (selectedRows.size === filteredAndSorted.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredAndSorted.map(e => e.id)))
    }
  }

  const handleSelectRow = (id) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedRows(newSelected)
  }

  // Drag selection handlers
  const handleDragSelectStart = (id) => {
    setIsDragging(true)
    setDragStartRow(id)
    // Select the starting row
    const newSelected = new Set(selectedRows)
    newSelected.add(id)
    setSelectedRows(newSelected)
  }

  const handleDragSelectOver = (id) => {
    if (!isDragging || !dragStartRow) return

    // Find the range between drag start and current row
    const startIndex = filteredAndSorted.findIndex(e => e.id === dragStartRow)
    const endIndex = filteredAndSorted.findIndex(e => e.id === id)

    if (startIndex === -1 || endIndex === -1) return

    // Select all rows in the range
    const [min, max] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
    const rowsInRange = filteredAndSorted.slice(min, max + 1).map(e => e.id)

    setSelectedRows(new Set(rowsInRange))
  }

  const handleDragSelectEnd = () => {
    setIsDragging(false)
    setDragStartRow(null)
  }

  // Add global mouseup listener to end drag selection
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        handleDragSelectEnd()
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [isDragging])

  // Bulk action handlers (Chapter 20: Delete with confirmation)
  const handleBulkDelete = () => {
    if (!confirm(`Delete ${selectedRows.size} selected entries?`)) return

    selectedRows.forEach(id => {
      const entry = entries.find(e => e.id === id)
      if (entry) onDelete(entry)
    })
    setSelectedRows(new Set())
  }

  // Column filter handler (Chapter 20.1) - updates input state immediately, debounce handles filter state
  const handleColumnFilterChange = (columnKey, value) => {
    setColumnFilterInputs(prev => ({
      ...prev,
      [columnKey]: value
    }))
  }

  // Filter and sort entries
  const filteredAndSorted = useMemo(() => {
    let result = [...entries]

    // Apply category filter if specified
    if (category) {
      result = result.filter(e => e.category === category)
    }

    // Apply search (Chapter 20.20) - Search across ALL fields
    if (search) {
      const query = search.toLowerCase()
      result = result.filter(e => {
        // Get all values from the entry and check if any contain the search query
        return Object.values(e).some(value => {
          if (value === null || value === undefined) return false
          // Convert to string and check for match
          return String(value).toLowerCase().includes(query)
        })
      })
    }

    // Apply inline column filters (Chapter 20.1)
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (!value) return

      switch (key) {
        case 'category':
          result = result.filter(e => e.category === value)
          break
        case 'chapter':
          result = result.filter(e => e.chapter_number === parseInt(value))
          break
        case 'section':
          result = result.filter(e => e.section_number?.toLowerCase().includes(value.toLowerCase()) || e.section_display?.toLowerCase().includes(value.toLowerCase()))
          break
        case 'type':
          result = result.filter(e => e.entry_type === value)
          break
        case 'title':
          result = result.filter(e => e.title?.toLowerCase().includes(value.toLowerCase()))
          break
        case 'content':
          result = result.filter(e => {
            const searchIn = [
              e.description,
              e.details,
              e.summary,
              e.scenario,
              e.solution,
              e.examples,
              e.code_example
            ].filter(Boolean).join(' ').toLowerCase()
            return searchIn.includes(value.toLowerCase())
          })
          break
        case 'component':
          // Component uses multi-select checkboxes
          if (selectedComponents.size > 0) {
            result = result.filter(e => {
              // Special handling: "Table" checkbox also includes "DynamicTables"
              if (selectedComponents.has('Table') && (e.component === 'Table' || e.component === 'DynamicTables')) {
                return true
              }
              return selectedComponents.has(e.component)
            })
          }
          break
        case 'status':
          result = result.filter(e => e.status === value)
          break
        case 'severity':
          result = result.filter(e => e.severity === value)
          break
        case 'user':
          // User filter - convert string to number for comparison
          result = result.filter(e => e.user === parseInt(value))
          break
        default:
          // Generic handler for other filterable columns
          // For boolean columns, convert string "true"/"false" to boolean
          if (value === 'true' || value === 'false') {
            const boolValue = value === 'true'
            result = result.filter(e => e[key] === boolValue)
          } else {
            // For other columns, do a simple equality check or string match
            result = result.filter(e => {
              const entryValue = e[key]
              if (entryValue === null || entryValue === undefined) return false

              // Check column type for special handling
              const column = COLUMNS.find(c => c.key === key)
              const isChoiceColumn = column?.column_type === 'choice' ||
                                     column?.column_type === 'single_select' ||
                                     column?.column_type === 'dropdown'
              const isLookupColumn = column?.column_type === 'lookup'

              // Handle lookup columns - value is stored as {id, display} object
              if (isLookupColumn && typeof entryValue === 'object' && entryValue.id !== undefined) {
                // Filter value is the ID, compare as strings
                return String(entryValue.id) === String(value)
              }

              if (typeof entryValue === 'string') {
                // Choice columns: exact match (case-insensitive)
                // Other columns: substring match (contains)
                if (isChoiceColumn) {
                  return entryValue.toLowerCase() === value.toLowerCase()
                } else {
                  return entryValue.toLowerCase().includes(value.toLowerCase())
                }
              }
              return entryValue === value
            })
          }
          break
      }
    })

    // Apply cascade filters with group support
    // Helper function to check if a single filter matches an entry
    const filterMatches = (filter, entry) => {
      if (!filter.value && filter.value !== 0) return true // Empty filter passes

      const key = filter.column
      const value = filter.value
      const operator = filter.operator || '='
      const entryValue = entry[key]

      // Handle different value types
      if (typeof value === 'boolean') {
        return entryValue === value
      }

      // Handle date comparison - check if this looks like a date filter
      const dateKeywords = ['date', 'created_at', 'updated_at', 'datetime', '_at', 'timestamp']
      const isDateColumn = dateKeywords.some(keyword => key.toLowerCase().includes(keyword))

      if (isDateColumn && entryValue) {
        const entryDate = new Date(entryValue)
        const entryDateOnly = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate())

        // Handle RELATIVE date filters (today, yesterday, last7days, etc.)
        if (operator === 'relative') {
          const today = new Date()
          const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

          switch (value) {
            case 'today':
              return entryDateOnly.getTime() === todayOnly.getTime()
            case 'yesterday': {
              const yesterday = new Date(todayOnly)
              yesterday.setDate(yesterday.getDate() - 1)
              return entryDateOnly.getTime() === yesterday.getTime()
            }
            case 'last7days': {
              const weekAgo = new Date(todayOnly)
              weekAgo.setDate(weekAgo.getDate() - 7)
              return entryDateOnly >= weekAgo && entryDateOnly <= todayOnly
            }
            case 'last30days': {
              const monthAgo = new Date(todayOnly)
              monthAgo.setDate(monthAgo.getDate() - 30)
              return entryDateOnly >= monthAgo && entryDateOnly <= todayOnly
            }
            case 'thisMonth': {
              const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
              return entryDateOnly >= monthStart && entryDateOnly <= todayOnly
            }
            case 'lastMonth': {
              const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
              const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
              return entryDateOnly >= lastMonthStart && entryDateOnly <= lastMonthEnd
            }
            default:
              return true
          }
        }

        // Handle fixed date filters
        const filterDate = new Date(value)
        const filterDateOnly = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate())

        switch (operator) {
          case 'between':
            if (filter.value2) {
              const filterDate2 = new Date(filter.value2)
              const filterDate2Only = new Date(filterDate2.getFullYear(), filterDate2.getMonth(), filterDate2.getDate())
              return entryDateOnly >= filterDateOnly && entryDateOnly <= filterDate2Only
            }
            return true
          case '>': return entryDateOnly > filterDateOnly
          case '<': return entryDateOnly < filterDateOnly
          case '>=': return entryDateOnly >= filterDateOnly
          case '<=': return entryDateOnly <= filterDateOnly
          case '=':
          default: return entryDateOnly.getTime() === filterDateOnly.getTime()
        }
      }

      // Handle empty/notEmpty operators directly
      if (operator === 'empty') {
        return entryValue === null || entryValue === undefined || entryValue === ''
      }
      if (operator === 'notEmpty') {
        return entryValue !== null && entryValue !== undefined && entryValue !== ''
      }

      // Handle relative filters (hasValue, empty) - works for any column type
      if (operator === 'relative') {
        switch (value) {
          case 'hasValue':
            return entryValue !== null && entryValue !== undefined && entryValue !== ''
          case 'empty':
            return entryValue === null || entryValue === undefined || entryValue === ''
          default:
            return true
        }
      }

      // Handle text operators (contains, startsWith, endsWith)
      if (operator === 'contains') {
        return String(entryValue || '').toLowerCase().includes(String(value).toLowerCase())
      }
      if (operator === 'startsWith') {
        return String(entryValue || '').toLowerCase().startsWith(String(value).toLowerCase())
      }
      if (operator === 'endsWith') {
        return String(entryValue || '').toLowerCase().endsWith(String(value).toLowerCase())
      }

      // Handle numeric comparison with operators
      if (typeof entryValue === 'number' && !isNaN(parseFloat(value))) {
        const numValue = parseFloat(value)
        switch (operator) {
          case 'between':
            if (filter.value2) {
              const numValue2 = parseFloat(filter.value2)
              return entryValue >= numValue && entryValue <= numValue2
            }
            return true
          case '>': return entryValue > numValue
          case '<': return entryValue < numValue
          case '>=': return entryValue >= numValue
          case '<=': return entryValue <= numValue
          case '!=': return entryValue !== numValue
          case '=':
          default: return entryValue === numValue
        }
      }

      // Handle string comparison (case-insensitive)
      if (operator === '!=') {
        return String(entryValue).toLowerCase() !== String(value).toLowerCase()
      }
      return String(entryValue).toLowerCase() === String(value).toLowerCase()
    }

    // Apply cascade filters with group logic
    if (cascadeFilters.length > 0) {
      result = result.filter(entry => {
        // Group filters by their groupId
        const groupResults = filterGroups.map(group => {
          const groupFilters = cascadeFilters.filter(f => (f.groupId || 'default') === group.id)
          if (groupFilters.length === 0) return true // Empty group passes

          // Apply group's internal logic (AND/OR)
          if (group.logic === 'OR') {
            return groupFilters.some(filter => filterMatches(filter, entry))
          } else {
            // AND logic (default)
            return groupFilters.every(filter => filterMatches(filter, entry))
          }
        })

        // Apply inter-group logic
        if (interGroupLogic === 'OR') {
          return groupResults.some(r => r)
        } else {
          // AND logic (default between groups)
          return groupResults.every(r => r)
        }
      })
    }

    // Apply global filters (legacy)
    if (filters.chapter !== 'all') {
      result = result.filter(e => e.chapter_number === parseInt(filters.chapter))
    }
    if (filters.type !== 'all') {
      result = result.filter(e => e.entry_type === filters.type)
    }
    if (filters.status !== 'all') {
      result = result.filter(e => e.status === filters.status)
    }
    if (filters.severity !== 'all') {
      result = result.filter(e => e.severity === filters.severity)
    }

    // Helper to get sort value for a column
    const getSortValue = (row, sortKey) => {
      switch (sortKey) {
        case 'category':
          return row.category || ''
        case 'chapter':
          return row.chapter_number
        case 'section':
          // Parse section numbers with optional category prefix (B01.01, L01.02, T01.03)
          const parseSection = (str) => {
            if (!str) return [0, 0, 0] // Use numbers for proper sorting
            const match = str.match(/^([BTL])?(\d+)\.(\d+)$/)
            if (!match) return [0, 0, 0]
            // Convert prefix to number: B=1, L=2, T=3, none=0
            const prefixOrder = { 'B': 1, 'L': 2, 'T': 3 }
            return [
              prefixOrder[match[1]] || 0,
              parseInt(match[2]),
              parseInt(match[3])
            ]
          }
          // Return array for multi-level section comparison
          return parseSection(row.section_number)
        case 'title':
          return row.title || ''
        case 'status':
          return row.status || ''
        case 'severity':
          const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 }
          return severityOrder[row.severity] || 0
        case 'component':
          return row.component || ''
        case 'type':
          return row.entry_type || ''
        case 'audit':
        case 'updated_at':
          return row.updated_at ? new Date(row.updated_at).getTime() : 0
        case 'created_at':
          return row.created_at ? new Date(row.created_at).getTime() : 0
        case 'price':
          return row.price || 0
        case 'quantity':
          return row.quantity || 0
        case 'discount':
          return row.discount || 0
        case 'total_cost':
          const column = COLUMNS.find(c => c.key === sortKey)
          if (column?.isComputed && column?.computeFunction) {
            return column.computeFunction(row) || 0
          }
          return 0
        case 'id':
          return row.id || 0
        default:
          return row[sortKey] ?? ''
      }
    }

    // Compare two values for sorting
    const compareValues = (aVal, bVal, dir) => {
      // Handle array values (for section sorting)
      if (Array.isArray(aVal) && Array.isArray(bVal)) {
        for (let i = 0; i < aVal.length; i++) {
          if (aVal[i] < bVal[i]) return dir === 'asc' ? -1 : 1
          if (aVal[i] > bVal[i]) return dir === 'asc' ? 1 : -1
        }
        return 0
      }
      if (aVal < bVal) return dir === 'asc' ? -1 : 1
      if (aVal > bVal) return dir === 'asc' ? 1 : -1
      return 0
    }

    // Multi-column sort
    if (sortColumns.length > 0) {
      result.sort((a, b) => {
        for (const { column: sortKey, dir } of sortColumns) {
          const aVal = getSortValue(a, sortKey)
          const bVal = getSortValue(b, sortKey)
          const comparison = compareValues(aVal, bVal, dir)
          if (comparison !== 0) return comparison
        }
        return 0
      })
    }

    return result
  }, [entries, search, filters, sortColumns, columnFilters, category, cascadeFilters, filterGroups, interGroupLogic, selectedComponents])

  // Collapse all top-level groups by default when groupByColumns changes
  useEffect(() => {
    const activeGroupColumns = groupByColumns.length > 0 ? groupByColumns : (groupByColumn ? [groupByColumn] : [])
    if (activeGroupColumns.length > 0 && filteredAndSorted.length > 0) {
      const topLevelGroups = new Set()

      // Helper to get display value for a column
      const getDisplayValue = (entry, colKey) => {
        const groupColumnDef = COLUMNS.find(c => c.key === colKey)
        const isLookupColumn = groupColumnDef?.column_type === 'lookup'
        const lookupOptions = isLookupColumn && groupColumnDef?.id ? (columnChoices[groupColumnDef.id] || []) : []
        const rawValue = entry[colKey]

        if (rawValue && typeof rawValue === 'object' && rawValue.display !== undefined) {
          return rawValue.display || '(empty)'
        } else if (isLookupColumn && rawValue != null && lookupOptions.length > 0) {
          const matchingOption = lookupOptions.find(opt =>
            opt.id === rawValue || parseInt(opt.id) === parseInt(rawValue)
          )
          return matchingOption?.display || `ID: ${rawValue}`
        }
        return rawValue ?? '(empty)'
      }

      // Collapse only top-level groups (first column)
      filteredAndSorted.forEach(entry => {
        const topLevelValue = getDisplayValue(entry, activeGroupColumns[0])
        topLevelGroups.add(topLevelValue)
      })
      setCollapsedGroups(topLevelGroups)
    }
  }, [groupByColumns, groupByColumn, columnChoices, COLUMNS]) // Also trigger when columnChoices loads

  // Multi-column sort handler
  // Regular click: single column sort (cycles asc -> desc -> clear)
  // Shift+click: add/toggle column in multi-sort
  const handleSort = (column, event) => {
    const isShiftKey = event?.shiftKey

    setSortColumns(prev => {
      const existingIndex = prev.findIndex(s => s.column === column)

      if (isShiftKey) {
        // Shift+click: add to multi-sort or toggle existing
        if (existingIndex >= 0) {
          const existing = prev[existingIndex]
          if (existing.dir === 'asc') {
            // Toggle to desc
            const newSort = [...prev]
            newSort[existingIndex] = { ...existing, dir: 'desc' }
            return newSort
          } else {
            // Remove from multi-sort
            return prev.filter((_, i) => i !== existingIndex)
          }
        } else {
          // Add new column to sort
          return [...prev, { column, dir: 'asc' }]
        }
      } else {
        // Regular click: single column sort
        if (existingIndex === 0 && prev.length === 1) {
          // Already primary sort, cycle through
          if (prev[0].dir === 'asc') {
            return [{ column, dir: 'desc' }]
          } else {
            return [] // Clear sort
          }
        } else {
          // Set as new primary sort
          return [{ column, dir: 'asc' }]
        }
      }
    })
  }

  // Sort icon showing direction and order number for multi-sort
  const SortIcon = ({ column }) => {
    const sortIndex = sortColumns.findIndex(s => s.column === column)
    if (sortIndex < 0) return null

    const sort = sortColumns[sortIndex]
    const showNumber = sortColumns.length > 1

    return (
      <span className="inline-flex items-center ml-1">
        {sort.dir === 'asc'
          ? <ChevronUpIcon className="w-4 h-4 text-white" />
          : <ChevronDownIcon className="w-4 h-4 text-white" />
        }
        {showNumber && (
          <span className="text-xs text-yellow-300 font-bold -ml-0.5">{sortIndex + 1}</span>
        )}
      </span>
    )
  }

  const uniqueChapters = useMemo(() => {
    const chapters = [...new Set(entries.map(e => e.chapter_number).filter(Boolean))].sort((a, b) => a - b)
    return chapters.map(num => ({ value: num, label: `Ch ${num}: ${CHAPTER_NAMES[num]}` }))
  }, [entries])

  const uniqueComponents = useMemo(() => {
    return [...new Set(entries.map(e => e.component).filter(Boolean))].sort()
  }, [entries])

  // Get unique values for any column - generic helper
  const getUniqueValuesForColumn = (columnKey) => {
    const columnDef = COLUMNS.find(c => c.key === columnKey)

    // For lookup columns, use columnChoices which has the display values
    if (columnDef?.column_type === 'lookup' && columnDef?.id) {
      const availableChoices = columnChoices[columnDef.id] || []
      // columnChoices for lookups are stored as {id, display} objects from API
      // Return them as-is since the dropdown renderer expects this format
      return availableChoices
    }

    // For choice columns, also include available choices (even if not used in data)
    if (columnDef?.column_type === 'choice' && columnDef?.id) {
      const availableChoices = columnChoices[columnDef.id] || []
      // Use the order from API (columnChoices), not alphabetical sort
      // This respects the saved choices_order from the database
      return availableChoices
    }

    // Get values from data
    const dataValues = [...new Set(entries.map(e => e[columnKey] || e.entry_type).filter(Boolean))]

    // For numeric columns or columns with numeric values, sort numerically
    const allNumbers = dataValues.every(v => typeof v === 'number' || !isNaN(parseFloat(v)))
    if (allNumbers) {
      return dataValues.sort((a, b) => parseFloat(a) - parseFloat(b))
    }

    // Default to alphabetical sort with natural number handling
    return dataValues.sort((a, b) => {
      const numA = parseInt(String(a).match(/\d+/)?.[0], 10)
      const numB = parseInt(String(b).match(/\d+/)?.[0], 10)
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB
      }
      return String(a).localeCompare(String(b))
    })
  }

  const getColumnLabel = (key) => {
    const column = COLUMNS.find(c => c.key === key)
    return column ? column.label : key
  }

  // Helper function to save a new view via API
  const saveNewView = async (viewData) => {
    try {
      // Defensive validation: ensure correct data types before saving
      const sortColumns = Array.isArray(viewData.sortColumns) ? viewData.sortColumns : []
      const groupByColumn = typeof viewData.groupByColumn === 'string' && viewData.groupByColumn.trim() !== ''
        ? viewData.groupByColumn
        : null

      const response = await api.post('/api/v1/foundation_views', {
        foundation_view: {
          foundation_id: foundationIdNumeric,
          name: viewData.name,
          view_type: 'custom',
          filters: {
            cascadeFilters: viewData.filters || [],
            filterGroups: viewData.filterGroups || [],
            interGroupLogic: viewData.interGroupLogic || 'AND'
          },
          columns: {
            visible: viewData.visibleColumns || {},
            order: viewData.columnOrder || [],
            showFilters: viewData.showFilters === undefined ? true : viewData.showFilters
          },
          sort_order: sortColumns,
          group_by_column: groupByColumn,
          is_default: viewData.isDefault || false
        }
      })

      if (response.success && response.view) {
        // Convert API response to frontend format and add to savedFilters
        const filters = response.view.filters || {}
        const columns = response.view.columns || {}

        const newView = {
          id: response.view.id,
          name: response.view.name,
          // Parse cascade filters structure
          filters: filters.cascadeFilters || [],
          filterGroups: filters.filterGroups || [],
          interGroupLogic: filters.interGroupLogic || 'AND',
          // Parse columns structure
          visibleColumns: columns.visible || {},
          columnOrder: columns.order || [],
          showFilters: columns.showFilters !== false, // default true
          sortColumns: Array.isArray(response.view.sort_order) ? response.view.sort_order : [],
          groupByColumn: response.view.group_by_column || null,
          display_order: 1, // New views go to position 2 (after the first/default view)
          isDefault: response.view.is_default || false
        }

        // Insert new view at position 1 (second position) and shift others down
        const reorderedFilters = [...savedFilters]
        reorderedFilters.splice(1, 0, newView) // Insert at index 1

        // Update display_order for all views
        const updatedFilters = reorderedFilters.map((v, idx) => ({
          ...v,
          display_order: idx
        }))

        setSavedFilters(updatedFilters)

        // Save new order to API in background
        const orders = updatedFilters.map(v => ({
          id: v.id,
          display_order: v.display_order
        }))

        api.post('/api/v1/foundation_views/reorder', { orders })
          .then(() => console.log('[Save View] View order updated - new view at position 2'))
          .catch(err => console.error('[Save View] Failed to save view order:', err))

        return newView
      } else {
        console.error('Failed to save view:', response.error)
        alert('Failed to save view: ' + (response.error || 'Unknown error'))
        return null
      }
    } catch (error) {
      console.error('Error saving view:', error)
      // Don't show alert for authentication errors (user is not logged in)
      if (error.response?.status === 401) {
        console.log('[Save View] Authentication required - user not logged in')
      } else {
        alert('Failed to save view: ' + (error.response?.data?.error || error.message))
      }
      return null
    }
  }

  // Helper function to update an existing view via API
  const updateView = async (viewId, viewData) => {
    try {
      console.log('[Update View] Sending column order to API:', viewData.columnOrder)

      // Defensive validation: ensure correct data types before saving
      const sortColumns = Array.isArray(viewData.sortColumns) ? viewData.sortColumns : []
      // Support both single groupByColumn (legacy) and groupByColumns array (new)
      const groupByColumns = Array.isArray(viewData.groupByColumns) ? viewData.groupByColumns : []
      const groupByColumn = groupByColumns[0] || (typeof viewData.groupByColumn === 'string' && viewData.groupByColumn.trim() !== '' ? viewData.groupByColumn : null)

      const response = await api.put(`/api/v1/foundation_views/${viewId}`, {
        foundation_view: {
          name: viewData.name,
          filters: {
            cascadeFilters: viewData.filters || [],
            filterGroups: viewData.filterGroups || [],
            interGroupLogic: viewData.interGroupLogic || 'AND'
          },
          columns: {
            visible: viewData.visibleColumns || {},
            order: viewData.columnOrder || [],
            showFilters: viewData.showFilters === undefined ? true : viewData.showFilters
          },
          sort_order: sortColumns,
          group_by_column: groupByColumn,  // Legacy single column (backward compatible)
          group_by_columns: groupByColumns,  // New array of columns
          is_default: viewData.isDefault || false
        }
      })
      console.log('[Update View] API response:', response)

      if (response.success && response.view) {
        // Update the view in savedFilters
        const filters = response.view.filters || {}
        const columns = response.view.columns || {}
        // Use group_by_columns array if available, otherwise fall back to single group_by_column
        const savedGroupByColumns = Array.isArray(response.view.group_by_columns) && response.view.group_by_columns.length > 0
          ? response.view.group_by_columns
          : (response.view.group_by_column ? [response.view.group_by_column] : [])

        setSavedFilters(savedFilters.map(v =>
          v.id === viewId ? {
            id: response.view.id,
            name: response.view.name,
            // Parse cascade filters structure
            filters: filters.cascadeFilters || [],
            filterGroups: filters.filterGroups || [],
            interGroupLogic: filters.interGroupLogic || 'AND',
            // Parse columns structure
            visibleColumns: columns.visible || {},
            columnOrder: columns.order || [],
            showFilters: columns.showFilters !== false, // default true
            sortColumns: Array.isArray(response.view.sort_order) ? response.view.sort_order : [],
            groupByColumn: response.view.group_by_column || null,  // Legacy single
            groupByColumns: savedGroupByColumns,  // New array
            isDefault: response.view.is_default || false
          } : v
        ))
        return true
      } else {
        console.error('Failed to update view:', response.error)
        alert('Failed to update view: ' + (response.error || 'Unknown error'))
        return false
      }
    } catch (error) {
      console.error('Error updating view:', error)
      // Don't show alert for authentication errors (user is not logged in)
      if (error.response?.status === 401) {
        console.log('[Update View] Authentication required - user not logged in')
      } else {
        alert('Failed to update view: ' + (error.response?.data?.error || error.message))
      }
      return false
    }
  }

  // Helper function to delete a view via API
  const deleteView = async (viewId) => {
    try {
      console.log('[Delete View] Deleting view:', viewId)
      const response = await api.delete(`/api/v1/foundation_views/${viewId}`)
      console.log('[Delete View] API response:', response)

      if (response.success) {
        console.log('[Delete View] Successfully deleted, updating state')
        console.log('[Delete View] Before:', savedFilters.length, 'views')
        setSavedFilters(savedFilters.filter(v => v.id !== viewId))
        console.log('[Delete View] After: should have', savedFilters.filter(v => v.id !== viewId).length, 'views')
        return true
      } else {
        console.error('Failed to delete view:', response.error)
        alert('Failed to delete view: ' + (response.error || 'Unknown error'))
        return false
      }
    } catch (error) {
      console.error('Error deleting view:', error)
      alert('Failed to delete view: ' + (error.response?.data?.error || error.message))
      return false
    }
  }

  // Auto-format function to fix phone and mobile numbers
  const autoFormatPhone = (value, type = 'mobile') => {
    if (!value) return value

    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '')

    if (type === 'mobile') {
      // Format Australian mobile: 0400 000 000
      if (digits.length === 10 && digits.startsWith('04')) {
        return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
      }
    } else if (type === 'phone') {
      // Format Australian landline: (02) 0000 0000
      if (digits.length === 10 && /^0[2-9]/.test(digits)) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)} ${digits.slice(6)}`
      }
      // Format 1300/1800 numbers: 1300 000 000
      if (digits.length === 10 && /^1[38]00/.test(digits)) {
        return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
      }
      // Handle 8-digit numbers - auto-detect area code
      if (digits.length === 8) {
        const areaCode = detectAreaCode(digits)
        if (areaCode) {
          return `(${areaCode}) ${digits.slice(0, 4)} ${digits.slice(4)}`
        }
      }
    }

    return value // Return original if can't format
  }

  // Detect area code based on 8-digit landline pattern
  const detectAreaCode = (eightDigits) => {
    const firstDigit = eightDigits[0]

    switch (firstDigit) {
      case '3':
        // Brisbane/QLD
        return '07'
      case '6':
        // Perth/WA (most common for 6xxx)
        return '08'
      case '8':
        // Check second digit for better accuracy
        const secondDigit = eightDigits[1]
        if (secondDigit === '8' || secondDigit === '9') {
          // Adelaide/Darwin
          return '08'
        }
        // Melbourne/VIC
        return '03'
      case '9':
        // Melbourne/VIC (most common for 9xxx)
        return '03'
      default:
        // Can't determine
        return null
    }
  }

  // Validation function to check if cell value is valid based on column type
  const isCellValid = (entry, columnKey, column) => {
    // Skip validation for special columns
    if (['select', 'id', 'user_id', 'created_at', 'updated_at'].includes(columnKey)) {
      return true
    }

    // Skip validation for computed columns
    if (column?.isComputed) {
      return true
    }

    // Skip validation if value is empty/null/undefined
    const value = entry[columnKey]
    if (value === null || value === undefined || value === '' || value === '-') {
      return true
    }

    // Get column type for validation
    const columnType = column?.column_type

    // Validate based on column type
    switch (columnType) {
      case 'email':
        // Validate email format
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

      case 'phone':
      case 'mobile':
        // Validate phone format (basic check for numbers and common phone chars)
        return /^[\d\s\-\+\(\)]+$/.test(value)

      case 'url':
        // Validate URL format - accept URLs with or without protocol
        try {
          // Try parsing as-is first
          new URL(value)
          return true
        } catch {
          // If it fails, try adding https:// protocol
          try {
            new URL(`https://${value}`)
            return true
          } catch {
            return false
          }
        }

      case 'number':
      case 'whole_number':
      case 'currency':
      case 'percentage':
        // Validate numeric fields
        return !isNaN(parseFloat(value))

      case 'date':
      case 'date_and_time':
        // Validate date format
        return !isNaN(Date.parse(value))

      default:
        // No specific validation for other types
        return true
    }
  }

  const renderCellContent = (entry, columnKey) => {
    switch (columnKey) {
      case 'select':
        return (
          <div
            className="flex items-center justify-center"
            onMouseDown={(e) => {
              // Start drag selection when clicking in the select column
              // Checkbox's stopPropagation prevents this when clicking checkbox directly
              e.preventDefault()
              handleDragSelectStart(entry.id)
            }}
            onMouseEnter={() => {
              if (isDragging) {
                handleDragSelectOver(entry.id)
              }
            }}
          >
            <input
              type="checkbox"
              checked={selectedRows.has(entry.id)}
              onChange={() => {}} // Handled by onMouseDown for drag support
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                e.stopPropagation()
                // Start drag selection from checkbox click
                handleDragSelectStart(entry.id)
              }}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
            />
          </div>
        )

      case 'category':
        const categoryColors = {
          bible: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          teacher: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          lexicon: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
        }
        const categoryIcons = {
          bible: '📖',
          teacher: '🔧',
          lexicon: '📕'
        }
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${categoryColors[entry.category] || 'bg-gray-100 text-gray-800'}`}>
            <span className="mr-1">{categoryIcons[entry.category]}</span>
            {entry.category}
          </span>
        )

      case 'chapter':
        return (
          <div className="truncate">
            <span className="font-medium">Ch {entry.chapter_number}</span>
            {CHAPTER_NAMES[entry.chapter_number] && (
              <span className="text-gray-500 dark:text-gray-400"> - {CHAPTER_NAMES[entry.chapter_number]}</span>
            )}
          </div>
        )

      case 'section':
        // Check if this is a Bible/Lexicon/Teacher entry with section_number
        if (entry.section_number !== undefined) {
          // This is Trinity documentation - use formatted section numbers
          if (!entry.section_number) {
            return <span className="text-gray-400">-</span>
          }

          // Format section number with category prefix: B01.001, L12.003, T05.001 (3-digit)
          let formattedSection = entry.section_number

          // Check if section_number already has a B/L/T prefix (2-digit or 3-digit)
          const alreadyHasPrefix = /^[BLT]\d{2}\.\d{2,3}$/.test(entry.section_number)

          if (alreadyHasPrefix) {
            // Already correctly formatted - use as is
            formattedSection = entry.section_number
          } else if (entry.section_number.startsWith('TEMP-')) {
            // Temporary number during migration - show as is
            formattedSection = entry.section_number
          } else {
            // Need to add prefix and padding
            const categoryPrefix = {
              'bible': 'B',
              'lexicon': 'L',
              'teacher': 'T'
            }[entry.category] || ''

            if (entry.section_number.includes('.')) {
              // Already has dot notation - add prefix and ensure padding
              const parts = entry.section_number.split('.')
              if (parts.length === 2) {
                const [chapter, section] = parts
                const chapterPadded = String(chapter).padStart(2, '0')
                // Use 3-digit section padding for consistency
                const sectionPadded = String(section).padStart(3, '0')
                formattedSection = `${categoryPrefix}${chapterPadded}.${sectionPadded}`
              }
            } else if (entry.section_number.includes('-')) {
              // Has hyphen - this is likely a range that was incorrectly stored
              // For now, display as-is but this indicates data quality issue
              formattedSection = entry.section_number
            }
          }

          return (
            <div className="font-mono font-medium text-indigo-700 dark:text-indigo-400">
              {formattedSection}
            </div>
          )
        }

        // Otherwise, this is Gold Standard - editable single line text field
        if (editingRowId === entry.id) {
          return (
            <input
              type="text"
              value={editingData.section || ''}
              onChange={(e) => setEditingData({ ...editingData, section: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              maxLength={255}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return entry.section || <span className="text-gray-400">-</span>

      case 'type':
        // Format type display: first letter capital, rest lowercase
        const formatType = (type) => {
          if (!type) return ''
          // Handle special cases with underscores
          if (type.includes('_')) {
            return type.split('_').map(word =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ')
          }
          // Standard: First letter uppercase, rest lowercase
          return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
        }

        return (
          <>
            {entry.entry_type === 'bug' && '🐛'}
            {entry.entry_type === 'architecture' && '🏛️'}
            {entry.entry_type === 'test' && '📊'}
            {entry.entry_type === 'note' && '🎓'}
            <span className="ml-1">{formatType(entry.entry_type)}</span>
          </>
        )

      case 'title':
        if (editingRowId === entry.id) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setTextEditField('title')
                setTextEditValue(editingData.title || '')
                setShowTextEditModal(true)
              }}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer truncate"
            >
              {editingData.title || 'Click to edit...'}
            </button>
          )
        }
        return <div className="truncate font-medium">{entry.title}</div>

      case 'content':
        if (editingRowId === entry.id) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setTextEditField('content')
                setTextEditValue(editingData.description || '')
                setShowTextEditModal(true)
              }}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer truncate"
            >
              {editingData.description || 'Click to edit...'}
            </button>
          )
        }

        // Show the primary content field based on category
        let contentText = ''
        if (entry.category === 'bible') {
          // Bible: show description or details
          contentText = entry.description || entry.details || entry.examples || ''
        } else if (entry.category === 'teacher') {
          // Teacher: show summary or description
          contentText = entry.summary || entry.description || entry.code_example || ''
        } else if (entry.category === 'lexicon') {
          // Lexicon: show scenario or description
          contentText = entry.scenario || entry.description || entry.solution || ''
        } else {
          // Fallback
          contentText = entry.description || entry.details || entry.summary || ''
        }

        // Strip HTML tags and truncate to reasonable length for table cell
        const stripHTML = (html) => {
          const tmp = document.createElement('div')
          tmp.innerHTML = html
          return tmp.textContent || tmp.innerText || ''
        }

        const plainText = stripHTML(contentText)
        const maxLength = 150
        const displayText = plainText.length > maxLength
          ? plainText.substring(0, maxLength) + '...'
          : plainText

        return (
          <div className="truncate text-gray-600 dark:text-gray-400">
            {displayText || '-'}
          </div>
        )

      case 'dense_index':
        const denseText = entry.dense_index || ''
        const maxDenseLength = 150
        const displayDense = denseText.length > maxDenseLength
          ? denseText.substring(0, maxDenseLength) + '...'
          : denseText

        return (
          <div className="truncate text-xs font-mono text-gray-500 dark:text-gray-500">
            {displayDense || '-'}
          </div>
        )

      case 'component':
        if (editingRowId === entry.id) {
          return (
            <input
              type="text"
              value={editingData.component || ''}
              onChange={(e) => setEditingData({ ...editingData, component: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return <span>{entry.component || '-'}</span>

      case 'status':
        if (editingRowId === entry.id) {
          return (
            <select
              value={editingData.status || entry.status || ''}
              onChange={(e) => setEditingData({ ...editingData, status: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                // Allow the dropdown to open
                e.stopPropagation()
              }}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option key="status-empty" value="">Select Status</option>
              <option key="status-open" value="open">⚡ Open</option>
              <option key="status-fixed" value="fixed">✅ Fixed</option>
              <option key="status-by-design" value="by_design">⚠️ By Design</option>
              <option key="status-monitoring" value="monitoring">🔄 Monitoring</option>
            </select>
          )
        }
        return (
          <span
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[entry.status]}`}
          >
            {STATUS_ICONS[entry.status]} {entry.status?.replace('_', ' ')}
          </span>
        )

      case 'severity':
        if (editingRowId === entry.id) {
          return (
            <select
              value={editingData.severity || entry.severity || ''}
              onChange={(e) => setEditingData({ ...editingData, severity: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                // Allow the dropdown to open
                e.stopPropagation()
              }}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option key="severity-empty" value="">Select Severity</option>
              <option key="severity-low" value="low">Low</option>
              <option key="severity-medium" value="medium">Medium</option>
              <option key="severity-high" value="high">High</option>
              <option key="severity-critical" value="critical">Critical</option>
            </select>
          )
        }
        return (
          <span
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${SEVERITY_COLORS[entry.severity]}`}
          >
            {entry.severity}
          </span>
        )

      case 'audit':
      case 'updated_at':
      case 'created_at':
        // Check if this is Trinity documentation (Bible/Lexicon/Teacher)
        if (entry.section_number !== undefined) {
          // This is Trinity documentation - use read-only formatted date
          if (!entry.updated_at) {
            return <span className="text-gray-400 text-xs">Never</span>
          }

          // Format date only (no time)
          const updatedDate = new Date(entry.updated_at)
          const formattedDate = updatedDate.toLocaleDateString('en-AU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })

          return (
            <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              {formattedDate}
            </div>
          )
        }

        // Otherwise, this is Gold Standard - editable date picker
        if (editingRowId === entry.id) {
          // Convert datetime to YYYY-MM-DD format for date input
          const dateValue = editingData[columnKey]
            ? new Date(editingData[columnKey]).toISOString().split('T')[0]
            : ''

          return (
            <input
              type="date"
              value={dateValue}
              onChange={(e) => {
                // Convert back to ISO datetime string when saving
                const dateStr = e.target.value
                if (dateStr) {
                  const date = new Date(dateStr)
                  setEditingData({ ...editingData, [columnKey]: date.toISOString() })
                } else {
                  setEditingData({ ...editingData, [columnKey]: null })
                }
              }}
              onClick={(e) => {
                e.stopPropagation()
                e.target.showPicker && e.target.showPicker() // Show calendar picker on click
              }}
              onFocus={(e) => {
                e.target.showPicker && e.target.showPicker() // Show calendar picker on focus
              }}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
          )
        }

        // In edit mode but not editing this row - show white box to indicate it's clickable
        if (editModeActive && editingRowId !== entry.id) {
          return (
            <div className="px-2 py-1 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 cursor-pointer">
              {entry[columnKey] ? (
                <span className="text-sm text-gray-900 dark:text-white">
                  {new Date(entry[columnKey]).toLocaleDateString('en-AU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </span>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          )
        }

        // Display formatted date (when not in edit mode)
        if (entry[columnKey]) {
          const date = new Date(entry[columnKey])
          return (
            <div className="text-sm text-gray-900 dark:text-white">
              {date.toLocaleDateString('en-AU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}
            </div>
          )
        }
        return <span className="text-gray-400">-</span>

      case 'document_link':
        // URL column - editable in edit mode
        if (editingRowId === entry.id) {
          return (
            <input
              type="url"
              value={editingData.document_link || ''}
              onChange={(e) => setEditingData({ ...editingData, document_link: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              placeholder="https://example.com"
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          )
        }

        if (!entry.document_link) {
          return <span className="text-gray-400 text-xs">-</span>
        }

        return (
          <a
            href={entry.document_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open Document
          </a>
        )

      case 'actions': // Column key 'actions' - check column_type for full buttons vs view-only
      case 'action_buttons':
        // Action buttons - View only when viewOnly=true, otherwise View/Edit/Delete
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (onView) {
                  onView(entry)
                } else if (onRowDoubleClick) {
                  onRowDoubleClick(entry)
                } else {
                  setModalEditData({...entry})
                  setShowEditableModal(true)
                }
              }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
              title="View"
            >
              <EyeIcon className="h-4 w-4" />
            </button>
            {onEditRelationships && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEditRelationships(entry)
                }}
                className="p-1.5 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded transition-colors"
                title="Edit Relationships"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </button>
            )}
            {!viewOnly && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setModalEditData({...entry})
                    setShowEditableModal(true)
                  }}
                  className="p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded transition-colors"
                  title="Edit"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onDelete && confirm('Are you sure you want to delete this record?')) {
                      onDelete(entry)
                    }
                  }}
                  className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )

      case 'price':
        // Currency column - right-aligned with AUD formatting
        if (editingRowId === entry.id) {
          return (
            <input
              type="number"
              step="0.01"
              value={editingData.price || ''}
              onChange={(e) => setEditingData({ ...editingData, price: parseFloat(e.target.value) || 0 })}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-right"
            />
          )
        }
        return (
          <div className="text-right font-medium">
            {entry.price != null ? new Intl.NumberFormat('en-AU', {
              style: 'currency',
              currency: 'AUD'
            }).format(entry.price) : '-'}
          </div>
        )

      case 'number':
      case 'quantity':
      case 'whole_number':
        // Number column - right-aligned
        if (editingRowId === entry.id) {
          return (
            <input
              type="number"
              step={columnKey === 'whole_number' ? '1' : 'any'}
              value={editingData[columnKey] ?? ''}
              onChange={(e) => {
                const value = e.target.value
                // Store the raw value to allow typing decimals
                setEditingData({ ...editingData, [columnKey]: value })
              }}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-right"
            />
          )
        }
        return (
          <div className="text-right font-medium">
            {entry[columnKey] != null ? entry[columnKey].toLocaleString('en-AU') : '-'}
          </div>
        )

      case 'currency':
        // Currency column - right-aligned with $ sign
        if (editingRowId === entry.id) {
          return (
            <div className="relative flex items-center">
              <span className="absolute left-2 text-gray-500 dark:text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                value={editingData[columnKey] ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  setEditingData({ ...editingData, [columnKey]: value })
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                className="w-full pl-6 pr-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-right"
              />
            </div>
          )
        }
        return (
          <div className="text-right font-medium">
            {entry[columnKey] != null ? `$${parseFloat(entry[columnKey]).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
          </div>
        )

      case 'percentage':
        // Percentage column - right-aligned with % sign
        if (editingRowId === entry.id) {
          return (
            <div className="relative flex items-center">
              <input
                type="number"
                step="0.01"
                value={editingData[columnKey] ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  setEditingData({ ...editingData, [columnKey]: value })
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                className="w-full pr-6 pl-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-right"
              />
              <span className="absolute right-2 text-gray-500 dark:text-gray-400">%</span>
            </div>
          )
        }
        return (
          <div className="text-right font-medium">
            {entry[columnKey] != null ? `${parseFloat(entry[columnKey]).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '-'}
          </div>
        )

      case 'date':
        // Date column with calendar picker
        if (editingRowId === entry.id) {
          return (
            <input
              type="date"
              value={editingData[columnKey] ?? ''}
              onChange={(e) => {
                const value = e.target.value
                setEditingData({ ...editingData, [columnKey]: value })
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return (
          <div>
            {entry[columnKey] ? new Date(entry[columnKey]).toLocaleDateString('en-AU') : '-'}
          </div>
        )

      case 'date_and_time':
        // Date and time column with datetime picker
        if (editingRowId === entry.id) {
          return (
            <input
              type="datetime-local"
              value={editingData[columnKey] ?? ''}
              onChange={(e) => {
                const value = e.target.value
                setEditingData({ ...editingData, [columnKey]: value })
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return (
          <div>
            {entry[columnKey] ? new Date(entry[columnKey]).toLocaleString('en-AU') : '-'}
          </div>
        )

      case 'gps_coordinates':
        // GPS coordinates with picker button
        if (editingRowId === entry.id) {
          return (
            <div className="flex items-center gap-1 min-w-0">
              <input
                type="text"
                value={editingData[columnKey] ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  setEditingData({ ...editingData, [columnKey]: value })
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                placeholder="lat, lng (e.g., -27.4705, 153.0260)"
                className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  // Parse existing coordinates or use default
                  const existing = editingData[columnKey] || ''
                  const [lat, lng] = existing.split(',').map(s => parseFloat(s.trim()))
                  if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                    setGpsModalCoords({ lat, lng })
                  }
                  setShowGpsModal(true)
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex-shrink-0"
                title="Open location picker"
              >
                📍 Pick
              </button>
            </div>
          )
        }
        // Display mode - show coordinates with Google Maps link
        if (entry[columnKey]) {
          const coords = entry[columnKey]
          const [lat, lng] = coords.split(',').map(s => s.trim())
          if (lat && lng) {
            return (
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                {coords}
              </a>
            )
          }
          return <span>{coords}</span>
        }
        return <span className="text-gray-400">-</span>

      case 'color_picker':
        // Color picker with button to open modal
        if (editingRowId === entry.id) {
          const colorValue = editingData[columnKey] || '#000000'
          return (
            <div className="flex items-center gap-2">
              {/* Color preview and picker button */}
              <div
                className="h-8 w-12 rounded border-2 border-gray-400 dark:border-gray-500 flex-shrink-0"
                style={{ backgroundColor: colorValue }}
                title={colorValue}
              />
              {/* Hex input field */}
              <input
                type="text"
                value={colorValue}
                onChange={(e) => {
                  let value = e.target.value
                  // Auto-add # if not present
                  if (value && !value.startsWith('#')) {
                    value = '#' + value
                  }
                  // Validate hex format
                  if (!value || /^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                    setEditingData({ ...editingData, [columnKey]: value })
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                placeholder="#000000"
                className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono"
                maxLength={7}
              />
              {/* Pick button to open modal */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setColorModalValue(colorValue)
                  setShowColorModal(true)
                }}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex-shrink-0"
                title="Open color picker"
              >
                🎨 Pick
              </button>
            </div>
          )
        }
        // Display mode - show color swatch with hex value
        if (entry[columnKey]) {
          const color = entry[columnKey]
          return (
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: color }}
                title={color}
              />
              <span className="text-sm font-mono">{color}</span>
            </div>
          )
        }
        return <span className="text-gray-400">-</span>

      case 'file_upload':
        // File upload column with modal picker
        if (editingRowId === entry.id) {
          const fileValue = editingData[columnKey] || ''
          return (
            <div className="flex items-center gap-2 min-w-0">
              {/* Display current file path */}
              <input
                type="text"
                value={fileValue}
                onChange={(e) => {
                  const value = e.target.value
                  setEditingData({ ...editingData, [columnKey]: value })
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                placeholder="No file selected"
                className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              {/* Browse button to open modal */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setFileModalValue(fileValue)
                  setSelectedFile(null)
                  setFileModalTab('upload')
                  setShowFileModal(true)
                }}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex-shrink-0 flex items-center gap-1"
                title="Browse files"
              >
                📎 Browse
              </button>
            </div>
          )
        }
        // Display mode - show file link with icon
        if (entry[columnKey]) {
          const filePath = entry[columnKey]
          const fileName = filePath.split('/').pop() || filePath
          const fileExt = fileName.split('.').pop()?.toLowerCase() || ''

          // Determine file icon based on extension
          let fileIcon = '📄' // Default document
          if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(fileExt)) {
            fileIcon = '🖼️'
          } else if (['pdf'].includes(fileExt)) {
            fileIcon = '📕'
          } else if (['doc', 'docx'].includes(fileExt)) {
            fileIcon = '📘'
          } else if (['xls', 'xlsx', 'csv'].includes(fileExt)) {
            fileIcon = '📊'
          } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExt)) {
            fileIcon = '📦'
          }

          return (
            <a
              href={filePath}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline text-sm flex items-center gap-1 hover:text-blue-800 dark:hover:text-blue-300"
              onClick={(e) => e.stopPropagation()}
              title={`Download: ${fileName}`}
            >
              <span>{fileIcon}</span>
              <span className="truncate max-w-[200px]">{fileName}</span>
            </a>
          )
        }
        return <span className="text-gray-400">No file</span>

      case 'email':
        // Email column with mailto link
        if (editingRowId === entry.id) {
          const emailValue = editingData.email || ''
          const isValidEmail = !emailValue || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)
          const hasValue = emailValue.length > 0

          return (
            <div className="w-full">
              <div className="relative flex items-center">
                <input
                  type="email"
                  value={emailValue}
                  onChange={(e) => {
                    const value = e.target.value
                    setEditingData({ ...editingData, email: value })

                    // Validate email format
                    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                      setValidationErrors({ ...validationErrors, email: 'Invalid email format' })
                    } else {
                      const newErrors = { ...validationErrors }
                      delete newErrors.email
                      setValidationErrors(newErrors)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                  className={`w-full px-2 py-1 pr-8 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 transition-all ${
                    !isValidEmail
                      ? 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/20 animate-pulse'
                      : hasValue
                      ? 'border-green-500 focus:ring-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-blue-500 focus:ring-blue-500'
                  }`}
                />
                {/* Clickable mailto link overlaid on valid email */}
                {isValidEmail && hasValue && (
                  <a
                    href={`mailto:${emailValue}`}
                    className="absolute left-2 right-10 text-sm text-blue-600 dark:text-blue-400 underline pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {emailValue}
                  </a>
                )}
                {/* Green checkmark for valid email */}
                {isValidEmail && hasValue && (
                  <svg
                    className="absolute right-2 h-5 w-5 text-green-600 dark:text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              {/* Error message for invalid email */}
              {!isValidEmail && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-0.5 font-semibold">
                  Invalid email format
                </div>
              )}
            </div>
          )
        }
        // View mode - render email with mailto link
        return entry.email ? (
          <a
            href={`mailto:${entry.email}`}
            className="text-blue-600 dark:text-blue-400 underline"
            onClick={(e) => e.stopPropagation()}
          >
            {entry.email}
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        )

      case 'phone':
        // Landline phone column with tel link
        if (editingRowId === entry.id) {
          return (
            <input
              type="tel"
              value={editingData.phone || ''}
              onChange={(e) => {
                setEditingData({ ...editingData, phone: e.target.value })
              }}
              onBlur={(e) => {
                // Auto-format on blur
                const formatted = autoFormatPhone(e.target.value, 'phone')
                setEditingData({ ...editingData, phone: formatted })
              }}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              placeholder="(03) 9123 4567"
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return entry.phone ? (
          <a
            href={`tel:${entry.phone.replace(/[\s()]/g, '')}`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {entry.phone}
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        )

      case 'mobile':
        // Mobile phone column with tel link
        if (editingRowId === entry.id) {
          return (
            <input
              type="tel"
              value={editingData.mobile || ''}
              onChange={(e) => {
                setEditingData({ ...editingData, mobile: e.target.value })
              }}
              onBlur={(e) => {
                // Auto-format on blur
                const formatted = autoFormatPhone(e.target.value, 'mobile')
                setEditingData({ ...editingData, mobile: formatted })
              }}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              placeholder="0407 397 541"
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          )
        }
        return entry.mobile ? (
          <a
            href={`tel:${entry.mobile.replace(/\s/g, '')}`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {entry.mobile}
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        )

      case 'is_active':
        // Boolean column with toggle-style indicator
        const isActive = editingRowId === entry.id ? editingData.is_active : entry.is_active

        return (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (editingRowId === entry.id) {
                  // In edit mode: toggle the value
                  setEditingData({ ...editingData, is_active: !editingData.is_active })
                }
              }}
              disabled={editingRowId !== entry.id}
              className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors ${
                isActive
                  ? 'bg-green-500 dark:bg-green-600'
                  : 'bg-red-400 dark:bg-red-500'
              } ${editingRowId === entry.id ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        )

      case 'discount':
        // Percentage column - right-aligned with % symbol
        if (editingRowId === entry.id) {
          return (
            <input
              type="number"
              step="0.1"
              value={editingData.discount || ''}
              onChange={(e) => setEditingData({ ...editingData, discount: parseFloat(e.target.value) || 0 })}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-right"
            />
          )
        }
        return (
          <div className="text-right font-medium">
            {entry.discount != null ? `${entry.discount}%` : '-'}
          </div>
        )

      case 'total_cost':
        // Computed column - calculated value (e.g., price × quantity)
        // Find the column definition to get the compute function
        const column = COLUMNS.find(col => col.key === columnKey)
        if (column?.isComputed && column?.computeFunction) {
          const computedValue = column.computeFunction(entry)
          return (
            <div className="text-right font-medium bg-blue-50 dark:bg-blue-900/20">
              {computedValue != null ? new Intl.NumberFormat('en-AU', {
                style: 'currency',
                currency: 'AUD'
              }).format(computedValue) : '-'}
            </div>
          )
        }
        return <span className="text-gray-400">-</span>

      case 'boolean':
        // Boolean column with toggle switch (green = checked/true, gray = unchecked/false)
        // Always clickable - toggles immediately and saves
        const boolValue = editingRowId === entry.id ? editingData[columnKey] : entry[columnKey]

        return (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation()
                const newValue = !boolValue

                if (editingRowId === entry.id) {
                  // If already in edit mode, just update editingData
                  setEditingData({ ...editingData, [columnKey]: newValue })
                } else {
                  // Not in edit mode: toggle and save immediately
                  const updatedEntry = { ...entry, [columnKey]: newValue }

                  // If onEdit callback exists, call it to save the change
                  if (onEdit) {
                    try {
                      await onEdit(updatedEntry)
                    } catch (error) {
                      console.error('Failed to update boolean value:', error)
                    }
                  }
                }
              }}
              className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors cursor-pointer ${
                boolValue
                  ? 'bg-green-500 dark:bg-green-600 hover:bg-green-600 dark:hover:bg-green-700'
                  : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
              title={boolValue ? 'Click to uncheck' : 'Click to check'}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                boolValue ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        )

      case 'choice':
        // Choice/dropdown column with predefined options
        if (editingRowId === entry.id) {
          // Get available choices for this column
          const columnDef = COLUMNS.find(c => c.key === columnKey)
          const availableChoices = columnDef?.id ? (columnChoices[columnDef.id] || []) : []
          console.log('🎯 [CASE CHOICE] Rendering dropdown for column', columnKey, 'columnDef.id:', columnDef?.id, 'with choices:', availableChoices)

          return (
            <select
              value={editingData[columnKey] || ''}
              onChange={(e) => {
                const value = e.target.value
                setEditingData({ ...editingData, [columnKey]: value })
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              {availableChoices.length > 0 ? (
                availableChoices.map(choice => {
                  // Handle both string choices and object choices (from lookups)
                  const choiceValue = typeof choice === 'object' ? (choice.id || choice.display) : choice
                  const choiceLabel = typeof choice === 'object' ? choice.display : choice
                  return (
                    <option key={choiceValue} value={choiceValue}>{choiceLabel}</option>
                  )
                })
              ) : (
                <>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                  <option value="archived">Archived</option>
                </>
              )}
            </select>
          )
        }
        // Display mode - show the value with color coding
        const choiceValue = entry[columnKey]
        const choiceColors = {
          'active': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          'inactive': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
          'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
          'archived': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
        }
        return (
          <div className="flex justify-center">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${choiceColors[choiceValue] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
              {choiceValue || '-'}
            </span>
          </div>
        )

      case 'user':
        // User column - displays user information with dropdown selector
        if (editingRowId === entry.id) {
          // In edit mode: show dropdown to select user
          return (
            <select
              value={editingData[columnKey] || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : null
                setEditingData({ ...editingData, [columnKey]: value })
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select user...</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email || `User #${user.id}`}
                </option>
              ))}
            </select>
          )
        }
        // Display mode - show user info with avatar
        const userId = entry[columnKey]
        if (userId) {
          const user = getUserById(userId)
          if (user) {
            const displayName = user.name || user.email || 'Unknown User'
            return (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{displayName}</span>
              </div>
            )
          }
          // User ID exists but user not found in list
          return (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 bg-gray-400 text-white rounded-full text-xs font-bold">
                ?
              </div>
              <span className="text-gray-500 text-xs">User #{userId}</span>
            </div>
          )
        }
        return (
          <div className="text-center text-gray-400 text-xs">-</div>
        )

      default:
        // Generic handler for all other columns - make them editable in edit mode
        const value = entry[columnKey]

        // Get column definition to check if it's computed
        const columnDef = COLUMNS.find(col => col.key === columnKey)
        const isSystemColumn = columnKey === 'id' || columnKey === 'user_id'
        const isComputedColumn = columnDef?.isComputed
        const columnType = columnDef?.column_type

        // Handle column_type-based rendering for dynamic columns (e.g., from API)
        // This allows columns like 'contract_value' with type 'currency' to render correctly
        if (columnType === 'currency') {
          if (editingRowId === entry.id) {
            return (
              <div className="relative flex items-center">
                <span className="absolute left-2 text-gray-500 dark:text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={editingData[columnKey] ?? ''}
                  onChange={(e) => setEditingData({ ...editingData, [columnKey]: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                  className="w-full pl-6 pr-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-right"
                />
              </div>
            )
          }
          return (
            <div className="text-right font-medium">
              {entry[columnKey] != null ? `$${parseFloat(entry[columnKey]).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
            </div>
          )
        }

        if (columnType === 'percentage') {
          if (editingRowId === entry.id) {
            return (
              <div className="relative flex items-center">
                <input
                  type="number"
                  step="0.01"
                  value={editingData[columnKey] ?? ''}
                  onChange={(e) => setEditingData({ ...editingData, [columnKey]: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                  className="w-full pr-6 pl-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-right"
                />
                <span className="absolute right-2 text-gray-500 dark:text-gray-400">%</span>
              </div>
            )
          }
          return (
            <div className="text-right font-medium">
              {entry[columnKey] != null ? `${parseFloat(entry[columnKey]).toFixed(2)}%` : '-'}
            </div>
          )
        }

        if (columnType === 'number' || columnType === 'whole_number') {
          if (editingRowId === entry.id) {
            return (
              <input
                type="number"
                step={columnType === 'whole_number' ? '1' : 'any'}
                value={editingData[columnKey] ?? ''}
                onChange={(e) => setEditingData({ ...editingData, [columnKey]: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-right"
              />
            )
          }
          return (
            <div className="text-right font-medium">
              {entry[columnKey] != null ? entry[columnKey].toLocaleString('en-AU') : '-'}
            </div>
          )
        }

        if (columnType === 'date') {
          if (editingRowId === entry.id) {
            return (
              <input
                type="date"
                value={editingData[columnKey] || ''}
                onChange={(e) => setEditingData({ ...editingData, [columnKey]: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            )
          }
          // Format date for display
          if (entry[columnKey]) {
            const date = new Date(entry[columnKey])
            return <span>{date.toLocaleDateString('en-AU')}</span>
          }
          return <span className="text-gray-400">-</span>
        }

        if (columnType === 'date_and_time') {
          if (editingRowId === entry.id) {
            return (
              <input
                type="datetime-local"
                value={editingData[columnKey] || ''}
                onChange={(e) => setEditingData({ ...editingData, [columnKey]: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            )
          }
          // Format datetime for display
          if (entry[columnKey]) {
            const date = new Date(entry[columnKey])
            return <span>{date.toLocaleDateString('en-AU')} {date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>
          }
          return <span className="text-gray-400">-</span>
        }

        if (columnType === 'email') {
          if (editingRowId === entry.id) {
            return (
              <input
                type="email"
                value={editingData[columnKey] || ''}
                onChange={(e) => setEditingData({ ...editingData, [columnKey]: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            )
          }
          return entry[columnKey] ? (
            <a href={`mailto:${entry[columnKey]}`} className="text-blue-600 dark:text-blue-400 underline" onClick={(e) => e.stopPropagation()}>
              {entry[columnKey]}
            </a>
          ) : <span className="text-gray-400">-</span>
        }

        if (columnType === 'phone') {
          if (editingRowId === entry.id) {
            return (
              <input
                type="tel"
                value={editingData[columnKey] || ''}
                onChange={(e) => setEditingData({ ...editingData, [columnKey]: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
                className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            )
          }
          return entry[columnKey] ? (
            <a href={`tel:${entry[columnKey].replace(/[\s()]/g, '')}`} className="text-blue-600 dark:text-blue-400 hover:underline" onClick={(e) => e.stopPropagation()}>
              {entry[columnKey]}
            </a>
          ) : <span className="text-gray-400">-</span>
        }

        if (columnType === 'lookup' || columnType === 'link_to_another_record') {
          // Edit mode - show dropdown with lookup options from linked table
          if (editingRowId === entry.id) {
            const columnDef = COLUMNS.find(c => c.key === columnKey)
            const lookupOptions = columnDef?.id ? (columnChoices[columnDef.id] || []) : []
            console.log('🔗 Rendering lookup dropdown for column', columnKey, 'with options:', lookupOptions)

            // Check if lookupOptions are objects {id, display} or just strings (fallback)
            const isObjectFormat = lookupOptions.length > 0 && typeof lookupOptions[0] === 'object'

            // Get the current value - handle both object format from API and direct ID
            const currentValue = editingData[columnKey]
            const selectValue = typeof currentValue === 'object' ? currentValue?.id : currentValue

            return (
              <select
                value={selectValue || ''}
                onChange={(e) => {
                  const value = e.target.value
                  setEditingData({ ...editingData, [columnKey]: value })
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                {lookupOptions.map((option, idx) => {
                  // Handle both object format {id, display} and string format
                  if (option && typeof option === 'object') {
                    return <option key={option.id ?? idx} value={option.id}>{option.display ?? option.id ?? '-'}</option>
                  }
                  // String or primitive format
                  return <option key={option ?? idx} value={option}>{option}</option>
                })}
              </select>
            )
          }

          // Display mode - render lookup value as text
          // The API returns lookup values as {id, display} objects
          if (entry[columnKey]) {
            const entryValue = entry[columnKey]

            // Handle object format from API (e.g., {id: 1, display: "House"})
            if (typeof entryValue === 'object' && entryValue !== null) {
              return (
                <span className="text-gray-900 dark:text-white">
                  {entryValue.display || entryValue.id || '-'}
                </span>
              )
            }

            // Handle raw ID - look up display value from columnChoices
            const columnDef = COLUMNS.find(c => c.key === columnKey)
            const lookupOptions = columnDef?.id ? (columnChoices[columnDef.id] || []) : []
            const isObjectFormat = lookupOptions.length > 0 && typeof lookupOptions[0] === 'object'

            let displayValue = entryValue
            if (isObjectFormat) {
              const entryId = parseInt(entryValue)
              const matchingOption = lookupOptions.find(opt => parseInt(opt.id) === entryId)
              if (matchingOption) {
                displayValue = matchingOption.display
              }
            }

            return (
              <span className="text-gray-900 dark:text-white">
                {displayValue}
              </span>
            )
          }
          return <span className="text-gray-400">-</span>
        }

        if (columnType === 'multiple_lookups') {
          // Edit mode - show checkbox list with lookup options from linked table
          if (editingRowId === entry.id) {
            const columnDef = COLUMNS.find(c => c.key === columnKey)
            const lookupOptions = columnDef?.id ? (columnChoices[columnDef.id] || []) : []
            console.log('🔗 Rendering multiple_lookups checkboxes for column', columnKey, 'with options:', lookupOptions)

            // Check if lookupOptions are objects {id, display} or just strings (fallback)
            const isObjectFormat = lookupOptions.length > 0 && typeof lookupOptions[0] === 'object'

            // Parse the current value (stored as JSON array of IDs)
            let currentValues = []
            try {
              const rawValue = editingData[columnKey]
              if (typeof rawValue === 'string') {
                currentValues = JSON.parse(rawValue)
              } else if (Array.isArray(rawValue)) {
                currentValues = rawValue
              }
            } catch (e) {
              console.error('Error parsing multiple_lookups value:', e)
            }

            const handleCheckboxChange = (optionId) => {
              const id = parseInt(optionId)
              let newValues = [...currentValues.map(v => parseInt(v))]

              if (newValues.includes(id)) {
                newValues = newValues.filter(v => v !== id)
              } else {
                newValues.push(id)
              }

              setEditingData({ ...editingData, [columnKey]: JSON.stringify(newValues) })
            }

            // Filter options based on search (using component-level state)
            const filteredOptions = lookupOptions.filter(option => {
              if (!lookupSearch) return true
              const displayValue = isObjectFormat ? option.display : option
              return displayValue.toLowerCase().includes(lookupSearch.toLowerCase())
            })

            return (
              <div
                className="w-full border border-blue-500 rounded bg-white dark:bg-gray-800"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Search Input */}
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={lookupSearch}
                    onChange={(e) => setLookupSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Checkbox List */}
                <div className="max-h-48 overflow-y-auto p-2">
                  {filteredOptions.length === 0 ? (
                    <p className="text-gray-400 text-sm">
                      {lookupSearch ? 'No matches found' : 'No options available'}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {isObjectFormat ? (
                        filteredOptions.map(option => {
                          const isChecked = currentValues.map(v => parseInt(v)).includes(parseInt(option.id))
                          return (
                            <label
                              key={option.id}
                              className="flex items-center gap-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleCheckboxChange(option.id)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-900 dark:text-white">{option.display}</span>
                            </label>
                          )
                        })
                      ) : (
                        filteredOptions.map(option => {
                          const isChecked = currentValues.includes(option)
                          return (
                            <label
                              key={option}
                              className="flex items-center gap-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleCheckboxChange(option)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-900 dark:text-white">{option}</span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Selected count */}
                {currentValues.length > 0 && (
                  <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {currentValues.length} selected
                    </span>
                  </div>
                )}
              </div>
            )
          }

          // Display mode - render multiple lookup values as badges
          if (entry[columnKey]) {
            const columnDef = COLUMNS.find(c => c.key === columnKey)
            const lookupOptions = columnDef?.id ? (columnChoices[columnDef.id] || []) : []
            const isObjectFormat = lookupOptions.length > 0 && typeof lookupOptions[0] === 'object'

            // Parse the stored JSON array of IDs
            let selectedIds = []
            try {
              const rawValue = entry[columnKey]
              if (typeof rawValue === 'string') {
                selectedIds = JSON.parse(rawValue)
              } else if (Array.isArray(rawValue)) {
                selectedIds = rawValue
              }
            } catch (e) {
              console.error('Error parsing multiple_lookups value:', e)
            }

            if (selectedIds.length === 0) {
              return <span className="text-gray-400">-</span>
            }

            // Look up display values for each ID
            const displayValues = selectedIds.map(id => {
              if (isObjectFormat) {
                const entryId = parseInt(id)
                const matchingOption = lookupOptions.find(opt => parseInt(opt.id) === entryId)
                return matchingOption ? matchingOption.display : id
              }
              return id
            })

            return (
              <div className="flex flex-wrap gap-1">
                {displayValues.map((displayValue, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {displayValue}
                  </span>
                ))}
              </div>
            )
          }
          return <span className="text-gray-400">-</span>
        }

        if (columnType === 'choice') {
          // Edit mode - show dropdown with available choices
          if (editingRowId === entry.id) {
            const columnDef = COLUMNS.find(c => c.key === columnKey)
            const availableChoices = columnDef?.id ? (columnChoices[columnDef.id] || []) : []
            console.log('🎯 Rendering dropdown for column', columnKey, 'with choices:', availableChoices)

            return (
              <select
                value={editingData[columnKey] || ''}
                onChange={(e) => {
                  const value = e.target.value
                  setEditingData({ ...editingData, [columnKey]: value })
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                {availableChoices.map(choice => {
                  // Handle both string choices and object choices (from lookups)
                  const choiceValue = typeof choice === 'object' ? (choice.id || choice.display) : choice
                  const choiceLabel = typeof choice === 'object' ? choice.display : choice
                  return (
                    <option key={choiceValue} value={choiceValue}>{choiceLabel}</option>
                  )
                })}
              </select>
            )
          }

          // Display mode - render choice as badge
          if (entry[columnKey]) {
            // Handle object format (from API) vs string
            const choiceDisplayValue = typeof entry[columnKey] === 'object'
              ? (entry[columnKey].display || entry[columnKey].id)
              : entry[columnKey]
            return (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                {choiceDisplayValue}
              </span>
            )
          }
          return <span className="text-gray-400">-</span>
        }

        // Boolean column type - render as tick/cross icons
        if (columnType === 'boolean') {
          const boolValue = editingRowId === entry.id ? editingData[columnKey] : entry[columnKey]

          // View-only mode: just show tick or cross
          if (viewOnly) {
            return (
              <div className="flex justify-center">
                {boolValue ? (
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
            )
          }

          // Editable mode: clickable tick/cross that toggles on click
          return (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation()
                  const newValue = !boolValue

                  if (editingRowId === entry.id) {
                    // If already in edit mode, just update editingData
                    setEditingData({ ...editingData, [columnKey]: newValue })
                  } else {
                    // Not in edit mode: toggle and save immediately
                    const updatedEntry = { ...entry, [columnKey]: newValue }

                    // If onEdit callback exists, call it to save the change
                    if (onEdit) {
                      try {
                        await onEdit(updatedEntry)
                      } catch (error) {
                        console.error('Failed to update boolean value:', error)
                      }
                    }
                  }
                }}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                title={boolValue ? 'Click to uncheck' : 'Click to check'}
              >
                {boolValue ? (
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>
          )
        }

        // Check if this is a long text field that should have expand button
        const isLongTextField = ['description', 'details', 'summary', 'notes', 'scenario', 'solution', 'examples', 'code_example', 'common_mistakes'].includes(columnKey)

        if (editingRowId === entry.id && !isSystemColumn && !isComputedColumn) {
          // In edit mode: show editable input with optional expand button for long text
          if (isLongTextField) {
            return (
              <div className="flex items-center gap-1 w-full">
                <input
                  type="text"
                  value={editingData[columnKey] || ''}
                  onChange={(e) => setEditingData({ ...editingData, [columnKey]: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setTextEditField(columnKey)
                    setTextEditValue(editingData[columnKey] || '')
                    setShowTextEditModal(true)
                  }}
                  className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors flex-shrink-0"
                  title="Open in large editor"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
            )
          }

          // For email fields: add validation
          if (columnKey === 'email') {
            const emailValue = editingData[columnKey] || ''
            const isValidEmail = !emailValue || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)
            const hasValue = emailValue.length > 0

            return (
              <div className="w-full relative">
                <input
                  type="email"
                  value={emailValue}
                  onChange={(e) => {
                    const value = e.target.value
                    setEditingData({ ...editingData, [columnKey]: value })

                    // Validate email format
                    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                      setValidationErrors({ ...validationErrors, [columnKey]: 'Invalid email format' })
                    } else {
                      const newErrors = { ...validationErrors }
                      delete newErrors[columnKey]
                      setValidationErrors(newErrors)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                  className={`w-full px-2 py-1 pr-8 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 transition-all ${
                    !isValidEmail
                      ? 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/20 animate-pulse'
                      : hasValue
                      ? 'border-green-500 focus:ring-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-blue-500 focus:ring-blue-500'
                  }`}
                />
                {/* Green checkmark for valid email */}
                {isValidEmail && hasValue && (
                  <svg
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600 dark:text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {!isValidEmail && (
                  <div className="text-xs text-red-600 dark:text-red-400 mt-0.5 font-semibold">
                    Invalid email format
                  </div>
                )}
              </div>
            )
          }

          // For other fields: just simple input
          return (
            <input
              type="text"
              value={editingData[columnKey] || ''}
              onChange={(e) => setEditingData({ ...editingData, [columnKey]: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              className="w-full px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          )
        }

        // Display mode: show value as text (or if system/computed column)
        // Special handling for URL fields - make them clickable links
        if (columnKey === 'url' && value) {
          // Add https:// if no protocol specified
          const href = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          )
        }

        // Special handling for email fields - make them mailto links
        if (columnKey === 'email' && value) {
          return (
            <a
              href={`mailto:${value}`}
              className="text-blue-600 dark:text-blue-400 underline"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          )
        }

        // Handle object values (e.g., lookup columns returning {id, display})
        if (value && typeof value === 'object') {
          const displayValue = value.display || value.id || JSON.stringify(value)
          return (
            <span className="text-gray-900 dark:text-white">{displayValue}</span>
          )
        }

        return value ? (
          <span className="text-gray-900 dark:text-white">{value}</span>
        ) : (
          <span className="text-gray-400">-</span>
        )
    }
  }

  return (
    <>
      <style>{`
        /* TEEEM table scrollbar styling - blue theme for both scrollbars */
        .teeem-table-scroll {
          scrollbar-width: auto;
          scrollbar-color: #2563EB #E0E7FF;
        }
        .teeem-table-scroll::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        .teeem-table-scroll::-webkit-scrollbar-track {
          background: #E0E7FF;
          border-radius: 6px;
        }
        .teeem-table-scroll::-webkit-scrollbar-thumb {
          background: #2563EB;
          border-radius: 6px;
          border: 2px solid #E0E7FF;
        }
        .teeem-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #1D4ED8;
        }
        .dark .teeem-table-scroll {
          scrollbar-color: #1E40AF #1E293B;
        }
        .dark .teeem-table-scroll::-webkit-scrollbar-track {
          background: #1E293B;
        }
        .dark .teeem-table-scroll::-webkit-scrollbar-thumb {
          background: #1E40AF;
          border-color: #1E293B;
        }
        .dark .teeem-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #1E3A8A;
        }

        /* Cascade popup scrollbar styling - HUGE and always visible */
        .cascade-popup-scroll {
          scrollbar-width: auto;
          scrollbar-color: #6366F1 #D1D5DB;
          overflow-y: scroll !important;
        }
        .cascade-popup-scroll::-webkit-scrollbar {
          width: 48px !important;
          height: 48px !important;
          display: block !important;
          background: #E5E7EB !important;
        }
        .cascade-popup-scroll::-webkit-scrollbar-track {
          background: #E5E7EB !important;
          border-radius: 24px !important;
          margin: 4px !important;
          border: 3px solid #F3F4F6 !important;
        }
        .cascade-popup-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #6366F1 0%, #8B5CF6 100%) !important;
          border-radius: 24px !important;
          border: 6px solid #E5E7EB !important;
          min-height: 80px !important;
          cursor: grab !important;
        }
        .cascade-popup-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
        }
        .cascade-popup-scroll::-webkit-scrollbar-thumb:active {
          cursor: grabbing;
          background: linear-gradient(135deg, #4338CA 0%, #6D28D9 100%);
        }
        .dark .cascade-popup-scroll {
          scrollbar-color: #4F46E5 #374151;
        }
        .dark .cascade-popup-scroll::-webkit-scrollbar-track {
          background: #374151;
        }
        .dark .cascade-popup-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
          border-color: #374151;
        }
        .dark .cascade-popup-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #4338CA 0%, #6D28D9 100%);
        }
        .dark .cascade-popup-scroll::-webkit-scrollbar-thumb:active {
          background: linear-gradient(135deg, #3730A3 0%, #5B21B6 100%);
        }

        /* Cursor styles for table headers */
        .trinity-resize-handle {
          cursor: col-resize;
        }
        .trinity-drag-handle {
          cursor: grab;
        }
        .trinity-drag-handle:active {
          cursor: grabbing;
        }
      `}</style>
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 min-h-0">
      {/* Full-width table container */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 min-h-0">

        {/* Edit Mode Banner - Shows when edit mode is active */}
        {editModeActive && (
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 text-white px-6 py-4 border-b-4 border-orange-400 dark:border-orange-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-full backdrop-blur-sm">
                  <PencilIcon className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <span>Edit Mode Active</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 animate-pulse">
                      LIVE
                    </span>
                  </h3>
                  <p className="text-sm text-orange-100 mt-0.5">
                    Click any cell to edit • Click Save button to save changes • Exit when done
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Save & Exit button - saves current row if editing */}
                <button
                  onClick={async () => {
                    console.log('Save & Exit clicked')
                    console.log('Validation errors:', validationErrors)

                    // Check if there are validation errors
                    if (Object.keys(validationErrors).length > 0) {
                      alert('Please fix validation errors before saving')
                      return
                    }

                    // Save current editing row if any
                    if (editingRowId !== null && Object.keys(editingData).length > 0) {
                      const entry = entries.find(e => e.id === editingRowId)
                      if (entry) {
                        console.log('Original entry:', entry)
                        console.log('Editing data (changes only):', editingData)
                        const updatedEntry = { ...entry, ...editingData }
                        console.log('Merged entry to save:', updatedEntry)
                        await onEdit(updatedEntry)
                      }
                    }
                    setEditModeActive(false)
                    setEditingRowId(null)
                    setEditingData({})
                    setValidationErrors({})
                    setShowDeleteButton(false)
                    setSelectedRows(new Set())
                  }}
                  disabled={Object.keys(validationErrors).length > 0}
                  className={`px-6 py-2.5 rounded-lg font-semibold transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-lg ${
                    Object.keys(validationErrors).length > 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save & Exit
                </button>

                {/* Exit Without Saving button */}
                <button
                  onClick={() => {
                    if (confirm('Exit edit mode? Any unsaved changes will be lost.')) {
                      setEditModeActive(false)
                      setEditingRowId(null)
                      setEditingData({})
                      setValidationErrors({})
                      setShowDeleteButton(false)
                      setSelectedRows(new Set())
                    }
                  }}
                  className="px-6 py-2.5 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition-all hover:scale-105 flex items-center justify-center gap-2 backdrop-blur-sm"
                >
                  <XMarkIcon className="h-5 w-5" />
                  Exit Without Saving
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation Error Banner - Shows when validation fails */}
        {validationError && (
          <div className="bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white px-6 py-3 border-b-4 border-red-400 dark:border-red-500 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full backdrop-blur-sm">
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <h4 className="font-bold">Validation Error</h4>
                <p className="text-sm text-red-100">{validationError}</p>
              </div>
            </div>
          </div>
        )}

        {/* TOP SECTION - Search and Buttons */}
        <div className="py-2 border-b border-gray-200 dark:border-gray-700 space-y-1 flex-shrink-0 relative z-20">
        {/* Search Box with Clear Button (Chapter 20.20) */}
        <div className="flex items-end gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search across all fields..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Custom Action Buttons (Chapter 20: Add, Import, etc.) */}
          {customActions && customActions}

          {/* Edit Mode Toggle - Always visible */}
          <button
            onClick={() => {
              // Toggle edit mode - unlock all cells
              setEditModeActive(!editModeActive)
              setShowDeleteButton(!editModeActive) // Show delete when entering edit mode
              if (!editModeActive) {
                // Entering edit mode - clear any selections
                setEditingRowId(null)
                setEditingData({})
                setSelectedRows(new Set())
              }
            }}
            className={`inline-flex items-center gap-2 px-4 text-sm font-bold rounded-lg transition-all h-[42px] ml-auto ${
              editModeActive
                ? 'bg-orange-600 hover:bg-orange-700 text-white ring-4 ring-orange-400/50 shadow-lg shadow-orange-500/50 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
            }`}
          >
            <PencilIcon className={`h-5 w-5 ${editModeActive ? 'animate-bounce' : ''}`} />
            {editModeActive ? '🔓 Editing' : '✏️ Edit'}
          </button>

          {/* Delete Button - Only visible when rows selected (Export available in three-dot menu) */}
          {selectedRows.size > 0 && !editingRowId && (
            <>
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${selectedRows.size} ${selectedRows.size === 1 ? 'entry' : 'entries'}?`)) {
                    const selectedEntryIds = Array.from(selectedRows)
                    const selectedEntries = selectedEntryIds.map(id => entries.find(e => e.id === id)).filter(Boolean)

                    // Use onBulkDelete if available (no individual confirmations)
                    if (onBulkDelete) {
                      onBulkDelete(selectedEntries)
                    } else {
                      // Fallback: call onDelete for each entry (will show multiple confirmations)
                      selectedEntries.forEach(entry => {
                        if (onDelete) {
                          onDelete(entry)
                        }
                      })
                    }

                    setSelectedRows(new Set())
                    setShowDeleteButton(false)
                  }
                }}
                className="inline-flex items-center gap-2 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
              >
                <TrashIcon className="h-4 w-4" />
                Delete ({selectedRows.size})
              </button>
              <button
                onClick={() => {
                  setBulkUpdateColumn('')
                  setBulkUpdateValue('')
                  setShowBulkUpdateModal(true)
                }}
                className="inline-flex items-center gap-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
              >
                <PencilIcon className="h-4 w-4" />
                Bulk Update ({selectedRows.size})
              </button>
              <button
                onClick={() => {
                  setSelectedRows(new Set())
                  setShowDeleteButton(false)
                  setEditModeActive(false)
                }}
                className="inline-flex items-center gap-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors h-[42px]"
              >
                Clear Selection
              </button>
            </>
          )}

          {/* Three-Dot Menu - Always on far right */}
          <Menu as="div" className="relative inline-block text-left z-[100]">
            <MenuButton className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 p-2 text-white border border-blue-600 dark:border-blue-500 h-[42px] w-[42px] transition-colors">
              <EllipsisVerticalIcon className="h-6 w-6" />
            </MenuButton>

            <MenuItems anchor="bottom end" className="z-[9999] w-56 rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 dark:divide-gray-700 max-h-[80vh] overflow-y-auto">
              {/* Filter toggle */}
              <div className="py-1">
                <MenuItem>
                  {({ focus }) => (
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`${
                        focus ? 'bg-gray-100 dark:bg-gray-700' : ''
                      } group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                    >
                      {showFilters ? (
                        <>
                          <EyeSlashIcon className="h-5 w-5 mr-3 text-blue-600 dark:text-blue-400" />
                          <span>Hide Filters</span>
                        </>
                      ) : (
                        <>
                          <EyeIcon className="h-5 w-5 mr-3 text-gray-600 dark:text-gray-400" />
                          <span>Show Filters</span>
                        </>
                      )}
                    </button>
                  )}
                </MenuItem>

                {/* Columns toggle */}
                <MenuItem>
                  {({ focus }) => (
                    <button
                      onClick={() => setShowColumnsDropdown(!showColumnsDropdown)}
                      className={`${
                        focus ? 'bg-gray-100 dark:bg-gray-700' : ''
                      } group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                    >
                      <ViewColumnsIcon className="h-5 w-5 mr-3 text-gray-600 dark:text-gray-400" />
                      <span>Columns</span>
                    </button>
                  )}
                </MenuItem>
              </div>

              {/* Schema Editor - only show if enableSchemaEditor prop is true */}
              {enableSchemaEditor && (
                <div className="py-1">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Schema
                  </div>
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        onClick={() => navigate(`/tables/${foundationIdNumeric}/columns/new?name=${encodeURIComponent(tableName)}`)}
                        className={`${
                          focus ? 'bg-gray-100 dark:bg-gray-700' : ''
                        } group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                      >
                        <PlusCircleIcon className="h-5 w-5 mr-3 text-green-600 dark:text-green-400" />
                        <span>Create New Column</span>
                      </button>
                    )}
                  </MenuItem>
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        onClick={() => navigate(`/tables/${foundationIdNumeric}/columns?name=${encodeURIComponent(tableName)}`)}
                        className={`${
                          focus ? 'bg-gray-100 dark:bg-gray-700' : ''
                        } group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                      >
                        <WrenchScrewdriverIcon className="h-5 w-5 mr-3 text-purple-600 dark:text-purple-400" />
                        <span>Edit Columns</span>
                      </button>
                    )}
                  </MenuItem>
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        onClick={() => setShowDeleteColumnModal(true)}
                        className={`${
                          focus ? 'bg-gray-100 dark:bg-gray-700' : ''
                        } group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                      >
                        <MinusCircleIcon className="h-5 w-5 mr-3 text-red-600 dark:text-red-400" />
                        <span>Delete Column</span>
                      </button>
                    )}
                  </MenuItem>
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        onClick={() => {
                          setEditIndividualMode(!editIndividualMode)
                        }}
                        className={`${
                          focus ? 'bg-gray-100 dark:bg-gray-700' : ''
                        } group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                      >
                        <Cog8ToothIcon className={`h-5 w-5 mr-3 ${editIndividualMode ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`} />
                        <span>{editIndividualMode ? 'Exit Edit Individual' : 'Edit Individual'}</span>
                      </button>
                    )}
                  </MenuItem>
                </div>
              )}

              {/* Import/Export options - only show if enabled */}
              {(enableImport || enableExport) && (
                <div className="py-1">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Data
                  </div>
                  {enableImport && (
                    <MenuItem>
                      {({ focus }) => (
                        <button
                          onClick={() => onImport && onImport()}
                          className={`${
                            focus ? 'bg-gray-100 dark:bg-gray-700' : ''
                          } group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                        >
                          <ArrowDownTrayIcon className="h-5 w-5 mr-3 text-gray-600 dark:text-gray-400" />
                          <span>Import</span>
                        </button>
                      )}
                    </MenuItem>
                  )}
                  {enableExport && (
                    <MenuItem>
                      {({ focus }) => (
                        <button
                          onClick={() => onExport && onExport()}
                          className={`${
                            focus ? 'bg-gray-100 dark:bg-gray-700' : ''
                          } group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                        >
                          <ArrowUpTrayIcon className="h-5 w-5 mr-3 text-gray-600 dark:text-gray-400" />
                          <span>Export</span>
                        </button>
                      )}
                    </MenuItem>
                  )}
                </div>
              )}

              {/* Table Info - always show */}
              <div className="py-1">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Table Info
                </div>
                <div className="px-4 py-2 space-y-2">
                  {/* Table ID - only show if available */}
                  {foundationIdNumeric && (
                    <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Table ID:</span>
                        <span className="ml-2 font-mono text-sm text-gray-900 dark:text-gray-100">{foundationIdNumeric}</span>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(String(foundationIdNumeric))
                          alert('Table ID copied to clipboard!')
                        }}
                        className="ml-2 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  {/* Current View */}
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Current View:</span>
                        <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                          {activeViewId
                            ? (() => {
                                const activeView = savedFilters.find(v => v.id === activeViewId)
                                return activeView
                                  ? <span className="flex items-center gap-1">
                                      {activeView.isDefault && <span className="text-yellow-500">⭐</span>}
                                      {activeView.name}
                                    </span>
                                  : 'Custom'
                              })()
                            : <span className="text-gray-500 dark:text-gray-400 italic">No view selected</span>
                          }
                        </span>
                      </div>
                      {activeViewId && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                          {cascadeFilters.length} filter{cascadeFilters.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {/* Visible columns count */}
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {Object.entries(visibleColumns).filter(([key, visible]) => key !== 'select' && visible).length} of {COLUMNS.filter(c => c.key !== 'select').length} columns visible
                    </div>
                  </div>
                </div>
                <MenuItem>
                  <button
                    onClick={() => setShowSchemaModal(true)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    🗄️ View Schema
                  </button>
                </MenuItem>
              </div>
            </MenuItems>
          </Menu>

          {/* Columns dropdown - appears when triggered from three-dot menu */}
          {showColumnsDropdown && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowColumnsDropdown(false)} />
              {/* Dropdown positioned in center */}
              <div
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl max-h-[80vh] overflow-y-auto z-[60]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Show/Hide Columns
                    </span>
                    <button
                      onClick={() => setShowColumnsDropdown(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      ✕
                    </button>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 font-medium w-8"></th>
                        <th className="text-left py-2 font-medium">Column Name</th>
                        <th className="text-left py-2 font-medium w-32">SQL Type</th>
                        <th className="text-left py-2 font-medium w-28">Display Type</th>
                        <th className="text-left py-2 font-medium w-20">Min Width</th>
                        <th className="text-center py-2 font-medium w-24">Show Filter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COLUMNS.filter(col => col.key !== 'select' && col.key !== 'actions')
                        .sort((a, b) => a.label.localeCompare(b.label))
                        .map((column) => {
                        const colType = column.column_type || column.key
                        return (
                          <tr
                            key={column.key}
                            className="group hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <td className="py-2 text-base">{getColumnTypeEmoji(colType)}</td>
                            <td className="py-2 text-sm text-gray-700 dark:text-gray-200">{column.label}</td>
                            <td className="py-2 text-xs font-mono text-gray-400 dark:text-gray-500 cursor-pointer" onClick={() => handleToggleColumn(column.key)}>{getColumnTypeSqlType(colType)}</td>
                            <td className="py-2 text-xs text-gray-400 dark:text-gray-500 cursor-pointer" onClick={() => handleToggleColumn(column.key)}>{getColumnTypeLabel(colType)}</td>
                            <td className="py-2 px-1">
                              <input
                                type="number"
                                min="0"
                                max="500"
                                value={columnMinWidths[column.key] ?? 75}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0
                                  setColumnMinWidths(prev => ({
                                    ...prev,
                                    [column.key]: Math.max(0, Math.min(500, value))
                                  }))
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-16 px-2 py-1 text-xs text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            </td>
                            <td className="py-2 px-1 text-center">
                              <input
                                type="checkbox"
                                checked={columnShowFilters[column.key] ?? true}
                                onChange={(e) => {
                                  setColumnShowFilters(prev => ({
                                    ...prev,
                                    [column.key]: e.target.checked
                                  }))
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                                title="Uncheck to hide filter for this column"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Schema Modal - Full schema info for all columns */}
          {showSchemaModal && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowSchemaModal(false)} />
              {/* Modal */}
              <div
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-6xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl max-h-[90vh] overflow-hidden z-[60] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-500 to-purple-600 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        🗄️ Table Schema
                        {tableName && <span className="text-indigo-100">- {tableName}</span>}
                      </h2>
                      <p className="text-sm text-indigo-100 mt-1">
                        {COLUMNS.filter(col => col.key !== 'select' && col.key !== 'actions').length} columns • Schema definitions from COLUMN_TYPES (Single Source of Truth)
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSchemaModal(false)}
                      className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                    >
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Content - scrollable */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    {COLUMNS.filter(col => col.key !== 'select' && col.key !== 'actions')
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .map((column) => {
                      const colType = column.column_type || column.key
                      const columnTypeDef = COLUMN_TYPES.find(t => t.value === colType) || {}

                      return (
                        <div
                          key={column.key}
                          className="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden"
                        >
                          {/* Column Header */}
                          <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{getColumnTypeEmoji(colType)}</span>
                                <div>
                                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{column.label}</h3>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{column.key}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 text-xs font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
                                  {getColumnTypeSqlType(colType)}
                                </span>
                                <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded">
                                  {getColumnTypeLabel(colType)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Column Details */}
                          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Validation Rules */}
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                Validation Rules
                              </label>
                              <div className="text-sm text-gray-700 dark:text-gray-300 bg-orange-50 dark:bg-orange-900/20 px-3 py-2 rounded border border-orange-200 dark:border-orange-800">
                                {columnTypeDef.validationRules || 'No validation rules defined'}
                              </div>
                            </div>

                            {/* Example */}
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                Example
                              </label>
                              <div className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded border border-green-200 dark:border-green-800">
                                {columnTypeDef.example || 'No example available'}
                              </div>
                            </div>

                            {/* Used For */}
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                Used For
                              </label>
                              <div className="text-sm text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded border border-blue-200 dark:border-blue-800">
                                {columnTypeDef.usedFor || column.tooltip || 'No description available'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Schema sourced from COLUMN_TYPES constant (see columnTypes.js)
                    </p>
                    <button
                      onClick={() => setShowSchemaModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Delete Column Modal */}
          {showDeleteColumnModal && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowDeleteColumnModal(false)} />
              {/* Modal */}
              <div
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-2xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl max-h-[80vh] overflow-hidden z-[60] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-500 to-red-600 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        🗑️ Delete Column
                        {tableName && <span className="text-red-100">- {tableName}</span>}
                      </h2>
                      <p className="text-sm text-red-100 mt-1">
                        Select a column to delete. This action cannot be undone.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeleteColumnModal(false)}
                      className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                    >
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Content - scrollable list of columns */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-2">
                    {COLUMNS.filter(col => col.key !== 'select' && !['id', 'created_at', 'updated_at', 'user_id'].includes(col.key)).map((column) => (
                      <div
                        key={column.key}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-600 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{getColumnTypeEmoji(column.column_type || column.key)}</span>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{column.label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{column.key}</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm(`Are you sure you want to delete the column "${column.label}"?\n\nThis will permanently remove this column and all its data from the table.`)) {
                              return
                            }
                            setDeletingColumnId(column.id || column.key)
                            try {
                              const response = await api.delete(`/api/v1/foundations/${foundationIdNumeric}/columns/${column.id}`)
                              if (response?.success !== false) {
                                alert(`Column "${column.label}" deleted successfully. Please refresh the page to see changes.`)
                                setShowDeleteColumnModal(false)
                                window.location.reload()
                              } else {
                                alert(`Failed to delete column: ${response?.error || 'Unknown error'}`)
                              }
                            } catch (err) {
                              alert(`Failed to delete column: ${err.message}`)
                            } finally {
                              setDeletingColumnId(null)
                            }
                          }}
                          disabled={deletingColumnId === (column.id || column.key)}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          {deletingColumnId === (column.id || column.key) ? (
                            <>
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <TrashIcon className="h-4 w-4" />
                              Delete
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-red-500 dark:text-red-400">
                      ⚠️ Deleting a column is permanent and cannot be undone
                    </p>
                    <button
                      onClick={() => setShowDeleteColumnModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Search Results Count (Chapter 20.20) */}
        {search && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Found {filteredAndSorted.length} of {entries.length} entries
          </div>
        )}
        </div>
        {/* END TOP SECTION - Search/Buttons */}

        {/* Main content area - filters at top for now until code can be restructured */}
        <div className="flex-1 flex flex-col min-h-0">

        {/* Filters row */}
        <div className="flex items-end gap-3 flex-wrap px-2 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
          {/* Cascade Filters Button - Excel-style popup */}
          <div className="relative group flex items-center gap-2">
            <button
              onClick={() => {
                if (!showCascadeDropdown) {
                  // Reset position to center when opening
                  setCascadePopupPosition({ x: 0, y: 0 })
                  // Sort columns: visible (ticked) first, then hidden (unticked) at bottom
                  const filteredCols = COLUMNS.filter(col => col.key !== 'select')
                  const currentOrder = visibilityColumnOrder
                    ? [...visibilityColumnOrder]
                    : filteredCols.sort((a, b) => a.label.localeCompare(b.label)).map(c => c.key)
                  // Separate visible and hidden columns
                  const visibleCols = currentOrder.filter(key => visibleColumns[key] !== false)
                  const hiddenCols = currentOrder.filter(key => visibleColumns[key] === false)
                  // Combine: visible first, then hidden
                  const sortedOrder = [...visibleCols, ...hiddenCols]
                  setVisibilityColumnOrder(sortedOrder)
                  // Always clear sort/groupBy when opening cascade popup fresh
                  // User can then configure and save to a view
                  setSortColumns([])
                  setGroupByColumn(null)
                  setGroupByColumns([])
                }
                setShowCascadeDropdown(!showCascadeDropdown)
              }}
              className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <FunnelIcon className="w-4 h-4" />
              Filters
              {cascadeFilters.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] bg-purple-600 text-white rounded-full text-[10px] font-bold">
                  {cascadeFilters.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Access Saved View Buttons */}
          {savedFilters
            .filter(v => v.name !== '__default_setup__')
            .sort((a, b) => {
              // Sort by display_order only (no default priority)
              return (a.display_order || 0) - (b.display_order || 0)
            })
            .map((view) => (
            <button
              key={view.id}
              onClick={() => {
                loadViewState(view)
                // Update URL with view name (URL-friendly slug)
                const viewSlug = view.name.toLowerCase().replace(/\s+/g, '-')
                const newParams = new URLSearchParams(searchParams)
                newParams.set('view', viewSlug)
                setSearchParams(newParams, { replace: false })
              }}
              className={`px-3 py-1.5 ${
                activeViewId === view.id
                  ? 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-400 dark:border-blue-600'
                  : 'bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              } text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              {view.name}
              {view.filters.length > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] ${
                  activeViewId === view.id
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-green-600 dark:bg-green-700'
                } text-white rounded-full text-[10px] font-bold`}>
                  {view.filters.length}
                </span>
              )}
            </button>
          ))}

            {/* Excel-style dropdown panel */}
            {showCascadeDropdown && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 bg-black/30 z-50" onClick={closeCascadePopup} />
                {/* Dropdown positioned in center like a modal - resizable */}
                <div
                  ref={cascadePopupRef}
                  style={cascadeFullscreen ? {} : {
                    width: `${cascadePopupSize.width}vw`,
                    height: `${cascadePopupSize.height}vh`,
                    transform: `translate(calc(-50% + ${cascadePopupPosition.x}px), calc(-50% + ${cascadePopupPosition.y}px))`
                  }}
                  className={cascadeFullscreen
                    ? "fixed inset-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl overflow-hidden z-[60]"
                    : "fixed top-1/2 left-1/2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl overflow-hidden z-[60]"
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                {/* Resize handles - hidden in fullscreen mode */}
                {!cascadeFullscreen && (
                  <>
                    {/* Right resize handle */}
                    <div
                      className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-blue-500/20 z-10"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setIsResizing('right')
                        document.body.style.cursor = 'ew-resize'
                      }}
                    />
                    {/* Bottom resize handle */}
                    <div
                      className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-blue-500/20 z-10"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setIsResizing('bottom')
                        document.body.style.cursor = 'ns-resize'
                      }}
                    />
                    {/* Corner resize handle */}
                    <div
                      className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-blue-500/30 z-20"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setIsResizing('corner')
                        document.body.style.cursor = 'nwse-resize'
                      }}
                    >
                      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
                      </svg>
                    </div>
                  </>
                )}
                <div className="p-3 h-full overflow-hidden flex flex-col">
                  {/* Header - Draggable */}
                  <div
                    className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2 mb-3 select-none cursor-move"
                    onMouseDown={(e) => {
                      // Don't start drag if clicking buttons
                      if (e.target.tagName === 'BUTTON') return
                      e.preventDefault()
                      setIsDraggingPopup(true)
                      setDragStartPos({ x: e.clientX, y: e.clientY })
                    }}
                  >
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                      </svg>
                      Cascade Filters
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Fullscreen toggle button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setCascadeFullscreen(!cascadeFullscreen)
                          // Reset position when toggling fullscreen
                          if (!cascadeFullscreen) {
                            setCascadePopupPosition({ x: 0, y: 0 })
                          }
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={cascadeFullscreen ? "Exit fullscreen" : "Fullscreen"}
                      >
                        {cascadeFullscreen ? (
                          // Exit fullscreen icon (arrows pointing inward)
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v5m0-5h5m6 0l5-5m0 0v5m0-5h-5m0 16l5 5m0 0v-5m0 5h-5m-6 0l-5 5m0 0v-5m0 5h5" />
                          </svg>
                        ) : (
                          // Fullscreen icon (arrows pointing outward)
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5" />
                          </svg>
                        )}
                      </button>
                      {/* Close button */}
                      <button
                        onClick={closeCascadePopup}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Close"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Two separate header boxes */}
                  <div className="grid grid-cols-[340px,1fr] gap-4 -mx-3 px-3 mb-3">
                    {/* LEFT: Saved Views header box */}
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2.5 rounded-lg shadow-lg">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">Saved Views</span>
                          <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] bg-white/20 backdrop-blur-sm text-white rounded-full text-xs font-bold">
                            {savedFilters.length}
                          </span>
                        </div>
                        <div className="text-xs opacity-75">Drag to reorder</div>
                      </div>
                    </div>
                    {/* RIGHT: Create New or Edit View header box */}
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2.5 rounded-lg shadow-lg">
                      <div className="flex items-center gap-3">
                        {editingViewId ? (
                          <>
                            <span className="text-sm font-bold whitespace-nowrap">Edit View:</span>
                            <input
                              type="text"
                              id="editViewNameInput"
                              key={editingViewId}
                              defaultValue={savedFilters.find(v => v.id === editingViewId)?.name || ''}
                              className="flex-1 max-w-[200px] text-sm font-semibold px-2 py-1 border-0 rounded bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingViewId(null)
                                }
                              }}
                            />
                            <button
                              onClick={async () => {
                                // Save all changes via API: name, filters, groups, columns, sort, and groupBy
                                const nameInput = document.getElementById('editViewNameInput')
                                const newName = nameInput?.value?.trim() || savedFilters.find(v => v.id === editingViewId)?.name
                                const editedView = savedFilters.find(v => v.id === editingViewId)

                                console.log('[Save View] Saving column order:', visibilityColumnOrder)
                                console.log('[Save View] Saving sortColumns:', sortColumns)
                                console.log('[Save View] Saving groupByColumns:', groupByColumns)
                                if (editedView) {
                                  await updateView(editingViewId, {
                                    ...editedView,
                                    name: newName,
                                    filters: cascadeFilters.map(f => ({ column: f.column, value: f.value, operator: f.operator, label: f.label, groupId: f.groupId })),
                                    filterGroups: [...filterGroups],
                                    interGroupLogic,
                                    visibleColumns: { ...visibleColumns },
                                    columnOrder: visibilityColumnOrder,
                                    showFilters,
                                    sortColumns: [...sortColumns],
                                    groupByColumns: [...groupByColumns]  // Save full array of group by columns
                                  })
                                }

                                // Keep the view active after saving (stay in edit mode)
                                setActiveViewId(editingViewId)
                                // Don't reset filters/columns - they were just saved
                              }}
                              className="text-xs px-3 py-1 bg-green-500 hover:bg-green-600 rounded transition-colors whitespace-nowrap font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={async () => {
                                // Save all changes via API: name, filters, groups, columns, sort, and groupBy
                                const nameInput = document.getElementById('editViewNameInput')
                                const newName = nameInput?.value?.trim() || savedFilters.find(v => v.id === editingViewId)?.name
                                const editedView = savedFilters.find(v => v.id === editingViewId)

                                console.log('[Save & Close] Saving column order:', visibilityColumnOrder)
                                console.log('[Save & Close] Saving sortColumns:', sortColumns)
                                console.log('[Save & Close] Saving groupByColumns:', groupByColumns)
                                if (editedView) {
                                  await updateView(editingViewId, {
                                    ...editedView,
                                    name: newName,
                                    filters: cascadeFilters.map(f => ({ column: f.column, value: f.value, operator: f.operator, label: f.label, groupId: f.groupId })),
                                    filterGroups: [...filterGroups],
                                    interGroupLogic,
                                    visibleColumns: { ...visibleColumns },
                                    columnOrder: visibilityColumnOrder,
                                    showFilters,
                                    sortColumns: [...sortColumns],
                                    groupByColumns: [...groupByColumns]  // Save full array of group by columns
                                  })
                                }

                                // Keep the view active after saving
                                setActiveViewId(editingViewId)
                                setEditingViewId(null)
                                // Don't reset filters/columns - they were just saved
                                setShowCascadeDropdown(false) // Close the popup
                              }}
                              className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded transition-colors whitespace-nowrap font-medium"
                            >
                              Save & Close
                            </button>
                            <button
                              onClick={() => {
                                setEditingViewId(null)
                                setCascadeFilters([])
                              }}
                              className="text-xs px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          </>
                        ) : creatingNewView ? (
                          <>
                            <span className="text-sm font-bold whitespace-nowrap">New View:</span>
                            <input
                              type="text"
                              autoFocus
                              value={newViewName}
                              onChange={(e) => setNewViewName(e.target.value.slice(0, 20))}
                              placeholder="Enter view name..."
                              className="flex-1 max-w-[200px] text-sm font-semibold px-2 py-1 border-0 rounded bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                              onKeyDown={async (e) => {
                                if (e.key === 'Escape') {
                                  setCreatingNewView(false)
                                  setNewViewName('')
                                } else if (e.key === 'Enter' && newViewName.trim()) {
                                  // Save the new view via API
                                  const columnsToSave = {}
                                  COLUMNS.filter(col => col.key !== 'select').forEach(col => {
                                    columnsToSave[col.key] = visibleColumns[col.key] !== false
                                  })
                                  const orderToSave = columnOrder || COLUMNS.map(c => c.key)

                                  const newView = await saveNewView({
                                    name: newViewName.trim(),
                                    filters: cascadeFilters.map(f => ({ column: f.column, value: f.value, operator: f.operator, label: f.label, groupId: f.groupId })),
                                    filterGroups: [...filterGroups],
                                    interGroupLogic,
                                    visibleColumns: columnsToSave,
                                    columnOrder: orderToSave,
                                    showFilters,
                                    sortColumns: [...sortColumns],
                                    groupByColumn,
                                    isDefault: savedFilters.length === 0
                                  })

                                  if (newView) {
                                    setActiveViewId(newView.id)
                                    setCreatingNewView(false)
                                    setNewViewName('')
                                  }
                                }
                              }}
                            />
                            <span className="text-[10px] opacity-60">{newViewName.length}/20</span>
                            <button
                              onClick={async () => {
                                if (!newViewName.trim()) return
                                // Save the new view via API
                                const columnsToSave = {}
                                COLUMNS.filter(col => col.key !== 'select').forEach(col => {
                                  columnsToSave[col.key] = visibleColumns[col.key] !== false
                                })
                                const orderToSave = columnOrder || COLUMNS.map(c => c.key)

                                const newView = await saveNewView({
                                  name: newViewName.trim(),
                                  filters: cascadeFilters.map(f => ({ column: f.column, value: f.value, operator: f.operator, label: f.label, groupId: f.groupId })),
                                  filterGroups: [...filterGroups],
                                  interGroupLogic,
                                  visibleColumns: columnsToSave,
                                  columnOrder: orderToSave,
                                  showFilters,
                                  sortColumns: [...sortColumns],
                                  groupByColumn,
                                  isDefault: savedFilters.length === 0
                                })

                                if (newView) {
                                  setActiveViewId(newView.id)
                                  setCreatingNewView(false)
                                  setNewViewName('')
                                }
                              }}
                              disabled={!newViewName.trim()}
                              className="text-xs px-3 py-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed rounded transition-colors whitespace-nowrap font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={async () => {
                                if (!newViewName.trim()) return
                                // Save the new view via API and close popup
                                const columnsToSave = {}
                                COLUMNS.filter(col => col.key !== 'select').forEach(col => {
                                  columnsToSave[col.key] = visibleColumns[col.key] !== false
                                })
                                const orderToSave = columnOrder || COLUMNS.map(c => c.key)

                                const newView = await saveNewView({
                                  name: newViewName.trim(),
                                  filters: cascadeFilters.map(f => ({ column: f.column, value: f.value, operator: f.operator, label: f.label, groupId: f.groupId })),
                                  filterGroups: [...filterGroups],
                                  interGroupLogic,
                                  visibleColumns: columnsToSave,
                                  columnOrder: orderToSave,
                                  showFilters,
                                  sortColumns: [...sortColumns],
                                  groupByColumn,
                                  isDefault: savedFilters.length === 0
                                })

                                if (newView) {
                                  setActiveViewId(newView.id)
                                  setCreatingNewView(false)
                                  setNewViewName('')
                                  setShowCascadeDropdown(false) // Close the popup
                                }
                              }}
                              disabled={!newViewName.trim()}
                              className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed rounded transition-colors whitespace-nowrap font-medium"
                            >
                              Save & Close
                            </button>
                            <button
                              onClick={() => {
                                setCreatingNewView(false)
                                setNewViewName('')
                              }}
                              className="text-xs px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>

                            <button
                              onClick={() => {
                                // Load the Setup view as the starting point for new views
                                // Use Setup view's column configuration as the default
                                const setupView = savedFilters.find(v => v.name === 'Setup')
                                console.log('[Create New View] Setup view found:', setupView ? 'YES' : 'NO', setupView)
                                console.log('[Create New View] savedFilters:', savedFilters)
                                if (setupView) {
                                  // Load Setup view's configuration
                                  console.log('[Create New View] Loading Setup view columns:', setupView.visibleColumns)
                                  loadViewState(setupView)
                                  // Setup view should never have grouping, ensure it's cleared
                                  setGroupByColumn(null)
                                  setGroupByColumns([])
                                } else {
                                  // Fallback if Setup view doesn't exist (shouldn't happen)
                                  console.log('[Create New View] No Setup view found, using fallback with all columns')
                                  setCascadeFilters([])
                                  setFilterGroups([{ id: 'default', logic: 'AND' }])
                                  setInterGroupLogic('OR')
                                  setSortColumns([])
                                  setGroupByColumn(null)
                                  setGroupByColumns([])
                                  const allVisible = {}
                                  COLUMNS.forEach(col => {
                                    if (col.key !== 'select' && col.key !== 'actions') {
                                      allVisible[col.key] = true
                                    }
                                  })
                                  setVisibleColumns(allVisible)
                                  setColumnOrder(COLUMNS.map(c => c.key))
                                }
                                setActiveViewId(null)
                                setEditingViewId(null)
                                setCreatingNewView(true)
                              }}
                              className="text-xs px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded transition-colors whitespace-nowrap font-medium flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Create New
                            </button>
                            <span className="text-xs opacity-75">Select columns & filters, then save as a new view</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Main content: 3 columns - Saved Views | Filter Builder | Column Visibility */}
                  {/* Columns panel gets more space since it often has many items */}
                  <div className={`grid ${cascadeFullscreen ? 'grid-cols-[220px,minmax(260px,1fr),minmax(550px,3fr)]' : 'grid-cols-[220px,minmax(240px,1fr),minmax(480px,2.5fr)]'} gap-4 flex-1 min-h-0 overflow-hidden cascade-popup-scroll`}>
                    {/* COLUMN 1: Saved Views Section (moved to left) */}
                    <div className="border-r border-gray-200 dark:border-gray-700 pr-4 h-full overflow-hidden flex flex-col">
                      <div className="flex-1 min-h-0">
                        {/* Kanban-style drag-and-drop saved views - without its own header now */}
                        <SavedViewsKanban
                          savedFilters={savedFilters}
                          setSavedFilters={setSavedFilters}
                          activeViewId={activeViewId}
                          setActiveViewId={setActiveViewId}
                          setCascadeFilters={setCascadeFilters}
                          setVisibleColumns={setVisibleColumns}
                          setShowCascadeDropdown={setShowCascadeDropdown}
                          filterName={filterName}
                          setFilterName={setFilterName}
                          cascadeFilters={cascadeFilters}
                          visibleColumns={visibleColumns}
                          editingViewId={editingViewId}
                          setEditingViewId={setEditingViewId}
                          setVisibilityColumnOrder={setVisibilityColumnOrder}
                          setColumnOrder={setColumnOrder}
                          setFilterGroups={setFilterGroups}
                          setInterGroupLogic={setInterGroupLogic}
                          setSortColumns={setSortColumns}
                          setGroupByColumn={setGroupByColumn}
                          setGroupByColumns={setGroupByColumns}
                          deleteView={deleteView}
                          hideHeader={true}
                          searchParams={searchParams}
                          setSearchParams={setSearchParams}
                          columns={COLUMNS}
                          showFilters={showFilters}
                        />
                      </div>
                    {/* END COLUMN 1 (Saved Views) */}
                    </div>

                    {/* COLUMN 2: Filter Builder, Sort By, Group By */}
                    <div className="flex flex-col h-full min-h-0 overflow-y-auto pr-2 relative">
                      {/* Disabled overlay */}
                      {isViewEditingDisabled && (
                        <div className="absolute inset-0 bg-gray-100/70 dark:bg-gray-800/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
                          <div className="text-center px-4">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Click "+ Create New" or edit an existing view to modify filters
                            </p>
                          </div>
                        </div>
                      )}
                      {/* View Filter - Filter Builder UI - Collapsible */}
                      <div className={`${filterSectionCollapsed ? '' : 'flex-1'} min-h-0 overflow-visible`}>
                        <button
                          onClick={() => setFilterSectionCollapsed(!filterSectionCollapsed)}
                          className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            View Filter
                            {cascadeFilters.length > 0 && (
                              <span className="text-xs font-normal text-blue-600 dark:text-blue-400">({cascadeFilters.length} active)</span>
                            )}
                          </span>
                          <span className={`transform transition-transform ${filterSectionCollapsed ? '' : 'rotate-180'}`}>▼</span>
                        </button>
                        {!filterSectionCollapsed && (
                        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30">
                          {/* Top action bar */}
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <button
                              onClick={() => {
                                const newGroupId = `group_${Date.now()}`
                                setFilterGroups([...filterGroups, { id: newGroupId, logic: 'AND' }])
                              }}
                              className="px-3 py-1.5 border border-blue-300 dark:border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                              +Group
                            </button>
                            {filterGroups.length > 1 && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                <span>Between groups:</span>
                                <select
                                  value={interGroupLogic}
                                  onChange={(e) => setInterGroupLogic(e.target.value)}
                                  className="px-2 py-1 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                                >
                                  <option value="AND">AND</option>
                                  <option value="OR">OR</option>
                                </select>
                              </div>
                            )}
                            {(cascadeFilters.length > 0 || filterGroups.length > 1) && (
                              <button
                                onClick={() => {
                                  clearCascadeFilters()
                                  setVisibleColumns({ ...defaultColumnsForNewViews })
                                }}
                                className="ml-auto px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              >
                                Clear All
                              </button>
                            )}
                          </div>

                          {/* Filter groups */}
                          <div className="space-y-3">
                            {filterGroups.map((group, groupIndex) => {
                              const groupFilters = cascadeFilters.filter(f => (f.groupId || 'default') === group.id)
                              return (
                                <div
                                  key={group.id}
                                  className={`border-2 rounded-lg p-3 ${
                                    filterGroups.length > 1
                                      ? 'border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
                                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                                  }`}
                                >
                                  {/* Group header */}
                                  <div className="flex items-center gap-2 mb-2">
                                    {filterGroups.length > 1 && (
                                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                                        Group {groupIndex + 1}
                                      </span>
                                    )}
                                    <select
                                      value={group.logic}
                                      onChange={(e) => {
                                        setFilterGroups(filterGroups.map(g =>
                                          g.id === group.id ? { ...g, logic: e.target.value } : g
                                        ))
                                      }}
                                      className="px-2 py-1 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                                    >
                                      <option value="AND">AND</option>
                                      <option value="OR">OR</option>
                                    </select>
                                    <button
                                      onClick={() => {
                                        const newFilter = {
                                          id: Date.now() + Math.random(),
                                          groupId: group.id,
                                          column: '',
                                          operator: '=', // Start with exact match, will be kept for choice columns
                                          value: '',
                                          label: ''
                                        }
                                        setCascadeFilters([...cascadeFilters, newFilter])
                                      }}
                                      className="px-2 py-1 border border-gray-300 dark:border-gray-500 rounded bg-white dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                    >
                                      +Rule
                                    </button>
                                    {filterGroups.length > 1 && (
                                      <button
                                        onClick={() => {
                                          // Remove group and its filters
                                          setCascadeFilters(cascadeFilters.filter(f => (f.groupId || 'default') !== group.id))
                                          setFilterGroups(filterGroups.filter(g => g.id !== group.id))
                                        }}
                                        className="ml-auto p-1 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                        title="Delete group"
                                      >
                                        <span className="text-xs font-bold">✕</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Rules in this group */}
                                  <div className="space-y-2 overflow-visible">
                                    {groupFilters.length === 0 ? (
                                      <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-2 italic">
                                        No rules. Click +Rule to add one.
                                      </div>
                                    ) : (
                                      groupFilters.map((filter) => (
                                        <div
                                          key={filter.id}
                                          className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg overflow-visible"
                                        >
                                          {/* Column dropdown - Searchable with smart positioning */}
                                          <div className="relative flex-1 min-w-[120px]" data-filter-column-dropdown={filter.id}>
                                            {filterColumnDropdownOpen === filter.id ? (
                                              // Search input replaces button when open
                                              <input
                                                type="text"
                                                data-filter-input={filter.id}
                                                value={filterColumnSearchQuery}
                                                onChange={(e) => setFilterColumnSearchQuery(e.target.value)}
                                                placeholder="Type to search..."
                                                className="w-full px-2 py-1.5 border border-blue-500 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 focus:outline-none"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Escape') {
                                                    setFilterColumnDropdownOpen(null)
                                                    setFilterColumnSearchQuery('')
                                                  }
                                                }}
                                              />
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setFilterColumnDropdownOpen(filter.id)
                                                  setFilterColumnSearchQuery('')
                                                }}
                                                className={`w-full px-2 py-1.5 border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700 text-sm text-left flex items-center justify-between ${
                                                  filter.column ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
                                                }`}
                                              >
                                                <span>{filter.column ? (COLUMNS.find(c => c.key === filter.column)?.label || filter.column) : 'Select column...'}</span>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                              </button>
                                            )}

                                            {filterColumnDropdownOpen === filter.id && (
                                              <div
                                                className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-[50vh] overflow-y-auto"
                                                style={{ top: '100%', marginTop: '4px' }}
                                              >
                                                {COLUMNS
                                                  .filter(col => col.key !== 'select' && col.key !== 'id')
                                                  .filter(col => {
                                                    if (!filterColumnSearchQuery.trim()) return true
                                                    const searchLower = filterColumnSearchQuery.toLowerCase()
                                                    return col.label.toLowerCase().includes(searchLower) || col.key.toLowerCase().includes(searchLower)
                                                  })
                                                  .sort((a, b) => a.label.localeCompare(b.label))
                                                  .map(col => (
                                                    <button
                                                      key={col.key}
                                                      type="button"
                                                      onClick={() => {
                                                        const columnDef = col
                                                        const columnLabel = columnDef?.label || col.key
                                                        const columnType = columnDef?.column_type

                                                        // For choice columns, always use exact match (=)
                                                        // For other columns, keep existing operator or default to 'contains'
                                                        const newOperator = (columnType === 'choice' || columnType === 'single_select' || columnType === 'dropdown')
                                                          ? '='
                                                          : (filter.operator || 'contains')

                                                        setCascadeFilters(cascadeFilters.map(f =>
                                                          f.id === filter.id
                                                            ? { ...f, column: col.key, operator: newOperator, label: filter.value ? `${columnLabel}: ${filter.value}` : '' }
                                                            : f
                                                        ))
                                                        setFilterColumnDropdownOpen(null)
                                                        setFilterColumnSearchQuery('')
                                                      }}
                                                      className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
                                                        filter.column === col.key
                                                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                                          : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                                                      }`}
                                                    >
                                                      {filter.column === col.key && <span className="text-blue-600">✓</span>}
                                                      <span className={filter.column === col.key ? '' : 'ml-5'}>{col.label}</span>
                                                    </button>
                                                  ))
                                                }
                                                {filterColumnSearchQuery.trim() &&
                                                  COLUMNS.filter(col => col.key !== 'select' && col.key !== 'id')
                                                    .filter(col => col.label.toLowerCase().includes(filterColumnSearchQuery.toLowerCase()) || col.key.toLowerCase().includes(filterColumnSearchQuery.toLowerCase()))
                                                    .length === 0 && (
                                                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                                                    No columns found
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>

                                          {/* Operator dropdown */}
                                          <select
                                            value={filter.operator || 'contains'}
                                            onChange={(e) => {
                                              const newOp = e.target.value
                                              const columnLabel = COLUMNS.find(col => col.key === filter.column)?.label || filter.column
                                              const opLabels = { 'contains': 'contains', '=': '=', '!=': '≠', '>': '>', '<': '<', '>=': '≥', '<=': '≤', 'empty': 'is empty', 'notEmpty': 'is not empty' }
                                              setCascadeFilters(cascadeFilters.map(f =>
                                                f.id === filter.id
                                                  ? { ...f, operator: newOp, label: (newOp === 'empty' || newOp === 'notEmpty') ? `${columnLabel} ${opLabels[newOp]}` : (filter.value ? `${columnLabel} ${opLabels[newOp]} ${filter.value}` : '') }
                                                  : f
                                              ))
                                            }}
                                            className="w-[100px] px-2 py-1.5 border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                                          >
                                            <option value="contains">contains</option>
                                            <option value="=">=</option>
                                            <option value="!=">≠</option>
                                            <option value=">">{'>'}</option>
                                            <option value="<">{'<'}</option>
                                            <option value=">=">≥</option>
                                            <option value="<=">≤</option>
                                            <option value="empty">is empty</option>
                                            <option value="notEmpty">is not empty</option>
                                          </select>

                                          {/* Value input - hidden for empty/notEmpty operators */}
                                          {filter.operator !== 'empty' && filter.operator !== 'notEmpty' && (
                                            <input
                                              type="text"
                                              value={filter.value}
                                              onChange={(e) => {
                                                const newValue = e.target.value
                                                const columnLabel = COLUMNS.find(col => col.key === filter.column)?.label || filter.column
                                                const opLabels = { 'contains': 'contains', '=': '=', '!=': '≠', '>': '>', '<': '<', '>=': '≥', '<=': '≤', 'empty': 'is empty', 'notEmpty': 'is not empty' }
                                                setCascadeFilters(cascadeFilters.map(f =>
                                                  f.id === filter.id
                                                    ? { ...f, value: newValue, label: `${columnLabel} ${opLabels[f.operator || 'contains']} ${newValue}` }
                                                    : f
                                                ))
                                              }}
                                              placeholder="Value..."
                                              className="flex-1 min-w-[80px] px-2 py-1.5 border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400"
                                            />
                                          )}

                                          {/* Delete button */}
                                          <button
                                            onClick={() => setCascadeFilters(cascadeFilters.filter(f => f.id !== filter.id))}
                                            className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 border border-gray-300 dark:border-gray-500 rounded hover:border-red-300 dark:hover:border-red-500 transition-colors"
                                          >
                                            <span className="text-xs font-bold">✕</span>
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Inter-group logic indicator */}
                          {filterGroups.length > 1 && (
                            <div className="mt-2 text-center">
                              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                Groups combined with <strong>{interGroupLogic}</strong>
                              </span>
                            </div>
                          )}
                        </div>
                        )}
                      </div>

                      {/* Sort By Panel - Collapsible */}
                      <div className="mt-4">
                        <button
                          onClick={() => setSortSectionCollapsed(!sortSectionCollapsed)}
                          className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            Sort By
                            {sortColumns.length > 0 && (
                              <span className="text-xs font-normal text-blue-600 dark:text-blue-400">({sortColumns.length} column{sortColumns.length !== 1 ? 's' : ''})</span>
                            )}
                          </span>
                          <span className={`transform transition-transform ${sortSectionCollapsed ? '' : 'rotate-180'}`}>▼</span>
                        </button>
                        {!sortSectionCollapsed && (
                        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30">
                          {/* Add sort column button */}
                          <div className="flex items-center gap-2 mb-3">
                            <button
                              onClick={() => {
                                // Find first column alphabetically that isn't already in sortColumns
                                const availableCols = COLUMNS.filter(col =>
                                  col.key !== 'select' &&
                                  col.key !== 'actions' &&
                                  !sortColumns.find(s => s.column === col.key)
                                ).sort((a, b) => a.label.localeCompare(b.label))
                                if (availableCols.length > 0) {
                                  setSortColumns([...sortColumns, { column: availableCols[0].key, dir: 'asc' }])
                                }
                              }}
                              className="px-3 py-1.5 border border-blue-300 dark:border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                              +Sort Column
                            </button>
                            {sortColumns.length > 0 && (
                              <button
                                onClick={() => setSortColumns([])}
                                className="ml-auto px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              >
                                Clear All
                              </button>
                            )}
                          </div>

                          {/* Sort columns list */}
                          {sortColumns.length === 0 ? (
                            <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 italic">
                              No sort columns. Click +Sort Column to add one, or Shift+Click column headers.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {sortColumns.map((sort, index) => (
                                <div
                                  key={`${sort.column}-${index}`}
                                  className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg"
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', `sort-${index}`)
                                    e.dataTransfer.effectAllowed = 'move'
                                    e.currentTarget.style.opacity = '0.5'
                                  }}
                                  onDragEnd={(e) => {
                                    e.currentTarget.style.opacity = '1'
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = 'move'
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault()
                                    const data = e.dataTransfer.getData('text/plain')
                                    if (data.startsWith('sort-')) {
                                      const fromIndex = parseInt(data.replace('sort-', ''), 10)
                                      const toIndex = index
                                      if (fromIndex !== toIndex) {
                                        const newSort = [...sortColumns]
                                        const [removed] = newSort.splice(fromIndex, 1)
                                        newSort.splice(toIndex, 0, removed)
                                        setSortColumns(newSort)
                                      }
                                    }
                                  }}
                                >
                                  {/* Drag handle */}
                                  <div className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" title="Drag to reorder">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                                    </svg>
                                  </div>

                                  {/* Sort priority number - Click to edit */}
                                  {editingSortOrderIndex === index ? (
                                    <input
                                      type="number"
                                      min="1"
                                      max={sortColumns.length}
                                      value={sortOrderInputValue}
                                      onChange={(e) => setSortOrderInputValue(e.target.value)}
                                      onBlur={() => {
                                        const newPosition = parseInt(sortOrderInputValue, 10)
                                        if (newPosition >= 1 && newPosition <= sortColumns.length && newPosition !== index + 1) {
                                          const newSort = [...sortColumns]
                                          const [removed] = newSort.splice(index, 1)
                                          newSort.splice(newPosition - 1, 0, removed)
                                          setSortColumns(newSort)
                                        }
                                        setEditingSortOrderIndex(null)
                                        setSortOrderInputValue('')
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.target.blur()
                                        } else if (e.key === 'Escape') {
                                          setEditingSortOrderIndex(null)
                                          setSortOrderInputValue('')
                                        }
                                      }}
                                      className="w-8 h-6 text-center bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full border-2 border-blue-500 focus:outline-none"
                                      autoFocus
                                    />
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingSortOrderIndex(index)
                                        setSortOrderInputValue(String(index + 1))
                                      }}
                                      className="w-6 h-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 cursor-pointer transition-colors"
                                      title="Click to change order"
                                    >
                                      {index + 1}
                                    </button>
                                  )}

                                  {/* Column dropdown - Searchable with smart positioning */}
                                  <div className="relative flex-1 min-w-[120px]" data-sort-column-dropdown ref={(el) => {
                                    // Store ref for position calculation
                                    if (el) el._dropdownRef = el
                                  }}>
                                    {sortColumnDropdownOpen === index ? (
                                      // Search input replaces button when open
                                      <input
                                        type="text"
                                        value={sortColumnSearchQuery}
                                        onChange={(e) => setSortColumnSearchQuery(e.target.value)}
                                        placeholder="Type to search..."
                                        className="w-full px-2 py-1.5 border border-blue-500 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') {
                                            setSortColumnDropdownOpen(null)
                                            setSortColumnSearchQuery('')
                                          }
                                        }}
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSortColumnDropdownOpen(index)
                                          setSortColumnSearchQuery('')
                                        }}
                                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 text-left flex items-center justify-between"
                                      >
                                        <span>{COLUMNS.find(c => c.key === sort.column)?.label || sort.column}</span>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>
                                    )}

                                    {sortColumnDropdownOpen === index && (
                                      <div
                                        className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-[50vh] overflow-y-auto"
                                        style={{
                                          // Smart positioning: check if more space above or below
                                          ...((() => {
                                            const el = document.querySelector(`[data-sort-column-dropdown]`)
                                            if (el) {
                                              const rect = el.getBoundingClientRect()
                                              const spaceBelow = window.innerHeight - rect.bottom
                                              const spaceAbove = rect.top
                                              if (spaceBelow < 200 && spaceAbove > spaceBelow) {
                                                return { bottom: '100%', marginBottom: '4px' }
                                              }
                                            }
                                            return { top: '100%', marginTop: '4px' }
                                          })())
                                        }}
                                      >
                                        {COLUMNS
                                          .filter(col => col.key !== 'select' && col.key !== 'actions')
                                          .filter(col => {
                                            if (!sortColumnSearchQuery.trim()) return true
                                            const searchLower = sortColumnSearchQuery.toLowerCase()
                                            return col.label.toLowerCase().includes(searchLower) || col.key.toLowerCase().includes(searchLower)
                                          })
                                          .sort((a, b) => a.label.localeCompare(b.label))
                                          .map(col => {
                                            const isDisabled = sortColumns.some((s, i) => i !== index && s.column === col.key)
                                            return (
                                              <button
                                                key={col.key}
                                                type="button"
                                                disabled={isDisabled}
                                                onClick={() => {
                                                  if (!isDisabled) {
                                                    setSortColumns(sortColumns.map((s, i) =>
                                                      i === index ? { ...s, column: col.key } : s
                                                    ))
                                                    setSortColumnDropdownOpen(null)
                                                    setSortColumnSearchQuery('')
                                                  }
                                                }}
                                                className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
                                                  isDisabled
                                                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                                    : sort.column === col.key
                                                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                                      : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                                                }`}
                                              >
                                                {sort.column === col.key && <span className="text-blue-600">✓</span>}
                                                <span className={sort.column === col.key ? '' : 'ml-5'}>{col.label}</span>
                                              </button>
                                            )
                                          })
                                        }
                                        {sortColumnSearchQuery.trim() &&
                                          COLUMNS.filter(col => col.key !== 'select' && col.key !== 'actions')
                                            .filter(col => col.label.toLowerCase().includes(sortColumnSearchQuery.toLowerCase()) || col.key.toLowerCase().includes(sortColumnSearchQuery.toLowerCase()))
                                            .length === 0 && (
                                          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                                            No columns found
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Direction toggle */}
                                  <button
                                    onClick={() => {
                                      setSortColumns(sortColumns.map((s, i) =>
                                        i === index ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s
                                      ))
                                    }}
                                    className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
                                      sort.dir === 'asc'
                                        ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                        : 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                                    }`}
                                  >
                                    {sort.dir === 'asc' ? '↑ ' : '↓ '}{getSortDirectionLabel(COLUMNS.find(c => c.key === sort.column)?.column_type, sort.dir)}
                                  </button>

                                  {/* Move up/down buttons */}
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      onClick={() => {
                                        if (index === 0) return
                                        const newSort = [...sortColumns]
                                        const temp = newSort[index]
                                        newSort[index] = newSort[index - 1]
                                        newSort[index - 1] = temp
                                        setSortColumns(newSort)
                                      }}
                                      disabled={index === 0}
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                                      title="Move up (higher priority)"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (index === sortColumns.length - 1) return
                                        const newSort = [...sortColumns]
                                        const temp = newSort[index]
                                        newSort[index] = newSort[index + 1]
                                        newSort[index + 1] = temp
                                        setSortColumns(newSort)
                                      }}
                                      disabled={index === sortColumns.length - 1}
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                                      title="Move down (lower priority)"
                                    >
                                      ▼
                                    </button>
                                  </div>

                                  {/* Delete button */}
                                  <button
                                    onClick={() => setSortColumns(sortColumns.filter((_, i) => i !== index))}
                                    className="p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 border border-gray-300 dark:border-gray-500 rounded hover:border-red-300 dark:hover:border-red-500 transition-colors"
                                  >
                                    <span className="text-xs font-bold">✕</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Help text */}
                          {sortColumns.length > 0 && (
                            <div className="mt-2 text-center">
                              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                Sorted by {sortColumns.length} column{sortColumns.length !== 1 ? 's' : ''} in order shown. Drag or click number to reorder.
                              </span>
                            </div>
                          )}
                        </div>
                        )}
                      </div>

                      {/* Group By Panel - Multiple Columns - Collapsible */}
                      <div className="mt-4">
                        <button
                          onClick={() => setGroupSectionCollapsed(!groupSectionCollapsed)}
                          className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            Group By
                            {groupByColumns.length > 0 && (
                              <span className="text-xs font-normal text-purple-600 dark:text-purple-400">({groupByColumns.length} column{groupByColumns.length !== 1 ? 's' : ''})</span>
                            )}
                          </span>
                          <span className={`transform transition-transform ${groupSectionCollapsed ? '' : 'rotate-180'}`}>▼</span>
                        </button>
                        {!groupSectionCollapsed && (
                        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30">
                          {/* Add group column button */}
                          <div className="flex items-center gap-2 mb-3">
                            <button
                              onClick={() => {
                                // Find first column alphabetically that isn't already in groupByColumns
                                const availableCols = COLUMNS.filter(col =>
                                  col.key !== 'select' &&
                                  col.key !== 'actions' &&
                                  col.key !== 'id' &&
                                  !groupByColumns.includes(col.key)
                                ).sort((a, b) => a.label.localeCompare(b.label))
                                if (availableCols.length > 0) {
                                  const newGroupByColumns = [...groupByColumns, availableCols[0].key]
                                  setGroupByColumns(newGroupByColumns)
                                  setGroupByColumn(newGroupByColumns[0]) // Keep legacy in sync with first
                                  setCollapsedGroups(new Set())
                                }
                              }}
                              className="px-3 py-1.5 border border-purple-300 dark:border-purple-500 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                            >
                              +Group Column
                            </button>
                            {groupByColumns.length > 0 && (
                              <button
                                onClick={() => {
                                  setGroupByColumns([])
                                  setGroupByColumn(null)
                                  setCollapsedGroups(new Set())
                                }}
                                className="ml-auto px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              >
                                Clear All
                              </button>
                            )}
                          </div>

                          {/* Group columns list */}
                          {groupByColumns.length === 0 ? (
                            <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 italic">
                              No grouping. Click +Group Column to add one.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {groupByColumns.map((groupCol, index) => (
                                <div
                                  key={`${groupCol}-${index}`}
                                  className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg"
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', index.toString())
                                    e.dataTransfer.effectAllowed = 'move'
                                    e.currentTarget.style.opacity = '0.5'
                                  }}
                                  onDragEnd={(e) => {
                                    e.currentTarget.style.opacity = '1'
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = 'move'
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault()
                                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
                                    const toIndex = index
                                    if (fromIndex !== toIndex) {
                                      const newGroupByColumns = [...groupByColumns]
                                      const [removed] = newGroupByColumns.splice(fromIndex, 1)
                                      newGroupByColumns.splice(toIndex, 0, removed)
                                      setGroupByColumns(newGroupByColumns)
                                      setGroupByColumn(newGroupByColumns[0])
                                      setCollapsedGroups(new Set())
                                    }
                                  }}
                                >
                                  {/* Drag handle */}
                                  <div className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" title="Drag to reorder">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                                    </svg>
                                  </div>

                                  {/* Order number - Click to edit */}
                                  {editingGroupOrderIndex === index ? (
                                    <input
                                      type="number"
                                      min="1"
                                      max={groupByColumns.length}
                                      value={groupOrderInputValue}
                                      onChange={(e) => setGroupOrderInputValue(e.target.value)}
                                      onBlur={() => {
                                        const newPosition = parseInt(groupOrderInputValue, 10)
                                        if (newPosition >= 1 && newPosition <= groupByColumns.length && newPosition !== index + 1) {
                                          const newGroupByColumns = [...groupByColumns]
                                          const [removed] = newGroupByColumns.splice(index, 1)
                                          newGroupByColumns.splice(newPosition - 1, 0, removed)
                                          setGroupByColumns(newGroupByColumns)
                                          setGroupByColumn(newGroupByColumns[0])
                                          setCollapsedGroups(new Set())
                                        }
                                        setEditingGroupOrderIndex(null)
                                        setGroupOrderInputValue('')
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.target.blur()
                                        } else if (e.key === 'Escape') {
                                          setEditingGroupOrderIndex(null)
                                          setGroupOrderInputValue('')
                                        }
                                      }}
                                      className="w-8 h-6 text-center bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full border-2 border-purple-500 focus:outline-none"
                                      autoFocus
                                    />
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingGroupOrderIndex(index)
                                        setGroupOrderInputValue(String(index + 1))
                                      }}
                                      className="w-6 h-6 flex items-center justify-center bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-800 cursor-pointer transition-colors"
                                      title="Click to change order"
                                    >
                                      {index + 1}
                                    </button>
                                  )}

                                  {/* Column dropdown - Searchable with smart positioning */}
                                  <div className="relative flex-1 min-w-[120px]" data-group-column-dropdown={index}>
                                    {groupByDropdownOpen === index ? (
                                      <input
                                        type="text"
                                        data-group-input={index}
                                        value={groupBySearchQuery}
                                        onChange={(e) => setGroupBySearchQuery(e.target.value)}
                                        placeholder="Type to search..."
                                        className="w-full px-2 py-1.5 border border-purple-500 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 focus:outline-none"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') {
                                            setGroupByDropdownOpen(null)
                                            setGroupBySearchQuery('')
                                          }
                                        }}
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setGroupByDropdownOpen(index)
                                          setGroupBySearchQuery('')
                                        }}
                                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 text-left flex items-center justify-between"
                                      >
                                        <span>{COLUMNS.find(c => c.key === groupCol)?.label || groupCol}</span>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>
                                    )}

                                    {groupByDropdownOpen === index && (
                                      <div
                                        className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-[50vh] overflow-y-auto"
                                        style={{ top: '100%', marginTop: '4px' }}
                                      >
                                        {COLUMNS
                                          .filter(col => col.key !== 'select' && col.key !== 'actions' && col.key !== 'id')
                                          .filter(col => {
                                            if (!groupBySearchQuery.trim()) return true
                                            const searchLower = groupBySearchQuery.toLowerCase()
                                            return col.label.toLowerCase().includes(searchLower) || col.key.toLowerCase().includes(searchLower)
                                          })
                                          .sort((a, b) => a.label.localeCompare(b.label))
                                          .map(col => {
                                            const isDisabled = groupByColumns.some((g, i) => i !== index && g === col.key)
                                            return (
                                              <button
                                                key={col.key}
                                                type="button"
                                                disabled={isDisabled}
                                                onClick={() => {
                                                  if (!isDisabled) {
                                                    const newGroupByColumns = groupByColumns.map((g, i) =>
                                                      i === index ? col.key : g
                                                    )
                                                    setGroupByColumns(newGroupByColumns)
                                                    setGroupByColumn(newGroupByColumns[0]) // Keep legacy in sync
                                                    setGroupByDropdownOpen(null)
                                                    setGroupBySearchQuery('')
                                                    setCollapsedGroups(new Set())
                                                  }
                                                }}
                                                className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 ${
                                                  isDisabled
                                                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                                    : groupCol === col.key
                                                      ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                                                      : 'text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/30'
                                                }`}
                                              >
                                                {groupCol === col.key && <span className="text-purple-600">✓</span>}
                                                <span className={groupCol === col.key ? '' : 'ml-5'}>{col.label}</span>
                                              </button>
                                            )
                                          })
                                        }
                                        {groupBySearchQuery.trim() &&
                                          COLUMNS.filter(col => col.key !== 'select' && col.key !== 'actions' && col.key !== 'id')
                                            .filter(col => col.label.toLowerCase().includes(groupBySearchQuery.toLowerCase()) || col.key.toLowerCase().includes(groupBySearchQuery.toLowerCase()))
                                            .length === 0 && (
                                          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                                            No columns found
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Move up/down buttons */}
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      onClick={() => {
                                        if (index === 0) return
                                        const newGroupByColumns = [...groupByColumns]
                                        const temp = newGroupByColumns[index]
                                        newGroupByColumns[index] = newGroupByColumns[index - 1]
                                        newGroupByColumns[index - 1] = temp
                                        setGroupByColumns(newGroupByColumns)
                                        setGroupByColumn(newGroupByColumns[0])
                                        setCollapsedGroups(new Set())
                                      }}
                                      disabled={index === 0}
                                      className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                                      title="Move up (higher priority)"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (index === groupByColumns.length - 1) return
                                        const newGroupByColumns = [...groupByColumns]
                                        const temp = newGroupByColumns[index]
                                        newGroupByColumns[index] = newGroupByColumns[index + 1]
                                        newGroupByColumns[index + 1] = temp
                                        setGroupByColumns(newGroupByColumns)
                                        setGroupByColumn(newGroupByColumns[0])
                                        setCollapsedGroups(new Set())
                                      }}
                                      disabled={index === groupByColumns.length - 1}
                                      className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                                      title="Move down (lower priority)"
                                    >
                                      ▼
                                    </button>
                                  </div>

                                  {/* Delete button */}
                                  <button
                                    onClick={() => {
                                      const newGroupByColumns = groupByColumns.filter((_, i) => i !== index)
                                      setGroupByColumns(newGroupByColumns)
                                      setGroupByColumn(newGroupByColumns[0] || null) // Keep legacy in sync
                                      setCollapsedGroups(new Set())
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 border border-gray-300 dark:border-gray-500 rounded hover:border-red-300 dark:hover:border-red-500 transition-colors"
                                    title="Remove group column"
                                  >
                                    <span className="text-xs font-bold">✕</span>
                                  </button>
                                </div>
                              ))}

                              {/* Group info */}
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center mt-1">
                                Grouped by {groupByColumns.length} column{groupByColumns.length !== 1 ? 's' : ''} in order shown. Drag or click number to reorder.</div>
                            </div>
                          )}

                          {/* Collapse/Expand controls */}
                          {groupByColumns.length > 0 && (
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() => {
                                  // Collapse all groups at all levels - build all possible paths
                                  const allPaths = new Set()

                                  // Helper to get display value for a column (matches getGroupDisplayValue in table render)
                                  const getDisplayValue = (entry, colKey) => {
                                    // Search by key or column_name to handle saved views with different formats
                                    const groupColumnDef = COLUMNS.find(c => c.key === colKey || c.column_name === colKey)
                                    const isLookupColumn = groupColumnDef?.column_type === 'lookup'
                                    const lookupOptions = isLookupColumn && groupColumnDef?.id ? (columnChoices[groupColumnDef.id] || []) : []
                                    // Use column_name if different from key to access the entry data
                                    const actualKey = groupColumnDef?.column_name || groupColumnDef?.key || colKey
                                    const rawValue = entry[actualKey] ?? entry[colKey]

                                    if (rawValue && typeof rawValue === 'object' && rawValue.display !== undefined) {
                                      return rawValue.display || '(empty)'
                                    } else if (isLookupColumn && rawValue != null && lookupOptions.length > 0) {
                                      const matchingOption = lookupOptions.find(opt =>
                                        opt.id === rawValue || parseInt(opt.id) === parseInt(rawValue)
                                      )
                                      return matchingOption?.display || `ID: ${rawValue}`
                                    }
                                    return rawValue ?? '(empty)'
                                  }

                                  // Build all paths for each row
                                  filteredAndSorted.forEach(entry => {
                                    let path = ''
                                    groupByColumns.forEach((colKey, idx) => {
                                      const value = getDisplayValue(entry, colKey)
                                      path = path ? `${path}|${value}` : value
                                      allPaths.add(path)
                                    })
                                  })
                                  setCollapsedGroups(allPaths)
                                }}
                                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded transition-colors"
                              >
                                Collapse All
                              </button>
                              <button
                                onClick={() => setCollapsedGroups(new Set())}
                                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded transition-colors"
                              >
                                Expand All
                              </button>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                                Click row headers to collapse/expand
                              </span>
                            </div>
                          )}
                        </div>
                        )}
                      </div>

                      {/* Display Options Panel */}
                      <div className="mt-4">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Display Options
                        </label>
                        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showFilters}
                              onChange={(e) => setShowFilters(e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Show inline column filters</span>
                          </label>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                            Display filter inputs in the table header row
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* COLUMN 3: Column Visibility - Combined with Default */}
                    <div className="border-l border-gray-200 dark:border-gray-700 pl-4 pr-2 relative flex flex-col overflow-y-auto">
                      {/* Disabled overlay */}
                      {isViewEditingDisabled && (
                        <div className="absolute inset-0 bg-gray-100/70 dark:bg-gray-800/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
                          <div className="text-center px-4">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              Click "+ Create New" or edit an existing view to modify columns
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          Columns:
                        </label>
                      </div>
                      {/* Column search input */}
                      <div className="relative mb-2">
                        <input
                          type="text"
                          value={columnSearchQuery}
                          onChange={(e) => setColumnSearchQuery(e.target.value)}
                          placeholder="Search columns..."
                          className="w-full px-2 py-1 pl-7 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {columnSearchQuery && (
                          <button
                            onClick={() => setColumnSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {/* Side-by-side Visible and Hidden columns */}
                      <div className="flex gap-2">
                        {(() => {
                          // Filter columns by search query
                          const searchLower = columnSearchQuery.toLowerCase().trim()
                          const filteredCols = COLUMNS.filter(col =>
                            col.key !== 'select' &&
                            col.key !== 'actions' &&
                            (!searchLower || col.label.toLowerCase().includes(searchLower) || col.key.toLowerCase().includes(searchLower))
                          )

                          // Get the current visibility order
                          const currentOrder = visibilityColumnOrder || filteredCols.map(c => c.key)

                          // Split into visible and hidden
                          const visibleCols = filteredCols
                            .filter(col => visibleColumns[col.key] !== false)
                            .sort((a, b) => {
                              const aIndex = currentOrder.indexOf(a.key)
                              const bIndex = currentOrder.indexOf(b.key)
                              if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label)
                              if (aIndex === -1) return 1
                              if (bIndex === -1) return -1
                              return aIndex - bIndex
                            })
                          const hiddenCols = filteredCols
                            .filter(col => visibleColumns[col.key] === false)
                            .sort((a, b) => a.label.localeCompare(b.label))

                          const renderColumnItem = (column, index, isVisible) => (
                            <div
                              key={column.key}
                              draggable="true"
                              onDragStart={(e) => {
                                setDraggedVisibilityColumn(column.key)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', column.key)
                              }}
                              onDragEnd={() => {
                                setTimeout(() => {
                                  setDraggedVisibilityColumn(null)
                                  setDragOverVisibilityColumn(null)
                                }, 0)
                              }}
                              onDragOver={(e) => {
                                e.preventDefault()
                                if (draggedVisibilityColumn && draggedVisibilityColumn !== column.key) {
                                  setDragOverVisibilityColumn(column.key)
                                }
                              }}
                              onDragLeave={() => setDragOverVisibilityColumn(null)}
                              onDrop={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                if (draggedVisibilityColumn && draggedVisibilityColumn !== column.key) {
                                  // Check if dragged column visibility needs to change
                                  const draggedIsVisible = visibleColumns[draggedVisibilityColumn] !== false
                                  const targetIsVisible = isVisible

                                  // Update visibility if moving between zones
                                  if (draggedIsVisible !== targetIsVisible) {
                                    setVisibleColumns({ ...visibleColumns, [draggedVisibilityColumn]: targetIsVisible })
                                  }

                                  // Update order
                                  const existingOrder = visibilityColumnOrder || []
                                  const allKeys = filteredCols.map(c => c.key)
                                  const fullOrder = [...existingOrder]
                                  allKeys.forEach(key => {
                                    if (!fullOrder.includes(key)) fullOrder.push(key)
                                  })

                                  const draggedIndex = fullOrder.indexOf(draggedVisibilityColumn)
                                  const targetIndex = fullOrder.indexOf(column.key)

                                  if (draggedIndex !== -1 && targetIndex !== -1) {
                                    fullOrder.splice(draggedIndex, 1)
                                    fullOrder.splice(targetIndex, 0, draggedVisibilityColumn)
                                    setVisibilityColumnOrder(fullOrder)
                                  }
                                }
                                setDraggedVisibilityColumn(null)
                                setDragOverVisibilityColumn(null)
                              }}
                              className={`relative flex items-center gap-1 px-1.5 py-0.5 rounded select-none transition-all text-[10px] cursor-grab active:cursor-grabbing ${
                                isVisible
                                  ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-800'
                                  : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                              } ${draggedVisibilityColumn === column.key ? 'opacity-50 scale-95 border-dashed border-orange-400' : ''} ${dragOverVisibilityColumn === column.key ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50' : ''}`}
                            >
                              {dragOverVisibilityColumn === column.key && draggedVisibilityColumn && (
                                <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
                              )}
                              {/* Drag handle */}
                              <span className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">⠿</span>
                              {/* Position number input for visible columns */}
                              {isVisible && (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={index + 1}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.target.select()
                                  }}
                                  onFocus={(e) => {
                                    const target = e.target
                                    setTimeout(() => target.select(), 0)
                                  }}
                                  onMouseUp={(e) => e.preventDefault()}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    const newPos = parseInt(e.target.value) || 1
                                    const clampedPos = Math.max(1, Math.min(newPos, visibleCols.length))

                                    // Reorder: move this column to the new position
                                    const existingOrder = visibilityColumnOrder || []
                                    const allKeys = filteredCols.map(c => c.key)
                                    const fullOrder = [...existingOrder]
                                    allKeys.forEach(key => {
                                      if (!fullOrder.includes(key)) fullOrder.push(key)
                                    })

                                    // Get visible columns in current order
                                    const visibleKeys = fullOrder.filter(key => visibleColumns[key] !== false)
                                    const currentIndex = visibleKeys.indexOf(column.key)
                                    const targetIndex = clampedPos - 1

                                    if (currentIndex !== -1 && currentIndex !== targetIndex) {
                                      // Remove from current position
                                      visibleKeys.splice(currentIndex, 1)
                                      // Insert at new position
                                      visibleKeys.splice(targetIndex, 0, column.key)

                                      // Rebuild full order: visible columns first in new order, then hidden
                                      const hiddenKeys = fullOrder.filter(key => visibleColumns[key] === false)
                                      setVisibilityColumnOrder([...visibleKeys, ...hiddenKeys])
                                    }
                                  }}
                                  className="w-6 text-[9px] text-center text-green-700 dark:text-green-300 font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 hover:border-green-400 focus:border-green-500 focus:outline-none rounded [appearance:textfield]"
                                />
                              )}
                              <label className="flex items-center gap-1 cursor-pointer flex-1 min-w-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    setVisibleColumns({ ...visibleColumns, [column.key]: !isVisible })
                                  }}
                                  className={`w-3 h-3 rounded flex-shrink-0 ${
                                    isVisible
                                      ? 'border-green-400 text-green-600 focus:ring-green-500'
                                      : 'border-gray-300 text-blue-600 focus:ring-blue-500'
                                  } focus:ring-offset-0`}
                                />
                                <span
                                  className={`font-medium ${
                                    isVisible
                                      ? 'text-green-800 dark:text-green-200'
                                      : 'text-gray-600 dark:text-gray-400'
                                  }`}
                                >
                                  {column.label}
                                </span>
                              </label>
                              {/* Show Filter toggle - pushed to end */}
                              {isVisible && showFilters && column.key !== 'select' && column.key !== 'actions' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setColumnShowFilters(prev => ({
                                      ...prev,
                                      [column.key]: !(prev[column.key] ?? true)
                                    }))
                                  }}
                                  className={`flex-shrink-0 ml-auto w-4 h-4 flex items-center justify-center rounded text-[9px] font-medium transition-colors ${
                                    columnShowFilters[column.key] ?? true
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  }`}
                                  title={columnShowFilters[column.key] ?? true ? 'Hide filter for this column' : 'Show filter for this column'}
                                >
                                  {columnShowFilters[column.key] ?? true ? '⊜' : '⊝'}
                                </button>
                              )}
                            </div>
                          )

                          // Handle drop on the zone itself (for empty zones or dropping at end)
                          const handleZoneDrop = (e, makeVisible) => {
                            e.preventDefault()
                            if (draggedVisibilityColumn) {
                              const draggedIsVisible = visibleColumns[draggedVisibilityColumn] !== false
                              if (draggedIsVisible !== makeVisible) {
                                setVisibleColumns({ ...visibleColumns, [draggedVisibilityColumn]: makeVisible })
                              }
                            }
                            setDraggedVisibilityColumn(null)
                            setDragOverVisibilityColumn(null)
                          }

                          // Select all / Hide all handlers
                          const handleSelectAll = () => {
                            const newVisibility = { ...visibleColumns }
                            filteredCols.forEach(col => {
                              newVisibility[col.key] = true
                            })
                            setVisibleColumns(newVisibility)
                          }

                          const handleHideAll = () => {
                            const newVisibility = { ...visibleColumns }
                            filteredCols.forEach(col => {
                              newVisibility[col.key] = false
                            })
                            setVisibleColumns(newVisibility)
                          }

                          return (
                            <>
                              {/* Visible Columns - auto width based on content */}
                              <div className="min-w-0" style={{ flex: visibleCols.length <= 20 ? '0 0 auto' : '1 1 0%' }}>
                                <div className="text-[10px] font-semibold text-green-700 dark:text-green-400 mb-1 px-1 flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    Visible ({visibleCols.length})
                                  </div>
                                  <button
                                    onClick={handleHideAll}
                                    className="text-[9px] text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    Deselect All
                                  </button>
                                </div>
                                <div
                                  className={`border rounded p-1 transition-colors ${
                                    draggedVisibilityColumn && visibleColumns[draggedVisibilityColumn] === false
                                      ? 'border-green-400 border-2 bg-green-100/50 dark:bg-green-900/30'
                                      : 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10'
                                  }`}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => handleZoneDrop(e, true)}
                                >
                                  {visibleCols.length === 0 ? (
                                    <div className="text-[10px] text-gray-400 text-center py-4">
                                      {draggedVisibilityColumn ? '⬇️ Drop here to show' : 'No visible columns'}
                                    </div>
                                  ) : (
                                    <div
                                      className={`${visibleCols.length <= 20 ? 'columns-1' : visibleCols.length <= 40 ? 'columns-2' : 'columns-3'} gap-2`}
                                      style={{ columnFill: 'balance' }}
                                    >
                                      {visibleCols.map((col, idx) => (
                                        <div key={col.key} className="break-inside-avoid mb-1">
                                          {renderColumnItem(col, idx, true)}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Hidden Columns - takes remaining space */}
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 px-1 flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                    Hidden ({hiddenCols.length})
                                  </div>
                                  <button
                                    onClick={handleSelectAll}
                                    className="text-[9px] text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    Select All
                                  </button>
                                </div>
                                <div
                                  className={`border rounded p-1 transition-colors ${
                                    draggedVisibilityColumn && visibleColumns[draggedVisibilityColumn] !== false
                                      ? 'border-gray-400 border-2 bg-gray-200/50 dark:bg-gray-700/50'
                                      : 'border-gray-200 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30'
                                  }`}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => handleZoneDrop(e, false)}
                                >
                                  {hiddenCols.length === 0 ? (
                                    <div className="text-[10px] text-gray-400 text-center py-4">
                                      {draggedVisibilityColumn ? '⬇️ Drop here to hide' : 'No hidden columns'}
                                    </div>
                                  ) : (
                                    <div
                                      className={`${hiddenCols.length <= 20 ? 'columns-1' : hiddenCols.length <= 40 ? 'columns-2' : 'columns-3'} gap-2`}
                                      style={{ columnFill: 'balance' }}
                                    >
                                      {hiddenCols.map((col, idx) => (
                                        <div key={col.key} className="break-inside-avoid mb-1">
                                          {renderColumnItem(col, idx, false)}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                      {/* Grouped columns section - only when multiple groups exist */}
                      {(() => {
                        const uniqueGroups = new Set(
                          COLUMNS
                            .filter(col => col.key !== 'select' && col.key !== 'actions')
                            .map(col => col.column_group || 'Other')
                        )
                        // Only show grouped view if there are multiple column groups
                        if (uniqueGroups.size <= 1) return null

                        return null // For now, skip grouped view - side by side is cleaner
                      })()}
                      {/* Legacy grouped column list - keeping for tables with column_group */}
                      <div className="hidden">
                        {(() => {
                          // Filter columns by search query
                          const searchLower = columnSearchQuery.toLowerCase().trim()
                          const filteredCols = COLUMNS.filter(col =>
                            col.key !== 'select' &&
                            col.key !== 'actions' &&
                            (!searchLower || col.label.toLowerCase().includes(searchLower) || col.key.toLowerCase().includes(searchLower))
                          )

                          // Group columns by column_group
                          const groupedColumns = {}
                          filteredCols.forEach(col => {
                            const group = col.column_group || 'Other'
                            if (!groupedColumns[group]) {
                              groupedColumns[group] = []
                            }
                            groupedColumns[group].push(col)
                          })

                          // Sort columns within each group: checked first (alphabetical), then unchecked (alphabetical)
                          Object.keys(groupedColumns).forEach(group => {
                            const cols = groupedColumns[group]
                            const checkedCols = cols
                              .filter(col => visibleColumns[col.key] !== false)
                              .sort((a, b) => a.label.localeCompare(b.label))
                            const uncheckedCols = cols
                              .filter(col => visibleColumns[col.key] === false)
                              .sort((a, b) => a.label.localeCompare(b.label))
                            groupedColumns[group] = [...checkedCols, ...uncheckedCols]
                          })

                          // Sort groups alphabetically, but put "Other" last
                          const sortedGroups = Object.keys(groupedColumns).sort((a, b) => {
                            if (a === 'Other') return 1
                            if (b === 'Other') return -1
                            return a.localeCompare(b)
                          })

                          // Check if we should collapse all groups initially
                          const shouldCollapseAll = collapsedColumnGroups.has('__all_collapsed__')
                          if (shouldCollapseAll && sortedGroups.length > 0) {
                            // Initialize all groups as collapsed
                            const allGroups = new Set(sortedGroups)
                            setCollapsedColumnGroups(allGroups)
                          }

                          // Check if we should render flat (no group headers)
                          // Render flat when there's only one group (typically "Other" when no column_group defined)
                          const renderFlat = sortedGroups.length === 1

                          if (renderFlat) {
                            return null // Using new side-by-side layout instead
                          }

                          return sortedGroups.map(groupName => {
                            const groupCols = groupedColumns[groupName]
                            const isCollapsed = collapsedColumnGroups.has(groupName)
                            const checkedCount = groupCols.filter(col => visibleColumns[col.key] !== false).length
                            const totalCount = groupCols.length

                            return (
                              <div key={groupName} className="mb-1">
                                {/* Group Header - Collapsible */}
                                <button
                                  onClick={() => {
                                    const newCollapsed = new Set(collapsedColumnGroups)
                                    if (isCollapsed) {
                                      newCollapsed.delete(groupName)
                                    } else {
                                      newCollapsed.add(groupName)
                                    }
                                    newCollapsed.delete('__all_collapsed__') // Clear the initial marker
                                    setCollapsedColumnGroups(newCollapsed)
                                  }}
                                  className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px]">{isCollapsed ? '▶' : '▼'}</span>
                                    <span>{groupName}</span>
                                  </div>
                                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                    {checkedCount}/{totalCount}
                                  </span>
                                </button>

                                {/* Group Columns - Hidden when collapsed */}
                                {!isCollapsed && (
                                  <div className="grid grid-cols-2 gap-0.5 mt-0.5 pl-2">
                                    {groupCols.map((column) => (
                          <div
                            key={column.key}
                            draggable="false"
                            onDragOver={(e) => {
                              e.preventDefault()
                              if (draggedVisibilityColumn && draggedVisibilityColumn !== column.key) {
                                setDragOverVisibilityColumn(column.key)
                              }
                            }}
                            onDragLeave={() => setDragOverVisibilityColumn(null)}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              console.log('[Drag] Drop event:', { draggedVisibilityColumn, targetColumn: column.key, editingDefaultSetup })
                              if (draggedVisibilityColumn && draggedVisibilityColumn !== column.key) {
                                const filteredCols = COLUMNS.filter(col => col.key !== 'select' && col.key !== 'actions')

                                // Build the ACTUAL current order being displayed (must match render logic)
                                let fullOrderedCols
                                if (editingDefaultSetup) {
                                  // When editing default setup, use the sorted order (checked first)
                                  const orderedCols = visibilityColumnOrder
                                    ? visibilityColumnOrder.map(key => filteredCols.find(c => c.key === key)).filter(Boolean)
                                    : filteredCols.sort((a, b) => a.label.localeCompare(b.label))
                                  const orderedKeys = new Set(orderedCols.map(c => c.key))
                                  const newCols = filteredCols.filter(c => !orderedKeys.has(c.key))
                                  const allCols = [...orderedCols, ...newCols]

                                  // Sort: checked columns first, then unchecked (matching display logic)
                                  fullOrderedCols = allCols.sort((a, b) => {
                                    const aChecked = defaultColumnsForNewViews[a.key] !== false
                                    const bChecked = defaultColumnsForNewViews[b.key] !== false
                                    if (aChecked && !bChecked) return -1
                                    if (!aChecked && bChecked) return 1
                                    return 0
                                  })
                                } else {
                                  // Normal mode: use custom order if set, otherwise alphabetical
                                  const orderedCols = visibilityColumnOrder
                                    ? visibilityColumnOrder.map(key => filteredCols.find(c => c.key === key)).filter(Boolean)
                                    : filteredCols.sort((a, b) => a.label.localeCompare(b.label))
                                  const orderedKeys = new Set(orderedCols.map(c => c.key))
                                  const newCols = filteredCols.filter(c => !orderedKeys.has(c.key))
                                  fullOrderedCols = [...orderedCols, ...newCols]
                                }

                                const currentOrder = fullOrderedCols.map(c => c.key)
                                const draggedIndex = currentOrder.indexOf(draggedVisibilityColumn)
                                const targetIndex = currentOrder.indexOf(column.key)
                                console.log('[Drag] Reordering:', { draggedIndex, targetIndex, currentOrder: currentOrder.length, order: currentOrder })

                                if (draggedIndex !== -1 && targetIndex !== -1) {
                                  currentOrder.splice(draggedIndex, 1)
                                  currentOrder.splice(targetIndex, 0, draggedVisibilityColumn)
                                  setVisibilityColumnOrder(currentOrder)
                                  console.log('[Drag] ✓ Order updated to:', currentOrder)
                                }
                              }
                            }}
                            className={`relative flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded select-none transition-all duration-150 ${
                              visibleColumns[column.key] !== false
                                ? 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 border-2 border-green-300 dark:border-green-700'
                                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-gray-300 dark:border-gray-600'
                            } ${draggedVisibilityColumn === column.key ? 'opacity-40 scale-95 border-dashed border-orange-400 bg-orange-50 dark:bg-orange-900/30' : ''} ${dragOverVisibilityColumn === column.key ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50' : ''}`}
                          >
                            {/* Drop indicator line - shows where item will be inserted */}
                            {dragOverVisibilityColumn === column.key && draggedVisibilityColumn && (
                              <div className="absolute -top-1 left-0 right-0 h-1 bg-blue-500 rounded-full shadow-lg shadow-blue-300 z-10">
                                <div className="absolute -left-1 -top-1 w-3 h-3 bg-blue-500 rounded-full" />
                                <div className="absolute -right-1 -top-1 w-3 h-3 bg-blue-500 rounded-full" />
                              </div>
                            )}
                            {/* Drag handle */}
                            <span
                              draggable="true"
                              onDragStart={(e) => {
                                e.stopPropagation()
                                setDraggedVisibilityColumn(column.key)
                                e.dataTransfer.effectAllowed = 'move'
                              }}
                              onDragEnd={(e) => {
                                // Use setTimeout to allow onDrop to fire first
                                setTimeout(() => {
                                  setDraggedVisibilityColumn(null)
                                  setDragOverVisibilityColumn(null)
                                }, 0)
                              }}
                              className="text-gray-400 cursor-grab active:cursor-grabbing text-sm hover:text-gray-600 dark:hover:text-gray-300"
                              onClick={(e) => e.stopPropagation()}
                              title="Drag to reorder columns"
                            >⠿</span>
                            {/* Visible checkbox (blue) - show/hide now */}
                            <input
                              type="checkbox"
                              checked={visibleColumns[column.key] !== false}
                              onChange={(e) => {
                                e.stopPropagation()
                                const isChecking = e.target.checked

                                // Update visibility
                                setVisibleColumns({
                                  ...visibleColumns,
                                  [column.key]: isChecking
                                })

                                // When checking a column, move it to the bottom of checked columns
                                if (isChecking && visibilityColumnOrder) {
                                  const currentOrder = [...visibilityColumnOrder]
                                  // Remove the column from its current position
                                  const index = currentOrder.indexOf(column.key)
                                  if (index > -1) {
                                    currentOrder.splice(index, 1)
                                  }

                                  // Find the position to insert: after the last checked column
                                  const allCols = COLUMNS.filter(col => col.key !== 'select' && col.key !== 'actions')
                                  const checkedKeys = allCols
                                    .filter(col => col.key !== column.key && visibleColumns[col.key] !== false)
                                    .map(col => col.key)

                                  // Find the last checked column in the current order
                                  let insertIndex = 0
                                  for (let i = currentOrder.length - 1; i >= 0; i--) {
                                    if (checkedKeys.includes(currentOrder[i])) {
                                      insertIndex = i + 1
                                      break
                                    }
                                  }

                                  // Insert at the position after the last checked column
                                  currentOrder.splice(insertIndex, 0, column.key)
                                  setVisibilityColumnOrder(currentOrder)
                                }
                              }}
                              className="rounded border-blue-400 w-4 h-4 text-blue-600 cursor-pointer flex-shrink-0"
                              title="Show/hide now"
                            />
                            {/* Column name */}
                            <span className={`flex-1 truncate font-medium ${
                              ['id', 'created_at', 'updated_at'].includes(column.key)
                                ? 'text-red-600 dark:text-red-400'
                                : ''
                            }`}>
                              {column.label}
                              {['id', 'created_at', 'updated_at'].includes(column.key) && ' 🔒'}
                            </span>
                          </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  </div>
                  {/* END MAIN GRID */}
                </div>
                {/* END PADDING WRAPPER */}
                </div>
                {/* END MODAL WRAPPER */}
              </>
            )}
          </div>

          {/* Collapse/Expand buttons (left) and Record count (right) */}
          <div className="flex justify-between items-center">
            {/* Collapse/Expand All - shown when grouping is active */}
            {groupByColumns.length > 0 && filteredAndSorted.length > 0 ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    // Collapse all groups - build all possible paths
                    const allPaths = new Set()
                    const getDisplayValue = (entry, colKey) => {
                      const groupColumnDef = COLUMNS.find(c => c.key === colKey || c.column_name === colKey)
                      const isLookupColumn = groupColumnDef?.column_type === 'lookup'
                      const lookupOptions = isLookupColumn && groupColumnDef?.id ? (columnChoices[groupColumnDef.id] || []) : []
                      const actualKey = groupColumnDef?.column_name || groupColumnDef?.key || colKey
                      const rawValue = entry[actualKey] ?? entry[colKey]
                      if (rawValue && typeof rawValue === 'object' && rawValue.display !== undefined) {
                        return rawValue.display || '(empty)'
                      } else if (isLookupColumn && rawValue != null && lookupOptions.length > 0) {
                        const matchingOption = lookupOptions.find(opt =>
                          opt.id === rawValue || parseInt(opt.id) === parseInt(rawValue)
                        )
                        return matchingOption?.display || `ID: ${rawValue}`
                      }
                      return rawValue ?? '(empty)'
                    }
                    filteredAndSorted.forEach(entry => {
                      let path = ''
                      groupByColumns.forEach((colKey) => {
                        const value = getDisplayValue(entry, colKey)
                        path = path ? `${path}|${value}` : value
                        allPaths.add(path)
                      })
                    })
                    setCollapsedGroups(allPaths)
                  }}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  title="Collapse All Groups"
                >
                  ▶ Collapse
                </button>
                <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
                <button
                  onClick={() => setCollapsedGroups(new Set())}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  title="Expand All Groups"
                >
                  ▼ Expand
                </button>
              </div>
            ) : (
              <div></div>
            )}

            {/* Showing count - right aligned */}
            <div className="flex items-center gap-2">
              {loadingMore && (
                <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <span className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></span>
                  Loading...
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {filteredAndSorted.length > MAX_RENDERED_ROWS
                  ? `Showing ${MAX_RENDERED_ROWS} of ${filteredAndSorted.length} matches (${entries.length} total)`
                  : filteredAndSorted.length === entries.length
                    ? `${filteredAndSorted.length} records`
                    : `${filteredAndSorted.length} of ${entries.length} records`}
              </span>
            </div>
          </div>
        </div>
        {/* END BOTTOM SECTION - Filters */}

        {/* Table Container with Border */}
        <div className="flex-1 min-h-0 p-4">
          {/* Table with Sticky Gradient Headers (Chapter 20.2) */}
          <div
            ref={scrollContainerRef}
            className="teeem-table-scroll h-full overflow-y-scroll overflow-x-scroll border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
          >
          <table className="border-collapse" style={{
            width: (() => {
              // Calculate total width from all visible columns
              const visibleCols = columnOrder.filter(key => key === 'select' || key === 'actions' || visibleColumns[key])
              const totalWidth = visibleCols.reduce((sum, key) => {
                return sum + (columnWidths[key] || 200)
              }, 0)
              return `${totalWidth}px`
            })()
          }}>
            <thead className="sticky top-0 z-10 backdrop-blur-sm">
            <tr className="bg-gradient-to-b from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800">
              {(() => {
                const visibleCols = columnOrder.filter(key => key === 'select' || key === 'actions' || visibleColumns[key])
                return visibleCols.map((colKey, index) => {
                const column = COLUMNS.find(c => c.key === colKey)
                if (!column) return null

                // Check if this is a system-generated column
                const isSystemGenerated = ['id', 'created_at', 'updated_at'].includes(colKey)
                const isFirst = index === 0
                const isLast = index === visibleCols.length - 1

                return (
                  <th
                    key={colKey}
                    onDragOver={(e) => handleDragOver(e, colKey)}
                    onDrop={(e) => handleDrop(e, colKey)}
                    onClick={(e) => {
                      // Only sort if clicking on the column content, not resize handle or drag icon
                      // Pass event for Shift+click multi-column sort
                      if (column.sortable && !e.defaultPrevented) {
                        handleSort(colKey, e)
                      }
                    }}
                    style={{
                      width: columnWidths[colKey],
                      minWidth: columnMinWidths[colKey] ?? 75,
                      maxWidth: columnWidths[colKey],
                      position: 'relative',
                      fontSize: '16px',
                      fontWeight: '600',
                      verticalAlign: 'top',
                      overflow: 'hidden',
                    }}
                    className={`group align-top ${colKey === 'select' ? 'px-2 py-3' : 'px-2 py-3'} text-white border-r-2 border-white/50 last:border-r-0 ${
                      isSystemGenerated ? 'bg-gradient-to-b from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700' : ''
                    } ${column.sortable ? 'cursor-pointer hover:bg-blue-400/20 dark:hover:bg-blue-600/20' : ''} ${
                      isFirst ? 'rounded-tl-lg' : ''
                    } ${isLast ? 'rounded-tr-lg' : ''} ${
                      column.header_align === 'center' ? 'text-center' : column.header_align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {/* Select All Checkbox (Chapter 20.1) */}
                    {colKey === 'select' ? (
                      <div className="flex items-center justify-center h-full">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === filteredAndSorted.length && filteredAndSorted.length > 0}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleSelectAll()
                          }}
                          className="h-4 w-4 rounded border-white/50 text-white bg-transparent focus:ring-white"
                        />
                      </div>
                    ) : (
                      <div className={`flex flex-col h-full gap-2 overflow-hidden ${
                        showFilters && (columnShowFilters[colKey] ?? true) && column.filterType ? 'justify-between' : 'justify-start'
                      }`}>
                        <div className="flex items-center gap-1 min-w-0">
                          {/* Only show drag handle in edit mode */}
                          {editIndividualMode && column.resizable && (
                            <div
                              draggable="true"
                              onDragStart={(e) => {
                                e.stopPropagation()
                                e.dataTransfer.setData('text/plain', colKey)
                                e.dataTransfer.effectAllowed = 'move'
                                handleDragStart(e, colKey)
                              }}
                              onDragEnd={(e) => {
                                e.stopPropagation()
                                handleDragEnd()
                              }}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                              }}
                              className="cursor-grab active:cursor-grabbing flex-shrink-0"
                              title="Drag to reorder column"
                            >
                              <Bars3Icon className="h-5 w-5 text-white/70 hover:text-white transition-colors" />
                            </div>
                          )}
                          <span className="truncate" title={column.label}>{column.label}</span>
                          {isSystemGenerated && <span className="ml-1 text-sm">🔒</span>}
                          {column.sortable && <SortIcon column={colKey} />}
                          {/* Schema Editor Cog Icon - only show in Edit Individual mode */}
                          {editIndividualMode && enableSchemaEditor && colKey !== 'select' && (
                            // Only show cog if column has a database ID (numeric) - system columns like 'id' primary key have no column record
                            column.id && typeof column.id === 'number' ? (
                              <button
                                onClick={async (e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  // Fetch the full column data from API to get all configuration including lookup settings
                                  try {
                                    const response = await api.get(`/api/v1/foundations/${foundationIdNumeric}`)
                                    const tableData = response.foundation || response.table
                                    if (response.success && tableData) {
                                      const fullColumn = tableData.columns.find(c => c.id === column.id)
                                      if (fullColumn) {
                                        setSelectedColumnForEdit(fullColumn)
                                      } else {
                                        // Fallback to basic column data if not found in API response
                                        setSelectedColumnForEdit({
                                          id: column.id,
                                          name: column.label,
                                          column_name: colKey,
                                          column_type: column.column_type || 'single_line_text',
                                          required: false
                                        })
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Error fetching column data:', error)
                                    // Fallback to basic column data on error
                                    setSelectedColumnForEdit({
                                      id: column.id,
                                      name: column.label,
                                      column_name: colKey,
                                      column_type: column.column_type || 'single_line_text',
                                      required: false
                                    })
                                  }
                                }}
                                className={`ml-2 p-1 rounded transition-colors ${
                                  isSystemGenerated
                                    ? 'hover:bg-red-500 dark:hover:bg-red-700'
                                    : 'hover:bg-blue-500 dark:hover:bg-blue-700'
                                }`}
                                title={isSystemGenerated ? 'Edit system-generated column schema' : 'Edit column schema'}
                              >
                                <Cog8ToothIcon className="h-4 w-4 text-orange-300 hover:text-white" />
                              </button>
                            ) : (
                              // System column without editable schema - show disabled cog
                              <span
                                className="ml-2 p-1 rounded opacity-50 cursor-not-allowed"
                                title="System column - cannot be edited"
                              >
                                <Cog8ToothIcon className="h-4 w-4 text-gray-400" />
                              </span>
                            )
                          )}
                        </div>

                        {/* Column Resize Handle */}
                        {column.resizable && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              handleResizeStart(e, colKey)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-transparent hover:bg-blue-300 dark:hover:bg-blue-500 cursor-col-resize z-20 transition-all"
                            style={{ cursor: 'col-resize' }}
                          />
                        )}

                        {/* Inline Column Filter (Chapter 20.1) - Show only if showFilters is true AND column filter is enabled */}
                        {showFilters && (columnShowFilters[colKey] ?? true) && column.filterType === 'text' && (
                          <input
                            type="text"
                            placeholder="Filter..."
                            value={columnFilterInputs[colKey] || ''}
                            onChange={(e) => handleColumnFilterChange(colKey, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-xs px-2 py-1 border border-blue-400 dark:border-blue-700 rounded focus:ring-1 focus:ring-white focus:border-white bg-blue-500 dark:bg-blue-700 text-white placeholder-blue-200 dark:placeholder-blue-300"
                          />
                        )}

                        {showFilters && (columnShowFilters[colKey] ?? true) && column.filterType === 'boolean' && (
                          <select
                            value={columnFilterInputs[colKey] || ''}
                            onChange={(e) => handleColumnFilterChange(colKey, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-xs px-2 py-1 border border-blue-400 dark:border-blue-700 rounded focus:ring-1 focus:ring-white focus:border-white bg-blue-500 dark:bg-blue-700 text-white"
                          >
                            <option value="">All</option>
                            <option value="true">✓ Checked</option>
                            <option value="false">✗ Unchecked</option>
                          </select>
                        )}

                        {showFilters && (columnShowFilters[colKey] ?? true) && column.filterType === 'dropdown' && colKey !== 'component' && (
                          <select
                            value={columnFilterInputs[colKey] || ''}
                            onChange={(e) => handleColumnFilterChange(colKey, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-xs px-2 py-1 border border-blue-400 dark:border-blue-700 rounded focus:ring-1 focus:ring-white focus:border-white bg-blue-500 dark:bg-blue-700 text-white placeholder-blue-200 dark:placeholder-blue-300"
                          >
                            <option key="inline-all" value="">All</option>
                            {colKey === 'category' && (
                              // Check if this is Trinity data (has bible/teacher/lexicon) or other data
                              entries.some(e => ['bible', 'teacher', 'lexicon'].includes(e.category)) ? (
                                <>
                                  <option key="inline-cat-bible" value="bible">📖 Bible</option>
                                  <option key="inline-cat-teacher" value="teacher">🔧 Teacher</option>
                                  <option key="inline-cat-lexicon" value="lexicon">📕 Lexicon</option>
                                </>
                              ) : (
                                // For non-Trinity tables, show unique category values from the data
                                getUniqueValuesForColumn('category').map(cat => (
                                  <option key={`cat-${cat}`} value={cat}>{cat}</option>
                                ))
                              )
                            )}
                            {colKey === 'chapter' && uniqueChapters.map(ch => (
                              <option key={ch.value} value={ch.value}>{ch.label}</option>
                            ))}
                            {colKey === 'type' && (
                              <>
                                {/* Lexicon types */}
                                <option key="inline-type-bug" value="bug">🐛 Bug</option>
                                <option key="inline-type-architecture" value="architecture">🏗️ Architecture</option>
                                <option key="inline-type-test" value="test">📊 Test</option>
                                <option key="inline-type-performance" value="performance">📈 Performance</option>
                                <option key="inline-type-dev-note" value="dev_note">🎓 Dev Note</option>
                                <option key="inline-type-common-issue" value="common_issue">🔍 Common Issue</option>
                                {/* Teacher types */}
                                <option key="inline-type-component" value="component">🧩 Component</option>
                                <option key="inline-type-feature" value="feature">✨ Feature</option>
                                <option key="inline-type-util" value="util">🔧 Util</option>
                                <option key="inline-type-hook" value="hook">🪝 Hook</option>
                                <option key="inline-type-integration" value="integration">🔌 Integration</option>
                                <option key="inline-type-optimization" value="optimization">⚡ Optimization</option>
                                <option key="inline-type-dropdown-md" value="dropdown_md">📋 Dropdown Md</option>
                                {/* Bible types */}
                                <option key="inline-type-must" value="MUST">✅ Must</option>
                                <option key="inline-type-never" value="NEVER">❌ Never</option>
                                <option key="inline-type-always" value="ALWAYS">🔄 Always</option>
                                <option key="inline-type-protected" value="PROTECTED">🔒 Protected</option>
                                <option key="inline-type-config" value="CONFIG">⚙️ Config</option>
                                <option key="inline-type-rule" value="rule">📖 Rule</option>
                                <option key="inline-type-reference" value="REFERENCE">📚 Reference</option>
                              </>
                            )}
                            {colKey === 'status' && (
                              <>
                                <option key="active" value="active">Active</option>
                                <option key="inactive" value="inactive">Inactive</option>
                                <option key="open" value="open">Open</option>
                                <option key="fixed" value="fixed">Fixed</option>
                                <option key="by_design" value="by_design">By Design</option>
                                <option key="monitoring" value="monitoring">Monitoring</option>
                              </>
                            )}
                            {colKey === 'severity' && (
                              <>
                                <option key="low" value="low">Low</option>
                                <option key="medium" value="medium">Medium</option>
                                <option key="high" value="high">High</option>
                                <option key="critical" value="critical">Critical</option>
                              </>
                            )}
                            {colKey === 'user' && users.map(user => (
                              <option key={user.id} value={user.id}>
                                {user.name || user.email || `User #${user.id}`}
                              </option>
                            ))}
                            {colKey === 'trinity' && (
                              <>
                                <option key="inline-trinity-bible" value="bible">📖 Bible</option>
                                <option key="inline-trinity-teacher" value="teacher">🔧 Teacher</option>
                                <option key="inline-trinity-lexicon" value="lexicon">📕 Lexicon</option>
                              </>
                            )}
                            {colKey === 'component' && (
                              <>
                                <option key="inline-comp-auth" value="Auth">Auth</option>
                                <option key="inline-comp-chat" value="Chat">Chat</option>
                                <option key="inline-comp-dynamic" value="DynamicTables">DynamicTables</option>
                                <option key="inline-comp-email" value="Email">Email</option>
                                <option key="inline-comp-gantt" value="Gantt">Gantt</option>
                                <option key="inline-comp-jobs" value="Jobs">Jobs</option>
                                <option key="inline-comp-onedrive" value="OneDrive">OneDrive</option>
                                <option key="inline-comp-payments" value="Payments">Payments</option>
                                <option key="inline-comp-pos" value="PurchaseOrders">PurchaseOrders</option>
                                <option key="inline-comp-settings" value="Settings">Settings</option>
                                <option key="inline-comp-table" value="Table">Table</option>
                                <option key="inline-comp-tasks" value="Tasks">Tasks</option>
                                <option key="inline-comp-weather" value="Weather">Weather</option>
                                <option key="inline-comp-xero" value="Xero">Xero</option>
                              </>
                            )}
                            {/* Generic fallback for other dropdown columns - dynamically populate from data */}
                            {!['category', 'chapter', 'type', 'status', 'severity', 'trinity', 'component'].includes(colKey) &&
                              getUniqueValuesForColumn(colKey).map((value, idx) => {
                                // Handle both object format {id, display} and string format
                                if (value && typeof value === 'object') {
                                  return <option key={`${colKey}-${value.id}-${idx}`} value={value.id}>{value.display ?? value.id ?? '-'}</option>
                                }
                                return <option key={`${colKey}-${value}-${idx}`} value={value}>{value}</option>
                              })
                            }
                          </select>
                        )}

                        {/* Component multi-select checkboxes - Show only if showFilters is true */}
                        {showFilters && colKey === 'component' && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowComponentDropdown(!showComponentDropdown)
                              }}
                              className="w-full text-xs px-2 py-1 border border-blue-400 dark:border-blue-700 rounded focus:ring-1 focus:ring-white focus:border-white bg-blue-500 dark:bg-blue-700 text-white flex items-center justify-between"
                            >
                              <span>{selectedComponents.size > 0 ? `${selectedComponents.size} selected` : 'Filter...'}</span>
                              <span>▼</span>
                            </button>
                            {showComponentDropdown && (
                              <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg text-xs z-[100] min-w-full max-h-64 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                {uniqueComponents.map(comp => (
                                  <label key={comp} className="flex items-center space-x-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 px-1 rounded cursor-pointer text-gray-900 dark:text-white whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={selectedComponents.has(comp)}
                                      onChange={(e) => {
                                        const newSet = new Set(selectedComponents)
                                        if (e.target.checked) {
                                          newSet.add(comp)
                                        } else {
                                          newSet.delete(comp)
                                        }
                                        setSelectedComponents(newSet)
                                      }}
                                      className="rounded border-gray-300"
                                    />
                                    <span>{comp}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Default text filter for columns without specific filterType - Show only if showFilters is true */}
                        {/* Exclude: select, actions, component - everything else gets a filter if columnShowFilters allows */}
                        {/* Also show for columns with filterType that doesn't have a specific handler (like currency, number, etc) */}
                        {showFilters && (columnShowFilters[colKey] ?? true) && colKey !== 'component' && colKey !== 'select' && colKey !== 'actions' &&
                         (!column.filterType || !['text', 'boolean', 'dropdown'].includes(column.filterType)) && (
                          <input
                            type="text"
                            placeholder="Filter..."
                            value={columnFilterInputs[colKey] || ''}
                            onChange={(e) => handleColumnFilterChange(colKey, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-xs px-2 py-1 border border-blue-400 dark:border-blue-700 rounded focus:ring-1 focus:ring-white focus:border-white bg-blue-500 dark:bg-blue-700 text-white placeholder-blue-200 dark:placeholder-blue-300"
                          />
                        )}

                        {/* Empty spacer for select column */}
                        {showFilters && colKey === 'select' && (
                          <div className="h-[26px]"></div>
                        )}
                      </div>
                    )}

                  </th>
                )
              })
              })()}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900">
            {filteredAndSorted.length > 0 ? (() => {
              // Get active group columns - prefer array, fall back to legacy single column
              const activeGroupColumns = groupByColumns.length > 0 ? groupByColumns : (groupByColumn ? [groupByColumn] : [])

              // Helper to get display value for a column
              const getGroupDisplayValue = (entry, colKey) => {
                // Search by key or column_name to handle saved views with different formats
                const groupColumnDef = COLUMNS.find(c => c.key === colKey || c.column_name === colKey)
                const isLookupColumn = groupColumnDef?.column_type === 'lookup'
                const lookupOptions = isLookupColumn && groupColumnDef?.id ? (columnChoices[groupColumnDef.id] || []) : []
                // Use column_name if different from key to access the entry data
                const actualKey = groupColumnDef?.column_name || groupColumnDef?.key || colKey
                const rawValue = entry[actualKey] ?? entry[colKey]

                if (rawValue && typeof rawValue === 'object' && rawValue.display !== undefined) {
                  return rawValue.display || '(empty)'
                } else if (isLookupColumn && rawValue != null && lookupOptions.length > 0) {
                  const matchingOption = lookupOptions.find(opt =>
                    opt.id === rawValue || parseInt(opt.id) === parseInt(rawValue)
                  )
                  return matchingOption?.display || `ID: ${rawValue}`
                }
                return rawValue ?? '(empty)'
              }

              // Helper to sort group keys naturally
              const sortGroupKeys = (keys) => {
                return keys.sort((a, b) => {
                  const numA = parseInt(a.match(/\d+/)?.[0], 10)
                  const numB = parseInt(b.match(/\d+/)?.[0], 10)
                  if (!isNaN(numA) && !isNaN(numB)) return numA - numB
                  return a.localeCompare(b)
                })
              }

              // Build nested group structure recursively
              const buildNestedGroups = (rows, columnIndex = 0) => {
                if (columnIndex >= activeGroupColumns.length) {
                  return { rows } // Leaf node - return rows directly
                }

                const colKey = activeGroupColumns[columnIndex]
                const groups = {}

                rows.forEach(entry => {
                  const groupValue = getGroupDisplayValue(entry, colKey)
                  if (!groups[groupValue]) {
                    groups[groupValue] = []
                  }
                  groups[groupValue].push(entry)
                })

                // Recursively build sub-groups
                const result = {}
                Object.keys(groups).forEach(key => {
                  result[key] = buildNestedGroups(groups[key], columnIndex + 1)
                })

                return { groups: result, columnIndex }
              }

              // Render nested groups recursively
              const renderNestedGroups = (node, parentPath = '', level = 0) => {
                const visibleColCount = columnOrder.filter(key => key === 'select' || key === 'actions' || visibleColumns[key]).length

                // Level-based colors for visual hierarchy
                const levelColors = [
                  'from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 text-indigo-800 dark:text-indigo-200',
                  'from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 text-blue-800 dark:text-blue-200',
                  'from-green-100 to-teal-100 dark:from-green-900/40 dark:to-teal-900/40 text-green-800 dark:text-green-200',
                  'from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 text-amber-800 dark:text-amber-200',
                ]
                const colorClass = levelColors[level % levelColors.length]

                if (node.rows) {
                  // Leaf node - render actual data rows
                  let rowIndex = 0
                  return node.rows.map((entry) => {
                    const currentIndex = rowIndex++
                    return (
                      <tr
                        key={entry.id}
                        onMouseEnter={() => {
                          if (isDragging) {
                            handleDragSelectOver(entry.id)
                          }
                        }}
                        onDoubleClick={(e) => {
                          if (!editModeActive) {
                            e.stopPropagation()
                            if (onRowDoubleClick) {
                              onRowDoubleClick(entry)
                            } else {
                              setModalEditData({...entry})
                              setShowEditableModal(true)
                            }
                          }
                        }}
                        className={`${
                          editingRowId === entry.id
                            ? 'bg-white dark:bg-gray-800 ring-4 ring-blue-500 shadow-lg'
                            : selectedRows.has(entry.id)
                              ? 'bg-blue-200 dark:bg-blue-800/60 ring-2 ring-blue-400 dark:ring-blue-500'
                              : currentIndex % 2 === 0
                                ? 'bg-white dark:bg-gray-900'
                                : editModeActive
                                  ? 'bg-orange-50 dark:bg-orange-900/20'
                                  : 'bg-blue-50 dark:bg-blue-900/20'
                        } ${!editModeActive ? 'cursor-pointer' : ''} ${editModeActive ? 'hover:bg-orange-100 dark:hover:bg-orange-800/30' : 'hover:bg-blue-100 dark:hover:bg-blue-800/30'} transition-colors duration-150`}
                      >
                            {columnOrder.filter(key => key === 'select' || key === 'actions' || visibleColumns[key]).map(colKey => {
                              const column = COLUMNS.find(c => c.key === colKey)
                              if (!column) return null

                              return (
                                <td
                                  key={colKey}
                                  onDoubleClick={(e) => {}}
                                  onClick={(e) => {
                                    const textColumns = ['title', 'content'];
                                    if (textColumns.includes(colKey) && !editModeActive) {
                                      e.stopPropagation();
                                      setSelectedEntry(entry);
                                      setSelectedColumn(colKey);
                                      return;
                                    }
                                    if (editModeActive && colKey !== 'select' && colKey !== 'id' && colKey !== 'user_id' && !column.isComputed) {
                                      e.stopPropagation();
                                      if (editingRowId !== entry.id) {
                                        if (editingRowId !== null && Object.keys(editingData).length > 0) {
                                          const errors = []
                                          Object.keys(editingData).forEach(key => {
                                            const error = validateField(key, editingData[key])
                                            if (error) errors.push(error)
                                          })
                                          if (errors.length > 0) {
                                            setValidationError(errors[0])
                                            setTimeout(() => setValidationError(null), 4000)
                                            return
                                          }
                                          if (onEdit) {
                                            onEdit(editingData).catch(err => {
                                              console.error('Failed to auto-save row:', err)
                                              setValidationError('Failed to save changes')
                                              setTimeout(() => setValidationError(null), 4000)
                                            })
                                          }
                                        }
                                        setValidationError(null)
                                        setEditingRowId(entry.id);
                                        const safeEditingData = { ...entry }
                                        COLUMNS.forEach(col => {
                                          if (safeEditingData[col.key] === undefined) {
                                            safeEditingData[col.key] = ''
                                          }
                                        })
                                        setEditingData(safeEditingData);
                                        setSelectedRows(new Set([entry.id]));
                                      }
                                    }
                                  }}
                                  style={{
                                    width: columnWidths[colKey],
                                    minWidth: columnMinWidths[colKey] ?? 75,
                                    maxWidth: columnWidths[colKey],
                                    fontSize: '14px',
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                                  }}
                                  className={`group relative ${colKey === 'select' ? 'px-1 py-2' : 'px-3 py-2'} ${
                                    !editModeActive && !isCellValid(entry, colKey, column) ? 'bg-red-600 text-white dark:bg-red-600 dark:text-white' :
                                    editModeActive && column.isComputed ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'
                                  } ${
                                    colKey === 'select' ? 'text-center' : column.data_align === 'center' ? 'text-center' : column.data_align === 'right' ? 'text-right' : 'text-left'
                                  } ${
                                    ['title', 'content'].includes(colKey) && !editModeActive ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20' : ''
                                  } ${
                                    editModeActive && colKey !== 'select' && colKey !== 'id' && colKey !== 'user_id' && !column.isComputed ? 'cursor-pointer' : ''
                                  } whitespace-nowrap overflow-hidden text-ellipsis max-w-0`}
                                >
                                  {renderCellContent(entry, colKey)}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })
                    }

                // Has groups - render group headers and nested content
                if (node.groups) {
                  const sortedKeys = sortGroupKeys(Object.keys(node.groups))
                  return sortedKeys.map(groupKey => {
                    const groupPath = parentPath ? `${parentPath}|${groupKey}` : groupKey
                    const isCollapsed = collapsedGroups.has(groupPath)
                    const childNode = node.groups[groupKey]

                    // Count total rows in this group (recursively)
                    const countRows = (n) => {
                      if (n.rows) return n.rows.length
                      if (n.groups) return Object.values(n.groups).reduce((sum, child) => sum + countRows(child), 0)
                      return 0
                    }
                    const rowCount = countRows(childNode)

                    // Get column label for this level - search by key, column_name, or fall back to raw key
                    const groupColKey = activeGroupColumns[level]
                    const colDef = COLUMNS.find(c => c.key === groupColKey || c.column_name === groupColKey)
                    const colLabel = colDef?.label || groupColKey

                    return (
                      <React.Fragment key={`group-${groupPath}`}>
                        {/* Group Header Row */}
                        <tr
                          className={`bg-gradient-to-r ${colorClass} cursor-pointer hover:brightness-95 transition-all`}
                          onClick={() => {
                            setCollapsedGroups(prev => {
                              const newSet = new Set(prev)
                              if (newSet.has(groupPath)) {
                                newSet.delete(groupPath)
                              } else {
                                newSet.add(groupPath)
                              }
                              return newSet
                            })
                          }}
                        >
                          <td colSpan={visibleColCount} className="px-3 py-2 font-semibold">
                            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 20}px` }}>
                              <span className={`transform transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>
                                ▶
                              </span>
                              <span className="text-xs font-normal opacity-60">{colLabel}:</span>
                              <span>{groupKey}</span>
                              <span className="text-sm font-normal opacity-70">
                                ({rowCount} row{rowCount !== 1 ? 's' : ''})
                              </span>
                            </div>
                          </td>
                        </tr>
                        {/* Group Children (recursive) */}
                        {!isCollapsed && renderNestedGroups(childNode, groupPath, level + 1)}
                      </React.Fragment>
                    )
                  })
                }

                return null
              }

              // If we have grouping columns, build and render nested groups
              if (activeGroupColumns.length > 0) {
                const nestedGroups = buildNestedGroups(filteredAndSorted)
                return renderNestedGroups(nestedGroups)
              }

              // No grouping - render flat list (limit rendered rows for performance)
              const displayedRows = filteredAndSorted.slice(0, MAX_RENDERED_ROWS)
              return displayedRows.map((entry, index) => (
              <tr
                key={entry.id}
                onMouseEnter={() => {
                  if (isDragging) {
                    handleDragSelectOver(entry.id)
                  }
                }}
                onDoubleClick={(e) => {
                  // Double-click row when NOT in edit mode
                  if (!editModeActive) {
                    e.stopPropagation()
                    // If custom handler provided, use it (e.g., navigate to detail page)
                    if (onRowDoubleClick) {
                      onRowDoubleClick(entry)
                    } else {
                      // Default: open editable modal
                      setModalEditData({...entry})
                      setShowEditableModal(true)
                    }
                  }
                }}
                className={`${
                  editingRowId === entry.id
                    ? 'bg-white dark:bg-gray-800 ring-4 ring-blue-500 shadow-lg'
                    : selectedRows.has(entry.id)
                      ? 'bg-blue-200 dark:bg-blue-800/60 ring-2 ring-blue-400 dark:ring-blue-500'
                      : index % 2 === 0
                        ? 'bg-white dark:bg-gray-900'
                        : editModeActive
                          ? 'bg-orange-50 dark:bg-orange-900/20'
                          : 'bg-blue-50 dark:bg-blue-900/20'
                } ${!editModeActive ? 'cursor-pointer' : ''} ${editModeActive ? 'hover:bg-orange-100 dark:hover:bg-orange-800/30' : 'hover:bg-blue-100 dark:hover:bg-blue-800/30'} transition-colors duration-150`}
              >
                {columnOrder.filter(key => key === 'select' || key === 'actions' || visibleColumns[key]).map(colKey => {
                  const column = COLUMNS.find(c => c.key === colKey)
                  if (!column) return null

                  return (
                    <td
                      key={colKey}
                      onDoubleClick={(e) => {
                        // Double-click row when NOT in edit mode to open editable modal (handled at row level)
                      }}
                      onClick={(e) => {
                        // Debug logging
                        console.log('Cell clicked:', {
                          colKey,
                          editModeActive,
                          isComputed: column.isComputed,
                          currentEditingRowId: editingRowId,
                          clickedRowId: entry.id
                        });

                        // Single-click on Title or Content columns ONLY to open detail modal (only when not in edit mode)
                        const textColumns = ['title', 'content'];
                        if (textColumns.includes(colKey) && !editModeActive) {
                          e.stopPropagation();
                          setSelectedEntry(entry);
                          setSelectedColumn(colKey); // Track which column was clicked
                          return;
                        }

                        // In edit mode: make ALL cells editable on click (except select, id, user_id, and computed)
                        if (editModeActive && colKey !== 'select' && colKey !== 'id' && colKey !== 'user_id' && !column.isComputed) {
                          e.stopPropagation();
                          if (editingRowId !== entry.id) {
                            // Validate and save current editing data before switching rows
                            if (editingRowId !== null && Object.keys(editingData).length > 0) {
                              const errors = []
                              Object.keys(editingData).forEach(key => {
                                const error = validateField(key, editingData[key])
                                if (error) errors.push(error)
                              })
                              if (errors.length > 0) {
                                setValidationError(errors[0]) // Show first error
                                setTimeout(() => setValidationError(null), 4000) // Clear after 4 seconds
                                return // Don't switch rows if validation fails
                              }

                              // Auto-save the current row before switching
                              if (onEdit) {
                                onEdit(editingData).catch(err => {
                                  console.error('Failed to auto-save row:', err)
                                  setValidationError('Failed to save changes')
                                  setTimeout(() => setValidationError(null), 4000)
                                })
                              }
                            }
                            setValidationError(null)
                            setEditingRowId(entry.id);
                            // Populate with current values, defaulting undefined to '' to prevent controlled/uncontrolled warnings
                            const safeEditingData = { ...entry }
                            COLUMNS.forEach(col => {
                              if (safeEditingData[col.key] === undefined) {
                                safeEditingData[col.key] = ''
                              }
                            })
                            setEditingData(safeEditingData);
                            setSelectedRows(new Set([entry.id]));
                          }
                        }
                      }}
                      style={{
                        width: columnWidths[colKey],
                        minWidth: columnMinWidths[colKey] ?? 75,
                        maxWidth: columnWidths[colKey],
                        fontSize: '14px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                      }}
                      className={`group relative ${colKey === 'select' ? 'px-1 py-2' : 'px-3 py-2'} ${
                        // Validation: bright red background with white text for invalid cells (not in edit mode)
                        !editModeActive && !isCellValid(entry, colKey, column) ? 'bg-red-600 text-white dark:bg-red-600 dark:text-white' :
                        // Gray out computed columns when in edit mode
                        editModeActive && column.isComputed ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'
                      } ${
                        colKey === 'select' ? 'text-center' : column.data_align === 'center' ? 'text-center' : column.data_align === 'right' ? 'text-right' : 'text-left'
                      } ${
                        // Non-edit mode: highlight clickable title/content cells
                        ['title', 'content'].includes(colKey) && !editModeActive ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20' : ''
                      } ${
                        // Edit mode: make all cells clickable except select, id, user_id, and computed
                        editModeActive && colKey !== 'select' && colKey !== 'id' && colKey !== 'user_id' && !column.isComputed ? 'cursor-pointer' : ''
                      } whitespace-nowrap overflow-hidden text-ellipsis max-w-0`}
                    >
                      {renderCellContent(entry, colKey)}
                    </td>
                  )
                })}
              </tr>
            ))
            })() : (
              // When no rows match filters, show 10 empty placeholder rows to maintain table height
              // This keeps filter dropdowns accessible (Chapter 20: Table must remain usable even with no matches)
              Array.from({ length: 10 }).map((_, index) => (
                <tr key={`empty-${index}`} className={index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-blue-50 dark:bg-blue-900/20'}>
                  {columnOrder.filter(key => visibleColumns[key]).map(colKey => (
                    <td key={colKey} className="px-6 py-3 text-center text-sm text-gray-400 dark:text-gray-600">
                      {colKey === 'select' ? '' : index === 4 && colKey === columnOrder.filter(key => visibleColumns[key])[1] ? 'No entries found matching your filters' : '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>

          {/* Table Footer - shows sums for currency/numeric columns */}
          <tfoot className="sticky bottom-0 z-10 bg-blue-100 dark:bg-blue-900/30 border-t border-blue-200 dark:border-blue-800">
            <tr>
              {columnOrder.filter(key => key === 'select' || visibleColumns[key]).map(colKey => {
                const column = COLUMNS.find(c => c.key === colKey)
                if (!column) return null

                // Calculate sum for currency/numeric columns
                // If rows are selected, sum only selected rows; otherwise sum all
                let sum = null
                if (column.showSum) {
                  const rowsToSum = selectedRows.size > 0
                    ? filteredAndSorted.filter(entry => selectedRows.has(entry.id))
                    : filteredAndSorted

                  sum = rowsToSum.reduce((total, entry) => {
                    // For computed columns, use the compute function
                    let value
                    if (column.isComputed && column.computeFunction) {
                      value = column.computeFunction(entry)
                    } else {
                      value = entry[colKey]
                    }
                    // Handle numeric values
                    const numValue = typeof value === 'number' ? value : parseFloat(value)
                    return total + (isNaN(numValue) ? 0 : numValue)
                  }, 0)
                }

                return (
                  <td
                    key={colKey}
                    style={{
                      width: columnWidths[colKey],
                      minWidth: columnMinWidths[colKey] ?? 75,
                    }}
                    className={`${colKey === 'select' ? 'px-2 py-1.5' : 'px-2 py-1.5'} ${
                      colKey === 'select' ? 'text-center' : column.showSum ? 'text-right' : 'text-left'
                    } text-xs font-semibold text-gray-700 dark:text-gray-300`}
                  >
                    {colKey === 'select' ? (
                      // Empty cell for checkbox column
                      ''
                    ) : column.showSum ? (
                      // Display sum (right-aligned) - format based on sumType
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-gray-600 dark:text-gray-400">{selectedRows.size > 0 ? 'Selected:' : 'Total:'}</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {column.sumType === 'currency'
                            ? new Intl.NumberFormat('en-AU', {
                                style: 'currency',
                                currency: 'AUD'
                              }).format(sum)
                            : sum.toLocaleString('en-AU')
                          }
                        </span>
                      </div>
                    ) : (
                      // Empty cell for non-sum columns
                      ''
                    )}
                  </td>
                )
              })}
            </tr>
          </tfoot>
          </table>
          </div>
          {/* End scroll container */}
        </div>
        {/* End Table Container with Border */}
      </div>
      {/* End Full-width table container */}
      </div>

      {/* Full Entry Details Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setSelectedEntry(null)
            setSelectedColumn(null)
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-blue-600 dark:bg-blue-800 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
              <div>
                <div className="text-sm font-medium opacity-90">
                  {selectedColumn === 'title' ? 'Title' : selectedColumn === 'content' ? 'Content' : 'Details'}
                </div>
                <h2 className="text-xl font-bold mt-1">
                  {selectedColumn === 'title' ? selectedEntry.title : selectedColumn === 'content' ? 'Content Details' : selectedEntry.title}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedEntry(null)
                  setSelectedColumn(null)
                }}
                className="p-2 hover:bg-blue-700 dark:hover:bg-blue-900 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Show only the clicked column's content */}
              {selectedColumn === 'title' && (
                <div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white whitespace-pre-wrap">
                    {selectedEntry.title}
                  </div>
                </div>
              )}

              {selectedColumn === 'content' && (
                <div>
                  <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {/* Show content based on category */}
                    {selectedEntry.category === 'bible' && (selectedEntry.description || selectedEntry.details || selectedEntry.examples || 'No content available')}
                    {selectedEntry.category === 'teacher' && (selectedEntry.summary || selectedEntry.description || selectedEntry.code_example || 'No content available')}
                    {selectedEntry.category === 'lexicon' && (selectedEntry.scenario || selectedEntry.description || selectedEntry.solution || 'No content available')}
                    {selectedEntry.category === 'inspiring_quotes' && (selectedEntry.description || 'No content available')}
                    {!['bible', 'teacher', 'lexicon', 'inspiring_quotes'].includes(selectedEntry.category) && (selectedEntry.description || selectedEntry.content || 'No content available')}
                  </div>
                </div>
              )}

              {/* Fallback: show metadata if no specific column selected */}
              {!selectedColumn && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</div>
                      <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                        {selectedEntry.category === 'bible' && '📖 Bible'}
                    {selectedEntry.category === 'teacher' && '🔧 Teacher'}
                    {selectedEntry.category === 'lexicon' && '📕 Lexicon'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {selectedEntry.entry_type}
                  </div>
                </div>
                {selectedEntry.component && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Component</div>
                    <div className="mt-1 text-sm font-mono text-gray-900 dark:text-white">
                      {selectedEntry.component}
                    </div>
                  </div>
                )}
                {selectedEntry.status && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</div>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedEntry.status]}`}>
                        {STATUS_ICONS[selectedEntry.status]} {selectedEntry.status?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                )}
                {selectedEntry.severity && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Severity</div>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${SEVERITY_COLORS[selectedEntry.severity]}`}>
                        {selectedEntry.severity}
                      </span>
                    </div>
                  </div>
                )}
                {selectedEntry.difficulty && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Difficulty</div>
                    <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {selectedEntry.difficulty}
                    </div>
                  </div>
                )}
              </div>

              {/* Content Fields - Bible */}
              {selectedEntry.category === 'bible' && (
                <>
                  {selectedEntry.description && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Description</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEntry.description}</div>
                    </div>
                  )}
                  {selectedEntry.details && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Details</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEntry.details}</div>
                    </div>
                  )}
                  {selectedEntry.examples && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Examples</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg font-mono">{selectedEntry.examples}</div>
                    </div>
                  )}
                  {selectedEntry.recommendations && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Recommendations</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEntry.recommendations}</div>
                    </div>
                  )}
                </>
              )}

              {/* Content Fields - Teacher */}
              {selectedEntry.category === 'teacher' && (
                <>
                  {selectedEntry.summary && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Summary</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEntry.summary}</div>
                    </div>
                  )}
                  {selectedEntry.description && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Description</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEntry.description}</div>
                    </div>
                  )}
                  {selectedEntry.code_example && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Code Example</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg font-mono overflow-x-auto">{selectedEntry.code_example}</div>
                    </div>
                  )}
                  {selectedEntry.common_mistakes && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Common Mistakes</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEntry.common_mistakes}</div>
                    </div>
                  )}
                  {selectedEntry.testing_strategy && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Testing Strategy</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEntry.testing_strategy}</div>
                    </div>
                  )}
                </>
              )}

              {/* Content Fields - Lexicon */}
              {selectedEntry.category === 'lexicon' && (
                <>
                  {selectedEntry.scenario && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Scenario</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEntry.scenario}</div>
                    </div>
                  )}
                  {selectedEntry.description && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Description</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEntry.description}</div>
                    </div>
                  )}
                  {selectedEntry.root_cause && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Root Cause</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEntry.root_cause}</div>
                    </div>
                  )}
                  {selectedEntry.solution && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Solution</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">{selectedEntry.solution}</div>
                    </div>
                  )}
                  {selectedEntry.prevention && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Prevention</div>
                      <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedEntry.prevention}</div>
                    </div>
                  )}
                </>
              )}

              {/* Dense Index - Searchable Content */}
              {selectedEntry.dense_index && (
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Dense Index (Searchable)</div>
                  <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg font-mono text-xs leading-relaxed max-h-96 overflow-y-auto">{selectedEntry.dense_index}</div>
                </div>
              )}

              {/* Related Rules */}
              {selectedEntry.related_rules && (
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Related Rules</div>
                  <div className="text-sm text-gray-900 dark:text-white">{selectedEntry.related_rules}</div>
                </div>
              )}
                </>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedEntry(null); onEdit(selectedEntry); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <PencilIcon className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(selectedEntry); setSelectedEntry(null); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={() => {
                    setSelectedEntry(null)
                    setSelectedColumn(null)
                  }}
                  className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Text Editing Modal */}
      {showTextEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setShowTextEditModal(false)}>
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity" aria-hidden="true" />

            {/* Modal Dialog */}
            <div
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit {getColumnLabel(textEditField)}
                </h3>
                <button
                  onClick={() => setShowTextEditModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 px-6 py-4 overflow-y-auto">
                {/* Simple Formatting Buttons */}
                <div className="mb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = textEditTextareaRef.current
                      if (textarea) {
                        const pos = textarea.selectionStart
                        const newValue = textEditValue.substring(0, pos) + '- ' + textEditValue.substring(pos)
                        setTextEditValue(newValue)
                        setTimeout(() => {
                          textarea.focus()
                          textarea.selectionStart = pos + 2
                          textarea.selectionEnd = pos + 2
                        }, 0)
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                  >
                    • Bullet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = textEditTextareaRef.current
                      if (textarea) {
                        const pos = textarea.selectionStart
                        const newValue = textEditValue.substring(0, pos) + '1. ' + textEditValue.substring(pos)
                        setTextEditValue(newValue)
                        setTimeout(() => {
                          textarea.focus()
                          textarea.selectionStart = pos + 3
                          textarea.selectionEnd = pos + 3
                        }, 0)
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                  >
                    1. Number
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = textEditTextareaRef.current
                      if (textarea) {
                        const start = textarea.selectionStart
                        const end = textarea.selectionEnd
                        const selectedText = textEditValue.substring(start, end) || 'text'
                        const newValue = textEditValue.substring(0, start) + '**' + selectedText + '**' + textEditValue.substring(end)
                        setTextEditValue(newValue)
                        setTimeout(() => {
                          textarea.focus()
                          textarea.selectionStart = start + 2
                          textarea.selectionEnd = start + 2 + selectedText.length
                        }, 0)
                      }
                    }}
                    className="px-3 py-1.5 text-sm font-bold bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = textEditTextareaRef.current
                      if (textarea) {
                        const start = textarea.selectionStart
                        const end = textarea.selectionEnd
                        const selectedText = textEditValue.substring(start, end) || 'text'
                        const newValue = textEditValue.substring(0, start) + '*' + selectedText + '*' + textEditValue.substring(end)
                        setTextEditValue(newValue)
                        setTimeout(() => {
                          textarea.focus()
                          textarea.selectionStart = start + 1
                          textarea.selectionEnd = start + 1 + selectedText.length
                        }, 0)
                      }
                    }}
                    className="px-3 py-1.5 text-sm italic bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                  >
                    I
                  </button>
                </div>

                <textarea
                  ref={textEditTextareaRef}
                  value={textEditValue}
                  onChange={(e) => setTextEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    // Handle Enter key for auto-continuing lists
                    if (e.key === 'Enter') {
                      const start = e.target.selectionStart
                      const value = textEditValue
                      const lines = value.substring(0, start).split('\n')
                      const currentLine = lines[lines.length - 1]

                      // Check if current line is a numbered list item (e.g., "1. text" or "2. text")
                      const numberedMatch = currentLine.match(/^(\d+)\.\s/)
                      if (numberedMatch) {
                        e.preventDefault()
                        const currentNum = parseInt(numberedMatch[1])
                        const nextNum = currentNum + 1
                        const newValue = value.substring(0, start) + '\n' + nextNum + '. ' + value.substring(start)
                        setTextEditValue(newValue)
                        setTimeout(() => {
                          e.target.selectionStart = e.target.selectionEnd = start + nextNum.toString().length + 3
                        }, 0)
                        return
                      }

                      // Check if current line is a bullet point (e.g., "- text")
                      const bulletMatch = currentLine.match(/^-\s/)
                      if (bulletMatch) {
                        e.preventDefault()
                        const newValue = value.substring(0, start) + '\n- ' + value.substring(start)
                        setTextEditValue(newValue)
                        setTimeout(() => {
                          e.target.selectionStart = e.target.selectionEnd = start + 3
                        }, 0)
                        return
                      }
                    }

                    // Handle Tab key for indentation
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      const start = e.target.selectionStart
                      const end = e.target.selectionEnd
                      const value = textEditValue

                      if (e.shiftKey) {
                        // Shift+Tab: Remove indentation
                        const lines = value.substring(0, start).split('\n')
                        const currentLine = lines[lines.length - 1]
                        if (currentLine.startsWith('  ')) {
                          const newValue = value.substring(0, start - 2) + value.substring(start)
                          setTextEditValue(newValue)
                          setTimeout(() => {
                            e.target.selectionStart = e.target.selectionEnd = start - 2
                          }, 0)
                        }
                      } else {
                        // Tab: Add indentation (2 spaces)
                        const newValue = value.substring(0, start) + '  ' + value.substring(end)
                        setTextEditValue(newValue)
                        setTimeout(() => {
                          e.target.selectionStart = e.target.selectionEnd = start + 2
                        }, 0)
                      }
                    }
                  }}
                  placeholder={`Enter ${getColumnLabel(textEditField).toLowerCase()}...`}
                  className="w-full h-96 px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono whitespace-pre-wrap"
                  style={{ tabSize: 2 }}
                />

                {/* Statistics */}
                <div className="mt-4 flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{textEditValue.length}</span>
                    <span className="text-xs">characters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {textEditValue.trim().split(/\s+/).filter(w => w.length > 0).length}
                    </span>
                    <span className="text-xs">words</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {textEditValue.split('\n').length}
                    </span>
                    <span className="text-xs">lines</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <button
                  onClick={() => setShowTextEditModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Update any field dynamically
                    // For number fields, convert back to number
                    let value = textEditValue
                    if (['quantity', 'whole_number', 'price', 'discount'].includes(textEditField)) {
                      value = textEditField === 'whole_number' ? parseInt(textEditValue) || 0 : parseFloat(textEditValue) || 0
                    }
                    setEditingData({ ...editingData, [textEditField]: value })
                    setShowTextEditModal(false)
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GPS Location Picker Modal - Using LocationMapCard */}
      {showGpsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setShowGpsModal(false)}>
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity" aria-hidden="true" />

            {/* Modal Dialog */}
            <div
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Pick GPS Location
                </h3>
                <button
                  onClick={() => setShowGpsModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body - Manual Input + LocationMapCard */}
              <div className="p-6 space-y-4">
                {/* Manual Input Section */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Manual Entry
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Latitude (e.g., -27.4705)"
                      value={gpsModalCoords.lat || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === '' || !isNaN(parseFloat(value))) {
                          setGpsModalCoords({ ...gpsModalCoords, lat: value === '' ? '' : parseFloat(value) })
                        }
                      }}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Longitude (e.g., 153.0260)"
                      value={gpsModalCoords.lng || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === '' || !isNaN(parseFloat(value))) {
                          setGpsModalCoords({ ...gpsModalCoords, lng: value === '' ? '' : parseFloat(value) })
                        }
                      }}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        if (gpsModalCoords.lat && gpsModalCoords.lng) {
                          setEditingData({ ...editingData, gps_coordinates: `${gpsModalCoords.lat}, ${gpsModalCoords.lng}` })
                        }
                      }}
                      className="px-4 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
                    >
                      Use These
                    </button>
                  </div>
                </div>

                {/* Map Picker Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pick on Map (Click map, search address, or use current location button)
                  </label>
                  <LocationMapCard
                    jobId={null}
                    location=""
                    latitude={gpsModalCoords.lat}
                    longitude={gpsModalCoords.lng}
                    onLocationUpdate={(location, lat, lng) => {
                      // Update coordinates when user picks a location on the map
                      setEditingData({ ...editingData, gps_coordinates: `${lat}, ${lng}` })
                      setGpsModalCoords({ lat: parseFloat(lat), lng: parseFloat(lng) })
                    }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-xl flex justify-between items-center gap-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Current: {editingData.gps_coordinates || 'Not set'}
                </div>
                <button
                  onClick={() => setShowGpsModal(false)}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Color Picker Modal */}
      {showColorModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setShowColorModal(false)}>
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity" aria-hidden="true" />

            {/* Modal Dialog */}
            <div
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Pick a Color
                </h3>
                <button
                  onClick={() => setShowColorModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Large Color Preview */}
                <div className="flex justify-center">
                  <div
                    className="w-48 h-48 rounded-lg border-4 border-gray-300 dark:border-gray-600 shadow-lg"
                    style={{ backgroundColor: colorModalValue }}
                  />
                </div>

                {/* Color Wheel Picker */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Visual Color Picker
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={colorModalValue}
                      onChange={(e) => setColorModalValue(e.target.value)}
                      className="h-16 w-32 rounded border-2 border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
                      Click the color box to open your browser's color picker wheel
                    </div>
                  </div>
                </div>

                {/* Manual Hex Input */}
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Manual Hex Entry
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={colorModalValue}
                      onChange={(e) => {
                        let value = e.target.value
                        if (value && !value.startsWith('#')) {
                          value = '#' + value
                        }
                        if (!value || /^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                          setColorModalValue(value)
                        }
                      }}
                      placeholder="#000000"
                      className="flex-1 px-4 py-3 text-lg font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      maxLength={7}
                    />
                    <button
                      onClick={() => {
                        if (colorModalValue) {
                          setEditingData({ ...editingData, color_picker: colorModalValue })
                          setShowColorModal(false)
                        }
                      }}
                      className="px-6 py-3 text-sm font-medium bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
                    >
                      Use This Color
                    </button>
                  </div>
                </div>

                {/* Common Colors */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Quick Colors
                  </label>
                  <div className="grid grid-cols-8 gap-2">
                    {['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3', '#000000',
                      '#FFFFFF', '#808080', '#FF1493', '#00CED1', '#FFD700', '#32CD32', '#FF4500', '#8B4513'].map(color => (
                      <button
                        key={color}
                        onClick={() => setColorModalValue(color)}
                        className="h-10 w-10 rounded border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 transition-colors"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-xl flex justify-between items-center gap-3">
                <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                  Current: {colorModalValue}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowColorModal(false)}
                    className="px-4 py-2 text-sm font-medium bg-gray-300 text-gray-700 hover:bg-gray-400 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (colorModalValue) {
                        setEditingData({ ...editingData, color_picker: colorModalValue })
                      }
                      setShowColorModal(false)
                    }}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Apply Color
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showFileModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setShowFileModal(false)}>
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity" aria-hidden="true" />

            {/* Modal Dialog */}
            <div
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Upload File or Add Link
                </h3>
                <button
                  onClick={() => setShowFileModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setFileModalTab('upload')}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                    fileModalTab === 'upload'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  📤 Upload File
                </button>
                <button
                  onClick={() => setFileModalTab('url')}
                  className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                    fileModalTab === 'url'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  🔗 Add URL
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                {fileModalTab === 'upload' ? (
                  <div className="space-y-4">
                    {/* Drag & Drop Zone */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        dragActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                      onDragEnter={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragActive(true)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragActive(false)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragActive(false)
                        const file = e.dataTransfer.files?.[0]
                        if (file) {
                          setSelectedFile(file)
                          // Mock path - in production, upload to server here
                          const mockPath = `/uploads/${file.name}`
                          setFileModalValue(mockPath)
                        }
                      }}
                    >
                      <div className="space-y-4">
                        <div className="text-6xl">📁</div>
                        <div>
                          <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                            Drag & drop your file here
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            or click the button below to browse
                          </p>
                        </div>
                        <label className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer font-medium">
                          Choose File
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                setSelectedFile(file)
                                // Mock path - in production, upload to server here
                                const mockPath = `/uploads/${file.name}`
                                setFileModalValue(mockPath)
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* File Preview */}
                    {selectedFile && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-3xl">
                              {selectedFile.type.startsWith('image/') ? '🖼️' :
                               selectedFile.type === 'application/pdf' ? '📕' :
                               selectedFile.type.includes('word') ? '📘' :
                               selectedFile.type.includes('sheet') || selectedFile.type.includes('excel') ? '📊' :
                               selectedFile.type.includes('zip') || selectedFile.type.includes('compressed') ? '📦' :
                               '📄'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {(selectedFile.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedFile(null)
                              setFileModalValue('')
                            }}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            title="Remove file"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TODO Note */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>Note:</strong> File upload to server not yet implemented. Currently sets mock path <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">/uploads/filename</code>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* URL Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Enter File URL or Path
                      </label>
                      <input
                        type="text"
                        value={fileModalValue}
                        onChange={(e) => setFileModalValue(e.target.value)}
                        placeholder="https://example.com/document.pdf or /uploads/file.pdf"
                        className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Examples */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Examples:</p>
                      <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <li>• Google Drive: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">https://drive.google.com/file/d/...</code></li>
                        <li>• Dropbox: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">https://www.dropbox.com/s/...</code></li>
                        <li>• Server path: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/uploads/document.pdf</code></li>
                      </ul>
                    </div>

                    {/* Preview if valid URL */}
                    {fileModalValue && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">🔗</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white">Link Preview</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{fileModalValue}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-xl flex justify-between items-center gap-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFile ? `Selected: ${selectedFile.name}` : fileModalValue ? `Path: ${fileModalValue}` : 'No file selected'}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFileModal(false)}
                    className="px-4 py-2 text-sm font-medium bg-gray-300 text-gray-700 hover:bg-gray-400 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (fileModalValue) {
                        setEditingData({ ...editingData, file_upload: fileModalValue })
                      }
                      setShowFileModal(false)
                    }}
                    disabled={!fileModalValue}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      fileModalValue
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Use This File
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editable Modal - Double-click row to open */}
      {showEditableModal && modalEditData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowEditableModal(false)
            setModalEditData(null)
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white px-6 py-5 rounded-t-lg flex items-center justify-between z-10 shadow-lg">
              <div>
                <h2 className="text-2xl font-bold">Edit Item</h2>
                <p className="text-blue-100 text-sm mt-1">Make changes to all fields</p>
              </div>
              <button
                onClick={() => {
                  setShowEditableModal(false)
                  setModalEditData(null)
                }}
                className="p-2 hover:bg-blue-700 dark:hover:bg-blue-900 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content - Form Fields */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COLUMNS.filter(col => col.key !== 'select' && col.key !== 'total_cost' && !col.isComputed).map((column) => (
                  <div key={column.key} className={column.key === 'content' ? 'md:col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {column.label}
                    </label>

                    {/* Text inputs */}
                    {['section', 'email', 'phone', 'mobile', 'title', 'category_type', 'document_link'].includes(column.key) && (
                      <input
                        type={column.key === 'email' ? 'email' : column.key === 'document_link' ? 'url' : 'text'}
                        value={modalEditData[column.key] ?? ''}
                        onChange={(e) => setModalEditData({ ...modalEditData, [column.key]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}

                    {/* Number inputs */}
                    {['price', 'quantity', 'discount', 'whole_number'].includes(column.key) && (
                      <input
                        type="number"
                        step={column.key === 'price' ? '0.01' : column.key === 'whole_number' ? '1' : 'any'}
                        value={modalEditData[column.key] ?? ''}
                        onChange={(e) => setModalEditData({ ...modalEditData, [column.key]: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}

                    {/* Boolean checkbox */}
                    {column.key === 'is_active' && (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={modalEditData[column.key] ?? false}
                          onChange={(e) => setModalEditData({ ...modalEditData, [column.key]: e.target.checked })}
                          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Active</span>
                      </div>
                    )}

                    {/* Status dropdown */}
                    {column.key === 'status' && (
                      <select
                        value={modalEditData[column.key] ?? 'active'}
                        onChange={(e) => setModalEditData({ ...modalEditData, [column.key]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="open">Open</option>
                        <option value="fixed">Fixed</option>
                        <option value="by_design">By Design</option>
                        <option value="monitoring">Monitoring</option>
                      </select>
                    )}

                    {/* Severity dropdown */}
                    {column.key === 'severity' && (
                      <select
                        value={modalEditData[column.key] ?? ''}
                        onChange={(e) => setModalEditData({ ...modalEditData, [column.key]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">None</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    )}

                    {/* Component text input */}
                    {column.key === 'component' && (
                      <input
                        type="text"
                        value={modalEditData[column.key] ?? ''}
                        onChange={(e) => setModalEditData({ ...modalEditData, [column.key]: e.target.value })}
                        placeholder="e.g., Auth, Chat, Jobs"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}

                    {/* Multi-line content */}
                    {column.key === 'content' && (
                      <textarea
                        value={modalEditData[column.key] ?? ''}
                        onChange={(e) => setModalEditData({ ...modalEditData, [column.key]: e.target.value })}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        placeholder="Enter notes or details..."
                      />
                    )}

                    {/* Date field - read only */}
                    {column.key === 'updated_at' && (
                      <input
                        type="text"
                        value={modalEditData[column.key] ? new Date(modalEditData[column.key]).toLocaleString('en-AU') : 'Never'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer - Action Buttons */}
            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 px-6 py-4 rounded-b-lg flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowEditableModal(false)
                  setModalEditData(null)
                }}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Call the onEdit callback with the updated data
                  onEdit(modalEditData)
                  setShowEditableModal(false)
                  setModalEditData(null)
                }}
                className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg hover:shadow-xl"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Column Editor Individual Modal */}
      {selectedColumnForEdit && (
        <ColumnEditorModal
          isOpen={!!selectedColumnForEdit}
          column={selectedColumnForEdit}
          table={null} // TODO: Pass table data if needed
          foundationId={foundationIdNumeric}
          onClose={() => setSelectedColumnForEdit(null)}
          onUpdate={async () => {
            console.log('🔄 onUpdate called for column:', selectedColumnForEdit.id, 'type:', selectedColumnForEdit.column_type)

            // Refetch the full column data to get updated configuration (alignment, lookup settings, etc.)
            try {
              console.log('🔄 Refetching column data for column:', selectedColumnForEdit.id)
              const tableData = await api.get(`/api/v1/foundations/${foundationIdNumeric}`)
              if (tableData.success && tableData.table?.columns) {
                const updatedColumn = tableData.table.columns.find(c => c.id === selectedColumnForEdit.id)
                if (updatedColumn) {
                  console.log('✅ Column data refreshed:', updatedColumn)
                  setSelectedColumnForEdit(updatedColumn)
                }
              }
            } catch (error) {
              console.error('❌ Failed to refetch column data:', error)
            }

            // Check if this is a choice column for special handling
            const isChoiceColumn = selectedColumnForEdit.column_type === 'choice' ||
                                   selectedColumnForEdit.column_type === 'single_select' ||
                                   selectedColumnForEdit.column_type === 'dropdown'

            // Refetch choices for choice columns
            if (isChoiceColumn && selectedColumnForEdit.id) {
              try {
                console.log('🔄 Refetching choices for column:', selectedColumnForEdit.id)
                const data = await api.get(`/api/v1/foundations/${foundationIdNumeric}/columns/${selectedColumnForEdit.id}/choices`, {
                  params: { _: Date.now() } // Cache buster
                })
                console.log('📦 API Response:', data)
                if (data.success && data.choices) {
                  const choiceValues = data.choices.map(c => c.value)
                  console.log('📋 Choice values from API:', choiceValues)
                  setColumnChoices(prev => {
                    const updated = {
                      ...prev,
                      [selectedColumnForEdit.id]: choiceValues
                    }
                    console.log('💾 Updated columnChoices state:', updated)
                    return updated
                  })
                  console.log('✅ Choices refreshed for column:', selectedColumnForEdit.id)
                }
              } catch (error) {
                console.error('❌ Failed to refetch choices:', error)
              }
            }

            // Call the onColumnUpdate callback if provided to refresh table data
            if (onColumnUpdate) {
              console.log('📢 Calling onColumnUpdate to refresh table and columns')
              onColumnUpdate()
            } else {
              console.log('⚠️ onColumnUpdate not provided - table columns will not refresh')
            }

            // Don't close the modal here - let onClose handle that
            // This allows the refetch to complete before the modal closes
          }}
        />
      )}

      {/* Bulk Update Modal */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setShowBulkUpdateModal(false)}>
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 transition-opacity" aria-hidden="true" />

            {/* Modal */}
            <div
              className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Bulk Update {selectedRows.size} {selectedRows.size === 1 ? 'Record' : 'Records'}
              </h3>

              {/* Column Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Column to Update
                </label>
                <select
                  value={bulkUpdateColumn}
                  onChange={(e) => {
                    setBulkUpdateColumn(e.target.value)
                    setBulkUpdateValue('')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">-- Select a column --</option>
                  {COLUMNS.filter(col => col.key !== 'select' && col.key !== 'actions' && col.key !== 'id').map(col => (
                    <option key={col.key} value={col.column_key || col.key}>
                      {col.display_name || col.label || col.key}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value Input - depends on column type */}
              {bulkUpdateColumn && (() => {
                const selectedCol = COLUMNS.find(c => (c.column_key || c.key) === bulkUpdateColumn)
                const colType = selectedCol?.column_type

                // Get choices/options from columnChoices state (fetched from API)
                const availableChoices = selectedCol?.id ? (columnChoices[selectedCol.id] || []) : []

                // For lookup columns, show dropdown with lookup options
                if (colType === 'lookup' || colType === 'single_lookup') {
                  const isObjectFormat = availableChoices.length > 0 && typeof availableChoices[0] === 'object'
                  return (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        New Value
                      </label>
                      <select
                        value={bulkUpdateValue}
                        onChange={(e) => setBulkUpdateValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">-- Select a value --</option>
                        {availableChoices.map((option, idx) => {
                          if (isObjectFormat) {
                            return (
                              <option key={option.id || idx} value={option.id}>
                                {option.display || option.name || `ID: ${option.id}`}
                              </option>
                            )
                          }
                          return (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  )
                }

                // For choice/select columns, show dropdown
                if (colType === 'choice' || colType === 'status' || colType === 'single_select') {
                  return (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        New Value
                      </label>
                      <select
                        value={bulkUpdateValue}
                        onChange={(e) => setBulkUpdateValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">-- Select a value --</option>
                        {availableChoices.map(choice => (
                          <option key={choice.value || choice} value={choice.value || choice}>
                            {choice.label || choice.value || choice}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                }

                // For boolean columns
                if (colType === 'boolean' || colType === 'checkbox') {
                  return (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        New Value
                      </label>
                      <select
                        value={bulkUpdateValue}
                        onChange={(e) => setBulkUpdateValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">-- Select a value --</option>
                        <option value="true">Yes / True</option>
                        <option value="false">No / False</option>
                      </select>
                    </div>
                  )
                }

                // For number columns
                if (colType === 'number' || colType === 'integer' || colType === 'decimal' || colType === 'currency') {
                  return (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        New Value
                      </label>
                      <input
                        type="number"
                        value={bulkUpdateValue}
                        onChange={(e) => setBulkUpdateValue(e.target.value)}
                        placeholder="Enter number..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  )
                }

                // For date columns
                if (colType === 'date' || colType === 'datetime') {
                  return (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        New Value
                      </label>
                      <input
                        type={colType === 'datetime' ? 'datetime-local' : 'date'}
                        value={bulkUpdateValue}
                        onChange={(e) => setBulkUpdateValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  )
                }

                // Default: text input
                return (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      New Value
                    </label>
                    <input
                      type="text"
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      placeholder="Enter new value..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                )
              })()}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowBulkUpdateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!bulkUpdateColumn) {
                      alert('Please select a column to update')
                      return
                    }

                    setBulkUpdateSaving(true)
                    try {
                      const selectedIds = Array.from(selectedRows)
                      console.log(`🔄 Bulk updating ${selectedIds.length} records, column: ${bulkUpdateColumn}, value: ${bulkUpdateValue}`)

                      // Call bulk update API
                      if (foundationIdNumeric) {
                        await api.post(`/api/v1/foundations/${foundationIdNumeric}/records/bulk_update`, {
                          ids: selectedIds,
                          column_key: bulkUpdateColumn,
                          value: bulkUpdateValue
                        })
                        // Refresh the data
                        if (onColumnUpdate) onColumnUpdate()
                      } else {
                        throw new Error('No foundation ID available for bulk update')
                      }

                      setShowBulkUpdateModal(false)
                      setSelectedRows(new Set())
                      setShowDeleteButton(false)
                      console.log('✅ Bulk update completed')
                    } catch (error) {
                      console.error('❌ Bulk update failed:', error)
                      alert(`Bulk update failed: ${error.message || 'Unknown error'}`)
                    } finally {
                      setBulkUpdateSaving(false)
                    }
                  }}
                  disabled={!bulkUpdateColumn || bulkUpdateSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {bulkUpdateSaving ? 'Updating...' : `Update ${selectedRows.size} Records`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
