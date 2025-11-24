import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import gantt from 'dhtmlx-gantt'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import { XMarkIcon, PencilSquareIcon, AdjustmentsHorizontalIcon, TrashIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'
import TaskDependencyEditor from './TaskDependencyEditor'
import CascadeDependenciesModal from './CascadeDependenciesModal'
import CascadeKanbanModal from './CascadeKanbanModal'
import { Menu } from '@headlessui/react'
import { createDebouncedStorageSetter } from '../../utils/debounce'
import { ganttDebug, bugHunter } from '../../utils/ganttDebugger'
import { getTodayInCompanyTimezone as getToday, getNowInCompanyTimezone, getCompanyTimezone } from '../../utils/timezoneUtils'

/**
 * DHtmlxGanttView - DHTMLX Gantt implementation for comparison with SVAR Gantt
 * Trial version with full PRO features for 30 days
 *
 * Key Features to Test:
 * - Auto-scheduling engine
 * - Built-in DataProcessor for automatic backend sync
 * - Advanced drag-and-drop
 * - Resource management
 * - Critical path visualization
 * - Performance with large datasets
 */

// DIAGNOSTIC MODE: Only enable in development
const DIAGNOSTIC_MODE = import.meta.env.DEV
const diagLog = (emoji, msg) => {
  if (DIAGNOSTIC_MODE) {
    const timestamp = performance.now().toFixed(2)
    console.log(`${emoji} [${timestamp}ms] ${msg}`)
  }
}

export default function DHtmlxGanttView({ isOpen, onClose, tasks, templateId, cascadeDepthRef, onUpdateTask }) {
  const ganttContainer = useRef(null)
  const clickTimeout = useRef(null)
  const highlightTimeout = useRef(null) // Timeout to auto-clear highlighting after 10 seconds
  const manuallyPositionedTasks = useRef(new Set()) // Track which task IDs are manually positioned
  const pendingUnlocks = useRef(new Set()) // Track tasks that are pending unlock (prevent re-locking during data reload)
  const isDragging = useRef(false) // Track if we're currently dragging a task
  const isSaving = useRef(false) // Track if we're currently saving a task update (prevent infinite loops)
  const isLoadingData = useRef(false) // Track if we're programmatically loading data (suppress drag events during parse)
  const loadingDataTimeout = useRef(null) // Track the timeout ID for isLoadingData reset
  const renderTimeout = useRef(null) // PERFORMANCE: Debounce render calls to batch multiple updates
  const suppressRender = useRef(false) // ANTI-FLICKER: Completely suppress all renders during drag completion
  const lastTasksSignature = useRef(null) // ANTI-FLICKER: Track last loaded tasks to prevent unnecessary reloads
  const onUpdateTaskRef = useRef(onUpdateTask) // ANTI-FLICKER: Store callback ref to prevent reinitialization

  // Diagnostic: Track drag start time
  const dragStartTime = useRef(0)

  // Keep onUpdateTask ref up to date
  useEffect(() => {
    onUpdateTaskRef.current = onUpdateTask
  }, [onUpdateTask])
  const [publicHolidays, setPublicHolidays] = useState([])
  const [workingDays, setWorkingDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: true
  })
  const [companyTimezone, setCompanyTimezone] = useState('Australia/Brisbane') // Default timezone
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showPositionDialog, setShowPositionDialog] = useState(false)
  const [positionDialogTask, setPositionDialogTask] = useState(null)
  const [ganttReady, setGanttReady] = useState(false)
  const [dragConflict, setDragConflict] = useState(null) // { task, originalStart, newStart, blockingPredecessors }
  const [canUndo, setCanUndo] = useState(false) // Track if undo is available
  const [canRedo, setCanRedo] = useState(false) // Track if redo is available
  const [cascadeModal, setCascadeModal] = useState(null) // { movedTask, unlockedSuccessors, blockedSuccessors, originalStart }
  const [dragTooltip, setDragTooltip] = useState(null) // { date, position: { x, y } }

  // PERFORMANCE: Create debounced localStorage setter (500ms delay)
  const debouncedSaveToStorage = useMemo(() => createDebouncedStorageSetter(500), [])

  // Load checkbox visibility from localStorage or use default
  const [showCheckboxes, setShowCheckboxes] = useState(() => {
    const saved = localStorage.getItem('dhtmlxGanttShowCheckboxes')
    return saved !== null ? JSON.parse(saved) : true
  })

  // Save checkbox visibility to localStorage whenever it changes (debounced)
  useEffect(() => {
    debouncedSaveToStorage('dhtmlxGanttShowCheckboxes', showCheckboxes)
  }, [showCheckboxes, debouncedSaveToStorage])

  // Load predecessor display mode from localStorage or use default ('numbers')
  const [predecessorDisplayMode, setPredecessorDisplayMode] = useState(() => {
    const saved = localStorage.getItem('dhtmlxGanttPredecessorDisplayMode')
    return saved || 'numbers' // 'numbers' or 'names'
  })

  // Feature flag: Use new kanban-style cascade modal (default: true)
  const [useKanbanModal, setUseKanbanModal] = useState(() => {
    const saved = localStorage.getItem('dhtmlxGanttUseKanbanModal')
    return saved !== null ? JSON.parse(saved) : true
  })

  // Save predecessor display mode to localStorage whenever it changes (debounced)
  useEffect(() => {
    debouncedSaveToStorage('dhtmlxGanttPredecessorDisplayMode', predecessorDisplayMode)
  }, [predecessorDisplayMode, debouncedSaveToStorage])

  // Load column widths from localStorage or use defaults
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('dhtmlxGanttColumnWidths')
    return saved !== null ? JSON.parse(saved) : {
      task_number: 40,
      text: 150,
      predecessors: 100,
      supplier: 120,
      duration: 70,
      confirm: 80,
      supplier_confirm: 120,
      start: 70,
      complete: 90,
      lock_position: 70,
      add: 44
    }
  })

  // Save column widths to localStorage whenever they change (debounced)
  useEffect(() => {
    debouncedSaveToStorage('dhtmlxGanttColumnWidths', columnWidths)
  }, [columnWidths, debouncedSaveToStorage])

  // Load column visibility from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const defaults = {
      taskNumber: true,
      taskName: true,
      predecessors: true,
      supplier: true,
      duration: true,
      confirm: true,
      supplierConfirm: true,
      start: true,
      complete: true,
      lock: true
    }
    const saved = localStorage.getItem('dhtmlxGanttColumns')
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved)
        // Migration: Merge saved with defaults to ensure all columns have visibility settings
        return { ...defaults, ...savedColumns }
      } catch (e) {
        console.error('Failed to parse saved column visibility:', e)
      }
    }
    return defaults
  })

  // Save column visibility to localStorage whenever it changes (debounced)
  useEffect(() => {
    debouncedSaveToStorage('dhtmlxGanttColumns', visibleColumns)
  }, [visibleColumns, debouncedSaveToStorage])

  // Load column order from localStorage or use default
  const [columnOrder, setColumnOrder] = useState(() => {
    const defaultOrder = ['taskNumber', 'taskName', 'predecessors', 'supplier', 'duration', 'confirm', 'supplierConfirm', 'start', 'complete', 'lock']
    const saved = localStorage.getItem('dhtmlxGanttColumnOrder')
    if (saved) {
      try {
        const savedOrder = JSON.parse(saved)
        // Migration: Add any missing columns from defaultOrder that aren't in savedOrder
        const mergedOrder = [...savedOrder]
        defaultOrder.forEach(col => {
          if (!mergedOrder.includes(col)) {
            mergedOrder.push(col)
          }
        })
        return mergedOrder
      } catch (e) {
        console.error('Failed to parse saved column order:', e)
      }
    }
    return defaultOrder
  })

  // Save column order to localStorage whenever it changes (debounced)
  useEffect(() => {
    debouncedSaveToStorage('dhtmlxGanttColumnOrder', columnOrder)
  }, [columnOrder, debouncedSaveToStorage])

  // Load zoom level from localStorage or use default
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem('dhtmlxGanttZoom')
    return saved || 'day'
  })

  // Save zoom level to localStorage whenever it changes (debounced)
  useEffect(() => {
    debouncedSaveToStorage('dhtmlxGanttZoom', zoomLevel)
  }, [zoomLevel, debouncedSaveToStorage])

  // Lock body scroll when modal is open to prevent background shake during drag
  useEffect(() => {
    if (isOpen) {
      // Save original styles
      const originalOverflow = document.body.style.overflow
      const originalPaddingRight = document.body.style.paddingRight
      const originalPosition = document.body.style.position
      const originalTop = document.body.style.top
      const originalWidth = document.body.style.width
      const scrollY = window.scrollY

      // Get scrollbar width BEFORE hiding overflow
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

      // Use RAF to batch all style changes and prevent layout shift
      requestAnimationFrame(() => {
        // Prevent body scroll and layout shift
        document.body.style.overflow = 'hidden'
        document.body.style.position = 'fixed'
        document.body.style.top = `-${scrollY}px`
        document.body.style.width = '100%'

        // Compensate for scrollbar disappearing
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = `${scrollbarWidth}px`
        }
      })

      // Cleanup: restore original styles when modal closes
      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.position = originalPosition
        document.body.style.top = originalTop
        document.body.style.width = originalWidth
        document.body.style.paddingRight = originalPaddingRight
        window.scrollTo(0, scrollY)
      }
    }
  }, [isOpen])

  // Task name search filter
  const [taskNameSearch, setTaskNameSearch] = useState('')

  // Map timezone to Australian state/region for public holidays
  const getRegionFromTimezone = (timezone) => {
    const timezoneMap = {
      'Australia/Brisbane': 'QLD',
      'Australia/Sydney': 'NSW',
      'Australia/Melbourne': 'VIC',
      'Australia/Perth': 'WA',
      'Australia/Adelaide': 'SA',
      'Australia/Darwin': 'NT',
      'Australia/Hobart': 'TAS'
    }
    return timezoneMap[timezone] || 'QLD' // Default to QLD if timezone not found
  }

  // Fetch company settings and public holidays from API
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        setIsLoading(true)

        // First, get company settings to determine region and working days
        let region = 'QLD' // Default
        try {
          const companyResponse = await api.get('/api/v1/company_settings')
          const companySettings = companyResponse.data || companyResponse
          const timezone = companySettings.timezone || 'Australia/Brisbane'
          region = getRegionFromTimezone(timezone)

          // Store timezone for date calculations
          setCompanyTimezone(timezone)
          console.log(`DHTMLX Gantt - Using timezone ${timezone} from company settings`)

          // Store working days configuration
          if (companySettings.working_days) {
            setWorkingDays(companySettings.working_days)
            console.log('DHTMLX Gantt - Using working days from company settings:', companySettings.working_days)
          }
        } catch (error) {
          console.warn('Failed to load company settings, using default region QLD:', error)
        }

        // Now fetch holidays for that region (use company timezone for current year)
        const currentYear = getToday().getFullYear()
        const response = await api.get(`/api/v1/public_holidays/dates?region=${region}&year_start=${currentYear}&year_end=${currentYear + 2}`)
        const holidays = response.dates || []
        console.log('DHTMLX Gantt - Fetched public holidays:', holidays)
        console.log('DHTMLX Gantt - November 2025 holidays:', holidays.filter(h => h.startsWith('2025-11')))
        setPublicHolidays(holidays)
      } catch (error) {
        console.error('Failed to fetch public holidays:', error)
        setPublicHolidays([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchHolidays()
  }, [])

  // Check if a date is a weekend
  const isSaturday = (date) => {
    const day = date.getDay()
    return day === 6 // Saturday only
  }

  // Keep weekend detection for styling purposes (even though Sunday is now allowed)
  const isWeekend = (date) => {
    const day = date.getDay()
    return day === 0 || day === 6 // Sunday or Saturday
  }

  // Helper function to format date as YYYY-MM-DD in LOCAL timezone (not UTC)
  const formatDateLocal = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Check if a date is a public holiday
  const isPublicHoliday = (dateStr) => {
    return publicHolidays.includes(dateStr)
  }

  // Check if a date is a working day
  // Uses company settings to determine which days are working days
  const isWorkingDay = (date) => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = dayNames[date.getDay()]
    // Default to true if day not configured (safer default)
    return workingDays[dayName] !== false
  }

  // PERFORMANCE: Debounced render to batch multiple render requests and reduce flashing
  // ANTI-FLICKER: Memoize debouncedRender to prevent unnecessary effect triggers
  // Note: ganttReady is accessed but not in dependencies because we want a stable function reference
  const ganttReadyRef = useRef(ganttReady)
  ganttReadyRef.current = ganttReady

  const debouncedRender = useCallback((delay = 0) => {
    if (renderTimeout.current) {
      clearTimeout(renderTimeout.current)
    }
    renderTimeout.current = setTimeout(() => {
      // ANTI-FLICKER: Skip render if suppression is active
      if (suppressRender.current) {
        console.log('⏸️ Skipping render - render suppression active (drag completion)')
        renderTimeout.current = null
        return
      }

      if (ganttReadyRef.current) {
        gantt.render()
      }
      renderTimeout.current = null
    }, delay)
  }, []) // Empty dependencies - function never changes

  // Initialize DHTMLX Gantt (only once when modal opens)
  useEffect(() => {
    if (!ganttContainer.current || !isOpen) return

    // Enable Undo/Redo plugin (PRO feature)
    gantt.plugins({
      undo: true
    })

    // Configure undo settings
    gantt.config.undo = true
    gantt.config.redo = true
    gantt.config.undo_steps = 10 // Keep last 10 actions
    gantt.config.undo_types = {
      link: 'link',
      task: 'task'
    }

    // Enable row selection on single click (highlights both grid row and timeline bar)
    gantt.config.select_task = true // Enable task selection
    gantt.config.scroll_on_click = false // Don't auto-scroll when selecting

    // Configure DHTMLX Gantt date format
    gantt.config.date_format = '%Y-%m-%d'
    gantt.config.xml_date = '%Y-%m-%d'
    gantt.config.duration_step = 1 // Duration in days

    // Configure timeline scale based on zoom level
    const zoomLevels = {
      day: {
        scales: [
          { unit: 'month', step: 1, format: '%F %Y' },
          { unit: 'day', step: 1, format: '%d' }
        ],
        min_column_width: 30
      },
      week: {
        scales: [
          { unit: 'month', step: 1, format: '%F %Y' },
          { unit: 'week', step: 1, format: 'Week %W' }
        ],
        min_column_width: 50
      },
      month: {
        scales: [
          { unit: 'year', step: 1, format: '%Y' },
          { unit: 'month', step: 1, format: '%M' }
        ],
        min_column_width: 60
      }
    }

    const currentZoom = zoomLevels[zoomLevel] || zoomLevels.day
    gantt.config.scales = currentZoom.scales
    gantt.config.min_column_width = currentZoom.min_column_width

    gantt.config.scale_height = 60
    gantt.config.row_height = 40
    gantt.config.task_height = 40  // MUST match row_height for correct positioning
    gantt.config.bar_height = 40   // MUST also match - DHtmlx uses this for Y calculations!
    gantt.config.round_dnd_dates = true // Round dates to full days
    gantt.config.column_resize = true // Enable resizing individual columns by dragging headers
    gantt.config.smart_rendering = true // PERFORMANCE: Enable smart rendering - only renders visible tasks
    gantt.config.static_background = true // PERFORMANCE: Static background is faster
    gantt.config.autosize = false // Disable autosize to maintain fixed heights
    gantt.config.show_errors = false // PERFORMANCE: Disable error popups during drag
    gantt.config.inline_editors_date_processing = 'keepDates' // Keep original date values when editing

    // Extend timeline range to show past and future dates
    // Set start date to 6 months BEFORE today (to see historical data)
    const timelineStart = getToday()
    timelineStart.setMonth(timelineStart.getMonth() - 6)
    timelineStart.setHours(0, 0, 0, 0)

    // Set end date to 10 years from today to accommodate longer project timelines
    // (e.g., test schedules with 2025-day offsets = ~5.5 years)
    const timelineEnd = getToday()
    timelineEnd.setFullYear(timelineEnd.getFullYear() + 10)
    timelineEnd.setHours(23, 59, 59, 999)

    gantt.config.start_date = timelineStart
    gantt.config.end_date = timelineEnd
    gantt.config.fit_tasks = false // Disable fit_tasks since we're setting explicit range

    // Configure separate scrollbars for grid and timeline
    gantt.config.scroll_size = 20 // Set scrollbar size

    // Custom layout with separate scrollbars
    gantt.config.layout = {
      css: "gantt_container",
      cols: [
        {
          width: 450,
          rows: [
            { view: "grid", scrollX: "gridScroll", scrollable: true, scrollY: "scrollVer" },
            { view: "scrollbar", id: "gridScroll", group: "horizontal" }
          ]
        },
        {
          rows: [
            { view: "timeline", scrollX: "timelineScroll", scrollable: true, scrollY: "scrollVer" },
            { view: "scrollbar", id: "timelineScroll", group: "horizontal" }
          ]
        },
        { view: "scrollbar", id: "scrollVer", group: "vertical" }
      ]
    }

    // ===== DHTMLX DataProcessor Configuration =====
    // This is a PRO feature that auto-syncs changes to backend
    // Uncomment and configure when ready to test automatic sync
    /*
    const dp = gantt.createDataProcessor({
      task: {
        update: (data) => api.put(`/api/v1/schedule_template_rows/${data.id}`, {
          name: data.text,
          duration: data.duration,
          // Add other fields as needed
        }),
        create: (data) => api.post('/api/v1/schedule_template_rows', {
          // Map DHTMLX data to your API format
        }),
        delete: (id) => api.delete(`/api/v1/schedule_template_rows/${id}`)
      },
      link: {
        update: (data) => {
          // Update task dependencies when links change
          // This would call your onUpdateTask callback
          return Promise.resolve()
        },
        create: (data) => Promise.resolve(),
        delete: (id) => Promise.resolve()
      }
    })
    */

    // Initial column configuration
    gantt.config.columns = [
      {
        name: 'lock_position',
        label: 'Lock',
        width: 70,
        align: 'center',
        resize: true,
        template: (task) => {
          const checked = task.$manuallyPositioned || task.manually_positioned ? 'checked' : ''
          return `<input type="checkbox" class="gantt-lock-checkbox" data-task-id="${task.id}" ${checked} />`
        }
      },
      {
        name: 'task_number',
        label: '#',
        width: 40,
        align: 'center',
        resize: true,
        template: (task) => {
          const taskIndex = tasks.filter(t => t).findIndex(t => t.id === task.id)
          return taskIndex >= 0 ? `#${taskIndex + 1}` : ''
        }
      },
      {
        name: 'text',
        label: 'Task Name',
        width: 150,
        tree: false,
        resize: true
      },
      {
        name: 'predecessors',
        label: 'Predecessors',
        width: 100,
        align: 'center',
        resize: true,
        template: (task) => {
          return task.predecessors || '-'
        }
      },
      {
        name: 'supplier',
        label: 'Supplier/Group',
        width: 120,
        resize: true,
        template: (task) => {
          return task.supplier || '-'
        }
      },
      {
        name: 'duration',
        label: 'Duration',
        width: 70,
        align: 'center',
        resize: true,
        template: (task) => {
          return task.duration ? `${task.duration} ${task.duration === 1 ? 'day' : 'days'}` : '-'
        }
      },
      // Only include checkbox columns if showCheckboxes is true
      ...(showCheckboxes ? [
        {
          name: 'confirm',
          label: 'Confirm',
          width: 80,
          align: 'center',
          resize: true,
          template: (task) => {
            const checked = task.confirm ? 'checked' : ''
            return `<input type="checkbox" class="gantt-checkbox" data-task-id="${task.id}" data-field="confirm" ${checked} />`
          }
        },
        {
          name: 'supplier_confirm',
          label: 'Supplier Confirm',
          width: 120,
          align: 'center',
          resize: true,
          template: (task) => {
            const checked = task.supplier_confirm ? 'checked' : ''
            return `<input type="checkbox" class="gantt-checkbox" data-task-id="${task.id}" data-field="supplier_confirm" ${checked} />`
          }
        },
        {
          name: 'start',
          label: 'Start',
          width: 70,
          align: 'center',
          resize: true,
          template: (task) => {
            const checked = task.start ? 'checked' : ''
            return `<input type="checkbox" class="gantt-checkbox" data-task-id="${task.id}" data-field="start" ${checked} />`
          }
        },
        {
          name: 'complete',
          label: 'Complete',
          width: 90,
          align: 'center',
          resize: true,
          template: (task) => {
            const checked = task.complete ? 'checked' : ''
            return `<input type="checkbox" class="gantt-checkbox" data-task-id="${task.id}" data-field="complete" ${checked} />`
          }
        }
      ] : []),
      {
        name: 'add',
        label: '',
        width: 44
      }
    ]

    // Configure work time based on company settings
    gantt.config.work_time = true
    gantt.config.duration_unit = 'day' // Set duration unit to days

    // Set working time rules (24 hours - full day)
    gantt.setWorkTime({ hours: [0, 24] })

    // Configure working days based on company settings
    const dayIndexMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
    Object.entries(workingDays).forEach(([dayName, isWorking]) => {
      const dayIndex = dayIndexMap[dayName]
      if (!isWorking) {
        gantt.setWorkTime({ day: dayIndex, hours: false })
      }
    })

    // Mark public holidays as non-working days
    publicHolidays.forEach(holiday => {
      gantt.setWorkTime({ date: new Date(holiday), hours: false })
    })

    // Disable auto-scheduling - we'll manually handle scheduling based on predecessors
    gantt.config.auto_scheduling = false

    // Enable task dragging
    gantt.config.drag_move = true // Allow dragging tasks to change dates
    gantt.config.drag_resize = true // Allow resizing to change duration
    gantt.config.drag_progress = false // Don't need progress dragging

    // Enable drag-and-drop for links
    gantt.config.drag_links = true
    gantt.config.details_on_dblclick = true // Enable lightbox on double-click

    // Enable undo/redo (PRO feature)
    // NOTE: auto_scheduling DISABLED - backend cascade service handles all dependency updates
    // This prevents conflicts between frontend auto-scheduling and backend cascade
    gantt.plugins({
      auto_scheduling: false,
      critical_path: true,
      drag_timeline: true,
      tooltip: true,
      undo: true
    })

    // Disable Gantt's built-in tooltip completely - we use our own custom drag tooltip
    gantt.config.tooltip_timeout = 999999 // Effectively disable by making timeout very long
    gantt.config.tooltip_hide_timeout = 0 // Hide immediately if it does appear

    // Configure the lightbox (task editor modal)
    gantt.config.lightbox.sections = [
      {
        name: 'description',
        height: 38,
        map_to: 'text',
        type: 'textarea',
        focus: true
      },
      {
        name: 'supplier',
        height: 38,
        map_to: 'supplier',
        type: 'textarea'
      },
      {
        name: 'time',
        height: 72,
        type: 'duration',
        map_to: 'auto'
      },
      {
        name: 'predecessor_editor',
        height: 150, // Start small, will expand dynamically
        type: 'template',
        map_to: 'my_template'
      },
      {
        name: 'successor_display',
        height: 150, // Start small, will expand dynamically
        type: 'successor_template',
        map_to: 'successor_display'
      }
    ]

    // Add labels
    gantt.locale.labels.section_predecessor_editor = 'Predecessors'
    gantt.locale.labels.section_successor_display = 'Tasks Depending on This'

    // Custom template for embedded predecessor editor
    gantt.form_blocks.template = {
      render: function(sns) {
        return `<div class='gantt_cal_ltext predecessor-editor-container' style='min-height:${sns.height}px; max-height: 500px; overflow-y: auto; padding: 8px;'>
          <div class='predecessor-list'></div>
          <button type='button' class='add-predecessor-btn' style='
            width: 100%;
            padding: 8px;
            margin-top: 8px;
            border: 2px dashed #d1d5db;
            background: white;
            color: #6b7280;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
          '>
            + Add Predecessor
          </button>
        </div>`
      },
      set_value: function(node, value, task, section) {
        const listContainer = node.querySelector('.predecessor-list')
        const addButton = node.querySelector('.add-predecessor-btn')

        // Get available tasks (all except current task)
        const availableTasks = tasks.filter(t => t && t.id !== task.id)
        const currentTaskIndex = tasks.filter(t => t).findIndex(t => t.id === task.id)

        // Parse existing predecessors from the DHTMLX Gantt task object
        let predecessors = []
        if (task.predecessor_ids && Array.isArray(task.predecessor_ids)) {
          predecessors = task.predecessor_ids.map(pred => {
            if (typeof pred === 'object') {
              return { id: pred.id, type: pred.type || 'FS', lag: pred.lag || 0 }
            }
            return { id: pred, type: 'FS', lag: 0 }
          })
        }

        console.log('Loading predecessors in lightbox for task', task.id, ':', predecessors)
        console.log('Raw task.predecessor_ids:', task.predecessor_ids)
        console.log('Task object:', task)

        // Store predecessors on the node for retrieval
        node.predecessorsData = predecessors

        // Helper function to check if adding a task as predecessor would create circular dependency
        const wouldCreateCircularDependency = (predecessorTaskNumber) => {
          const currentTaskNumber = tasks.findIndex(t => t.id === task.id) + 1

          // Can't be a predecessor of itself
          if (predecessorTaskNumber === currentTaskNumber) {
            return true
          }

          // Check if the predecessor task depends on the current task (directly or indirectly)
          const checkDependency = (taskNum, visited = new Set()) => {
            if (visited.has(taskNum)) {
              return false // Already checked this path
            }
            visited.add(taskNum)

            const taskToCheck = tasks[taskNum - 1]
            if (!taskToCheck || !taskToCheck.predecessor_ids) {
              return false
            }

            // Check each predecessor of this task
            for (const pred of taskToCheck.predecessor_ids) {
              const predId = typeof pred === 'object' ? pred.id : pred

              // If this task depends on the current task, we have a circular dependency
              if (predId === currentTaskNumber) {
                return true
              }

              // Recursively check if any predecessor's predecessors depend on current task
              if (checkDependency(predId, new Set(visited))) {
                return true
              }
            }

            return false
          }

          return checkDependency(predecessorTaskNumber)
        }

        const renderPredecessors = () => {
          listContainer.innerHTML = ''

          if (node.predecessorsData.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 13px;">No predecessors. This task can start at any time.</div>'
            return
          }

          node.predecessorsData.forEach((pred, index) => {
            const predRow = document.createElement('div')
            predRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 4px; border: 1px solid #e5e7eb;'

            predRow.innerHTML = `
              <div style="flex: 1;">
                <label style="display: block; font-size: 11px; color: #6b7280; margin-bottom: 4px;">Predecessor Task</label>
                <select class="pred-task-${index}" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                  <option value="">Select task...</option>
                  ${tasks.map((t, taskIdx) => {
                    const taskNumber = taskIdx + 1
                    if (t.id === task.id) return '' // Skip current task

                    // Always show the currently selected predecessor (even if it would create circular dependency)
                    // This allows user to see existing circular dependencies and remove them
                    const isCurrentlySelected = taskNumber === pred.id

                    // Skip tasks that would create circular dependency (unless currently selected)
                    if (!isCurrentlySelected && wouldCreateCircularDependency(taskNumber)) return ''

                    // Mark circular dependencies with a warning in the label
                    const wouldBeCircular = wouldCreateCircularDependency(taskNumber)
                    const label = wouldBeCircular
                      ? `#${taskNumber}: ${t.name} ⚠️ CIRCULAR`
                      : `#${taskNumber}: ${t.name}`

                    return `<option value="${taskNumber}" ${isCurrentlySelected ? 'selected' : ''}>
                      ${label}
                    </option>`
                  }).join('')}
                </select>
              </div>

              <div style="width: 140px;">
                <label style="display: block; font-size: 11px; color: #6b7280; margin-bottom: 4px;">Type</label>
                <select class="pred-type-${index}" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;">
                  <option value="FS" ${pred.type === 'FS' ? 'selected' : ''}>FS (Finish→Start)</option>
                  <option value="SS" ${pred.type === 'SS' ? 'selected' : ''}>SS (Start→Start)</option>
                  <option value="FF" ${pred.type === 'FF' ? 'selected' : ''}>FF (Finish→Finish)</option>
                  <option value="SF" ${pred.type === 'SF' ? 'selected' : ''}>SF (Start→Finish)</option>
                </select>
              </div>

              <div style="width: 80px;">
                <label style="display: block; font-size: 11px; color: #6b7280; margin-bottom: 4px;">Lag (days)</label>
                <input type="number" class="pred-lag-${index}" value="${pred.lag}" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;" />
              </div>

              <div style="padding-top: 18px;">
                <button type="button" class="remove-pred-${index}" style="padding: 6px 8px; background: #fee2e2; color: #dc2626; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">×</button>
              </div>
            `

            listContainer.appendChild(predRow)

            // Add event listeners
            predRow.querySelector(`.pred-task-${index}`).addEventListener('change', (e) => {
              node.predecessorsData[index].id = parseInt(e.target.value) || 0
            })

            predRow.querySelector(`.pred-type-${index}`).addEventListener('change', (e) => {
              node.predecessorsData[index].type = e.target.value
            })

            predRow.querySelector(`.pred-lag-${index}`).addEventListener('change', (e) => {
              node.predecessorsData[index].lag = parseInt(e.target.value) || 0
            })

            predRow.querySelector(`.remove-pred-${index}`).addEventListener('click', () => {
              node.predecessorsData.splice(index, 1)
              renderPredecessors()
            })
          })
        }

        addButton.addEventListener('click', (e) => {
          e.preventDefault()
          node.predecessorsData.push({ id: 0, type: 'FS', lag: 0 })
          renderPredecessors()
        })

        renderPredecessors()
      },
      get_value: function(node, task, section) {
        // Return the predecessors array
        const validPreds = (node.predecessorsData || []).filter(p => p.id > 0)
        console.log('get_value called, returning:', validPreds)
        return validPreds
      },
      focus: function(node) {}
    }

    // Custom form block for successor (dependent tasks) display
    gantt.form_blocks.successor_template = {
      render: function(sns) {
        return `<div class='gantt_cal_ltext successor-display-container' style='min-height:${sns.height}px; max-height: 600px; overflow-y: auto; padding: 4px 8px; background-color: #f9fafb; border-radius: 4px;'>
          <div class='successor-list'></div>
        </div>`
      },
      set_value: function(node, value, task, section) {
        const listContainer = node.querySelector('.successor-list')
        const currentTaskNumber = tasks.findIndex(t => t.id === task.id) + 1

        // Find all tasks that have this task as a predecessor OR had it removed
        const successors = []
        const removedSuccessors = []

        tasks.forEach((t, idx) => {
          const taskNumber = idx + 1

          // Check if this task has broken dependencies and used to depend on current task
          if (t.dependencies_broken) {
            // This task might have had the current task as a predecessor
            // We'll show it in the removed section
            removedSuccessors.push({
              taskId: t.id,
              taskNumber: taskNumber,
              name: t.name
            })
          }

          // Check current dependencies
          if (t.predecessor_ids && t.predecessor_ids.length > 0) {
            const hasDependency = t.predecessor_ids.some(pred => {
              const predId = typeof pred === 'object' ? pred.id : pred
              return predId === currentTaskNumber
            })
            if (hasDependency) {
              // Find the specific predecessor relationship
              const relationship = t.predecessor_ids.find(pred => {
                const predId = typeof pred === 'object' ? pred.id : pred
                return predId === currentTaskNumber
              })

              successors.push({
                taskId: t.id,
                taskNumber: taskNumber,
                name: t.name,
                type: typeof relationship === 'object' ? relationship.type : 'FS',
                lag: typeof relationship === 'object' ? (relationship.lag || 0) : 0
              })
            }
          }
        })

        if (successors.length === 0 && removedSuccessors.length === 0) {
          listContainer.innerHTML = '<div style="text-align: center; padding: 12px; color: #6b7280; font-size: 13px;">No tasks depend on this task.</div>'
          return
        }

        listContainer.innerHTML = `
          ${successors.length > 0 ? `
            <div style="margin-bottom: 6px; padding: 6px 8px; background: #e0e7ff; border-radius: 4px; border-left: 3px solid #4f46e5;">
              <div style="font-size: 12px; color: #4338ca; font-weight: 600;">
                ${successors.length} task${successors.length === 1 ? '' : 's'} depend${successors.length === 1 ? 's' : ''} on this task
              </div>
            </div>
            ${successors.map(succ => {
              const relationshipText = `${succ.type}${succ.lag !== 0 ? (succ.lag > 0 ? `+${succ.lag}` : succ.lag) : ''}`
              const typeLabel = {
                'FS': 'Finish → Start',
                'SS': 'Start → Start',
                'FF': 'Finish → Finish',
                'SF': 'Start → Finish'
              }[succ.type] || succ.type

              return `
                <div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; margin-bottom: 4px; background: white; border: 1px solid #e5e7eb; border-radius: 4px;">
                  <div style="flex-shrink: 0; width: 36px; height: 36px; background: #dbeafe; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #1e40af; font-size: 13px;">
                    #${succ.taskNumber}
                  </div>
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 13px; font-weight: 500; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${succ.name}
                    </div>
                    <div style="font-size: 11px; color: #6b7280; margin-top: 1px;">
                      ${typeLabel}${succ.lag !== 0 ? ` (${succ.lag > 0 ? '+' : ''}${succ.lag} days)` : ''}
                    </div>
                  </div>
                  <div style="flex-shrink: 0; padding: 3px 6px; background: #f3f4f6; border-radius: 4px; font-size: 11px; font-weight: 600; color: #4b5563;">
                    ${relationshipText}
                  </div>
                </div>
              `
            }).join('')}
          ` : ''}

          ${removedSuccessors.length > 0 ? `
            <div style="margin-top: ${successors.length > 0 ? '12px' : '0'}; margin-bottom: 6px; padding: 6px 8px; background: #fef3c7; border-radius: 4px; border-left: 3px solid #f59e0b;">
              <div style="font-size: 12px; color: #d97706; font-weight: 600;">
                ⚠️ ${removedSuccessors.length} dependency removed
              </div>
            </div>
            ${removedSuccessors.map(succ => `
              <div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; margin-bottom: 4px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px;">
                <div style="flex-shrink: 0; width: 36px; height: 36px; background: #fef3c7; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #d97706; font-size: 13px;">
                  #${succ.taskNumber}
                </div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 13px; font-weight: 500; color: #78350f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${succ.name}
                  </div>
                  <div style="font-size: 11px; color: #a16207; margin-top: 1px;">
                    Dependency removed due to conflict
                  </div>
                </div>
                <button
                  type="button"
                  class="restore-dependency-btn"
                  data-task-id="${succ.taskId}"
                  data-predecessor-id="${currentTaskNumber}"
                  style="flex-shrink: 0; padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 11px; font-weight: 500; cursor: pointer; transition: background 0.2s;"
                  onmouseover="this.style.background='#2563eb'"
                  onmouseout="this.style.background='#3b82f6'"
                >
                  Restore
                </button>
              </div>
            `).join('')}
          ` : ''}
        `

        // Add event listeners for restore buttons
        const restoreButtons = listContainer.querySelectorAll('.restore-dependency-btn')
        restoreButtons.forEach(btn => {
          btn.addEventListener('click', function(e) {
            e.preventDefault()
            const successorTaskId = parseInt(this.getAttribute('data-task-id'))
            const predecessorTaskNumber = parseInt(this.getAttribute('data-predecessor-id'))

            console.log('🔄 Restoring dependency:', { successorTaskId, predecessorTaskNumber })

            // Find the task in gantt
            const successorTask = gantt.getTask(successorTaskId)
            if (successorTask) {
              // Check if restoring this dependency would create a circular dependency
              const successorTaskNumber = tasks.findIndex(t => t.id === successorTaskId) + 1

              // First check: Is the task trying to depend on itself?
              if (predecessorTaskNumber === successorTaskNumber) {
                const errorMsg = document.createElement('div')
                errorMsg.style.cssText = 'margin-top: 8px; padding: 8px; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 4px; color: #991b1b; font-size: 12px;'
                errorMsg.textContent = '⚠️ Cannot restore: A task cannot depend on itself'
                this.closest('div[style*="background: #fffbeb"]').appendChild(errorMsg)
                setTimeout(() => errorMsg.remove(), 3000)
                return
              }

              // Helper to check circular dependencies
              const wouldCreateCircular = (taskNum, targetNum, visited = new Set()) => {
                if (visited.has(taskNum)) return false
                visited.add(taskNum)

                const taskToCheck = tasks[taskNum - 1]
                if (!taskToCheck || !taskToCheck.predecessor_ids) return false

                for (const pred of taskToCheck.predecessor_ids) {
                  const predId = typeof pred === 'object' ? pred.id : pred
                  if (predId === targetNum) return true
                  if (wouldCreateCircular(predId, targetNum, new Set(visited))) return true
                }
                return false
              }

              // Check if adding predecessorTaskNumber to successorTaskNumber would create circular dependency
              if (wouldCreateCircular(predecessorTaskNumber, successorTaskNumber)) {
                // Show error message in the UI
                const errorMsg = document.createElement('div')
                errorMsg.style.cssText = 'margin-top: 8px; padding: 8px; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 4px; color: #991b1b; font-size: 12px;'
                errorMsg.textContent = '⚠️ Cannot restore: This would create a circular dependency'
                this.closest('div[style*="background: #fffbeb"]').appendChild(errorMsg)

                // Remove error message after 3 seconds
                setTimeout(() => errorMsg.remove(), 3000)
                return
              }

              // Add the predecessor back
              if (!successorTask.predecessor_ids) {
                successorTask.predecessor_ids = []
              }
              successorTask.predecessor_ids.push({
                id: predecessorTaskNumber,
                type: 'FS',
                lag: 0
              })

              // Remove from broken_predecessor_ids
              if (successorTask.broken_predecessor_ids) {
                successorTask.broken_predecessor_ids = successorTask.broken_predecessor_ids.filter(pred => {
                  const predId = typeof pred === 'object' ? pred.id : pred
                  return predId !== predecessorTaskNumber
                })
              }

              // Clear dependencies_broken flag if no more broken dependencies
              const hasMoreBrokenDeps = successorTask.broken_predecessor_ids && successorTask.broken_predecessor_ids.length > 0
              successorTask.dependencies_broken = hasMoreBrokenDeps
              successorTask.$dependenciesBroken = hasMoreBrokenDeps

              // Save to backend
              onUpdateTaskRef.current(successorTaskId, {
                predecessor_ids: successorTask.predecessor_ids,
                broken_predecessor_ids: successorTask.broken_predecessor_ids || [],
                dependencies_broken: hasMoreBrokenDeps
              }, { skipReload: true })

              // Update the Gantt chart
              gantt.updateTask(successorTaskId)

              // Remove the restored dependency from the UI immediately
              const removedSection = this.closest('div[style*="background: #fffbeb"]')
              if (removedSection) {
                removedSection.remove()
              }

              // Check if there are any more removed dependencies
              const remainingRemoved = listContainer.querySelectorAll('.restore-dependency-btn')
              if (remainingRemoved.length === 0) {
                // Remove the entire warning section if no more removed dependencies
                const warningSection = listContainer.querySelector('div[style*="background: #fef3c7"]')
                if (warningSection) {
                  warningSection.remove()
                }
              } else {
                // Update the count
                const countText = listContainer.querySelector('div[style*="background: #fef3c7"] div')
                if (countText) {
                  countText.textContent = `⚠️ ${remainingRemoved.length} dependency removed`
                }
              }
            }
          })
        })
      },
      get_value: function(node, task, section) {
        // Read-only display, no value to return
        return null
      },
      focus: function(node) {}
    }

    // Custom tooltip
    gantt.templates.tooltip_text = (start, end, task) => {
      return `<b>Task:</b> ${task.text}<br/>
              <b>Duration:</b> ${task.duration} days<br/>
              <b>Start:</b> ${gantt.templates.tooltip_date_format(start)}<br/>
              <b>End:</b> ${gantt.templates.tooltip_date_format(end)}`
    }

    // Highlight selected task and its dependencies
    gantt.templates.task_class = (start, end, task) => {
      const classes = []

      // Status-based colors (highest priority first)
      if (task.complete) {
        classes.push('task-complete')
      } else if (task.start) {
        classes.push('task-start')
      } else if (task.supplier_confirm) {
        classes.push('task-supplier-confirm')
      } else if (task.confirm) {
        classes.push('task-confirm')
      } else if (task.$manuallyPositioned) {
        // Only show manually positioned color if no status checkboxes are set
        classes.push('manually-positioned-task')
      }

      // Add checkered pattern if dependencies were broken
      if (task.$dependenciesBroken || task.dependencies_broken) {
        classes.push('broken-dependencies-task')
      }

      if (task.$highlighted) {
        const colorIndex = task.$colorIndex !== undefined ? task.$colorIndex : 0
        classes.push(`highlighted-task highlighted-task-color-${colorIndex}`)
      }

      return classes.join(' ')
    }

    // Highlight grid rows for selected tasks
    gantt.templates.grid_row_class = (start, end, task) => {
      const classes = []

      if (task.$highlighted) {
        const colorIndex = task.$colorIndex !== undefined ? task.$colorIndex : 0
        classes.push(`highlighted-task highlighted-task-color-${colorIndex}`)
      }

      if (task.$manuallyPositioned) {
        classes.push('manually-positioned-row')
      }

      return classes.join(' ')
    }

    // Highlight dependency links
    gantt.templates.link_class = (link) => {
      if (link.$highlighted) {
        const colorIndex = link.$colorIndex !== undefined ? link.$colorIndex : 0
        return `highlighted-link highlighted-link-color-${colorIndex}`
      }
      return ''
    }

    // Style weekends, public holidays, and today
    gantt.templates.timeline_cell_class = (task, date) => {
      const dateStr = formatDateLocal(date) // Use LOCAL timezone

      // Get today's date dynamically
      const today = getToday()
      today.setHours(0, 0, 0, 0)
      const todayStr = formatDateLocal(today) // Use LOCAL timezone

      // Today gets priority styling
      if (dateStr === todayStr) {
        return 'today'
      }
      if (isPublicHoliday(dateStr)) {
        return 'public-holiday'
      }
      if (isWeekend(date)) {
        return 'weekend'
      }
      return ''
    }

    // Style scale cells (header)
    gantt.templates.scale_cell_class = (date) => {
      const dateStr = formatDateLocal(date) // Use LOCAL timezone

      // Get today's date dynamically
      const today = getToday()
      today.setHours(0, 0, 0, 0)
      const todayStr = formatDateLocal(today) // Use LOCAL timezone

      // Today gets priority styling
      if (dateStr === todayStr) {
        return 'today'
      }
      if (isPublicHoliday(dateStr)) {
        return 'public-holiday'
      }
      if (isWeekend(date)) {
        return 'weekend'
      }
      return ''
    }

    // Log today's date for debugging
    const debugToday = getToday()
    console.log('DHTMLX Gantt - Today\'s date (LOCAL):', formatDateLocal(debugToday))
    console.log('DHTMLX Gantt - Public holidays:', publicHolidays)

    // Handle link creation (drag-and-drop dependencies)
    gantt.attachEvent('onAfterLinkAdd', (id, link) => {
      console.log('Link added:', link)
      handleLinkUpdate()
      return true
    })

    // Handle link deletion
    gantt.attachEvent('onAfterLinkDelete', (id, link) => {
      console.log('Link deleted:', link)
      handleLinkUpdate()
      return true
    })

    // Update undo/redo button states
    const updateUndoRedoButtons = () => {
      if (gantt.getUndoStack && gantt.getRedoStack) {
        const undoStack = gantt.getUndoStack()
        const redoStack = gantt.getRedoStack()
        setCanUndo(undoStack.length > 0)
        setCanRedo(redoStack.length > 0)
        // Skip logging during drag to prevent visual lag
        if (!isDragging.current) {
          console.log('📚 Undo/Redo stacks:', { undo: undoStack.length, redo: redoStack.length })
        }
      }
    }

    // Handle task updates (drag to change dates)
    gantt.attachEvent('onAfterTaskUpdate', (id, task) => {
      // Skip logging during drag to prevent visual lag (fires ~50 times per drag)
      if (!isDragging.current) {
        console.log('Task updated:', task)
      }
      handleTaskUpdate(task)
      updateUndoRedoButtons() // Update button states after change
      return true
    })

    gantt.attachEvent('onAfterTaskAdd', () => {
      updateUndoRedoButtons()
      return true
    })

    gantt.attachEvent('onAfterTaskDelete', () => {
      updateUndoRedoButtons()
      return true
    })

    gantt.attachEvent('onAfterLinkAdd', () => {
      updateUndoRedoButtons()
      return true
    })

    gantt.attachEvent('onAfterLinkDelete', () => {
      updateUndoRedoButtons()
      return true
    })

    gantt.attachEvent('onAfterUndo', () => {
      updateUndoRedoButtons()
      return true
    })

    gantt.attachEvent('onAfterRedo', () => {
      updateUndoRedoButtons()
      return true
    })

    // ====================================================================
    // AUTO-SELECT TEXT IN INLINE EDITORS
    // ====================================================================
    // IMPORTANT: This handler ensures that when clicking on ANY editable
    // field in the gantt grid, the current value is:
    // 1. VISIBLE (not empty) - handled by editor's map_to property
    // 2. SELECTED/HIGHLIGHTED - handled by this event listener
    //
    // This allows users to:
    // - See what the old value was before changing it
    // - Immediately start typing to replace the value
    // - Use arrow keys or click to edit partially
    //
    // Apply this pattern to ALL editable columns by:
    // 1. Adding editor: { type: 'text|number', map_to: 'field_name' } to column config
    // 2. This handler will automatically select the text for any input field
    // ====================================================================
    const handleEditorFocus = (e) => {
      const target = e.target
      // Auto-select text when editor input receives focus (after double-click to open)
      if (target && target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'number')) {
        console.log('🎯 Duration editor focused, auto-selecting text...')
        // Select all text so user can immediately type to replace
        target.select()
        console.log('✅ Text selected, value:', target.value)
      }
    }

    const handleEditorKeyDown = (e) => {
      const target = e.target
      // Keep editor open and save on Enter without closing
      if (target && target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'number')) {
        if (e.key === 'Enter') {
          console.log('⏎ Enter pressed in editor - saving but keeping open')
          e.preventDefault() // Prevent default Enter behavior (which closes editor)
          e.stopPropagation()

          // Get the task ID from the closest row
          const row = target.closest('.gantt_row')
          if (row) {
            const taskId = row.getAttribute('task_id')
            if (taskId) {
              // Trigger save by updating the task
              const task = gantt.getTask(taskId)
              const newValue = parseInt(target.value)
              if (!isNaN(newValue) && newValue > 0) {
                task.duration = newValue
                gantt.updateTask(taskId) // This will trigger our handleTaskUpdate
                console.log('💾 Saved new duration:', newValue)

                // Keep focus in the input so it stays open
                setTimeout(() => {
                  target.focus()
                  target.select()
                }, 10)
              }
            }
          }
        }
      }
    }

    // Add event listeners to keep editor open
    if (ganttContainer.current) {
      ganttContainer.current.addEventListener('focus', handleEditorFocus, true) // Use capture phase
      ganttContainer.current.addEventListener('keydown', handleEditorKeyDown, true) // Capture Enter before it closes
    }

    // Intercept task drag to check for predecessor conflicts
    // Store original position before drag starts
    gantt.attachEvent('onBeforeTaskDrag', (id, mode, event) => {
      // CRITICAL: Hide tooltip immediately when drag starts to avoid blocking interaction
      try {
        if (gantt.ext && gantt.ext.tooltips && typeof gantt.ext.tooltips.hide === 'function') {
          gantt.ext.tooltips.hide()
        }
      } catch (err) {
        // Tooltip hide may not be available in all versions - ignore error
      }

      // Only check for conflicts when dragging the task position (not resizing)
      if (mode === 'move') {
        const task = gantt.getTask(id)

        // LOCK: Prevent dragging if any status checkbox is checked
        if (task.confirm || task.supplier_confirm || task.start || task.complete) {
          console.log('🔒 Task', id, 'is locked (status checkbox checked) - cannot drag')
          return false // Block the drag
        }

        // Store original start date only once at the start of drag
        if (!isDragging.current) {
          dragStartTime.current = performance.now()
          diagLog('🟢', `DRAG START - Task ${id}`)
          isDragging.current = true // Mark that we're dragging
          task.$originalStart = new Date(task.start_date)

          // Mouse position not available in onBeforeTaskDrag - will be set in onTaskDrag
        }
      }
      return true // Allow drag to start
    })

    // Show custom tooltip during drag
    // Track mouse position globally for tooltip (gantt.getState().mouse_position doesn't work)
    let lastMouseX = 0
    let lastMouseY = 0
    const handleMouseMove = (e) => {
      lastMouseX = e.clientX
      lastMouseY = e.clientY
    }
    document.addEventListener('mousemove', handleMouseMove)

    // Show custom tooltip during drag
    gantt.attachEvent('onTaskDrag', (id, mode, task, original) => {
      if (mode === 'move') {
        // Use tracked mouse position since gantt.getState().mouse_position doesn't work
        if (task.start_date && task.$originalStart) {
          // Format the NEW date (where we're dropping)
          const newDate = new Date(task.start_date)
          const newDay = newDate.getDate()
          const newDateFormatted = newDate.toLocaleDateString('en-AU', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })

          // Format the ORIGINAL date (where we're moving from)
          const originalDate = new Date(task.$originalStart)
          const originalDateFormatted = originalDate.toLocaleDateString('en-AU', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          })

          // Get predecessors (tasks this depends on)
          // Convert id to number for comparison (Gantt uses numeric IDs)
          const numericId = parseInt(id, 10)
          const predecessorLinks = gantt.getLinks().filter(link => link.target == numericId)
          const predecessorNames = predecessorLinks.map(link => {
            try {
              const predTask = gantt.getTask(link.source)
              return predTask ? predTask.text : 'Unknown'
            } catch (e) {
              return 'Unknown'
            }
          })

          // Get successors (tasks that depend on this)
          const successorLinks = gantt.getLinks().filter(link => link.source == numericId)
          const successorNames = successorLinks.map(link => {
            try {
              const succTask = gantt.getTask(link.target)
              return succTask ? succTask.text : 'Unknown'
            } catch (e) {
              return 'Unknown'
            }
          })

          setDragTooltip({
            newDay: newDay.toString(), // Just the day number (e.g., "28")
            newDate: newDateFormatted,
            originalDate: originalDateFormatted,
            duration: task.duration || 0,
            predecessors: predecessorNames,
            successors: successorNames,
            position: { x: lastMouseX + 15, y: lastMouseY + 15 }
          })
        }
      }
    })

    diagLog('📋', 'onBeforeTaskDrag handler attached')

    // Check for conflicts after drag completes but BEFORE AfterTaskUpdate fires
    gantt.attachEvent('onAfterTaskDrag', (id, mode, event) => {
      const dragDuration = (performance.now() - dragStartTime.current).toFixed(2)
      diagLog('🔴', `DRAG END - Task ${id}, Duration: ${dragDuration}ms`)
      console.log('🚨🚨🚨 onAfterTaskDrag FIRED - Task:', id, 'Mode:', mode, 'Event:', event)
      console.log('🎯 onAfterTaskDrag fired:', { id, mode })

      // Clear tooltip when drag ends
      setDragTooltip(null)

      // CRITICAL: Set drag lock IMMEDIATELY to prevent cascade API calls from auto-scheduling
      // Auto-scheduling plugin will recalculate dependent tasks and fire onAfterTaskUpdate
      // for each one. This lock prevents handleTaskUpdate from making API calls for those.
      isLoadingData.current = true
      diagLog('🔒', 'Drag lock ENABLED (prevents cascade API calls)')

      // Clear any existing timeout first
      if (loadingDataTimeout.current) {
        clearTimeout(loadingDataTimeout.current)
        loadingDataTimeout.current = null
      }

      // Set timeout to release lock after 5000ms (extended to absorb cascade updates and auto-scheduling)
      loadingDataTimeout.current = setTimeout(() => {
        isLoadingData.current = false
        loadingDataTimeout.current = null
        diagLog('🔓', 'Drag lock RELEASED')
        console.log('✅ Drag lock released - drag events re-enabled')
      }, 5000)

      // ANTI-FLICKER: Suppress ALL renders during drag completion to prevent shake
      suppressRender.current = true
      diagLog('🛡️', 'Render suppression ENABLED')

      // CRITICAL: Determine if this is a real user drag (has $originalStart) or spurious drag from gantt.parse()
      const task = gantt.getTask(id)
      const wasRealDrag = task && task.$originalStart !== undefined

      console.log(`🔍 Drag detection: task=${id}, hasOriginalStart=${!!task?.$originalStart}, isLoadingData=${isLoadingData.current}, isDragging=${isDragging.current}`)

      // CRITICAL: Suppress ONLY spurious drag events during programmatic data loading
      // gantt.parse() triggers drag events, causing infinite loop of re-renders and flickering
      // BUT: Let real user drags proceed even if isLoadingData is true (they override the lock)
      // ALSO: If isDragging is already true, this is a continuation of a real drag
      if (isLoadingData.current && !wasRealDrag && !isDragging.current) {
        console.log('⏸️ Suppressing spurious drag event during data load')
        // Reset isDragging but NOT isLoadingData (we're still loading)
        // Defer to prevent render flicker
        requestAnimationFrame(() => {
          isDragging.current = false
        })
        return true
      }

      // If we get here with isLoadingData=true but wasRealDrag=true, clear the flag
      // This allows the real drag to proceed and trigger a fresh reload
      if (isLoadingData.current && wasRealDrag) {
        console.log('🔓 Real user drag during data load - clearing lock to allow it')
        isLoadingData.current = false
      }

      if (mode === 'move') {
        const newStart = task.start_date
        const originalStart = task.$originalStart

        console.log('🚨🚨🚨 onAfterTaskDrag MOVE mode - task', id)
        console.log('📊 Drag completed:', {
          taskId: id,
          originalStart: originalStart,
          newStart: newStart
        })

        if (!originalStart) {
          console.log('⚠️ No original start found, allowing drag')
          // CRITICAL: Reset flags before early return
          // Defer to prevent render flicker
          requestAnimationFrame(() => {
            isDragging.current = false
            if (wasRealDrag) {
              isLoadingData.current = false
            }
          })
          return true
        }

        // Calculate the earliest possible start based on predecessors
        const earliestStart = calculateEarliestStart(task, tasks)

        console.log('📅 Earliest allowed start:', earliestStart)

        if (earliestStart && newStart < earliestStart) {
          // User is trying to drag the task EARLIER than predecessors allow
          console.log('🚫 Drag conflict detected! Task moved earlier than allowed')

          // Revert the task to earliest allowed position (keeping original duration)
          const originalDuration = task.duration
          task.start_date = earliestStart
          task.duration = originalDuration // Preserve duration
          gantt.updateTask(task.id)

          // Check if the task ended up at its original position after reverting
          const revertedStart = new Date(task.start_date)
          revertedStart.setHours(0, 0, 0, 0)
          const originalStartDate = new Date(originalStart)
          originalStartDate.setHours(0, 0, 0, 0)

          if (revertedStart.getTime() === originalStartDate.getTime()) {
            // Task is back at original position - don't mark as manually positioned
            console.log('↩️ Task reverted to original position - not marking as manually positioned')
            task.$manuallyPositioned = false
            task.manually_positioned = false
            manuallyPositionedTasks.current.delete(task.id)
            // updateTask already called above (line 1353), no need to call again
          }

          // Show conflict modal
          const links = task.$target || []
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          const blockingPredecessors = links.map(linkId => {
            const link = gantt.getLink(linkId)
            const predTask = gantt.getTask(link.source)
            return {
              linkId: linkId,
              taskId: predTask.id,
              taskName: predTask.text,
              type: getLinkType(link.type),
              lag: link.lag || 0
            }
          })

          // Check if the constraint is "today" (no predecessors or today is more restrictive)
          const isTodayConstraint = earliestStart && earliestStart.getTime() === today.getTime() && links.length === 0

          setDragConflict({
            task: task,
            originalStart: earliestStart,
            newStart: newStart,
            blockingPredecessors: blockingPredecessors,
            isTodayConstraint: isTodayConstraint
          })

          // Clean up temporary property
          delete task.$originalStart

          // Reset flags - defer to prevent render flicker
          requestAnimationFrame(() => {
            isDragging.current = false
            isLoadingData.current = false
          })

          return false // Prevent the drag from being saved
        }

        console.log('✅ Drag allowed - no conflict')

        // Check if task landed on a weekend or holiday - snap to next working day
        const droppedDate = new Date(task.start_date)
        if (!isWorkingDay(droppedDate)) {
          console.log('📅 Task dropped on non-working day:', droppedDate)
          const nextWorkingDay = getNextWorkingDay(droppedDate)
          console.log('📅 Snapping to next working day:', nextWorkingDay)
          task.start_date = nextWorkingDay
        }

        // Check if the task actually moved from its original position
        const finalStart = new Date(task.start_date)
        finalStart.setHours(0, 0, 0, 0)
        const originalStartDate = new Date(originalStart)
        originalStartDate.setHours(0, 0, 0, 0)

        const actuallyMoved = finalStart.getTime() !== originalStartDate.getTime()

        if (actuallyMoved) {
          // FIRST: Check if any SUCCESSOR tasks (tasks that depend on THIS task) are locked
          console.log('🔍 Checking for locked successor tasks that depend on task:', task.id, task.text)
          const lockedSuccessors = []

          // Find all tasks that have this task as a predecessor
          gantt.eachTask((successorTask) => {
            // Skip undefined/invalid tasks
            if (!successorTask || !successorTask.id) return
            if (successorTask.predecessor_ids && successorTask.predecessor_ids.length > 0) {
              const dependsOnThisTask = successorTask.predecessor_ids.some(pred => {
                const predData = typeof pred === 'object' ? pred : { id: pred, type: 'FS', lag: 0 }
                // predData.id is a task NUMBER (1-based), need to convert to task ID
                const predecessorTask = tasks[predData.id - 1]
                return predecessorTask && predecessorTask.id === task.id
              })

              if (dependsOnThisTask) {
                // Check if this successor is locked (has any status checkbox checked OR Lock checkbox checked)
                const isLocked = successorTask.confirm || successorTask.supplier_confirm ||
                                successorTask.start || successorTask.complete ||
                                successorTask.$manuallyPositioned || successorTask.manually_positioned
                if (isLocked) {
                  console.log('🔒 Found locked successor:', successorTask.id, successorTask.text)
                  lockedSuccessors.push(successorTask)
                }
              }
            }
          })

          // BETWEEN: Check for UNLOCKED successors that would need to cascade
          console.log('🔍 Checking for unlocked successor tasks that may need to cascade')
          const unlockedSuccessorsToMove = []
          const blockedSuccessors = [] // Successors that can't cascade due to locked dependencies

          gantt.eachTask((successorTask) => {
            // Skip undefined/invalid tasks
            if (!successorTask || !successorTask.id) return
            if (successorTask.id === task.id) return // Skip self

            // Check BOTH active predecessors AND broken predecessors
            const allPredecessors = [
              ...(successorTask.predecessor_ids || []),
              ...(successorTask.broken_predecessor_ids || [])
            ]

            if (allPredecessors.length > 0) {
              // Find if this successor depends on the moved task (in either active or broken deps)
              const dependency = allPredecessors.find(pred => {
                const predData = typeof pred === 'object' ? pred : { id: pred, type: 'FS', lag: 0 }
                // predData.id is a task NUMBER (1-based), need to convert to task ID
                const predecessorTask = tasks[predData.id - 1]
                return predecessorTask && predecessorTask.id === task.id
              })

              if (dependency) {
                // Check if this successor is NOT locked
                const isLocked = successorTask.confirm || successorTask.supplier_confirm ||
                                successorTask.start || successorTask.complete ||
                                successorTask.$manuallyPositioned || successorTask.manually_positioned

                if (!isLocked) {
                  console.log(`🔎 Checking Task #${successorTask.id} "${successorTask.text}" for locked successors...`)

                  // Check if this successor has any LOCKED successors that would block cascading
                  const hasLockedSuccessors = []
                  gantt.eachTask((nestedSuccessor) => {
                    // Skip undefined/invalid tasks
                    if (!nestedSuccessor || !nestedSuccessor.id) return

                    console.log(`  🔍 Examining nested task #${nestedSuccessor.id} "${nestedSuccessor.text}"`)

                    if (nestedSuccessor.id === successorTask.id) {
                      console.log(`    ⏭️  Skipping self`)
                      return
                    }

                    if (nestedSuccessor.predecessor_ids && nestedSuccessor.predecessor_ids.length > 0) {
                      console.log(`    📋 Nested task has ${nestedSuccessor.predecessor_ids.length} predecessor(s):`, nestedSuccessor.predecessor_ids)

                      const dependsOnSuccessor = nestedSuccessor.predecessor_ids.some(pred => {
                        // Handle multiple possible formats
                        let predId = pred
                        if (typeof pred === 'object') {
                          console.log(`      🔍 Predecessor is object with keys:`, Object.keys(pred), pred)
                          predId = pred.id || pred['id'] || pred.task_id || pred.source
                        }
                        // Convert both to numbers for comparison (handles string vs number mismatch)
                        const predIdNum = Number(predId)
                        const successorIdNum = Number(successorTask.id)
                        console.log(`      🔗 Checking if predecessor ${predId} (${predIdNum}) matches successorTask.id ${successorTask.id} (${successorIdNum})`)
                        return predIdNum === successorIdNum
                      })

                      if (dependsOnSuccessor) {
                        console.log(`    ✓ Task #${nestedSuccessor.id} depends on Task #${successorTask.id}`)

                        const nestedIsLocked = nestedSuccessor.confirm || nestedSuccessor.supplier_confirm ||
                                              nestedSuccessor.start || nestedSuccessor.complete
                        console.log(`    🔒 Lock status: confirm=${nestedSuccessor.confirm}, supplier_confirm=${nestedSuccessor.supplier_confirm}, start=${nestedSuccessor.start}, complete=${nestedSuccessor.complete} => locked=${nestedIsLocked}`)

                        if (nestedIsLocked) {
                          console.log(`    🚫 Task #${nestedSuccessor.id} IS LOCKED - blocking cascade!`)
                          hasLockedSuccessors.push(nestedSuccessor)
                        } else {
                          console.log(`    ✓ Task #${nestedSuccessor.id} is not locked`)
                        }
                      } else {
                        console.log(`    ⏭️  Task #${nestedSuccessor.id} does not depend on Task #${successorTask.id}`)
                      }
                    } else {
                      console.log(`    ⏭️  Nested task has no predecessors`)
                    }
                  })

                  // Track locked successors for the modal (even if task can cascade)
                  if (hasLockedSuccessors.length > 0) {
                    console.log(`⚠️ Task #${successorTask.id} has ${hasLockedSuccessors.length} locked successor(s):`, hasLockedSuccessors.map(s => `#${s.id} "${s.text}"`))
                    blockedSuccessors.push({
                      task: successorTask,
                      lockedSuccessors: hasLockedSuccessors
                    })
                    // Don't return - still add to cascade list so user can choose
                  } else {
                    console.log(`✅ Task #${successorTask.id} has no locked successors`)
                  }

                  // Calculate where this successor would need to be to maintain dependency
                  const depType = typeof dependency === 'object' ? (dependency.type || dependency['type'] || 'FS') : 'FS'
                  const depLag = typeof dependency === 'object' ? (dependency.lag || dependency['lag'] || 0) : 0

                  const movedTaskStart = new Date(task.start_date)
                  movedTaskStart.setHours(0, 0, 0, 0)
                  const movedTaskEnd = new Date(movedTaskStart)
                  movedTaskEnd.setDate(movedTaskEnd.getDate() + (task.duration || 1))

                  const currentSuccessorStart = new Date(successorTask.start_date)
                  currentSuccessorStart.setHours(0, 0, 0, 0)

                  let requiredSuccessorStart = null

                  switch (depType) {
                    case 'FS': // Successor should start >= moved task end + lag
                      requiredSuccessorStart = new Date(movedTaskEnd)
                      requiredSuccessorStart.setDate(requiredSuccessorStart.getDate() + depLag)
                      console.log(`📅 FS Dep: Task #${successorTask.id} - Moved end: ${movedTaskEnd.toISOString().split('T')[0]}, Lag: ${depLag}, Required start: ${requiredSuccessorStart.toISOString().split('T')[0]}`)
                      break
                    case 'SS': // Successor should start >= moved task start + lag
                      requiredSuccessorStart = new Date(movedTaskStart)
                      requiredSuccessorStart.setDate(requiredSuccessorStart.getDate() + depLag)
                      break
                    case 'FF': // Maintain finish relationship
                      const movedTaskFinish = new Date(movedTaskEnd)
                      movedTaskFinish.setDate(movedTaskFinish.getDate() + depLag)
                      requiredSuccessorStart = new Date(movedTaskFinish)
                      requiredSuccessorStart.setDate(requiredSuccessorStart.getDate() - (successorTask.duration || 1))
                      break
                    case 'SF': // Start-to-Finish relationship
                      const requiredFinish = new Date(movedTaskStart)
                      requiredFinish.setDate(requiredFinish.getDate() + depLag)
                      requiredSuccessorStart = new Date(requiredFinish)
                      requiredSuccessorStart.setDate(requiredSuccessorStart.getDate() - (successorTask.duration || 1))
                      break
                  }

                  // Check if successor would violate dependency in its current position
                  let needsToMove = false
                  const currentSuccessorEnd = new Date(currentSuccessorStart)
                  currentSuccessorEnd.setDate(currentSuccessorEnd.getDate() + (successorTask.duration || 1))

                  switch (depType) {
                    case 'FS':
                      needsToMove = currentSuccessorStart < movedTaskEnd
                      break
                    case 'SS':
                      needsToMove = currentSuccessorStart < movedTaskStart
                      break
                    case 'FF':
                      const requiredEndFF = new Date(movedTaskEnd)
                      requiredEndFF.setDate(requiredEndFF.getDate() + depLag)
                      needsToMove = currentSuccessorEnd < requiredEndFF
                      break
                    case 'SF':
                      const requiredEndSF = new Date(movedTaskStart)
                      requiredEndSF.setDate(requiredEndSF.getDate() + depLag)
                      needsToMove = currentSuccessorEnd < requiredEndSF
                      break
                  }

                  if (needsToMove) {
                    console.log(`📌 Successor #${successorTask.id} needs to move: current=${currentSuccessorStart.toISOString().split('T')[0]}, required=${requiredSuccessorStart.toISOString().split('T')[0]}`)
                    unlockedSuccessorsToMove.push({
                      task: successorTask,
                      currentStart: currentSuccessorStart,
                      requiredStart: requiredSuccessorStart,
                      depType,
                      depLag
                    })
                  }
                }
              }
            }
          })

          // Handle cascade and blocked successors - Show custom modal
          // Also show modal if there are locked successors that need dependencies broken
          if (lockedSuccessors.length > 0 || blockedSuccessors.length > 0 || unlockedSuccessorsToMove.length > 0) {
            console.log('📋 Opening cascade dependencies modal')
            console.log(`  - Locked successors: ${lockedSuccessors.length}`)
            console.log(`  - Unlocked successors: ${unlockedSuccessorsToMove.length}`)
            console.log(`  - Blocked successors: ${blockedSuccessors.length}`)

            // Convert locked successors to blocked format for the modal
            // Locked successors are tasks that have the Lock or status checkboxes checked
            const lockedSuccessorsForModal = lockedSuccessors.map(ls => ({
              task: ls,
              requiredStart: null, // Not applicable for locked tasks
              lockedSuccessors: [] // These ARE the locked successors themselves
            }))

            console.log('🔍 Locked successors for modal:', lockedSuccessorsForModal.length, lockedSuccessorsForModal.map(ls => `#${ls.task.id} ${ls.task.text}`))
            console.log('🔍 Other blocked successors:', blockedSuccessors.length, blockedSuccessors.map(b => `#${b.task.id} ${b.task.text}`))

            // Combine locked successors with other blocked successors
            const allBlockedSuccessors = [...lockedSuccessorsForModal, ...blockedSuccessors]

            console.log('🔍 All blocked successors for modal:', allBlockedSuccessors.length, allBlockedSuccessors.map(b => `#${b.task.id} ${b.task.text} (locked children: ${b.lockedSuccessors.length})`))

            // Open the cascade modal
            setCascadeModal({
              movedTask: task,
              unlockedSuccessors: unlockedSuccessorsToMove,
              blockedSuccessors: allBlockedSuccessors,
              originalStart: originalStart
            })

            // Reset both flags - modal will handle the save when user responds (race condition fix)
            isDragging.current = false
            isLoadingData.current = false

            // Don't continue processing until user responds to modal
            return false
          }

          // SECOND: Check if THIS task has dependencies and if the new position violates them
          console.log('🔍 Checking dependencies for task:', task.id, task.text)
          console.log('🔍 task.predecessor_ids:', task.predecessor_ids)
          const hasDependencies = task.predecessor_ids && task.predecessor_ids.length > 0
          console.log('🔍 hasDependencies:', hasDependencies)
          console.log('🚨 DEBUG: About to check hasDependencies condition')

          if (hasDependencies) {
            // Check if any dependencies would be violated by the new position
            const violatedDependencies = []
            const newTaskStart = new Date(task.start_date)
            newTaskStart.setHours(0, 0, 0, 0)
            const newTaskEnd = new Date(newTaskStart)
            newTaskEnd.setDate(newTaskEnd.getDate() + (task.duration || 1))

            task.predecessor_ids.forEach(pred => {
              const predId = typeof pred === 'object' ? (pred.id || pred['id']) : pred
              const predType = (typeof pred === 'object' ? (pred.type || pred['type']) : 'FS') || 'FS'
              const predLag = (typeof pred === 'object' ? (pred.lag || pred['lag'] || 0) : 0)

              // Find the predecessor task
              const predecessorTask = gantt.getTask(predId)
              if (predecessorTask) {
                const predStart = new Date(predecessorTask.start_date)
                predStart.setHours(0, 0, 0, 0)
                const predEnd = new Date(predStart)
                predEnd.setDate(predEnd.getDate() + (predecessorTask.duration || 1))

                // Check dependency constraint based on type
                let isViolated = false
                switch (predType) {
                  case 'FS': // Finish-to-Start: task should start >= predecessor end + lag
                    const requiredStartFS = new Date(predEnd)
                    requiredStartFS.setDate(requiredStartFS.getDate() + predLag)
                    isViolated = newTaskStart < requiredStartFS
                    console.log(`📊 FS Check: Task ${task.id} starts ${newTaskStart.toISOString().split('T')[0]}, must start >= ${requiredStartFS.toISOString().split('T')[0]} (after pred ${predId} ends ${predEnd.toISOString().split('T')[0]} + ${predLag} days)`, isViolated ? '❌ VIOLATED' : '✅ OK')
                    break
                  case 'SS': // Start-to-Start: task should start >= predecessor start + lag
                    const requiredStartSS = new Date(predStart)
                    requiredStartSS.setDate(requiredStartSS.getDate() + predLag)
                    isViolated = newTaskStart < requiredStartSS
                    console.log(`📊 SS Check: Task ${task.id} starts ${newTaskStart.toISOString().split('T')[0]}, must start >= ${requiredStartSS.toISOString().split('T')[0]}`, isViolated ? '❌ VIOLATED' : '✅ OK')
                    break
                  case 'FF': // Finish-to-Finish: task should finish >= predecessor end + lag
                    const requiredEndFF = new Date(predEnd)
                    requiredEndFF.setDate(requiredEndFF.getDate() + predLag)
                    isViolated = newTaskEnd < requiredEndFF
                    console.log(`📊 FF Check: Task ${task.id} ends ${newTaskEnd.toISOString().split('T')[0]}, must end >= ${requiredEndFF.toISOString().split('T')[0]}`, isViolated ? '❌ VIOLATED' : '✅ OK')
                    break
                  case 'SF': // Start-to-Finish: task should finish >= predecessor start + lag
                    const requiredEndSF = new Date(predStart)
                    requiredEndSF.setDate(requiredEndSF.getDate() + predLag)
                    isViolated = newTaskEnd < requiredEndSF
                    console.log(`📊 SF Check: Task ${task.id} ends ${newTaskEnd.toISOString().split('T')[0]}, must end >= ${requiredEndSF.toISOString().split('T')[0]}`, isViolated ? '❌ VIOLATED' : '✅ OK')
                    break
                }

                if (isViolated) {
                  violatedDependencies.push({
                    id: predId,
                    text: predecessorTask.text,
                    type: predType,
                    lag: predLag
                  })
                }
              }
            })

            console.log('🔍 Violated dependencies:', violatedDependencies)

            // Only show warning if dependencies are violated
            if (violatedDependencies.length > 0) {
              const predecessorList = violatedDependencies.map(pred => {
                let lagStr = ''
                if (pred.lag > 0) lagStr = `+${pred.lag}`
                else if (pred.lag < 0) lagStr = pred.lag.toString()
                return `#${pred.id} ${pred.text} (${pred.type}${lagStr})`
              }).join(', ')

              console.log('⚠️ Showing dependency violation dialog for task:', task.id, 'with violated predecessors:', predecessorList)
              const confirmed = window.confirm(
                `⚠️ Dependency Violation!\n\n` +
                `This position violates dependencies with: ${predecessorList}\n\n` +
                `Do you want to:\n` +
                `• YES: Remove dependencies and lock position (task will show checkered pattern)\n` +
                `• NO: Cancel move and keep dependencies intact`
              )

              if (confirmed) {
                // User chose to remove dependencies and lock position
                console.log('🔓 User chose to remove dependencies and lock position')

                // Remove dependencies
                task.predecessor_ids = []

                // Mark that dependencies were broken (for visual indicator)
                task.dependencies_broken = true
                task.$dependenciesBroken = true

                // Auto-check the lock checkbox
                task.manually_positioned = true
                task.$manuallyPositioned = true
                manuallyPositionedTasks.current.add(task.id)

                // Calculate day offset
                const projectStartDate = getToday()
                projectStartDate.setHours(0, 0, 0, 0)
                const taskStartDate = new Date(task.start_date)
                taskStartDate.setHours(0, 0, 0, 0)
                const dayOffset = Math.floor((taskStartDate - projectStartDate) / (1000 * 60 * 60 * 24))

                // Save with no dependencies and manually_positioned = true
                const updateData = {
                  duration: task.duration,
                  start_date: dayOffset,
                  manually_positioned: true,
                  dependencies_broken: true,  // Mark as broken
                  predecessor_ids: [] // Empty - dependencies removed
                }

                console.log('💾 Saving with removed dependencies:', updateData)

                // Delay API call until after visual transition completes (prevents shake)
                setTimeout(() => {
                  onUpdateTaskRef.current(task.id, updateData, { skipReload: true })
                }, 200)

                // Defer isDragging reset to prevent render flicker
                requestAnimationFrame(() => {
                  isDragging.current = false
                })

                // updateTask handles the visual update, no render needed
              } else {
                // User cancelled - revert the task to original position
                console.log('↩️ User cancelled violation - reverting to original position')
                task.start_date = originalStart
                gantt.updateTask(task.id) // Handles visual update, no render needed

                // Defer isDragging reset to prevent render flicker
                requestAnimationFrame(() => {
                  isDragging.current = false
                })

                delete task.$originalStart
                return false // Stop further processing
              }
            } else {
              // Dependencies exist but are NOT violated - allow move without warning
              console.log('✅ Dependencies exist but not violated - allowing move')

              // Mark as manually positioned but keep dependencies
              task.$manuallyPositioned = true
              manuallyPositionedTasks.current.add(task.id)

              const projectStartDate = getToday()
              projectStartDate.setHours(0, 0, 0, 0)
              const taskStartDate = new Date(task.start_date)
              taskStartDate.setHours(0, 0, 0, 0)
              const dayOffset = Math.floor((taskStartDate - projectStartDate) / (1000 * 60 * 60 * 24))

              // Save with dependencies preserved, manually_positioned = true
              const updateData = {
                duration: task.duration,
                start_date: dayOffset,
                manually_positioned: true,
                predecessor_ids: task.predecessor_ids || []
              }

              console.log('💾 Saving with preserved dependencies (no violation):', updateData)

              // Delay API call until after visual transition completes (prevents shake)
              setTimeout(() => {
                onUpdateTaskRef.current(task.id, updateData, { skipReload: true })
              }, 200)

              // Defer isDragging reset to prevent render flicker
              // Use requestAnimationFrame to wait until current render cycle completes
              requestAnimationFrame(() => {
                isDragging.current = false
              })

              // No need to call gantt.updateTask/refreshTask - drag operation already updated UI
              // These calls cause unnecessary re-renders and shake on drop
            }
          } else {
            // No predecessors - check if OTHER tasks depend on this one (successors)
            console.log('🔍 Task has no predecessors, checking for successors...')
            let hasSuccessors = false

            gantt.eachTask((otherTask) => {
              if (!otherTask || !otherTask.id || otherTask.id === task.id) return

              if (otherTask.predecessor_ids && otherTask.predecessor_ids.length > 0) {
                const dependsOnThisTask = otherTask.predecessor_ids.some(pred => {
                  const predId = typeof pred === 'object' ? (pred.id || pred['id']) : pred
                  return Number(predId) === Number(task.id)
                })

                if (dependsOnThisTask) {
                  hasSuccessors = true
                  console.log(`  ✓ Task #${otherTask.id} depends on this task`)
                }
              }
            })

            const projectStartDate = getToday()
            projectStartDate.setHours(0, 0, 0, 0)
            const taskStartDate = new Date(task.start_date)
            taskStartDate.setHours(0, 0, 0, 0)
            const dayOffset = Math.floor((taskStartDate - projectStartDate) / (1000 * 60 * 60 * 24))

            if (hasSuccessors) {
              // OTHER tasks depend on this one - let backend cascade
              console.log('🔄 Task has successors - triggering backend cascade')
              console.log('🚨 DRAG HANDLER: Preparing to save task', task.id, 'with successors')

              const updateData = {
                duration: task.duration,
                start_date: dayOffset,
                manually_positioned: false,  // ✅ Let backend cascade to successors!
                predecessor_ids: task.predecessor_ids || []  // ✅ RULE #9: ALWAYS preserve predecessor_ids
              }
              console.log('💾 DRAG HANDLER: Saving task to trigger cascade:', updateData)

              // Delay API call until after visual transition completes (prevents shake)
              setTimeout(() => {
                onUpdateTaskRef.current(task.id, updateData, { skipReload: true })
              }, 200)
            } else {
              // No predecessors AND no successors - truly independent task
              task.$manuallyPositioned = true
              manuallyPositionedTasks.current.add(task.id)
              console.log('🟤 Marked task', task.id, 'as manually positioned (no predecessors or successors)')

              const updateData = {
                duration: task.duration,
                start_date: dayOffset,
                manually_positioned: true,
                predecessor_ids: task.predecessor_ids || []  // ✅ RULE #9: ALWAYS preserve predecessor_ids
              }
              console.log('💾 Saving manually positioned task (no deps):', updateData)

              // Delay API call until after visual transition completes (prevents shake)
              setTimeout(() => {
                onUpdateTaskRef.current(task.id, updateData, { skipReload: true })
              }, 200)
            }

            // Defer isDragging reset to prevent render flicker
            requestAnimationFrame(() => {
              isDragging.current = false
            })
          }
        } else {
          console.log('↩️ Task did not actually move - not marking as manually positioned')
          // Task snapped back to its original position, don't mark as manually positioned

          // Defer isDragging reset to prevent render flicker
          requestAnimationFrame(() => {
            isDragging.current = false
          })
        }

        // Clean up temporary property
        delete task.$originalStart
      } else if (mode === 'resize') {
        // Handle duration change when resizing task
        const task = gantt.getTask(id)
        console.log('📏 Task resized - new duration:', task.duration)

        // Calculate day offset from today (project start)
        const projectStartDate = getToday()
        projectStartDate.setHours(0, 0, 0, 0)
        const taskStartDate = new Date(task.start_date)
        taskStartDate.setHours(0, 0, 0, 0)
        const dayOffset = Math.floor((taskStartDate - projectStartDate) / (1000 * 60 * 60 * 24))

        // CRITICAL: Preserve predecessor_ids when saving duration
        const updateData = {
          duration: task.duration,
          start_date: dayOffset,
          predecessor_ids: task.predecessor_ids || []  // Preserve dependencies!
        }
        console.log('💾 Saving resized task duration to backend:', updateData)

        // Delay API call until after visual transition completes (prevents shake)
        setTimeout(() => {
          onUpdateTaskRef.current(task.id, updateData, { skipReload: true })
        }, 200)
      }

      // CRITICAL: Always reset flags at the end, no matter which code path was taken
      // DO NOT reset isLoadingData here - it's managed by useEffect's 500ms timeout
      // Defer both isDragging and suppressRender reset to prevent shake
      requestAnimationFrame(() => {
        isDragging.current = false

        // Hide drag tooltip
        setDragTooltip(null)

        // Release render suppression after a longer delay to ensure smooth completion
        setTimeout(() => {
          suppressRender.current = false
          console.log('✅ Drag completed - rendering enabled')
        }, 100)
      })

      if (wasRealDrag) {
        console.log('✅ Real drag completed')
        // REMOVED: Delayed render - no longer needed, causes shake
      }

      return true
    })

    // Handle task single click - highlight dependencies (with delay to allow double-click)
    gantt.attachEvent('onTaskClick', (id) => {
      // Clear any existing timeouts
      if (clickTimeout.current) {
        clearTimeout(clickTimeout.current)
      }
      if (highlightTimeout.current) {
        clearTimeout(highlightTimeout.current)
      }

      // Delay the single-click action to allow double-click to fire
      clickTimeout.current = setTimeout(() => {
        // Clear any previous highlighting
        gantt.eachTask((task) => {
          // Skip undefined/invalid tasks
          if (!task || !task.id) return
          task.$highlighted = false
          task.$colorIndex = undefined
        })

        // Clear link highlighting
        const links = gantt.getLinks()
        links.forEach(link => {
          link.$highlighted = false
          link.$colorIndex = undefined
        })

        const clickedTask = gantt.getTask(id)
        clickedTask.$highlighted = true
        clickedTask.$colorIndex = 0 // Main task gets color 0 (amber)

        // Color palette for different dependency paths
        const colors = [
          { name: 'amber', index: 0 },
          { name: 'blue', index: 1 },
          { name: 'purple', index: 2 },
          { name: 'green', index: 3 },
          { name: 'pink', index: 4 },
          { name: 'cyan', index: 5 }
        ]

        // Highlight predecessors (tasks that this task depends on)
        if (clickedTask.predecessor_ids && clickedTask.predecessor_ids.length > 0) {
          clickedTask.predecessor_ids.forEach((pred, index) => {
            const predId = typeof pred === 'object' ? pred.id : pred
            const predTask = tasks[predId - 1]
            if (predTask) {
              try {
                const ganttPredTask = gantt.getTask(predTask.id)
                ganttPredTask.$highlighted = true
                // Assign a unique color to each predecessor path
                ganttPredTask.$colorIndex = (index + 1) % colors.length
              } catch (e) {
                // Task not found in gantt
              }
            }
          })
        }

        // Highlight successors (tasks that depend on this task)
        let successorIndex = clickedTask.predecessor_ids ? clickedTask.predecessor_ids.length + 1 : 1
        gantt.eachTask((task) => {
          // Skip undefined/invalid tasks
          if (!task || !task.id) return
          if (task.predecessor_ids && task.predecessor_ids.length > 0) {
            const hasDependency = task.predecessor_ids.some(pred => {
              const predId = typeof pred === 'object' ? pred.id : pred
              const taskNumber = tasks.findIndex(t => t.id === id) + 1
              return predId === taskNumber
            })
            if (hasDependency) {
              task.$highlighted = true
              task.$colorIndex = (successorIndex++) % colors.length
            }
          }
        })

        // Highlight links between highlighted tasks with matching colors
        links.forEach(link => {
          const sourceTask = gantt.getTask(link.source)
          const targetTask = gantt.getTask(link.target)
          if (sourceTask.$highlighted && targetTask.$highlighted) {
            link.$highlighted = true
            // Use the target task's color for the incoming link
            link.$colorIndex = targetTask.$colorIndex
          }
        })

        debouncedRender(0)

        // Auto-clear highlighting after 10 seconds
        highlightTimeout.current = setTimeout(() => {
          console.log('⏰ Auto-clearing task highlighting after 10 seconds')
          gantt.eachTask((task) => {
            // Skip undefined/invalid tasks
            if (!task || !task.id) return
            task.$highlighted = false
            task.$colorIndex = undefined
          })

          const links = gantt.getLinks()
          links.forEach(link => {
            link.$highlighted = false
            link.$colorIndex = undefined
          })

          debouncedRender(0)
        }, 10000) // 10 seconds = 10000ms
      }, 250) // 250ms delay to distinguish from double-click

      return true
    })

    // Handle task double-click - clear timeout and allow DHTMLX lightbox to open
    gantt.attachEvent('onTaskDblClick', (id) => {
      // Clear the single-click timeout to prevent highlighting
      if (clickTimeout.current) {
        clearTimeout(clickTimeout.current)
        clickTimeout.current = null
      }

      console.log('Task double-clicked, ID:', id)
      console.log('details_on_dblclick config:', gantt.config.details_on_dblclick)
      return true // Allow default DHTMLX lightbox to open
    })

    // Handle empty space click in timeline - select the row at that Y position
    gantt.attachEvent('onEmptyClick', (id, e) => {
      console.log('🖱️ Empty space clicked in timeline')

      try {
        // Guard: Check if event object exists
        if (!e || !e.clientY) {
          console.log('⚠️ Empty click event missing clientY, skipping')
          return true
        }

        // Get the timeline container
        const timeline = gantt.$task_data
        if (!timeline) {
          console.log('Timeline container not found')
          return true
        }

        // Get Y coordinate relative to the timeline
        const timelineRect = timeline.getBoundingClientRect()
        const relativeY = e.clientY - timelineRect.top + timeline.scrollTop

        // Calculate which row was clicked (row_height from config)
        const rowHeight = gantt.config.row_height || 40
        const rowIndex = Math.floor(relativeY / rowHeight)

        console.log('📍 Click position:', {
          clientY: e.clientY,
          timelineTop: timelineRect.top,
          scrollTop: timeline.scrollTop,
          relativeY: relativeY,
          rowHeight: rowHeight,
          rowIndex: rowIndex
        })

        // Get all visible tasks in order
        const visibleTasks = []
        gantt.eachTask((task) => {
          // Skip undefined/invalid tasks
          if (!task || !task.id) return
          visibleTasks.push(task)
        })

        console.log('👁️ Visible tasks:', visibleTasks.length)

        // Select the task at this row index
        if (rowIndex >= 0 && rowIndex < visibleTasks.length) {
          const taskToSelect = visibleTasks[rowIndex]
          gantt.selectTask(taskToSelect.id)
          console.log('✅ Selected task from empty space:', taskToSelect.id, taskToSelect.text)
        } else {
          console.log('⚠️ Row index out of range:', rowIndex, '/', visibleTasks.length)
        }
      } catch (err) {
        console.error('❌ Error handling empty click:', err)
      }

      return true
    })

    // Handle before lightbox
    gantt.attachEvent('onBeforeLightbox', (id) => {
      console.log('onBeforeLightbox called for task:', id)
      const task = gantt.getTask(id)
      console.log('Task data:', task)
      return true
    })

    // Handle lightbox save - update predecessors and other fields
    gantt.attachEvent('onLightboxSave', (id, task) => {
      console.log('=== LIGHTBOX SAVE STARTED ===')
      console.log('Task ID:', id)
      console.log('DHTMLX Task object:', task)

      try {
        // Find the original task
        const originalTask = tasks.find(t => t.id === id)
        if (!originalTask) {
          console.error('Original task not found for id:', id)
          return true
        }

        console.log('Original task from tasks array:', originalTask)

        // Update task name if changed
        if (task.text && task.text !== originalTask.name) {
          console.log('Updating task name from', originalTask.name, 'to', task.text)
          originalTask.name = task.text
        }

        // Update supplier if changed
        if (task.supplier !== undefined) {
          const newSupplier = task.supplier || ''
          const oldSupplier = originalTask.supplier_name || originalTask.assigned_role || ''
          if (newSupplier !== oldSupplier) {
            console.log('Updating supplier from', oldSupplier, 'to', newSupplier)
            originalTask.supplier_name = newSupplier
          }
        }

        // Update duration if changed
        if (task.duration && task.duration !== originalTask.duration) {
          console.log('Updating duration from', originalTask.duration, 'to', task.duration)
          originalTask.duration = task.duration
        }

        // Get the predecessor data from the custom form block
        const sections = gantt.config.lightbox.sections
        const predSection = sections.find(s => s.name === 'predecessor_editor')

        if (predSection) {
          // IMPORTANT: We need to manually retrieve the value from the form block
          // because DHTMLX doesn't automatically call get_value for custom templates
          const lightbox = gantt.getLightbox()
          const predecessorNode = lightbox.querySelector('.predecessor-editor-container')

          if (!predecessorNode) {
            console.error('Could not find predecessor-editor-container in lightbox!')
            return true
          }

          // Call the get_value function to retrieve the current predecessors data
          // This is the proper way to get data from custom form blocks
          let predecessorsData = []
          if (gantt.form_blocks.template && gantt.form_blocks.template.get_value) {
            predecessorsData = gantt.form_blocks.template.get_value(predecessorNode, task, predSection) || []
          } else {
            // Fallback: directly access the data from the DOM node
            predecessorsData = predecessorNode && predecessorNode.predecessorsData
              ? predecessorNode.predecessorsData.filter(p => p.id > 0)
              : []
          }

          console.log('Predecessors from lightbox (via get_value):', predecessorsData)
          console.log('Original task predecessors:', originalTask.predecessor_ids)

          // Only validate if we actually have NEW predecessors to check
          // (Don't block save if the existing data has circular deps but user didn't change them)
          if (predecessorsData.length > 0) {
            // Validate for circular dependencies before saving
            const currentTaskNumber = tasks.findIndex(t => t.id === id) + 1

            const wouldCreateCircularDependency = (predecessorTaskNumber, newPredecessors) => {
              // Can't be a predecessor of itself
              if (predecessorTaskNumber === currentTaskNumber) {
                return true
              }

              // Check if the predecessor task depends on the current task (directly or indirectly)
              const checkDependency = (taskNum, visited = new Set()) => {
                if (visited.has(taskNum)) {
                  return false // Already checked this path
                }
                visited.add(taskNum)

                const taskToCheck = tasks[taskNum - 1]
                if (!taskToCheck) {
                  return false
                }

                // Get the task's predecessors - use new ones if this is the current task
                const taskPreds = taskNum === currentTaskNumber
                  ? newPredecessors
                  : (taskToCheck.predecessor_ids || [])

                if (!taskPreds || taskPreds.length === 0) {
                  return false
                }

                // Check each predecessor of this task
                for (const pred of taskPreds) {
                  const predId = typeof pred === 'object' ? pred.id : pred

                  // If this task depends on the current task, we have a circular dependency
                  if (predId === currentTaskNumber) {
                    return true
                  }

                  // Recursively check if any predecessor's predecessors depend on current task
                  if (checkDependency(predId, new Set(visited))) {
                    return true
                  }
                }

                return false
              }

              return checkDependency(predecessorTaskNumber)
            }

            // Check all new predecessors for circular dependencies and auto-remove them
            const validPredecessors = []
            const removedPredecessors = []

            for (const pred of predecessorsData) {
              if (wouldCreateCircularDependency(pred.id, predecessorsData)) {
                console.error('CIRCULAR DEPENDENCY DETECTED for task #' + pred.id + ' - auto-removing')
                removedPredecessors.push(pred.id)
              } else {
                validPredecessors.push(pred)
              }
            }

            // If we removed any, update the predecessorsData array and show a warning
            if (removedPredecessors.length > 0) {
              predecessorsData.splice(0, predecessorsData.length, ...validPredecessors)
              console.warn(`Removed ${removedPredecessors.length} circular dependencies: ${removedPredecessors.join(', ')}`)

              // Show a non-blocking notification
              setTimeout(() => {
                const message = `Removed circular dependency: Task #${removedPredecessors.join(', #')} would create a loop.`
                console.log('📢 ' + message)
                // You could add a toast notification here instead of alert
              }, 100)
            }
          }

          // Update the original task's predecessor_ids (even if empty array)
          console.log('Setting originalTask.predecessor_ids to:', predecessorsData)
          originalTask.predecessor_ids = Array.isArray(predecessorsData) ? predecessorsData : []

          // Update the DHTMLX Gantt task object as well
          const ganttTask = gantt.getTask(id)
          if (ganttTask) {
            ganttTask.predecessor_ids = originalTask.predecessor_ids

            // Update the display string in the predecessors column
            const formatPred = (pred) => {
              const type = pred.type || 'FS'
              const lag = pred.lag || 0
              let result = `${pred.id}${type}`
              if (lag !== 0) {
                result += lag > 0 ? `+${lag}` : lag
              }
              return result
            }
            ganttTask.predecessors = originalTask.predecessor_ids.length > 0
              ? originalTask.predecessor_ids.map(formatPred).join(', ')
              : ''

            console.log('Updated ganttTask.predecessors display:', ganttTask.predecessors)

            // Update gantt task text and supplier
            ganttTask.text = originalTask.name
            ganttTask.supplier = originalTask.supplier_name || originalTask.assigned_role || ''
            ganttTask.duration = originalTask.duration

            // Force a refresh of the task in the grid
            gantt.updateTask(id)
            debouncedRender(0)
          }
        }

        // Call the update handler to save to backend
        console.log('Calling onUpdateTask with task ID:', originalTask.id)
        console.log('Predecessor IDs being saved:', originalTask.predecessor_ids)
        console.log('=== LIGHTBOX SAVE COMPLETED ===')
        onUpdateTaskRef.current(originalTask.id, { predecessor_ids: originalTask.predecessor_ids })
      } catch (error) {
        console.error('Error in onLightboxSave:', error)
        console.error('Stack trace:', error.stack)
      }

      return true
    })

    // Handle column resize - save widths to localStorage
    gantt.attachEvent('onColumnResizeEnd', (index, column) => {
      console.log('📏 Column resized:', column.name, 'new width:', column.width)
      setColumnWidths(prev => ({
        ...prev,
        [column.name]: column.width
      }))
      // PERFORMANCE: Debounced render after column resize - gantt auto-renders on resize
    })

    // Handle grid resize (dragging divider between left grid and right timeline)
    gantt.attachEvent('onGridResizeEnd', (oldWidth, newWidth) => {
      console.log('📏 Grid resized from', oldWidth, 'to', newWidth)
      // PERFORMANCE: Gantt auto-renders on grid resize, no manual render needed
    })

    // Initialize gantt
    gantt.init(ganttContainer.current)

    // DEBUG: Log dimensions after init - RE-ENABLED to diagnose alignment issue
    const debugDimensions = () => {
      /* eslint-disable */
      const gridData = document.querySelector('.gantt_grid_data')
      const taskData = document.querySelector('.gantt_data_area')
      const gridRows = document.querySelectorAll('.gantt_grid_data .gantt_row')
      const taskRows = document.querySelectorAll('.gantt_data_area .gantt_task_row')

      console.log('🔍 DHTMLX Gantt Dimensions Debug:')
      console.log('Container:', ganttContainer.current?.offsetWidth, 'x', ganttContainer.current?.offsetHeight)
      console.log('Grid data height:', gridData?.offsetHeight)
      console.log('Task data height:', taskData?.offsetHeight)
      console.log('Grid rows count:', gridRows?.length)
      console.log('Task rows count:', taskRows?.length)

      if (gridRows && taskRows && gridRows.length > 0) {
        console.log('First grid row height:', gridRows[0]?.offsetHeight)
        console.log('First task row height:', taskRows[0]?.offsetHeight)

        // OLD METHOD: offsetTop (relative to offsetParent)
        console.log('📍 OLD - Grid row offsetTop (relative):', Array.from(gridRows).slice(0, 5).map(r => r.offsetTop))
        console.log('📍 OLD - Task row offsetTop (relative):', Array.from(taskRows).slice(0, 5).map(r => r.offsetTop))

        // NEW METHOD: getBoundingClientRect (ABSOLUTE viewport position)
        const gridRects = Array.from(gridRows).slice(0, 5).map(r => r.getBoundingClientRect().top)
        const taskRects = Array.from(taskRows).slice(0, 5).map(r => r.getBoundingClientRect().top)
        console.log('🎯 NEW - Grid row ABSOLUTE positions (viewport):', gridRects)
        console.log('🎯 NEW - Task row ABSOLUTE positions (viewport):', taskRects)

        // Calculate the ACTUAL visual offset between rows
        if (gridRects.length > 0 && taskRects.length > 0) {
          const visualOffset = taskRects[0] - gridRects[0]
          console.log('🚨 VISUAL OFFSET (first row):', visualOffset, 'pixels')
          if (Math.abs(visualOffset) > 0.5) {
            console.log('🔧 FOUND IT! Timeline rows are', visualOffset, 'pixels', visualOffset > 0 ? 'BELOW' : 'ABOVE', 'grid rows!')
          }

          // Show all offsets
          for (let i = 0; i < Math.min(gridRects.length, taskRects.length); i++) {
            const offset = taskRects[i] - gridRects[i]
            if (Math.abs(offset) > 0.5) {
              console.log(`  Row ${i}: offset = ${offset.toFixed(2)}px`)
            }
          }
        }

        // Check for CSS transforms or positioning
        if (gridData && taskData) {
          const gridStyle = window.getComputedStyle(gridData)
          const taskStyle = window.getComputedStyle(taskData)
          console.log('🎨 Grid container transform:', gridStyle.transform)
          console.log('🎨 Task container transform:', taskStyle.transform)
          console.log('🎨 Grid container top:', gridStyle.top, 'position:', gridStyle.position)
          console.log('🎨 Task container top:', taskStyle.top, 'position:', taskStyle.position)
        }

        // Check scroll positions
        const gridScroll = gridData?.parentElement
        const taskScroll = taskData?.parentElement
        console.log('🔄 Grid scroll container scrollTop:', gridScroll?.scrollTop || 0)
        console.log('🔄 Task scroll container scrollTop:', taskScroll?.scrollTop || 0)
        const scrollOffset = (taskScroll?.scrollTop || 0) - (gridScroll?.scrollTop || 0)
        console.log('⚠️ SCROLL OFFSET between grid and timeline:', scrollOffset, 'pixels')

        // Check header/scale heights
        const gridScale = document.querySelector('.gantt_grid_scale')
        const taskScale = document.querySelector('.gantt_task .gantt_task_scale')
        console.log('📏 Grid header actual height:', gridScale?.offsetHeight || 'N/A')
        console.log('📏 Timeline header actual height:', taskScale?.offsetHeight || 'N/A')

        if (gridScale && taskScale) {
          const headerDiff = taskScale.offsetHeight - gridScale.offsetHeight
          console.log('🔴 HEADER HEIGHT DIFFERENCE:', headerDiff, 'pixels')
          if (headerDiff !== 0) {
            console.log('🔧 FOUND IT! Headers have different heights - timeline is', headerDiff, 'pixels taller!')
          }

          // Check absolute positions of headers too
          const gridScaleRect = gridScale.getBoundingClientRect()
          const taskScaleRect = taskScale.getBoundingClientRect()
          console.log('🎯 Grid header absolute top:', gridScaleRect.top)
          console.log('🎯 Task header absolute top:', taskScaleRect.top)
          console.log('🚨 HEADER VISUAL OFFSET:', taskScaleRect.top - gridScaleRect.top, 'pixels')
        }

        if (scrollOffset !== 0) {
          console.log('🔧 FOUND THE PROBLEM! Scroll offset is', scrollOffset, 'pixels - syncing now...')
          if (gridScroll && taskScroll) {
            taskScroll.scrollTop = gridScroll.scrollTop
          }
        }

        // GRID-SPECIFIC DEBUGGING - Since dependency lines are correct, the GRID must be offset!
        console.log('\n🔎 GRID-SPECIFIC DEBUG (grid is likely offset):')
        const ganttLayout = document.querySelector('.gantt_layout')
        const ganttGrid = document.querySelector('.gantt_grid')
        const ganttTask = document.querySelector('.gantt_task')

        if (ganttLayout) {
          const layoutRect = ganttLayout.getBoundingClientRect()
          console.log('📦 Gantt layout container absolute top:', layoutRect.top)
        }

        if (ganttGrid && ganttTask) {
          const gridRect = ganttGrid.getBoundingClientRect()
          const taskRect = ganttTask.getBoundingClientRect()
          console.log('📦 Grid container (.gantt_grid) absolute top:', gridRect.top)
          console.log('📦 Task container (.gantt_task) absolute top:', taskRect.top)
          console.log('🚨 GRID vs TASK CONTAINER OFFSET:', gridRect.top - taskRect.top, 'pixels')

          const gridStyle = window.getComputedStyle(ganttGrid)
          const taskStyle = window.getComputedStyle(ganttTask)
          console.log('🎨 Grid container: top=', gridStyle.top, 'paddingTop=', gridStyle.paddingTop, 'marginTop=', gridStyle.marginTop)
          console.log('🎨 Task container: top=', taskStyle.top, 'paddingTop=', taskStyle.paddingTop, 'marginTop=', taskStyle.marginTop)
        }

        if (gridScale && taskScale) {
          const gridScaleStyle = window.getComputedStyle(gridScale)
          const taskScaleStyle = window.getComputedStyle(taskScale)
          console.log('📏 Grid header: height=', gridScaleStyle.height, 'paddingTop=', gridScaleStyle.paddingTop, 'paddingBottom=', gridScaleStyle.paddingBottom)
          console.log('📏 Task header: height=', taskScaleStyle.height, 'paddingTop=', taskScaleStyle.paddingTop, 'paddingBottom=', taskScaleStyle.paddingBottom)
        }

        if (gridData && taskData) {
          const gridDataStyle = window.getComputedStyle(gridData)
          const taskDataStyle = window.getComputedStyle(taskData)
          console.log('📊 Grid data area: top=', gridDataStyle.top, 'paddingTop=', gridDataStyle.paddingTop)
          console.log('📊 Task data area: top=', taskDataStyle.top, 'paddingTop=', taskDataStyle.paddingTop)
        }

        // CHECK THE ACTUAL GANTT BARS (.gantt_task_line) - these might be offset within rows!
        console.log('\n🎯 GANTT BAR POSITION DEBUG:')
        const ganttBars = document.querySelectorAll('.gantt_task_line')
        console.log('Found', ganttBars.length, 'gantt bars')

        if (ganttBars.length > 0 && taskRows.length > 0) {
          // Check first 3 bars
          for (let i = 0; i < Math.min(3, ganttBars.length, taskRows.length); i++) {
            const bar = ganttBars[i]
            const row = taskRows[i]
            const barRect = bar.getBoundingClientRect()
            const rowRect = row.getBoundingClientRect()

            console.log(`Bar ${i}:`)
            console.log(`  Row top: ${rowRect.top}, height: ${rowRect.height}`)
            console.log(`  Bar top: ${barRect.top}, height: ${barRect.height}`)
            console.log(`  Bar offset from row top: ${barRect.top - rowRect.top}px`)

            // Check CSS top property
            const barStyle = window.getComputedStyle(bar)
            console.log(`  Bar CSS: top=${barStyle.top}, position=${barStyle.position}, transform=${barStyle.transform}`)
          }

          // Check if grid rows and bars are in sync
          if (gridRows.length > 0 && ganttBars.length > 0) {
            const firstGridRect = gridRows[0].getBoundingClientRect()
            const firstBarRect = ganttBars[0].getBoundingClientRect()
            const offset = firstBarRect.top - firstGridRect.top
            console.log(`\n🔴 FIRST GRID ROW vs FIRST GANTT BAR:`)
            console.log(`  Grid row top: ${firstGridRect.top}`)
            console.log(`  Gantt bar top: ${firstBarRect.top}`)
            console.log(`  🚨 OFFSET: ${offset.toFixed(2)}px`)

            if (Math.abs(offset) > 1) {
              console.log(`  ⚠️ FOUND IT! Gantt bars are ${offset.toFixed(2)}px ${offset > 0 ? 'BELOW' : 'ABOVE'} grid rows!`)

              // NOW CHECK THE PARENT CONTAINERS OF THE BARS - they might have scroll offset!
              const firstBar = ganttBars[0]
              let parent = firstBar.parentElement
              console.log(`\n🔬 INVESTIGATING BAR PARENT CHAIN:`)
              let level = 0
              while (parent && level < 10) {
                const parentRect = parent.getBoundingClientRect()
                const parentStyle = window.getComputedStyle(parent)
                console.log(`  Level ${level}: ${parent.className || parent.tagName}`)
                console.log(`    AbsoluteTop: ${parentRect.top}, Position: ${parentStyle.position}`)
                console.log(`    ScrollTop: ${parent.scrollTop}, ScrollLeft: ${parent.scrollLeft}`)
                console.log(`    CSS top: ${parentStyle.top}, transform: ${parentStyle.transform}`)

                if (parent.classList?.contains('gantt_task_bg') ||
                    parent.classList?.contains('gantt_bars_area') ||
                    parent.classList?.contains('gantt_data_area') ||
                    parent.classList?.contains('gantt_task')) {
                  console.log(`    ⚠️ KEY CONTAINER - This might be causing the offset!`)
                }

                parent = parent.parentElement
                level++
                if (parent?.classList?.contains('gantt_container')) break
              }

              // ATTEMPT TO FIX IT - Try to force correct positioning
              console.log(`\n🔧 ATTEMPTING TO FIX BAR POSITIONING...`)
              const taskBg = document.querySelector('.gantt_task_bg')
              if (taskBg) {
                const taskBgStyle = window.getComputedStyle(taskBg)
                console.log(`Found .gantt_task_bg - top: ${taskBgStyle.top}, position: ${taskBgStyle.position}, transform: ${taskBgStyle.transform}`)
              }
            }
          }
        }
      }
    }

    // PERFORMANCE: Gantt auto-renders after init, no manual render needed
    setGanttReady(true)

    // Expose gantt instance globally for testing
    window.gantt = gantt
    console.log('✅ window.gantt exposed globally')

    // Expose automated visual test function globally
    window.runGanttAutomatedTest = async (options = {}) => {
      const { visual = false, templateId, onProgress } = options
      console.log('🧪 Running Gantt Automated Visual Test...', options)

      const testStartTime = Date.now()
      const testSteps = []

      // Helper function to update progress
      const updateProgress = async (step, delayMs = visual ? 400 : 0) => {
        testSteps.push(step)
        if (onProgress) {
          onProgress(step, testSteps)
        }
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }

      try {
        // Get all tasks
        const tasks = []
        gantt.eachTask((task) => {
          tasks.push(task)
        })

        if (tasks.length === 0) {
          return {
            status: 'error',
            passed: false,
            message: 'No tasks found in Gantt',
            testDuration: (Date.now() - testStartTime) / 1000
          }
        }

        // Select first task that has dependencies
        const testTask = tasks.find(task => {
          // Count tasks that depend on this task
          const links = []
          gantt.eachTask((t) => {
            gantt.getLinks().forEach(link => {
              if (link.source == task.id) {
                links.push({ targetId: t.id, type: link.type })
              }
            })
          })
          return links.length > 0
        }) || tasks[0]

        console.log('🧪 Testing task:', testTask.text)
        await updateProgress(`✅ Selected task: ${testTask.text}`)

        // Get original state
        const originalStartDate = new Date(testTask.start_date)
        await updateProgress(`✅ Original start date: ${originalStartDate.toLocaleDateString()}`)

        // Find successor tasks to verify cascade
        const successorTasks = []
        gantt.getLinks().forEach(link => {
          if (link.source == testTask.id) {
            const successor = gantt.getTask(link.target)
            successorTasks.push({
              id: successor.id,
              text: successor.text,
              linkType: link.type,
              originalStartDate: new Date(successor.start_date)
            })
          }
        })
        await updateProgress(`✅ Found ${successorTasks.length} dependent task(s)`)

        // Move task forward by 5 days
        const newStartDate = new Date(originalStartDate)
        newStartDate.setDate(newStartDate.getDate() + 5)
        await updateProgress(`✅ Moving task 5 days forward (${originalStartDate.toLocaleDateString()} → ${newStartDate.toLocaleDateString()})`)
        console.log('🧪 Moving task from', originalStartDate, 'to', newStartDate)

        if (visual) {
          await new Promise(resolve => setTimeout(resolve, 800))
        }

        // Calculate day offset from project start
        const projectStartDate = new Date()
        projectStartDate.setHours(0, 0, 0, 0)
        const dayOffset = Math.floor((newStartDate - projectStartDate) / (1000 * 60 * 60 * 24))

        // Call backend API to update task and trigger cascade
        if (templateId) {
          try {
            const apiUrl = `/api/v1/schedule_templates/${templateId}/rows/${testTask.id}`
            console.log('🧪 Calling backend API:', apiUrl)
            await updateProgress(`🔄 Calling backend API for task #${testTask.id}...`)

            const data = await api.patch(apiUrl, {
              schedule_template_row: {
                start_date: dayOffset,
                duration: testTask.duration,
                manually_positioned: true
              }
            })
            console.log('🧪 Backend cascade response:', data)

            // Apply backend updates to Gantt (main task + cascaded tasks)
            const tasksToUpdate = [data.task || data]
            if (data.cascaded_tasks) {
              tasksToUpdate.push(...data.cascaded_tasks)
            }

            // Update all tasks in Gantt
            tasksToUpdate.forEach(task => {
              const ganttTask = gantt.getTask(task.id)
              if (ganttTask) {
                const date = new Date(projectStartDate)
                date.setDate(date.getDate() + task.start_date)
                ganttTask.start_date = date
                ganttTask.duration = task.duration
                ganttTask.manually_positioned = task.manually_positioned
                gantt.updateTask(ganttTask.id)
              }
            })

            await updateProgress(`✅ Backend cascade triggered - updated ${tasksToUpdate.length} task(s)`)
          } catch (error) {
            console.error('🧪 Backend API call failed:', error)
            await updateProgress(`❌ Backend API error: ${error.message}`)
            return {
              status: 'error',
              passed: false,
              message: `Backend cascade failed: ${error.message}`,
              testDuration: (Date.now() - testStartTime) / 1000,
              steps: testSteps
            }
          }
        } else {
          // No template ID - do local update only (no cascade)
          testTask.start_date = newStartDate
          gantt.updateTask(testTask.id)
          await updateProgress('⚠️ No template ID - local update only (no cascade)')
        }

        if (visual) {
          await new Promise(resolve => setTimeout(resolve, 1200))
        }

        // Check if dependent tasks cascaded correctly
        let dependenciesWorked = true
        const dependencyChecks = []

        for (const successor of successorTasks) {
          try {
            const currentSuccessor = gantt.getTask(successor.id)
            const currentStartDate = new Date(currentSuccessor.start_date)

            // For Finish-to-Start (type 0), successor should move by 5 days
            if (successor.linkType === 0) {
              const expectedDate = new Date(successor.originalStartDate)
              expectedDate.setDate(expectedDate.getDate() + 5)
              const datesMatch = currentStartDate.toDateString() === expectedDate.toDateString()

              if (datesMatch) {
                dependencyChecks.push(`✅ Task "${successor.text}" moved correctly (+5 days)`)
              } else {
                const daysDiff = Math.round((currentStartDate - successor.originalStartDate) / (1000 * 60 * 60 * 24))
                dependencyChecks.push(`❌ Task "${successor.text}" moved ${daysDiff} days instead of 5`)
                dependenciesWorked = false
              }
            }
          } catch (error) {
            dependencyChecks.push(`❌ Error checking task "${successor.text}": ${error.message}`)
            dependenciesWorked = false
          }
        }

        if (successorTasks.length > 0) {
          await updateProgress(dependenciesWorked ? `✅ All ${successorTasks.length} dependent task(s) cascaded correctly` : `❌ Some dependencies failed`)
          for (const check of dependencyChecks) {
            await updateProgress(`    ${check}`, 300)
          }
        } else {
          await updateProgress('⚠️ No dependencies to check')
        }

        // Move back - unset manually_positioned to allow cascade recalculation
        if (templateId) {
          try {
            await api.patch(`/api/v1/schedule_templates/${templateId}/rows/${testTask.id}`, {
              schedule_template_row: {
                manually_positioned: false
              }
            })
            await updateProgress('✅ Unlocked task - cascade will recalculate position')
          } catch (error) {
            console.error('Failed to unlock task:', error)
          }
        }

        if (visual) {
          await new Promise(resolve => setTimeout(resolve, 800))
        }

        const testDuration = (Date.now() - testStartTime) / 1000
        const passed = (successorTasks.length === 0 || dependenciesWorked)

        await updateProgress(passed ? '✅ TEST PASSED' : '❌ TEST FAILED', 600)

        return {
          status: passed ? 'pass' : 'fail',
          passed,
          message: passed
            ? `✅ PASS - Test completed successfully in ${testDuration.toFixed(1)}s!`
            : `❌ FAIL - Cascade did not work correctly. Test ran for ${testDuration.toFixed(1)}s.`,
          testDuration,
          taskId: testTask.id,
          taskName: testTask.text,
          steps: testSteps,
          metrics: {
            successorCount: successorTasks.length,
            dependenciesWorked
          }
        }
      } catch (error) {
        console.error('🧪 Test error:', error)
        await updateProgress(`❌ ERROR: ${error.message}`)
        return {
          status: 'error',
          passed: false,
          message: `Test failed: ${error.message}`,
          testDuration: (Date.now() - testStartTime) / 1000,
          steps: testSteps
        }
      }
    }
    console.log('✅ window.runGanttAutomatedTest exposed globally')

    // Add event delegation for checkbox clicks
    const handleCheckboxClick = (e) => {
      if (e.target.classList.contains('gantt-checkbox')) {
        const taskId = parseInt(e.target.getAttribute('data-task-id'))
        const field = e.target.getAttribute('data-field')
        const checked = e.target.checked

        console.log('📋 Checkbox clicked:', { taskId, field, checked })

        // Prevent gantt from triggering onAfterTaskUpdate during checkbox changes
        isDragging.current = true

        // Update task in gantt
        const task = gantt.getTask(taskId)
        if (task) {
          task[field] = checked

          // Check if ANY checkbox will be checked after this change
          const willHaveAnyChecked = task.confirm || task.supplier_confirm || task.start || task.complete
          console.log('🔍 Checkbox states:', {
            confirm: task.confirm,
            supplier_confirm: task.supplier_confirm,
            start: task.start,
            complete: task.complete,
            willHaveAnyChecked: willHaveAnyChecked
          })

          if (willHaveAnyChecked) {
            // Lock the task at its current position
            task.manually_positioned = true
            task.$manuallyPositioned = true
            manuallyPositionedTasks.current.add(taskId)

            // Calculate day offset for saving
            let dayOffset = task.start_date_offset
            if (dayOffset === undefined && task.start_date) {
              const projectStartDate = getToday()
              projectStartDate.setHours(0, 0, 0, 0)
              const taskStartDate = new Date(task.start_date)
              taskStartDate.setHours(0, 0, 0, 0)
              dayOffset = Math.floor((taskStartDate - projectStartDate) / (1000 * 60 * 60 * 24))
              task.start_date_offset = dayOffset
            }

            gantt.updateTask(taskId)
            // PERFORMANCE: refreshTask already triggers render, no need for manual render

            // Re-enable task updates after a short delay
            setTimeout(() => {
              isDragging.current = false
            }, 100)

            // Save to backend - CRITICAL: Preserve predecessor_ids AND lock position
            const updateData = {
              [field]: checked,
              manually_positioned: task.manually_positioned,
              start_date: dayOffset,  // Lock at current position!
              predecessor_ids: task.predecessor_ids || []  // Preserve dependencies!
            }
            console.log('💾 Saving checkbox state to backend:', updateData)
            onUpdateTaskRef.current(taskId, updateData)
          } else {
            // All checkboxes are now unchecked - show dialog to ask user what to do
            console.log('⚠️ All checkboxes unchecked - showing position dialog')

            // CRITICAL: Set dialog state FIRST, before gantt.updateTask() which might trigger re-render
            console.log('📋 Setting position dialog state BEFORE gantt.updateTask:', { taskId: task.id, field, checked })
            setPositionDialogTask({ task, field, checked })
            setShowPositionDialog(true)

            // Now revert the checkbox state in the UI until user confirms in dialog
            task[field] = !checked
            gantt.updateTask(taskId)
            // PERFORMANCE: updateTask already triggers render

            // IMMEDIATELY re-enable task updates (don't wait for timeout)
            isDragging.current = false

            console.log('✅ Position dialog should now be visible')
          }
        }
      }
    }

    ganttContainer.current.addEventListener('click', handleCheckboxClick)

    // Add event handler for lock position checkbox
    const handleLockCheckboxClick = (e) => {
      if (e.target.classList.contains('gantt-lock-checkbox')) {
        const taskId = parseInt(e.target.getAttribute('data-task-id'))
        const checked = e.target.checked

        console.log('🔒 Lock checkbox clicked:', { taskId, checked })

        // Prevent gantt from triggering onAfterTaskUpdate during checkbox changes
        isDragging.current = true

        const task = gantt.getTask(taskId)
        if (task) {
          if (checked) {
            // User wants to lock the task at its current position
            task.manually_positioned = true
            task.$manuallyPositioned = true
            manuallyPositionedTasks.current.add(taskId)

            // Calculate day offset for saving
            const projectStartDate = getToday()
            projectStartDate.setHours(0, 0, 0, 0)
            const taskStartDate = new Date(task.start_date)
            taskStartDate.setHours(0, 0, 0, 0)
            const dayOffset = Math.floor((taskStartDate - projectStartDate) / (1000 * 60 * 60 * 24))

            gantt.updateTask(taskId)
            // PERFORMANCE: updateTask already triggers render

            // Save to backend - CRITICAL: Preserve predecessor_ids
            const updateData = {
              manually_positioned: true,
              start_date: dayOffset,
              predecessor_ids: task.predecessor_ids || []  // Preserve dependencies!
            }
            console.log('💾 Locking task position for task', taskId, ':', updateData)
            console.log('💾 Calling onUpdateTask with:', { taskId, updateData })
            try {
              onUpdateTaskRef.current(taskId, updateData)
              console.log('✅ onUpdateTask called successfully for lock')
            } catch (error) {
              console.error('❌ Error calling onUpdateTask for lock:', error)
            }
          } else {
            // User wants to unlock and revert to auto-calculated position
            console.log('🔓 Unlocking task', taskId)

            // Clear manual positioning flags
            task.manually_positioned = false
            task.$manuallyPositioned = false
            manuallyPositionedTasks.current.delete(taskId)
            pendingUnlocks.current.add(taskId) // Prevent re-locking during data reload

            // Immediately recalculate task position based on predecessors
            const projectStartDate = getToday()
            projectStartDate.setHours(0, 0, 0, 0)

            // Find the original task data
            const originalTask = tasks.find(t => t.id === taskId)

            // Also update the original task to prevent it from being restored as manually positioned
            if (originalTask) {
              originalTask.manually_positioned = false
              console.log('✅ Updated original task manually_positioned flag to false')
            }

            // Calculate earliest start based on predecessors
            let newStartDate = projectStartDate

            if (originalTask && originalTask.predecessor_ids && originalTask.predecessor_ids.length > 0) {
              console.log('🔍 Recalculating position for task with', originalTask.predecessor_ids.length, 'predecessors')

              // Find latest finish date from all predecessors
              originalTask.predecessor_ids.forEach(pred => {
                const predData = typeof pred === 'object' ? pred : { id: pred, type: 'FS', lag: 0 }
                const predTaskData = tasks[predData.id - 1]

                if (predTaskData) {
                  try {
                    const predGanttTask = gantt.getTask(predTaskData.id)
                    const predEndDate = new Date(predGanttTask.end_date)

                    // For FS (Finish to Start), task starts after predecessor ends
                    if (predData.type === 'FS' || !predData.type) {
                      let possibleStart = new Date(predEndDate)
                      possibleStart.setDate(possibleStart.getDate() + 1)

                      // Skip to next working day
                      while (!isWorkingDay(possibleStart)) {
                        possibleStart.setDate(possibleStart.getDate() + 1)
                      }

                      // Apply lag if any
                      if (predData.lag && predData.lag > 0) {
                        let lagDays = predData.lag
                        while (lagDays > 0) {
                          possibleStart.setDate(possibleStart.getDate() + 1)
                          if (isWorkingDay(possibleStart)) {
                            lagDays--
                          }
                        }
                      }

                      // Use the latest date from all predecessors
                      if (possibleStart > newStartDate) {
                        newStartDate = possibleStart
                      }
                    }
                  } catch (e) {
                    console.log('Could not find predecessor task', predTaskData.id, 'in gantt')
                  }
                }
              })
            }

            console.log('📅 Recalculated start date:', newStartDate)

            // Update the task position in gantt immediately
            task.start_date = newStartDate
            gantt.updateTask(taskId)

            // Force full render to update checkbox and task bar color
            debouncedRender(0)

            // Save to backend (start_date: 0 means auto-calculate from today)
            // CRITICAL: Preserve predecessor_ids
            const updateData = {
              manually_positioned: false,
              start_date: 0,
              predecessor_ids: task.predecessor_ids || []  // Preserve dependencies!
            }
            console.log('💾 Unlocking task', taskId, '- will auto-calculate position:', updateData)
            console.log('💾 Calling onUpdateTask with:', { taskId, updateData })

            try {
              onUpdateTaskRef.current(taskId, updateData)
              console.log('✅ onUpdateTask called successfully for unlock')
            } catch (error) {
              console.error('❌ Error calling onUpdateTask for unlock:', error)
            }
          }

          // Re-enable task updates after a short delay
          setTimeout(() => {
            isDragging.current = false
          }, 100)
        }
      }
    }

    ganttContainer.current.addEventListener('click', handleLockCheckboxClick)

    // Cleanup
    return () => {
      ganttContainer.current?.removeEventListener('click', handleCheckboxClick)
      ganttContainer.current?.removeEventListener('click', handleLockCheckboxClick)
      ganttContainer.current?.removeEventListener('focus', handleEditorFocus, true)
      ganttContainer.current?.removeEventListener('keydown', handleEditorKeyDown, true)
      gantt.clearAll()
      // CRITICAL: Reset signature when gantt is cleared so data will reload
      lastTasksSignature.current = null
      // Clean up global references
      if (window.gantt) {
        delete window.gantt
      }
      if (window.runGanttAutomatedTest) {
        delete window.runGanttAutomatedTest
      }
    }
  }, [isOpen, publicHolidays, workingDays, zoomLevel]) // Removed onUpdateTask - no need to reinit when callback changes

  // Handle column visibility changes separately (without reinitializing)
  useEffect(() => {
    if (!ganttReady) return

    // Define all available column configurations
    const columnDefinitions = {
      taskNumber: {
        name: 'task_number',
        label: '#',
        width: columnWidths.task_number || 40,
        align: 'center',
        resize: true,
        template: (task) => {
          const taskIndex = tasks.filter(t => t).findIndex(t => t.id === task.id)
          return taskIndex >= 0 ? `#${taskIndex + 1}` : ''
        }
      },
      taskName: {
        name: 'text',
        label: 'Task Name',
        width: columnWidths.text || 150,
        tree: false,
        resize: true
      },
      predecessors: {
        name: 'predecessors',
        label: 'Predecessors',
        width: columnWidths.predecessors || 100,
        align: 'center',
        resize: true,
        template: (task) => {
          return task.predecessors || '-'
        }
      },
      supplier: {
        name: 'supplier',
        label: 'Supplier/Group',
        width: columnWidths.supplier || 120,
        resize: true,
        editor: {
          type: 'text',
          map_to: 'supplier'
        },
        template: (task) => {
          return task.supplier || '-'
        }
      },
      duration: {
        name: 'duration',
        label: 'Duration',
        width: columnWidths.duration || 70,
        align: 'center',
        resize: true,
        editor: {
          type: 'number',
          map_to: 'duration',
          min: 1,
          max: 999
        },
        template: (task) => {
          return task.duration ? `${task.duration} ${task.duration === 1 ? 'day' : 'days'}` : '-'
        }
      },
      confirm: {
        name: 'confirm',
        label: 'Confirm',
        width: columnWidths.confirm || 80,
        align: 'center',
        resize: true,
        template: (task) => {
          const checked = task.confirm ? 'checked' : ''
          return `<input type="checkbox" class="gantt-checkbox" data-task-id="${task.id}" data-field="confirm" ${checked} />`
        }
      },
      supplierConfirm: {
        name: 'supplier_confirm',
        label: 'Supplier Confirm',
        width: columnWidths.supplier_confirm || 120,
        align: 'center',
        resize: true,
        template: (task) => {
          const checked = task.supplier_confirm ? 'checked' : ''
          return `<input type="checkbox" class="gantt-checkbox" data-task-id="${task.id}" data-field="supplier_confirm" ${checked} />`
        }
      },
      start: {
        name: 'start',
        label: 'Start',
        width: columnWidths.start || 70,
        align: 'center',
        resize: true,
        template: (task) => {
          const checked = task.start ? 'checked' : ''
          return `<input type="checkbox" class="gantt-checkbox" data-task-id="${task.id}" data-field="start" ${checked} />`
        }
      },
      complete: {
        name: 'complete',
        label: 'Complete',
        width: columnWidths.complete || 90,
        align: 'center',
        resize: true,
        template: (task) => {
          const checked = task.complete ? 'checked' : ''
          return `<input type="checkbox" class="gantt-checkbox" data-task-id="${task.id}" data-field="complete" ${checked} />`
        }
      },
      lock: {
        name: 'lock_position',
        label: 'Lock',
        width: columnWidths.lock_position || 70,
        align: 'center',
        resize: true,
        template: (task) => {
          const checked = task.$manuallyPositioned || task.manually_positioned ? 'checked' : ''
          return `<input type="checkbox" class="gantt-lock-checkbox" data-task-id="${task.id}" ${checked} />`
        }
      }
    }

    // Build columns array based on columnOrder and visibility
    const columns = []
    columnOrder.forEach(columnKey => {
      // Lock column is always shown (even when checkboxes are hidden or column is set to invisible)
      const isLockColumn = columnKey === 'lock'
      // Other checkbox columns respect the showCheckboxes setting
      const isCheckboxColumn = ['confirm', 'supplierConfirm', 'start', 'complete'].includes(columnKey)

      // Lock column is ALWAYS shown, regardless of visibility settings
      if (isLockColumn && columnDefinitions[columnKey]) {
        columns.push(columnDefinitions[columnKey])
      } else if (visibleColumns[columnKey] && columnDefinitions[columnKey]) {
        // Other columns respect visibility and checkbox settings
        if (!isCheckboxColumn || showCheckboxes) {
          columns.push(columnDefinitions[columnKey])
        }
      }
    })

    // Always add the "add" column at the end
    columns.push({
      name: 'add',
      label: '',
      width: columnWidths.add || 44
    })

    gantt.config.columns = columns
    gantt.setSizes()
    // PERFORMANCE: Use single debounced render instead of immediate + delayed render
    debouncedRender(10)
  }, [visibleColumns, columnOrder, ganttReady, tasks, showCheckboxes, columnWidths, debouncedRender])

  // Handle zoom level changes
  useEffect(() => {
    if (!ganttReady) return

    const zoomLevels = {
      day: {
        scales: [
          { unit: 'month', step: 1, format: '%F %Y' },
          { unit: 'day', step: 1, format: '%d' }
        ],
        min_column_width: 30
      },
      week: {
        scales: [
          { unit: 'month', step: 1, format: '%F %Y' },
          { unit: 'week', step: 1, format: 'Week %W' }
        ],
        min_column_width: 50
      },
      month: {
        scales: [
          { unit: 'year', step: 1, format: '%Y' },
          { unit: 'month', step: 1, format: '%M' }
        ],
        min_column_width: 60
      }
    }

    const currentZoom = zoomLevels[zoomLevel] || zoomLevels.day
    gantt.config.scales = currentZoom.scales
    gantt.config.min_column_width = currentZoom.min_column_width

    console.log('🔍 Zoom level changed to:', zoomLevel)

    // PERFORMANCE: Single render after zoom change
    gantt.setSizes()
    debouncedRender(10)
  }, [zoomLevel, ganttReady, debouncedRender])

  // Handle task name search filtering
  useEffect(() => {
    if (!ganttReady) return

    // Apply search filter
    gantt.attachEvent('onBeforeTaskDisplay', (id, task) => {
      if (!taskNameSearch) return true // Show all tasks if no search term

      const searchLower = taskNameSearch.toLowerCase()
      const taskName = (task.text || '').toLowerCase()
      const taskSupplier = (task.supplier || '').toLowerCase()

      // Show task if name or supplier matches search term
      const matches = taskName.includes(searchLower) || taskSupplier.includes(searchLower)
      if (!matches) {
        console.log(`🔍 Task #${task.id} "${task.text}" filtered out by search: "${taskNameSearch}"`)
      }
      return matches
    })

    // PERFORMANCE: Use debounced render for search filter
    debouncedRender(10)
    console.log('🔎 Search filter applied:', taskNameSearch || '(no filter - showing all tasks)')
  }, [taskNameSearch, ganttReady, debouncedRender])

  // Handle link updates (when dependencies change)
  const handleLinkUpdate = () => {
    // Get all tasks and their links
    const allTasks = gantt.getTaskByTime()

    allTasks.forEach(task => {
      // Get links for this task
      const links = task.$target // Links where this task is the target

      if (links && links.length > 0) {
        // Convert links to predecessor format
        const predecessors = links.map(linkId => {
          const link = gantt.getLink(linkId)
          const predId = link.source
          const type = getLinkType(link.type)
          const lag = link.lag || 0

          return { id: predId, type, lag }
        })

        // Find original task
        const originalTask = tasks.find(t => t.id === task.id)
        if (originalTask) {
          console.log('Updating task dependencies:', task.id, predecessors)
          onUpdateTaskRef.current(task.id, { predecessor_ids: predecessors })
        }
      }
    })
  }

  // Calculate the earliest possible start date for a task based on predecessors
  const calculateEarliestStart = (task, allTasksMap) => {
    console.log('🔍 Calculating earliest start for task:', task.id)
    const links = task.$target || [] // Links where this task is the target
    console.log('   Found', links.length, 'predecessor links')

    // RULE: Tasks cannot be scheduled before today
    // Get today's date at midnight in the company timezone
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let earliestStart = today
    console.log('   📅 Minimum start date: Today (', today.toDateString(), ')')

    if (links.length === 0) {
      // No predecessors, but still can't start before today
      console.log('   ✓ No predecessors - earliest start is today')
      return earliestStart
    }

    links.forEach(linkId => {
      const link = gantt.getLink(linkId)
      const predTask = gantt.getTask(link.source)
      console.log('   📌 Predecessor:', predTask.text, 'Type:', link.type, 'Lag:', link.lag)

      if (!predTask) return

      let constraintDate
      const lag = link.lag || 0

      switch (link.type) {
        case 0: // FS - Finish to Start
          constraintDate = new Date(predTask.end_date)
          console.log('      FS: Must start after', predTask.text, 'finishes on', constraintDate)
          break
        case 1: // SS - Start to Start
          constraintDate = new Date(predTask.start_date)
          console.log('      SS: Must start with', predTask.text, 'on', constraintDate)
          break
        case 2: // FF - Finish to Finish
          // For FF, we need to work backwards from finish date
          constraintDate = new Date(predTask.end_date)
          // Subtract task duration to get start date
          const taskDuration = task.duration || 1
          constraintDate = addWorkingDays(constraintDate, -taskDuration)
          console.log('      FF: Must start on', constraintDate, 'to finish with', predTask.text)
          break
        case 3: // SF - Start to Finish
          constraintDate = new Date(predTask.start_date)
          // Subtract task duration to get start date
          const taskDuration2 = task.duration || 1
          constraintDate = addWorkingDays(constraintDate, -taskDuration2)
          console.log('      SF: Must start on', constraintDate)
          break
      }

      // Apply lag (can be positive or negative)
      if (lag !== 0) {
        const beforeLag = new Date(constraintDate)
        constraintDate = addWorkingDays(constraintDate, lag)
        console.log('      Lag:', lag, 'days - adjusted from', beforeLag, 'to', constraintDate)
      }

      // Track the latest constraint (most restrictive)
      if (!earliestStart || constraintDate > earliestStart) {
        earliestStart = constraintDate
        console.log('      ⭐ This is now the earliest allowed start')
      }
    })

    console.log('   ⏰ Final earliest start:', earliestStart)
    return earliestStart
  }

  // Add working days to a date (positive or negative)
  const addWorkingDays = (startDate, days) => {
    let current = new Date(startDate)
    const direction = days >= 0 ? 1 : -1
    let remainingDays = Math.abs(days)

    while (remainingDays > 0) {
      current.setDate(current.getDate() + direction)
      if (isWorkingDay(current)) {
        remainingDays--
      }
    }

    return current
  }

  // Find the next working day (or same day if already a working day)
  const getNextWorkingDay = (date) => {
    let current = new Date(date)
    while (!isWorkingDay(current)) {
      current.setDate(current.getDate() + 1)
    }
    return current
  }

  // Handle task updates (when dates or duration change via drag or inline editing)
  const handleTaskUpdate = (task) => {
    const duration = task.duration
    const startDate = task.start_date
    const supplier = task.supplier

    // Skip if we're currently saving (prevents infinite loops from data reloads)
    if (isSaving.current) {
      return
    }

    // Skip saving during drag - onAfterTaskDrag will handle it
    if (isDragging.current) {
      return
    }

    // Skip saving during drag lock period (prevents cascade API calls from auto-scheduling)
    // This prevents 8+ API calls when dragging a task with dependents
    if (isLoadingData.current) {
      diagLog('⏸️', `Skipping cascade update for task ${task.id} - drag lock active`)
      console.log('⏸️ Skipping cascade update - drag lock active (prevents API spam)')
      return
    }

    // For manually positioned tasks, check if this is a duration or supplier change (inline edit)
    // Duration and supplier changes should be allowed even for manually positioned tasks
    const originalTask = tasks.find(t => t.id === task.id)
    if (task.$manuallyPositioned && originalTask) {
      // Check if duration or supplier changed (inline edit)
      const durationChanged = originalTask.duration !== duration
      const supplierChanged = originalTask.supplier !== supplier

      if (durationChanged || supplierChanged) {
        console.log('✏️ Field edited for manually positioned task', task.id, '- saving changes')
        const updateData = {
          duration: duration,
          supplier_name: supplier,
          predecessor_ids: task.predecessor_ids || []
        }

        // Set saving flag to prevent infinite loops
        isSaving.current = true
        onUpdateTaskRef.current(task.id, updateData, { skipReload: true })

        // Reset flag after data reload completes (2 second timeout)
        setTimeout(() => {
          isSaving.current = false
          console.log('💾 Save cooldown complete - ready for next update')
        }, 2000)

        return
      } else {
        // Position change for manually positioned task - skip
        console.log('⏸️ Skipping auto-update for manually positioned task', task.id, '- position is locked')
        return
      }
    }

    // Save the update to backend for non-manually-positioned tasks
    // Note: Conflict checking now happens in onAfterTaskDrag event
    if (originalTask) {
      // CRITICAL: Check if data actually changed before making API call
      // Prevents infinite loop from gantt.render() firing onAfterTaskUpdate for all tasks
      const startDateStr = startDate ? startDate.toISOString().split('T')[0] : null
      const originalStartDateStr = originalTask.start_date ?
        (typeof originalTask.start_date === 'string' ? originalTask.start_date :
         new Date(originalTask.start_date).toISOString().split('T')[0]) :
        null

      const dataChanged =
        originalTask.duration !== duration ||
        originalStartDateStr !== startDateStr ||
        originalTask.supplier !== supplier ||
        JSON.stringify(originalTask.predecessor_ids || []) !== JSON.stringify(task.predecessor_ids || [])

      if (!dataChanged) {
        console.log('⏸️ Skipping update - no data changed for task', task.id)
        return
      }

      // CRITICAL: Skip saving tasks with predecessors when ONLY start_date changed
      // These tasks are auto-calculated from dependencies, so start_date changes during
      // data loading are expected and don't need to be saved (they'll be recalculated anyway)
      const hasPredecessors = task.predecessor_ids && task.predecessor_ids.length > 0
      const onlyStartDateChanged = originalStartDateStr !== startDateStr &&
                                   originalTask.duration === duration &&
                                   originalTask.supplier === supplier &&
                                   JSON.stringify(originalTask.predecessor_ids || []) === JSON.stringify(task.predecessor_ids || [])

      if (hasPredecessors && onlyStartDateChanged) {
        console.log('⏸️ Skipping update - task', task.id, 'has predecessors and only start_date changed (auto-calculated)')
        return
      }

      console.log('✏️ Data changed for task', task.id, '- saving to backend')

      const updateData = {
        duration: duration,
        start_date: startDateStr,
        supplier_name: supplier,
        predecessor_ids: task.predecessor_ids || []
      }

      // Set saving flag to prevent infinite loops
      isSaving.current = true
      onUpdateTaskRef.current(task.id, updateData, { skipReload: true })

      // Reset flag after data reload completes (2 second timeout)
      setTimeout(() => {
        isSaving.current = false
        console.log('💾 Save cooldown complete - ready for next update')
      }, 2000)
    }
  }

  // Convert DHTMLX link type to our format
  const getLinkType = (dhtmlxType) => {
    const types = {
      0: 'FS', // Finish to Start
      1: 'SS', // Start to Start
      2: 'FF', // Finish to Finish
      3: 'SF'  // Start to Finish
    }
    return types[dhtmlxType] || 'FS'
  }

  // Convert our link type to DHTMLX format
  const getDhtmlxLinkType = (type) => {
    const types = {
      'FS': 0,
      'SS': 1,
      'FF': 2,
      'SF': 3
    }
    return types[type] || 0
  }

  // Load tasks into gantt
  useEffect(() => {
    console.log('🐛 DHtmlxGanttView - useEffect triggered (tasks prop changed)')
    console.log('  - ganttReady:', ganttReady)
    console.log('  - tasks count:', tasks?.length || 0)
    console.log('  - tasks IDs:', tasks?.filter(t => t).map(t => t.id) || [])
    console.log('  - tasks names:', tasks?.filter(t => t).map(t => t.name) || [])

    // Filter out undefined/null tasks
    const validTasks = tasks?.filter(t => t && t.id) || []

    if (!ganttReady || validTasks.length === 0) {
      console.log('⏸️ Skipping task load:', { ganttReady, hasTasks: !!tasks, validTasksLength: validTasks.length })
      return
    }

    // ANTI-FLICKER: Create signature of task data to detect real changes
    // Only reload if actual task data changed, not just array reference
    const currentSignature = validTasks.map(t =>
      `${t.id}:${t.name}:${t.duration}:${t.start_date}:${t.manually_positioned}:${JSON.stringify(t.predecessor_ids)}`
    ).join('|')

    const signatureChanged = lastTasksSignature.current !== currentSignature

    if (!signatureChanged) {
      console.log('⏸️ Skipping reload - task data unchanged (only reference changed)')
      return
    }

    lastTasksSignature.current = currentSignature

    // CRITICAL: Prevent cascading reloads if already loading data
    // HOWEVER: If the signature changed, we MUST reload to show cascade updates
    // This allows backend cascade updates to display even during drag lock
    if (isLoadingData.current && !signatureChanged) {
      diagLog('⏸️', 'Skipping data reload - already loading data (CASCADE PREVENTED)')
      console.log('⏸️ Skipping data reload - already loading data')
      return
    }

    // ANTI-SHAKE: Throttle signature-based reloads during cascade operations
    // If cascades are in progress (depth > 0), defer the reload until cascades complete
    // This prevents multiple reloads from each cascade batch update
    const cascadeDepth = cascadeDepthRef?.current || 0
    if (signatureChanged && cascadeDepth > 0) {
      console.log(`⏸️ Signature changed but cascade depth = ${cascadeDepth} - deferring reload until cascades complete`)
      return
    }

    // If signature changed during loading, allow reload (cascade updates must display)
    if (isLoadingData.current && signatureChanged) {
      console.log('✅ Signature changed during load - proceeding with reload to show cascade updates')
    }

    diagLog('🔄', `Starting Gantt reload - ${validTasks.length} tasks`)
    console.log('🐛 DHtmlxGanttView: Starting to load', validTasks.length, 'tasks into DHTMLX Gantt')

    // Declare variables outside batchUpdate so they're accessible after
    let ganttTasks = []
    let ganttLinks = []

    // CRITICAL: Set flag to suppress spurious drag events during data load
    // This prevents onAfterTaskDrag from firing 20+ times during gantt.parse()
    // DO NOT clear pending timeout - let it complete to prevent cascade reloads
    isLoadingData.current = true
    diagLog('🔒', 'Reload lock ENABLED for 1000ms')

    // PERFORMANCE: Use batchUpdate for better performance instead of clearAll + parse
    gantt.batchUpdate(() => {
      // Clear existing data
      gantt.clearAll()

      // Calculate start dates for all tasks (same logic as SVAR implementation)
    const taskStartDates = new Map()
    const calculating = new Set() // Track tasks currently being calculated to detect circular dependencies

    // Use centralized timezone utility function (imported at top of file)
    // This ensures consistent date calculations regardless of user's local timezone
    const projectStartDate = getToday()
    console.log(`📅 Project start date (${companyTimezone}):`, projectStartDate.toISOString(), 'Local:', projectStartDate.toString())

    // Helper function to calculate finish date
    const calculateFinishDate = (startDate, days) => {
      if (days <= 0) return new Date(startDate)

      let current = new Date(startDate)
      while (!isWorkingDay(current)) {
        current.setDate(current.getDate() + 1)
      }

      let remainingDays = days - 1
      while (remainingDays > 0) {
        current.setDate(current.getDate() + 1)
        if (isWorkingDay(current)) {
          remainingDays--
        }
      }

      return current
    }

    // Recursive function to calculate task start date
    const calculateStartDate = (task) => {
      if (taskStartDates.has(task.id)) {
        return taskStartDates.get(task.id)
      }

      // If task is manually positioned, use its start_date from backend
      if (task.manually_positioned && task.start_date !== undefined) {
        // Backend stores start_date as integer day offset from project start (today)
        const manualDate = new Date(projectStartDate)
        manualDate.setDate(manualDate.getDate() + task.start_date)
        taskStartDates.set(task.id, manualDate)
        console.log('🟤 Task', task.id, 'is manually positioned at:', manualDate, '(offset:', task.start_date, 'days)')
        return manualDate
      }

      // Detect circular dependency
      if (calculating.has(task.id)) {
        console.warn(`Circular dependency detected for task ${task.id} (${task.name}). Using project start date.`)
        taskStartDates.set(task.id, projectStartDate)
        return projectStartDate
      }

      if (!task.predecessor_ids || task.predecessor_ids.length === 0) {
        // RULE #9.3: Tasks with no predecessors start on next working day from project start
        let startDate = new Date(projectStartDate)
        while (!isWorkingDay(startDate)) {
          startDate.setDate(startDate.getDate() + 1)
        }
        taskStartDates.set(task.id, startDate)
        console.log('📌 Task', task.id, 'has no predecessors, starts on next working day:', startDate.toString())
        return startDate
      }

      // Mark this task as currently being calculated
      calculating.add(task.id)

      let latestDate = projectStartDate
      task.predecessor_ids.forEach(pred => {
        const predData = typeof pred === 'object' ? pred : { id: pred, type: 'FS', lag: 0 }
        const predTask = tasks[predData.id - 1]

        if (predTask) {
          const predStart = calculateStartDate(predTask)
          const predDuration = predTask.duration !== undefined && predTask.duration !== null ? predTask.duration : 1
          const predFinish = calculateFinishDate(predStart, predDuration > 0 ? predDuration : 1)

          if (predData.type === 'FS' || !predData.type) {
            let taskStart = new Date(predFinish)
            taskStart.setDate(taskStart.getDate() + 1)

            while (!isWorkingDay(taskStart)) {
              taskStart.setDate(taskStart.getDate() + 1)
            }

            if (predData.lag && predData.lag > 0) {
              taskStart = calculateFinishDate(taskStart, predData.lag)
              taskStart.setDate(taskStart.getDate() + 1)
              while (!isWorkingDay(taskStart)) {
                taskStart.setDate(taskStart.getDate() + 1)
              }
            }

            if (taskStart > latestDate) {
              latestDate = taskStart
            }
          }
        }
      })

      // Remove from calculating set now that we're done
      calculating.delete(task.id)

      taskStartDates.set(task.id, latestDate)
      return latestDate
    }

    // Format predecessors for display
    const formatPredecessor = (pred) => {
      if (typeof pred === 'object') {
        const type = pred.type || 'FS'
        const lag = pred.lag || 0
        let result = `${pred.id}${type}`
        if (lag !== 0) {
          result += lag > 0 ? `+${lag}` : lag
        }
        return result
      }
      return `${pred}FS`
    }

    // Calculate start dates for all tasks first
    validTasks.forEach(task => calculateStartDate(task))

    // Sort tasks by calculated start date
    const sortedTasks = [...validTasks].sort((a, b) => {
      const dateA = taskStartDates.get(a.id) || projectStartDate
      const dateB = taskStartDates.get(b.id) || projectStartDate
      return dateA - dateB
    })

    // Convert tasks to DHTMLX format (using sorted order)
    ganttTasks = sortedTasks.map(task => {
      const duration = task.duration !== undefined && task.duration !== null ? task.duration : 1
      const startDate = taskStartDates.get(task.id) || projectStartDate

      // Use the appropriate predecessor display based on toggle mode
      const predecessorDisplay = task.predecessor_ids && task.predecessor_ids.length > 0
        ? (predecessorDisplayMode === 'names'
            ? task.predecessor_display_names || '' // Use names from backend
            : task.predecessor_ids.map(formatPredecessor).join(', ')) // Use numbers (IDs)
        : ''

      // Date is already in UTC at midnight, use it directly
      // Don't call setHours() as it would convert to local timezone
      const cleanStartDate = new Date(startDate)

      // If task is manually positioned from backend, add to our tracking set
      // BUT: Skip if task is pending unlock (prevents race condition during data reload)
      if (task.manually_positioned && !pendingUnlocks.current.has(task.id)) {
        manuallyPositionedTasks.current.add(task.id)
      }

      // If task is no longer manually positioned, remove from tracking set
      if (!task.manually_positioned) {
        if (manuallyPositionedTasks.current.has(task.id)) {
          manuallyPositionedTasks.current.delete(task.id)
          console.log('🔓 Removed task', task.id, 'from manually positioned set (backend update)')
        }
        // Also clear pending unlock flag if present
        if (pendingUnlocks.current.has(task.id)) {
          pendingUnlocks.current.delete(task.id)
          console.log('✅ Cleared pending unlock for task', task.id, '- backend update confirmed')
        }
      }

      return {
        id: task.id,
        text: task.name,
        start_date: cleanStartDate,
        duration: duration > 0 ? duration : 1,
        progress: 0,
        predecessors: predecessorDisplay,
        predecessor_ids: task.predecessor_ids || [], // Store the actual predecessor array for lightbox
        supplier: task.supplier_name || task.assigned_role || '',
        type: gantt.config.types.task,
        $manuallyPositioned: manuallyPositionedTasks.current.has(task.id), // Restore manual position flag
        manually_positioned: task.manually_positioned || false,
        confirm: task.confirm || false,
        supplier_confirm: task.supplier_confirm || false,
        start: task.start || false,
        complete: task.complete || false,
        dependencies_broken: task.dependencies_broken || false,
        $dependenciesBroken: task.dependencies_broken || false  // For visual indicator
      }
    })

    // Convert links to DHTMLX format
    ganttLinks = []
    validTasks.forEach((task, index) => {
      // Skip creating links if this task has broken dependencies
      if (task.dependencies_broken) {
        console.log(`⏭️ Skipping links for task ${task.id} - dependencies are broken`)
        return
      }

      if (task.predecessor_ids && task.predecessor_ids.length > 0) {
        task.predecessor_ids.forEach(pred => {
          const predData = typeof pred === 'object' ? pred : { id: pred, type: 'FS', lag: 0 }

          // Convert task number to task ID
          // predData.id is a task NUMBER (1-based), we need to get the actual task ID
          const predecessorTask = validTasks[predData.id - 1]

          if (predecessorTask) {
            ganttLinks.push({
              id: `${predecessorTask.id}_${task.id}`,
              source: predecessorTask.id,  // Predecessor task ID (arrow starts here)
              target: task.id,              // Current task ID (arrow points here)
              type: getDhtmlxLinkType(predData.type || 'FS'),
              lag: predData.lag || 0
            })
          }
        })
      }
    })

      // Load data into gantt
      gantt.parse({
        data: ganttTasks,
        links: ganttLinks
      })
    }) // End batchUpdate - PERFORMANCE: Single render for all data changes

    console.log('🐛 DHtmlxGanttView: gantt.parse() completed')
    console.log('  - Parsed tasks count:', ganttTasks.length)
    console.log('  - Parsed links count:', ganttLinks.length)
    console.log('  - Parsed task IDs:', ganttTasks.map(t => t.id))
    console.log('  - Parsed task names:', ganttTasks.map(t => t.text))
    console.log('📋 All loaded tasks:', ganttTasks.map(t => `#${t.id}: ${t.text} (start: ${t.start_date.toISOString().split('T')[0]})`).join(', '))

    // CRITICAL: Force immediate render to update lock checkbox states
    // (debounced render was causing lock checkboxes to not update after data reload)
    gantt.setSizes()
    gantt.render()
    console.log('✅ Forced immediate render after data load')

    // CRITICAL: Reset flag to allow real drag events again
    // Use longer timeout to ensure all queued state updates and renders have settled
    // This prevents cascading re-renders from triggering spurious drag events
    // ONLY set timeout if one doesn't already exist (prevents cascade reloads)
    if (!loadingDataTimeout.current) {
      loadingDataTimeout.current = setTimeout(() => {
        isLoadingData.current = false
        loadingDataTimeout.current = null
        diagLog('🔓', 'Reload lock RELEASED')
        console.log('✅ Data loading complete - drag events re-enabled')
      }, 1000) // Increased from 500ms to 1000ms to absorb cascades
    }

    // Scroll to show yesterday's date (after gantt fully renders)
    setTimeout(() => {
      // Find the earliest NON-COMPLETED task start date
      // (Completed tasks shouldn't affect the view - we want to see upcoming work)
      let earliestDate = null
      gantt.eachTask((task) => {
        // Skip completed tasks
        if (task.$complete || task.complete) return

        if (!earliestDate || task.start_date < earliestDate) {
          earliestDate = task.start_date
        }
      })

      // EXCEPTION: Don't auto-scroll if user is dragging a task
      // (Let them see where they're dragging to)
      if (isDragging.current) {
        console.log('⏸️ Skipping auto-scroll - user is dragging a task')
        return
      }

      // Initial scroll position: Show whichever is LATER:
      // 1. TODAY - 1 day (for screen context)
      // 2. Earliest NON-COMPLETED task - 1 day (to bring future tasks into view)
      // But if that date is a weekend/holiday, skip to next working day
      const today = getToday()
      today.setHours(0, 0, 0, 0)

      // Calculate option 1: Today - 1 day
      let todayMinus1 = new Date(today)
      todayMinus1.setDate(todayMinus1.getDate() - 1)
      todayMinus1.setHours(0, 0, 0, 0)

      let scrollToDate

      if (earliestDate) {
        // Calculate option 2: Earliest task - 1 day
        let taskMinus1 = new Date(earliestDate)
        taskMinus1.setDate(taskMinus1.getDate() - 1)
        taskMinus1.setHours(0, 0, 0, 0)

        // Use whichever is LATER (brings future tasks into view)
        scrollToDate = taskMinus1 > todayMinus1 ? taskMinus1 : todayMinus1
        console.log(`📅 Scroll candidates: today-1=${formatDateLocal(todayMinus1)}, task-1=${formatDateLocal(taskMinus1)}, using=${formatDateLocal(scrollToDate)}`)
      } else {
        // No tasks: just use today - 1
        scrollToDate = todayMinus1
      }

      // If the calculated date is a weekend/holiday, skip to next working day
      if (!isWorkingDay(scrollToDate)) {
        console.log(`📅 Calculated date (${formatDateLocal(scrollToDate)}) is a weekend/holiday, showing next working day`)
        scrollToDate = getNextWorkingDay(scrollToDate)
      }

      console.log('📅 Scrolling Gantt to:', formatDateLocal(scrollToDate))
      console.log('📅 Scroll date object:', scrollToDate)
      console.log('📅 Scroll date ISO:', scrollToDate.toISOString())
      console.log('📅 Today is:', formatDateLocal(today), '(', today.toDateString(), ')')
      console.log('📅 Is today a weekend?', today.getDay() === 0 || today.getDay() === 6)

      // Use showDate to position the timeline
      gantt.showDate(scrollToDate)

      console.log('✅ Scroll command executed')
      console.log('📅 After scroll - first visible date:', gantt.getState().min_date)
      console.log('📅 After scroll - last visible date:', gantt.getState().max_date)
    }, 300) // Longer delay to ensure gantt is fully rendered and sized

    // Cleanup function: Clear the timeout if component unmounts or dependencies change
    return () => {
      if (loadingDataTimeout.current) {
        clearTimeout(loadingDataTimeout.current)
        loadingDataTimeout.current = null
        isLoadingData.current = false // Clear the flag on cleanup
      }
    }
  }, [ganttReady, tasks, publicHolidays, debouncedRender, predecessorDisplayMode])

  // Handle saving task dependencies from editor
  const handleSaveDependencies = (taskId, predecessors) => {
    console.log('🐛 DHtmlxGanttView: handleSaveDependencies called')
    console.log('  - Task ID:', taskId)
    console.log('  - New predecessors:', predecessors)
    console.log('  - Current tasks count:', tasks?.length || 0)
    console.log('  - Current task IDs:', tasks?.filter(t => t).map(t => t.id) || [])
    console.log('  - Calling onUpdateTask...')
    onUpdateTaskRef.current(taskId, { predecessor_ids: predecessors })
    setShowEditor(false)
    setSelectedTask(null)
  }

  // Handle cascade modal confirmation
  const handleCascadeConfirm = (selection) => {
    if (!cascadeModal) return

    const { movedTask, originalStart } = cascadeModal
    const { cascade, unlinkUnselected, breakBlocked, lockedSuccessorsToKeep = {} } = selection

    console.log('📋 Processing cascade modal response')
    console.log(`  - Tasks to cascade: ${cascade.length}`)
    console.log(`  - Tasks to unlink: ${unlinkUnselected.length}`)
    console.log(`  - Blocked tasks to unlink: ${breakBlocked.length}`)
    console.log(`  - Locked successors to keep:`, lockedSuccessorsToKeep)

    // FIRST: Save the moved task's new position
    const movedTaskStart = new Date(movedTask.start_date)
    movedTaskStart.setHours(0, 0, 0, 0)
    const projectStartDate = getToday()
    projectStartDate.setHours(0, 0, 0, 0)
    const movedTaskDayOffset = Math.floor((movedTaskStart - projectStartDate) / (1000 * 60 * 60 * 24))

    console.log(`💾 Saving moved task #${movedTask.id} to day ${movedTaskDayOffset} with manually_positioned=true`)
    onUpdateTaskRef.current(movedTask.id, {
      duration: movedTask.duration,
      start_date: movedTaskDayOffset,
      predecessor_ids: movedTask.predecessor_ids || [],
      manually_positioned: true
    }, { skipReload: true })

    // Cascade selected tasks
    cascade.forEach(({ task: successorTask, requiredStart }) => {
      successorTask.start_date = requiredStart

      const dayOffset = Math.floor((requiredStart - projectStartDate) / (1000 * 60 * 60 * 24))

      // If this task has broken dependencies, restore them
      let predecessorIds = successorTask.predecessor_ids || []
      let dependenciesBroken = successorTask.dependencies_broken || false
      let brokenPredecessorIds = successorTask.broken_predecessor_ids || []

      if (successorTask.dependencies_broken && brokenPredecessorIds.length > 0) {
        // Check if any of the broken deps are for the moved task
        const brokenDepsForMovedTask = brokenPredecessorIds.filter(pred => {
          const predId = typeof pred === 'object' ? (pred.id || pred['id']) : pred
          return Number(predId) === Number(movedTask.id)
        })

        if (brokenDepsForMovedTask.length > 0) {
          // Restore these dependencies
          predecessorIds = [...predecessorIds, ...brokenDepsForMovedTask]

          // Remove from broken list
          brokenPredecessorIds = brokenPredecessorIds.filter(pred => {
            const predId = typeof pred === 'object' ? (pred.id || pred['id']) : pred
            return Number(predId) !== Number(movedTask.id)
          })

          // Clear broken flag if no more broken deps
          if (brokenPredecessorIds.length === 0) {
            dependenciesBroken = false
          }

          console.log(`🔄 Restoring broken dependency for task #${successorTask.id}`)
        }
      }

      successorTask.predecessor_ids = predecessorIds
      successorTask.dependencies_broken = dependenciesBroken
      successorTask.$dependenciesBroken = dependenciesBroken
      successorTask.broken_predecessor_ids = brokenPredecessorIds

      const updateData = {
        duration: successorTask.duration,
        start_date: dayOffset,
        predecessor_ids: predecessorIds,
        dependencies_broken: dependenciesBroken,
        broken_predecessor_ids: brokenPredecessorIds
      }

      console.log(`🔄 Cascading task #${successorTask.id} to day ${dayOffset}`)
      onUpdateTaskRef.current(successorTask.id, updateData, { skipReload: true })
      gantt.updateTask(successorTask.id)
    })

    // Handle nested locked successors - break dependencies for locked successors that weren't selected to keep
    cascade.forEach(({ task: cascadedTask }) => {
      const taskIdStr = String(cascadedTask.id)
      const lockedSuccessorsToKeepForTask = lockedSuccessorsToKeep[taskIdStr] || []

      // Find locked successors for this cascaded task from breakBlocked
      const lockedSuccessorsForTask = breakBlocked.filter(({ task }) => {
        // Check if this blocked task is a successor of the cascaded task
        const allPredecessors = [
          ...(task.predecessor_ids || []),
          ...(task.broken_predecessor_ids || [])
        ]
        return allPredecessors.some(pred => {
          const predId = typeof pred === 'object' ? (pred.id || pred['id']) : pred
          return Number(predId) === Number(cascadedTask.id)
        })
      })

      // For each locked successor, check if it should be broken
      lockedSuccessorsForTask.forEach(({ task: lockedSuccessor }) => {
        const shouldKeep = lockedSuccessorsToKeepForTask.includes(Number(lockedSuccessor.id))

        if (!shouldKeep) {
          // Break this dependency: remove cascadedTask from lockedSuccessor's predecessors
          console.log(`🔗❌ Breaking nested locked successor: Task #${cascadedTask.id} → #${lockedSuccessor.id}`)

          const brokenDeps = lockedSuccessor.predecessor_ids.filter(pred => {
            const predId = typeof pred === 'object' ? (pred.id || pred['id']) : pred
            return Number(predId) === Number(cascadedTask.id)
          })

          const existingBrokenDeps = lockedSuccessor.broken_predecessor_ids || []
          const newBrokenDeps = [...existingBrokenDeps, ...brokenDeps]

          lockedSuccessor.predecessor_ids = lockedSuccessor.predecessor_ids.filter(pred => {
            const predId = typeof pred === 'object' ? (pred.id || pred['id']) : pred
            return Number(predId) !== Number(cascadedTask.id)
          })

          lockedSuccessor.dependencies_broken = true
          lockedSuccessor.$dependenciesBroken = true
          lockedSuccessor.broken_predecessor_ids = newBrokenDeps

          const updateData = {
            predecessor_ids: lockedSuccessor.predecessor_ids,
            dependencies_broken: true,
            broken_predecessor_ids: newBrokenDeps
          }

          onUpdateTaskRef.current(lockedSuccessor.id, updateData, { skipReload: true })
          gantt.updateTask(lockedSuccessor.id)
        } else {
          console.log(`✅ Keeping nested locked successor: Task #${cascadedTask.id} → #${lockedSuccessor.id}`)
        }
      })
    })

    // Unlink unselected tasks
    unlinkUnselected.forEach(({ task: successorTask }) => {
      // Find the broken dependencies (the ones we're removing)
      const brokenDeps = successorTask.predecessor_ids.filter(pred => {
        const predId = typeof pred === 'object' ? (pred.id || pred['id']) : pred
        return Number(predId) === Number(movedTask.id)
      })

      // Store them so they can be restored later
      const existingBrokenDeps = successorTask.broken_predecessor_ids || []
      const newBrokenDeps = [...existingBrokenDeps, ...brokenDeps]

      // Remove from active predecessors
      successorTask.predecessor_ids = successorTask.predecessor_ids.filter(pred => {
        const predId = typeof pred === 'object' ? (pred.id || pred['id']) : pred
        return Number(predId) !== Number(movedTask.id)
      })

      successorTask.dependencies_broken = true
      successorTask.$dependenciesBroken = true
      successorTask.broken_predecessor_ids = newBrokenDeps

      const updateData = {
        predecessor_ids: successorTask.predecessor_ids,
        dependencies_broken: true,
        broken_predecessor_ids: newBrokenDeps
      }

      console.log(`🔗❌ Unlinking task #${successorTask.id}, storing broken deps:`, brokenDeps)
      onUpdateTaskRef.current(successorTask.id, updateData, { skipReload: true })
      gantt.updateTask(successorTask.id)
    })

    // Break dependencies for blocked tasks
    breakBlocked.forEach(({ task: blockedTask }) => {
      // Find the broken dependencies (the ones we're removing)
      const brokenDeps = blockedTask.predecessor_ids.filter(pred => {
        const predId = typeof pred === 'object' ? (pred.id || pred['id']) : pred
        return Number(predId) === Number(movedTask.id)
      })

      // Store them so they can be restored later
      const existingBrokenDeps = blockedTask.broken_predecessor_ids || []
      const newBrokenDeps = [...existingBrokenDeps, ...brokenDeps]

      // Remove from active predecessors
      blockedTask.predecessor_ids = blockedTask.predecessor_ids.filter(pred => {
        const predId = typeof pred === 'object' ? (pred.id || pred['id']) : pred
        return Number(predId) !== Number(movedTask.id)
      })

      blockedTask.dependencies_broken = true
      blockedTask.$dependenciesBroken = true
      blockedTask.broken_predecessor_ids = newBrokenDeps

      const updateData = {
        predecessor_ids: blockedTask.predecessor_ids,
        dependencies_broken: true,
        broken_predecessor_ids: newBrokenDeps
      }

      console.log(`🔗❌ Breaking dependency for blocked task #${blockedTask.id}, storing broken deps:`, brokenDeps)
      onUpdateTaskRef.current(blockedTask.id, updateData, { skipReload: true })
      gantt.updateTask(blockedTask.id)
    })

    debouncedRender(0)
    isDragging.current = false
    delete movedTask.$originalStart
    setCascadeModal(null)
  }

  // Handle cascade modal cancellation
  const handleCascadeCancel = () => {
    if (!cascadeModal) return

    const { movedTask, originalStart } = cascadeModal

    console.log('↩️ User cancelled cascade - reverting move')
    movedTask.start_date = originalStart
    gantt.updateTask(movedTask.id)
    debouncedRender(0)
    isDragging.current = false
    delete movedTask.$originalStart
    setCascadeModal(null)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-white flex items-center justify-center z-50 overflow-hidden"
      style={{
        transform: 'translateZ(0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        animation: 'fadeIn 0.15s ease-out',
        backgroundColor: '#ffffff !important'
      }}
    >
      <div
        className="bg-white shadow-xl w-full h-full flex flex-col"
        style={{
          transform: 'translateZ(0)',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          animation: 'fadeIn 0.15s ease-out'
        }}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              DHTMLX Gantt View (Trial)
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              30-day PRO trial with auto-scheduling, critical path, and advanced features
            </p>
          </div>

          {/* Debug Reset Button - Center where grid meets gantt */}
          <div className="flex-1 flex justify-center">
            <button
              onClick={() => {
                if (!window.confirm('⚠️ DEBUG: Reset all tasks?\n\nThis will:\n• Clear all Lock flags\n• Clear all status checkboxes\n• Restore all broken dependencies\n\nContinue?')) return

                console.log('🔧 DEBUG RESET: Starting...')
                const updates = []

                gantt.eachTask((task) => {
                  const updateData = {
                    manually_positioned: false,
                    confirm: false,
                    supplier_confirm: false,
                    start: false,
                    complete: false,
                    dependencies_broken: false
                  }

                  // Restore broken dependencies if any
                  if (task.broken_predecessor_ids && task.broken_predecessor_ids.length > 0) {
                    updateData.predecessor_ids = [
                      ...(task.predecessor_ids || []),
                      ...task.broken_predecessor_ids
                    ]
                    updateData.broken_predecessor_ids = []
                  }

                  console.log(`🔧 Resetting task ${task.id}:`, updateData)
                  updates.push({ id: task.id, updates: updateData })
                })

                // Apply all updates
                updates.forEach(({ id, updates: updateData }) => {
                  onUpdateTaskRef.current(id, updateData, { skipReload: false })
                })

                console.log(`✅ DEBUG RESET: Complete - reset ${updates.length} tasks`)
              }}
              className="px-6 py-3 text-base font-bold rounded-lg transition-colors bg-yellow-400 text-black hover:bg-yellow-500 border-3 border-black shadow-lg"
              title="DEBUG: Reset all flags and restore broken dependencies"
            >
              🔧 DEBUG RESET
            </button>
          </div>

          {/* Search, Zoom Controls, Column Visibility Dropdown and Close Button */}
          <div className="flex items-center gap-3">
            {/* Task Name Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search tasks..."
                value={taskNameSearch}
                onChange={(e) => setTaskNameSearch(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Zoom Level Controls */}
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setZoomLevel('day')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  zoomLevel === 'day'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
                title="Day view"
              >
                Day
              </button>
              <button
                onClick={() => setZoomLevel('week')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  zoomLevel === 'week'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
                title="Week view"
              >
                Week
              </button>
              <button
                onClick={() => setZoomLevel('month')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  zoomLevel === 'month'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
                title="Month view"
              >
                Month
              </button>
            </div>

            {/* Undo/Redo Buttons */}
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => {
                  console.log('🔄 Undo clicked')
                  if (gantt.undo) {
                    gantt.undo()
                    console.log('✅ Undo called')
                  } else {
                    console.error('❌ gantt.undo() not available - undo plugin may not be loaded')
                  }
                }}
                disabled={!canUndo}
                className="px-3 py-1.5 text-xs font-medium rounded transition-colors text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title={canUndo ? "Undo (Ctrl+Z)" : "No actions to undo"}
              >
                ↶ Undo
              </button>
              <button
                onClick={() => {
                  console.log('🔄 Redo clicked')
                  if (gantt.redo) {
                    gantt.redo()
                    console.log('✅ Redo called')
                  } else {
                    console.error('❌ gantt.redo() not available - undo plugin may not be loaded')
                  }
                }}
                disabled={!canRedo}
                className="px-3 py-1.5 text-xs font-medium rounded transition-colors text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title={canRedo ? "Redo (Ctrl+Y)" : "No actions to redo"}
              >
                ↷ Redo
              </button>
            </div>

            {/* Checkbox Toggle Button */}
            <button
              onClick={() => setShowCheckboxes(!showCheckboxes)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                showCheckboxes
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={showCheckboxes ? 'Hide status checkboxes' : 'Show status checkboxes'}
            >
              {showCheckboxes ? 'Hide' : 'Show'} Checkboxes
            </button>

            {/* Predecessor Display Mode Toggle */}
            <button
              onClick={() => setPredecessorDisplayMode(mode => mode === 'numbers' ? 'names' : 'numbers')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200`}
              title={predecessorDisplayMode === 'numbers' ? 'Switch to task names' : 'Switch to task numbers'}
            >
              {predecessorDisplayMode === 'numbers' ? '#' : 'ABC'}
            </button>

            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <AdjustmentsHorizontalIcon className="w-4 h-4" />
                Columns
              </Menu.Button>

              <Menu.Items className="absolute right-0 mt-2 w-64 origin-top-right bg-white border border-gray-200 rounded-lg shadow-lg focus:outline-none z-10">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Show/Hide & Reorder Columns
                  </div>
                  <div className="text-xs text-gray-400 px-3 pb-2">Drag ⠿ to reorder</div>
                  {columnOrder.map((columnKey, index) => {
                    const columnLabels = {
                      taskNumber: '# (Task Number)',
                      taskName: 'Task Name',
                      predecessors: 'Predecessors',
                      supplier: 'Supplier/Group',
                      duration: 'Duration',
                      confirm: 'Confirm',
                      supplierConfirm: 'Supplier Confirm',
                      start: 'Start',
                      complete: 'Complete',
                      lock: 'Lock'
                    }

                    return (
                      <Menu.Item key={columnKey}>
                        {() => (
                          <div
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move'
                              e.dataTransfer.setData('text/plain', index.toString())
                            }}
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'move'
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
                              const toIndex = index
                              if (fromIndex !== toIndex) {
                                const newOrder = [...columnOrder]
                                const [removed] = newOrder.splice(fromIndex, 1)
                                newOrder.splice(toIndex, 0, removed)
                                setColumnOrder(newOrder)
                              }
                            }}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded cursor-move"
                          >
                            <span className="text-gray-400 cursor-grab active:cursor-grabbing">⠿</span>
                            <input
                              type="checkbox"
                              checked={visibleColumns[columnKey]}
                              onChange={(e) => setVisibleColumns({ ...visibleColumns, [columnKey]: e.target.checked })}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700 select-none">{columnLabels[columnKey]}</span>
                          </div>
                        )}
                      </Menu.Item>
                    )
                  })}
                </div>
              </Menu.Items>
            </Menu>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Gantt Container */}
        <div className="flex-1 p-6 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading holidays and preparing gantt...</div>
            </div>
          ) : (
            <div
              ref={ganttContainer}
              className="w-full h-full dhtmlx-gantt-container"
              style={{
                width: '100%',
                height: '100%',
                transform: 'translateZ(0)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                contain: 'layout style paint'
              }}
            />
          )}
        </div>

        {/* Footer with feature highlights and terminology */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-6">
            {/* Left: Trial Features */}
            <div className="text-sm text-gray-600">
              <span className="font-medium">Trial Features:</span> Auto-scheduling • Critical Path • Undo/Redo • Drag Links • Resource Management
            </div>

            {/* Center: Terminology Legend */}
            <div className="flex-1 max-w-2xl">
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs">
                  <InformationCircleIcon className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <span className="font-semibold text-blue-900">Terminology:</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-blue-800">
                    <span><strong>SM</strong> = Schedule Master</span>
                    <span><strong>SMT</strong> = Table (24 cols)</span>
                    <span><strong>Gantt</strong> = Timeline chart</span>
                    <span><strong>Task</strong> = Row + bar</span>
                    <span><strong>Deps</strong> = Arrows</span>
                    <span><strong>FS/SS/FF</strong> = Dep types</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Hint */}
            <div className="text-xs text-gray-500 flex-shrink-0">
              Double-click task to edit dependencies
            </div>
          </div>
        </div>
      </div>

      {/* Task Dependency Editor */}
      {showEditor && selectedTask && (
        <TaskDependencyEditor
          isOpen={showEditor}
          onClose={() => {
            setShowEditor(false)
            setSelectedTask(null)
          }}
          task={selectedTask}
          tasks={tasks}
          onSave={handleSaveDependencies}
        />
      )}

      {/* Cascade Dependencies Modal - Kanban or Classic */}
      {cascadeModal && useKanbanModal && (
        <CascadeKanbanModal
          isOpen={!!cascadeModal}
          onClose={handleCascadeCancel}
          movedTask={cascadeModal.movedTask}
          unlockedSuccessors={cascadeModal.unlockedSuccessors}
          blockedSuccessors={cascadeModal.blockedSuccessors}
          onConfirm={handleCascadeConfirm}
          onUpdateTask={onUpdateTask}
        />
      )}

      {cascadeModal && !useKanbanModal && (
        <CascadeDependenciesModal
          isOpen={!!cascadeModal}
          onClose={handleCascadeCancel}
          movedTask={cascadeModal.movedTask}
          unlockedSuccessors={cascadeModal.unlockedSuccessors}
          blockedSuccessors={cascadeModal.blockedSuccessors}
          onConfirm={handleCascadeConfirm}
          onUpdateTask={onUpdateTask}
        />
      )}

      {/* Custom styles for DHTMLX Gantt */}
      <style>{`
        /* Ensure DHTMLX lightbox appears above everything */
        .gantt_modal_box,
        .gantt_popup,
        .gantt_cal_light,
        .gantt_cal_cover {
          z-index: 99999 !important;
        }

        /* Ensure lightbox background overlay is visible */
        .gantt_cal_cover {
          background-color: rgba(0, 0, 0, 0.5) !important;
        }

        /* Constrain lightbox to viewport with proper scrolling */
        .gantt_cal_light {
          max-height: 90vh !important;
          max-width: 90vw !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
        }

        /* Make lightbox content scrollable */
        .gantt_cal_larea {
          overflow-y: auto !important;
          flex: 1 !important;
          max-height: calc(90vh - 120px) !important;
        }

        /* Center the lightbox */
        .gantt_cal_light {
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          margin: 0 !important;
        }

        /* Fix row alignment - force exact same heights for grid and timeline rows */
        .dhtmlx-gantt-container .gantt_row,
        .dhtmlx-gantt-container .gantt_task_row,
        .dhtmlx-gantt-container .gantt_row.odd,
        .dhtmlx-gantt-container .gantt_row.gantt_row_task,
        .dhtmlx-gantt-container .gantt_task .gantt_task_row {
          height: 40px !important;
          line-height: 40px !important;
          min-height: 40px !important;
          max-height: 40px !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
        }

        /* Force exact scale/header heights - container should be 60px total */
        .dhtmlx-gantt-container .gantt_grid_scale,
        .dhtmlx-gantt-container .gantt_task_scale {
          height: 60px !important;
          min-height: 60px !important;
          max-height: 60px !important;
        }

        /* Each scale row (line) should be 30px so two rows fit in 60px */
        .dhtmlx-gantt-container .gantt_scale_line {
          height: 30px !important;
          line-height: 30px !important;
          min-height: 30px !important;
          max-height: 30px !important;
        }

        /* Make month/year and day numbers fit in 30px rows */
        .dhtmlx-gantt-container .gantt_scale_cell {
          font-size: 12px !important;
          line-height: 30px !important;
          height: 30px !important;
        }

        /* Force data area heights to sync */
        .dhtmlx-gantt-container .gantt_data_area,
        .dhtmlx-gantt-container .gantt_grid_data {
          overflow-y: hidden !important;
        }

        /* Task bars fill the full 40px row height for perfect alignment */
        .dhtmlx-gantt-container .gantt_task_line {
          top: 0px !important;
          height: 40px !important;
          pointer-events: auto !important; /* Ensure task bars are clickable/draggable */
          cursor: move !important; /* Show move cursor on hover */
        }

        /* FIX: Force gantt_bars_area to ignore gantt_task_bg flow with flexbox */
        .dhtmlx-gantt-container .gantt_task {
          display: flex !important;
          flex-direction: column !important;
        }

        .dhtmlx-gantt-container .gantt_task_bg {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 0 !important;
          pointer-events: none !important;
        }

        .dhtmlx-gantt-container .gantt_bars_area {
          position: relative !important;
          z-index: 1 !important;
          flex: 1 !important;
        }

        /* FIX: Task rows must match grid row height exactly to prevent drift */
        .dhtmlx-gantt-container .gantt_task_row {
          height: 40px !important;
          min-height: 40px !important;
          max-height: 40px !important;
          box-sizing: border-box !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
          pointer-events: none !important; /* Allow clicks to pass through to task bars */
        }

        /* Today's date - light green column with higher specificity */
        .dhtmlx-gantt-container .gantt_task_cell.today,
        .dhtmlx-gantt-container .gantt_scale_cell.today,
        .dhtmlx-gantt-container .today {
          background-color: #d1fae5 !important;
          border-left: 2px solid #10b981 !important;
          border-right: 2px solid #10b981 !important;
        }

        /* Weekend styling - light gray with higher specificity */
        .dhtmlx-gantt-container .gantt_task_cell.weekend,
        .dhtmlx-gantt-container .gantt_scale_cell.weekend,
        .dhtmlx-gantt-container .weekend {
          background-color: #f7f7f7 !important;
          background-image: none !important;
        }

        /* Public holiday styling - pink/red tint */
        .dhtmlx-gantt-container .public-holiday {
          background-color: #fee2e2 !important;
          background-image: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(239, 68, 68, 0.1) 10px,
            rgba(239, 68, 68, 0.1) 20px
          );
        }

        .dhtmlx-gantt-container .gantt_task_line {
          background-color: #60a5fa;
          border-color: #3b82f6;
          position: relative !important;
        }

        .dhtmlx-gantt-container .gantt_task_link .gantt_line_wrapper div {
          background-color: #6366f1;
        }

        .dhtmlx-gantt-container .gantt_task_link:hover .gantt_line_wrapper div {
          background-color: #4f46e5;
        }

        /* Dependency drag handles (circles) - hidden by default to avoid blocking clicks */
        .dhtmlx-gantt-container .gantt_link_point {
          width: 12px !important;
          height: 12px !important;
          margin-top: -6px !important;
          border: 2px solid #3b82f6 !important;
          background-color: white !important;
          border-radius: 50% !important;
          opacity: 0 !important;
          pointer-events: none !important;
          transition: opacity 0.2s, width 0.2s, height 0.2s !important;
        }

        /* Show and enable link points ONLY when hovering the task bar */
        .dhtmlx-gantt-container .gantt_task_line:hover .gantt_link_point {
          opacity: 1 !important;
          pointer-events: auto !important;
        }

        /* Enlarge link points when hovering them directly */
        .dhtmlx-gantt-container .gantt_link_point:hover {
          width: 16px !important;
          height: 16px !important;
          margin-top: -8px !important;
          border-width: 3px !important;
          background-color: #3b82f6 !important;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.5) !important;
        }

        /* Make column resize handles more visible and easier to grab */
        .dhtmlx-gantt-container .gantt_grid_head_cell {
          position: relative !important;
        }

        /* Wider resize area for easier grabbing */
        .dhtmlx-gantt-container .gantt_grid_head_cell .gantt_grid_head_cell_resize_area {
          width: 12px !important;
          right: -6px !important;
          cursor: col-resize !important;
          background-color: transparent !important;
          transition: all 0.2s !important;
          z-index: 10 !important;
        }

        /* Strong hover effect for resize handles */
        .dhtmlx-gantt-container .gantt_grid_head_cell .gantt_grid_head_cell_resize_area:hover {
          background-color: rgba(59, 130, 246, 0.15) !important;
        }

        /* Always visible resize border line - more prominent */
        .dhtmlx-gantt-container .gantt_grid_head_cell::after {
          content: '' !important;
          position: absolute !important;
          right: 0 !important;
          top: 20% !important;
          bottom: 20% !important;
          width: 3px !important;
          background: linear-gradient(to bottom,
            transparent 0%,
            rgba(209, 213, 219, 0.6) 20%,
            rgba(209, 213, 219, 0.8) 50%,
            rgba(209, 213, 219, 0.6) 80%,
            transparent 100%) !important;
          pointer-events: none !important;
        }

        /* Task bar content - make HIGHLY grabbable with move cursor for repositioning tasks */
        .dhtmlx-gantt-container .gantt_task_content {
          cursor: move !important; /* Hand/move cursor for dragging task to new date */
          pointer-events: auto !important;
          z-index: 5 !important;
          padding: 0 25px !important; /* Padding to avoid resize handles */
        }

        /* Make duration resize handles smaller and positioned outside */
        /* IMPORTANT: Handles extend OUTSIDE the task bar for easy duration changes */
        .dhtmlx-gantt-container .gantt_task_drag {
          width: 16px !important; /* Narrower to not block task bar */
          height: 100% !important;
          background-color: rgba(59, 130, 246, 0.9) !important;
          cursor: ew-resize !important;
          opacity: 0 !important; /* Hidden by default, show on hover */
          transition: opacity 0.2s, background-color 0.2s, transform 0.2s !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: absolute !important;
          top: 0 !important;
          bottom: 0 !important;
          z-index: 25 !important; /* Above task bar and content */
          pointer-events: auto !important;
        }

        /* Increase z-index of task line when hovering to show resize handles above other tasks */
        .dhtmlx-gantt-container .gantt_task_line:hover {
          z-index: 15 !important;
        }

        /* Show resize handles on task hover */
        .dhtmlx-gantt-container .gantt_task_line:hover .gantt_task_drag {
          opacity: 0.8 !important;
        }

        /* Full opacity when hovering handle directly */
        .dhtmlx-gantt-container .gantt_task_drag:hover {
          opacity: 1 !important;
          background-color: rgba(59, 130, 246, 1) !important;
          transform: scale(1.15) !important;
        }

        /* Left resize handle with arrow - EXTENDS TO THE LEFT */
        .dhtmlx-gantt-container .gantt_task_drag.task_left {
          left: -12px !important; /* Extends 12px outside the left edge */
          border-radius: 4px !important;
        }

        .dhtmlx-gantt-container .gantt_task_drag.task_left::before {
          content: '◄' !important;
          color: white !important;
          font-size: 14px !important;
          font-weight: bold !important;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5) !important;
        }

        /* Right resize handle with arrow - EXTENDS TO THE RIGHT */
        .dhtmlx-gantt-container .gantt_task_drag.task_right {
          right: -12px !important; /* Extends 12px outside the right edge */
          border-radius: 4px !important;
        }

        .dhtmlx-gantt-container .gantt_task_drag.task_right::before {
          content: '►' !important;
          color: white !important;
          font-size: 14px !important;
          font-weight: bold !important;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5) !important;
        }

        /* Critical path styling (PRO feature) */
        .dhtmlx-gantt-container .gantt_task_line.gantt_critical_task {
          background-color: #ef4444 !important;
          border-color: #dc2626 !important;
        }

        /* Manually positioned tasks - light brown color */
        .dhtmlx-gantt-container .gantt_task_line.manually-positioned-task {
          background-color: #d2691e !important; /* Chocolate/light brown */
          border-color: #a0522d !important; /* Sienna (darker brown) */
        }

        /* Broken dependencies - checkered pattern overlay */
        .dhtmlx-gantt-container .gantt_task_line.broken-dependencies-task {
          background-image: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(255, 255, 255, 0.4) 10px,
            rgba(255, 255, 255, 0.4) 20px
          ) !important;
          border: 2px dashed #ef4444 !important; /* Red dashed border */
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.5) !important; /* Red glow */
        }

        /* Manually positioned row highlight */
        .dhtmlx-gantt-container .gantt_row.manually-positioned-row {
          background-color: #faf5e9 !important; /* Very light brown/beige */
        }

        /* Status checkbox color classes */
        .dhtmlx-gantt-container .gantt_task_line.task-confirm {
          background-color: #fbbf24 !important; /* Yellow */
          border-color: #f59e0b !important;
        }

        .dhtmlx-gantt-container .gantt_task_line.task-supplier-confirm {
          background-color: #a855f7 !important; /* Purple */
          border-color: #9333ea !important;
        }

        .dhtmlx-gantt-container .gantt_task_line.task-start {
          background-color: #22c55e !important; /* Green */
          border-color: #16a34a !important;
        }

        .dhtmlx-gantt-container .gantt_task_line.task-complete {
          background-color: #1f2937 !important; /* Black/Dark Gray */
          border-color: #111827 !important;
        }

        /* Trial watermark styling */
        .dhtmlx-gantt-container .gantt_message_area {
          z-index: 1000;
        }

        /* Highlighted task styling - make it flash/pulse */
        .dhtmlx-gantt-container .gantt_task_line.highlighted-task {
          z-index: 10 !important;
        }

        /* Color 0: Amber (main clicked task) */
        .dhtmlx-gantt-container .gantt_task_line.highlighted-task-color-0 {
          background-color: #fbbf24 !important; /* Amber */
          animation: pulse-highlight-amber 1.5s ease-in-out infinite !important;
          box-shadow: 0 0 20px rgba(251, 191, 36, 0.8) !important;
          border: 2px solid #f59e0b !important;
        }

        .dhtmlx-gantt-container .gantt_row.highlighted-task-color-0 {
          background-color: #fef3c7 !important;
        }

        /* Color 1: Blue */
        .dhtmlx-gantt-container .gantt_task_line.highlighted-task-color-1 {
          background-color: #3b82f6 !important; /* Blue */
          animation: pulse-highlight-blue 1.5s ease-in-out infinite !important;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.8) !important;
          border: 2px solid #2563eb !important;
        }

        .dhtmlx-gantt-container .gantt_row.highlighted-task-color-1 {
          background-color: #dbeafe !important;
        }

        /* Color 2: Purple */
        .dhtmlx-gantt-container .gantt_task_line.highlighted-task-color-2 {
          background-color: #a855f7 !important; /* Purple */
          animation: pulse-highlight-purple 1.5s ease-in-out infinite !important;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.8) !important;
          border: 2px solid #9333ea !important;
        }

        .dhtmlx-gantt-container .gantt_row.highlighted-task-color-2 {
          background-color: #f3e8ff !important;
        }

        /* Color 3: Green */
        .dhtmlx-gantt-container .gantt_task_line.highlighted-task-color-3 {
          background-color: #22c55e !important; /* Green */
          animation: pulse-highlight-green 1.5s ease-in-out infinite !important;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.8) !important;
          border: 2px solid #16a34a !important;
        }

        .dhtmlx-gantt-container .gantt_row.highlighted-task-color-3 {
          background-color: #dcfce7 !important;
        }

        /* Color 4: Pink */
        .dhtmlx-gantt-container .gantt_task_line.highlighted-task-color-4 {
          background-color: #ec4899 !important; /* Pink */
          animation: pulse-highlight-pink 1.5s ease-in-out infinite !important;
          box-shadow: 0 0 20px rgba(236, 72, 153, 0.8) !important;
          border: 2px solid #db2777 !important;
        }

        .dhtmlx-gantt-container .gantt_row.highlighted-task-color-4 {
          background-color: #fce7f3 !important;
        }

        /* Color 5: Cyan */
        .dhtmlx-gantt-container .gantt_task_line.highlighted-task-color-5 {
          background-color: #06b6d4 !important; /* Cyan */
          animation: pulse-highlight-cyan 1.5s ease-in-out infinite !important;
          box-shadow: 0 0 20px rgba(6, 182, 212, 0.8) !important;
          border: 2px solid #0891b2 !important;
        }

        .dhtmlx-gantt-container .gantt_row.highlighted-task-color-5 {
          background-color: #cffafe !important;
        }

        /* Pulse animations for each color */
        @keyframes pulse-highlight-amber {
          0%, 100% {
            box-shadow: 0 0 20px rgba(251, 191, 36, 0.8);
            border-color: #f59e0b;
          }
          50% {
            box-shadow: 0 0 30px rgba(251, 191, 36, 1);
            border-color: #fbbf24;
          }
        }

        @keyframes pulse-highlight-blue {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
            border-color: #3b82f6;
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 1);
            border-color: #60a5fa;
          }
        }

        @keyframes pulse-highlight-purple {
          0%, 100% {
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.8);
            border-color: #a855f7;
          }
          50% {
            box-shadow: 0 0 30px rgba(168, 85, 247, 1);
            border-color: #c084fc;
          }
        }

        @keyframes pulse-highlight-green {
          0%, 100% {
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.8);
            border-color: #22c55e;
          }
          50% {
            box-shadow: 0 0 30px rgba(34, 197, 94, 1);
            border-color: #4ade80;
          }
        }

        @keyframes pulse-highlight-pink {
          0%, 100% {
            box-shadow: 0 0 20px rgba(236, 72, 153, 0.8);
            border-color: #ec4899;
          }
          50% {
            box-shadow: 0 0 30px rgba(236, 72, 153, 1);
            border-color: #f472b6;
          }
        }

        @keyframes pulse-highlight-cyan {
          0%, 100% {
            box-shadow: 0 0 20px rgba(6, 182, 212, 0.8);
            border-color: #06b6d4;
          }
          50% {
            box-shadow: 0 0 30px rgba(6, 182, 212, 1);
            border-color: #22d3ee;
          }
        }

        /* Highlighted dependency links - animated flowing indicator */
        /* Base styling for all highlighted links */
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link .gantt_line_wrapper > div[style*="height: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link .gantt_line_wrapper > div[style*="height:2px"] {
          height: 4px !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link .gantt_line_wrapper > div[style*="width: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link .gantt_line_wrapper > div[style*="width:2px"] {
          width: 4px !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link .gantt_link_arrow {
          border-width: 6px !important;
        }

        /* Color 0: Amber */
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-0 .gantt_line_wrapper div {
          background-color: #f59e0b !important;
          box-shadow: 0 0 15px rgba(251, 191, 36, 1), 0 0 25px rgba(251, 191, 36, 0.6) !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-0 .gantt_line_wrapper > div[style*="height: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-0 .gantt_line_wrapper > div[style*="height:2px"] {
          background-image: repeating-linear-gradient(90deg, #f59e0b 0px, #f59e0b 8px, #fff 8px, #fff 12px, #fbbf24 12px, #fbbf24 20px, #fff 20px, #fff 24px) !important;
          background-size: 48px 100% !important;
          animation: flow-indicator-horizontal 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-0 .gantt_line_wrapper > div[style*="width: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-0 .gantt_line_wrapper > div[style*="width:2px"] {
          background-image: repeating-linear-gradient(180deg, #f59e0b 0px, #f59e0b 8px, #fff 8px, #fff 12px, #fbbf24 12px, #fbbf24 20px, #fff 20px, #fff 24px) !important;
          background-size: 100% 48px !important;
          animation: flow-indicator-vertical 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-0 .gantt_link_arrow {
          border-color: #f59e0b !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-0 .gantt_link_arrow_right { border-left-color: #f59e0b !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-0 .gantt_link_arrow_left { border-right-color: #f59e0b !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-0 .gantt_link_arrow_up { border-bottom-color: #f59e0b !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-0 .gantt_link_arrow_down { border-top-color: #f59e0b !important; }

        /* Color 1: Blue */
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-1 .gantt_line_wrapper div {
          background-color: #3b82f6 !important;
          box-shadow: 0 0 15px rgba(59, 130, 246, 1), 0 0 25px rgba(59, 130, 246, 0.6) !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-1 .gantt_line_wrapper > div[style*="height: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-1 .gantt_line_wrapper > div[style*="height:2px"] {
          background-image: repeating-linear-gradient(90deg, #3b82f6 0px, #3b82f6 8px, #fff 8px, #fff 12px, #60a5fa 12px, #60a5fa 20px, #fff 20px, #fff 24px) !important;
          background-size: 48px 100% !important;
          animation: flow-indicator-horizontal 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-1 .gantt_line_wrapper > div[style*="width: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-1 .gantt_line_wrapper > div[style*="width:2px"] {
          background-image: repeating-linear-gradient(180deg, #3b82f6 0px, #3b82f6 8px, #fff 8px, #fff 12px, #60a5fa 12px, #60a5fa 20px, #fff 20px, #fff 24px) !important;
          background-size: 100% 48px !important;
          animation: flow-indicator-vertical 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-1 .gantt_link_arrow {
          border-color: #3b82f6 !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-1 .gantt_link_arrow_right { border-left-color: #3b82f6 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-1 .gantt_link_arrow_left { border-right-color: #3b82f6 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-1 .gantt_link_arrow_up { border-bottom-color: #3b82f6 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-1 .gantt_link_arrow_down { border-top-color: #3b82f6 !important; }

        /* Color 2: Purple */
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-2 .gantt_line_wrapper div {
          background-color: #a855f7 !important;
          box-shadow: 0 0 15px rgba(168, 85, 247, 1), 0 0 25px rgba(168, 85, 247, 0.6) !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-2 .gantt_line_wrapper > div[style*="height: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-2 .gantt_line_wrapper > div[style*="height:2px"] {
          background-image: repeating-linear-gradient(90deg, #a855f7 0px, #a855f7 8px, #fff 8px, #fff 12px, #c084fc 12px, #c084fc 20px, #fff 20px, #fff 24px) !important;
          background-size: 48px 100% !important;
          animation: flow-indicator-horizontal 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-2 .gantt_line_wrapper > div[style*="width: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-2 .gantt_line_wrapper > div[style*="width:2px"] {
          background-image: repeating-linear-gradient(180deg, #a855f7 0px, #a855f7 8px, #fff 8px, #fff 12px, #c084fc 12px, #c084fc 20px, #fff 20px, #fff 24px) !important;
          background-size: 100% 48px !important;
          animation: flow-indicator-vertical 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-2 .gantt_link_arrow {
          border-color: #a855f7 !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-2 .gantt_link_arrow_right { border-left-color: #a855f7 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-2 .gantt_link_arrow_left { border-right-color: #a855f7 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-2 .gantt_link_arrow_up { border-bottom-color: #a855f7 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-2 .gantt_link_arrow_down { border-top-color: #a855f7 !important; }

        /* Color 3: Green */
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-3 .gantt_line_wrapper div {
          background-color: #22c55e !important;
          box-shadow: 0 0 15px rgba(34, 197, 94, 1), 0 0 25px rgba(34, 197, 94, 0.6) !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-3 .gantt_line_wrapper > div[style*="height: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-3 .gantt_line_wrapper > div[style*="height:2px"] {
          background-image: repeating-linear-gradient(90deg, #22c55e 0px, #22c55e 8px, #fff 8px, #fff 12px, #4ade80 12px, #4ade80 20px, #fff 20px, #fff 24px) !important;
          background-size: 48px 100% !important;
          animation: flow-indicator-horizontal 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-3 .gantt_line_wrapper > div[style*="width: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-3 .gantt_line_wrapper > div[style*="width:2px"] {
          background-image: repeating-linear-gradient(180deg, #22c55e 0px, #22c55e 8px, #fff 8px, #fff 12px, #4ade80 12px, #4ade80 20px, #fff 20px, #fff 24px) !important;
          background-size: 100% 48px !important;
          animation: flow-indicator-vertical 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-3 .gantt_link_arrow {
          border-color: #22c55e !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-3 .gantt_link_arrow_right { border-left-color: #22c55e !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-3 .gantt_link_arrow_left { border-right-color: #22c55e !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-3 .gantt_link_arrow_up { border-bottom-color: #22c55e !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-3 .gantt_link_arrow_down { border-top-color: #22c55e !important; }

        /* Color 4: Pink */
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-4 .gantt_line_wrapper div {
          background-color: #ec4899 !important;
          box-shadow: 0 0 15px rgba(236, 72, 153, 1), 0 0 25px rgba(236, 72, 153, 0.6) !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-4 .gantt_line_wrapper > div[style*="height: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-4 .gantt_line_wrapper > div[style*="height:2px"] {
          background-image: repeating-linear-gradient(90deg, #ec4899 0px, #ec4899 8px, #fff 8px, #fff 12px, #f472b6 12px, #f472b6 20px, #fff 20px, #fff 24px) !important;
          background-size: 48px 100% !important;
          animation: flow-indicator-horizontal 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-4 .gantt_line_wrapper > div[style*="width: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-4 .gantt_line_wrapper > div[style*="width:2px"] {
          background-image: repeating-linear-gradient(180deg, #ec4899 0px, #ec4899 8px, #fff 8px, #fff 12px, #f472b6 12px, #f472b6 20px, #fff 20px, #fff 24px) !important;
          background-size: 100% 48px !important;
          animation: flow-indicator-vertical 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-4 .gantt_link_arrow {
          border-color: #ec4899 !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-4 .gantt_link_arrow_right { border-left-color: #ec4899 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-4 .gantt_link_arrow_left { border-right-color: #ec4899 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-4 .gantt_link_arrow_up { border-bottom-color: #ec4899 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-4 .gantt_link_arrow_down { border-top-color: #ec4899 !important; }

        /* Color 5: Cyan */
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-5 .gantt_line_wrapper div {
          background-color: #06b6d4 !important;
          box-shadow: 0 0 15px rgba(6, 182, 212, 1), 0 0 25px rgba(6, 182, 212, 0.6) !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-5 .gantt_line_wrapper > div[style*="height: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-5 .gantt_line_wrapper > div[style*="height:2px"] {
          background-image: repeating-linear-gradient(90deg, #06b6d4 0px, #06b6d4 8px, #fff 8px, #fff 12px, #22d3ee 12px, #22d3ee 20px, #fff 20px, #fff 24px) !important;
          background-size: 48px 100% !important;
          animation: flow-indicator-horizontal 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-5 .gantt_line_wrapper > div[style*="width: 2px"],
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-5 .gantt_line_wrapper > div[style*="width:2px"] {
          background-image: repeating-linear-gradient(180deg, #06b6d4 0px, #06b6d4 8px, #fff 8px, #fff 12px, #22d3ee 12px, #22d3ee 20px, #fff 20px, #fff 24px) !important;
          background-size: 100% 48px !important;
          animation: flow-indicator-vertical 0.8s linear infinite !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-5 .gantt_link_arrow {
          border-color: #06b6d4 !important;
        }

        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-5 .gantt_link_arrow_right { border-left-color: #06b6d4 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-5 .gantt_link_arrow_left { border-right-color: #06b6d4 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-5 .gantt_link_arrow_up { border-bottom-color: #06b6d4 !important; }
        .dhtmlx-gantt-container .gantt_task_link.highlighted-link-color-5 .gantt_link_arrow_down { border-top-color: #06b6d4 !important; }

        @keyframes flow-indicator-horizontal {
          0% {
            background-position: 0px 0%;
          }
          100% {
            background-position: 48px 0%;
          }
        }

        @keyframes flow-indicator-vertical {
          0% {
            background-position: 0% 0px;
          }
          100% {
            background-position: 0% 48px;
          }
        }
      `}</style>

      {/* Drag Conflict Modal */}
      {dragConflict && (
        <div className="fixed inset-0 bg-white flex items-center justify-center" style={{ zIndex: 2147483647, backgroundColor: '#ffffff !important' }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Cannot Move Task Earlier
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {dragConflict.isTodayConstraint
                  ? 'Tasks cannot be scheduled before today'
                  : 'This task is blocked by predecessor dependencies'
                }
              </p>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              {dragConflict.isTodayConstraint ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                    Schedule Constraint:
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    You're trying to move <strong>{dragConflict.task.text}</strong> to{' '}
                    <strong>{dragConflict.newStart.toLocaleDateString()}</strong>, but tasks cannot be
                    scheduled before today (<strong>{dragConflict.originalStart.toLocaleDateString()}</strong>).
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                    You're trying to move <strong>{dragConflict.task.text}</strong> to{' '}
                    <strong>{dragConflict.newStart.toLocaleDateString()}</strong>, but it has predecessor
                    dependencies that require it to start no earlier than{' '}
                    <strong>{dragConflict.originalStart.toLocaleDateString()}</strong>.
                  </p>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-2">
                      Blocking Dependencies:
                    </h4>
                    <ul className="space-y-2">
                      {dragConflict.blockingPredecessors.map((pred, idx) => (
                        <li key={idx} className="text-sm text-yellow-800 dark:text-yellow-400 flex items-center gap-2">
                          <span className="font-mono bg-yellow-200 dark:bg-yellow-900 px-2 py-0.5 rounded">
                            {pred.taskName}
                          </span>
                          <span className="text-xs">
                            ({pred.type}{pred.lag > 0 ? `+${pred.lag}` : pred.lag < 0 ? pred.lag : ''})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              <div className="space-y-2">
                {!dragConflict.isTodayConstraint && (
                  <button
                    onClick={() => {
                      // Remove all blocking dependencies and allow the move
                      dragConflict.blockingPredecessors.forEach(pred => {
                        gantt.deleteLink(pred.linkId)
                      })

                      // Update task position
                      const task = dragConflict.task
                      task.start_date = dragConflict.newStart
                      gantt.updateTask(task.id)

                      // Save to backend
                      onUpdateTaskRef.current(task.id, {
                        predecessor_ids: [], // Remove all predecessors
                        start_date: dragConflict.newStart.toISOString().split('T')[0]
                      })

                      // Close modal
                      setDragConflict(null)
                    }}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Remove {dragConflict.blockingPredecessors.length} Dependency{dragConflict.blockingPredecessors.length > 1 ? 'ies' : ''} and Move Task
                  </button>
                )}

                <button
                  onClick={() => {
                    // Cancel - task is already reverted, just close modal
                    setDragConflict(null)
                  }}
                  className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg"
                >
                  {dragConflict.isTodayConstraint ? 'OK' : 'Cancel - Keep Dependencies and Original Position'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Position Dialog - when unchecking all checkboxes */}
      {showPositionDialog && positionDialogTask && (
        <div
          className="fixed inset-0 bg-white flex items-center justify-center"
          style={{ zIndex: 10000, backgroundColor: '#ffffff !important' }}
          onClick={(e) => {
            // Close dialog if clicking outside
            if (e.target === e.currentTarget) {
              setShowPositionDialog(false)
              setPositionDialogTask(null)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Task Position
              </h3>
              <button
                onClick={() => {
                  setShowPositionDialog(false)
                  setPositionDialogTask(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Task "{positionDialogTask.task.text}" has no status checkboxes selected.
              <br /><br />
              What would you like to do with the task position?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  const { task: dialogTask, field, checked } = positionDialogTask

                  // Get fresh task reference from gantt to ensure we're modifying the latest state
                  const task = gantt.getTask(dialogTask.id)

                  // Keep the task locked at current position
                  task.manually_positioned = true
                  task.$manuallyPositioned = true
                  manuallyPositionedTasks.current.add(task.id)

                  // Calculate day offset for saving
                  let dayOffset = task.start_date_offset
                  if (dayOffset === undefined && task.start_date) {
                    const projectStartDate = getToday()
                    projectStartDate.setHours(0, 0, 0, 0)
                    const taskStartDate = new Date(task.start_date)
                    taskStartDate.setHours(0, 0, 0, 0)
                    dayOffset = Math.floor((taskStartDate - projectStartDate) / (1000 * 60 * 60 * 24))
                    task.start_date_offset = dayOffset
                  }

                  gantt.updateTask(task.id)
                  // Force refresh of this specific task's grid row to update lock checkbox
                  gantt.refreshTask(task.id)

                  // Save to backend - uncheck the checkbox and keep locked
                  // CRITICAL: Preserve predecessor_ids
                  onUpdateTaskRef.current(task.id, {
                    [field]: checked,
                    manually_positioned: true,
                    predecessor_ids: task.predecessor_ids || []  // Preserve dependencies!
                  })

                  setShowPositionDialog(false)
                  setPositionDialogTask(null)
                }}
                className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg"
              >
                Keep at Current Position (Locked/Brown)
              </button>

              <button
                onClick={async () => {
                  console.log('🔵 Auto-Calculate button clicked!')
                  const { task: dialogTask, field, checked } = positionDialogTask
                  console.log('🔵 Dialog task data:', { taskId: dialogTask.id, field, checked })

                  // Get task reference to access its properties
                  const task = gantt.getTask(dialogTask.id)
                  console.log('🔵 Got task from gantt:', { id: task.id, manually_positioned: task.manually_positioned })

                  // CRITICAL: Set isSaving flag FIRST to block ALL auto-saves
                  isSaving.current = true
                  console.log('🔵 Set isSaving=true to prevent auto-save during unlock')

                  // Close dialog immediately so user sees it's processing
                  console.log('🔵 Closing dialog')
                  setShowPositionDialog(false)
                  setPositionDialogTask(null)

                  try {
                    // Make API call FIRST, before any UI updates
                    // This prevents gantt.updateTask() from triggering unwanted auto-saves
                    console.log('🔵 Calling onUpdateTask with:', {
                      [field]: checked,
                      manually_positioned: false,
                      start_date: 0,
                      predecessor_ids: task.predecessor_ids || []
                    })

                    const responseData = await onUpdateTaskRef.current(task.id, {
                      [field]: checked,
                      manually_positioned: false,
                      start_date: 0,  // 0 means auto-calculate from today
                      predecessor_ids: task.predecessor_ids || []  // Preserve dependencies!
                    })
                    console.log('✅ Backend save completed, response:', responseData)

                    // NOW update local task with confirmed backend data
                    task.manually_positioned = false
                    task.$manuallyPositioned = false
                    task[field] = checked
                    manuallyPositionedTasks.current.delete(task.id)
                    console.log('🔵 Updated local task properties with backend data')

                    // Update DHTMLX Gantt UI
                    gantt.updateTask(task.id)
                    debouncedRender(0)
                    console.log('✅ UI updated with unlocked state')
                  } catch (error) {
                    console.error('❌ Backend save failed:', error)
                    // Revert UI on error
                    task[field] = !checked
                    gantt.updateTask(task.id)
                    debouncedRender(0)
                  } finally {
                    // Reset isSaving flag after everything completes
                    isSaving.current = false
                    console.log('🔵 Reset isSaving=false after all operations complete')
                  }
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
              >
                Auto-Calculate Based on Predecessors (Unlocked/Blue)
              </button>

              <button
                onClick={() => {
                  // Cancel - just close the dialog, checkbox state already reverted
                  setShowPositionDialog(false)
                  setPositionDialogTask(null)
                }}
                className="w-full px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drag Tooltip */}
      {dragTooltip && (
        <div
          className="fixed pointer-events-none"
          style={{
            left: `${dragTooltip.position.x}px`,
            top: `${dragTooltip.position.y}px`,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '1.25rem',
              borderRadius: '0.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '2px solid #60a5fa',
            }}
          >
            {/* Prominent day number */}
            <div style={{ fontSize: '3rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '0.5rem' }}>
              {dragTooltip.newDay}
            </div>
            {/* Full new date */}
            <div style={{ fontSize: '1rem', fontWeight: '600', textAlign: 'center', color: '#dbeafe', marginBottom: '0.75rem' }}>
              {dragTooltip.newDate}
            </div>
            {/* From original date */}
            <div style={{ fontSize: '0.875rem', color: '#bfdbfe', textAlign: 'center', borderTop: '1px solid #93c5fd', paddingTop: '0.5rem', marginBottom: '0.5rem' }}>
              From: {dragTooltip.originalDate}
            </div>
            {/* Duration */}
            <div style={{ fontSize: '0.875rem', color: '#bfdbfe', textAlign: 'center', borderTop: '1px solid #93c5fd', paddingTop: '0.5rem', marginBottom: '0.5rem' }}>
              Duration: {dragTooltip.duration} {dragTooltip.duration === 1 ? 'day' : 'days'}
            </div>
            {/* Predecessors */}
            {dragTooltip.predecessors && dragTooltip.predecessors.length > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#bfdbfe', textAlign: 'center', borderTop: '1px solid #93c5fd', paddingTop: '0.5rem', marginBottom: '0.5rem' }}>
                Depends on: {dragTooltip.predecessors.join(', ')}
              </div>
            )}
            {/* Successors */}
            {dragTooltip.successors && dragTooltip.successors.length > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#bfdbfe', textAlign: 'center', borderTop: '1px solid #93c5fd', paddingTop: '0.5rem' }}>
                Blocks: {dragTooltip.successors.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
