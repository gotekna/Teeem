import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  PlusIcon, TrashIcon, PencilIcon, DocumentDuplicateIcon,
  CheckIcon, ArrowUpIcon, ArrowDownIcon, InformationCircleIcon,
  MagnifyingGlassIcon, XMarkIcon, Cog6ToothIcon, EyeIcon, EyeSlashIcon,
  Bars3Icon, ChevronUpIcon, ChevronDownIcon, ArrowDownTrayIcon, ArrowUpTrayIcon,
  ChartBarIcon, BookOpenIcon, ClipboardDocumentIcon, PlayIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'
import { getTodayAsString, getNowInCompanyTimezone } from '../../utils/timezoneUtils'
import Toast from '../Toast'
import * as XLSX from 'xlsx'
import PredecessorEditor from './PredecessorEditor'
import PriceBookItemsModal from './PriceBookItemsModal'
import SupervisorChecklistModal from './SupervisorChecklistModal'
import LinkedTasksModal from './LinkedTasksModal'
import AutoCompleteTasksModal from './AutoCompleteTasksModal'
import SubtasksModal from './SubtasksModal'
import DHtmlxGanttView from './DHtmlxGanttView'
import GanttRulesModal from './GanttRulesModal'
import GanttBugHunterModal from './GanttBugHunterModal'
import { bugHunter } from '../../utils/ganttDebugger'

/**
 * Schedule Template Editor - Full 14-column grid interface for creating/editing schedule templates
 * Columns: Name, Supplier, Predecessors, PO Required, Create PO on Start, Price Book Items,
 *          Critical PO, Tags, Photo Required, Certificate Required, Cert Lag Days,
 *          Supervisor Check, Auto-Complete Predecessors, Subtasks
 */

// Tooltip component for column headers
function ColumnTooltip({ text, tooltip }) {
  return (
    <div className="group relative flex items-center gap-1">
      <span>{text}</span>
      <InformationCircleIcon className="h-3.5 w-3.5 text-gray-400 cursor-help" />
      <div className="invisible group-hover:visible absolute z-[9999] top-full left-0 mt-2 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-xl border border-gray-700">
        {tooltip}
        <div className="absolute bottom-full left-4 mb-[-4px] border-4 border-transparent border-b-gray-900"></div>
      </div>
    </div>
  )
}

// User role/group options for assignment
const ASSIGNABLE_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales', label: 'Sales' },
  { value: 'site', label: 'Site' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'builder', label: 'Builder' },
  { value: 'estimator', label: 'Estimator' }
]

// Plan types for documentation
const PLAN_TYPES = [
  { value: '', label: 'None' },
  { value: '01-perspective', label: '01 - PERSPECTIVE' },
  { value: '02-site-plan', label: '02 - SITE PLAN' },
  { value: '02a-survey-plan', label: '02a - SURVEY PLAN' },
  { value: '03-ground-floor', label: '03 - GROUND FLOOR PLAN' },
  { value: '03a-first-floor', label: '03a - FIRST FLOOR PLAN' },
  { value: '04-elevation-1', label: '04 - ELEVATION 1' },
  { value: '04a-elevation-2', label: '04a - ELEVATION 2' },
  { value: '05-electrical', label: '05 - ELECTRICAL' },
  { value: '06-landscaping', label: '06 - LANDSCAPING PLAN' },
  { value: '07-slab-plan', label: '07 - SLAB PLAN (Cert Drawing)' },
  { value: '07a-slab-3d', label: '07a - SLAB 3D (Cert Drawing)' },
  { value: '08-ext-concrete', label: '08 - EXT CONCRETE PLAN (Cert Drawing)' },
  { value: '09-roof-plan', label: '09 - ROOF PLAN (Cert Drawing)' },
  { value: '10-drainage', label: '10 - DRAINAGE PLAN (Cert Drawing)' },
  { value: '11-room-areas', label: '11 - ROOM AREAS (Cert Drawing)' },
  { value: '12-aircon', label: '12 - AIRCON (Cert Drawing)' },
  { value: '13-insulation', label: '13 - INSULATION (Cert Drawing)' },
  { value: '14-bracing', label: '14 - BRACING (Cert Drawing)' },
  { value: '14a-bracing-details', label: '14a - BRACING DETAILS (Cert Drawing)' },
  { value: '15-compliance', label: '15 - COMPLIANCE PLAN (Cert Drawing)' },
  { value: '16-access-dwelling', label: '16 - ACCESS TO DWELLING (Cert Drawing)' },
  { value: '17-emergency-evac', label: '17 - EMERGENCY EVAC PLAN (Cert Drawing)' },
  { value: '18-ndis-notes', label: '18 - NDIS NOTES (Cert Drawing)' }
]

// Default column configuration
const defaultColumnConfig = {
  select: { visible: true, width: 40, label: '', order: -1 },
  sequence: { visible: true, width: 40, label: '#', order: 0 },
  taskName: { visible: true, width: 200, label: 'Task Name', order: 1 },
  supplierGroup: { visible: true, width: 150, label: 'Supplier / Group', order: 2 },
  predecessors: { visible: true, width: 100, label: 'Predecessors', order: 3 },
  duration: { visible: true, width: 80, label: 'Duration', order: 4 },
  startDate: { visible: true, width: 110, label: 'Start Date', order: 5 },
  lock: { visible: true, width: 70, label: 'Lock', order: 5.5 },
  poRequired: { visible: true, width: 80, label: 'PO Req', order: 6 },
  autoPo: { visible: true, width: 80, label: 'Auto PO', order: 7 },
  priceItems: { visible: true, width: 120, label: 'Price Items', order: 8 },
  critical: { visible: true, width: 80, label: 'Critical', order: 9 },
  tags: { visible: true, width: 100, label: 'Tags', order: 10 },
  photo: { visible: true, width: 80, label: 'Photo', order: 11 },
  cert: { visible: true, width: 80, label: 'Cert', order: 12 },
  certLag: { visible: true, width: 80, label: 'Cert Lag', order: 13 },
  supCheck: { visible: true, width: 120, label: 'Sup Check', order: 14 },
  autoComplete: { visible: true, width: 120, label: 'Auto Complete', order: 15 },
  subtasks: { visible: true, width: 120, label: 'Subtasks', order: 16 },
  linkedTasks: { visible: true, width: 120, label: 'Linked Tasks', order: 17 },
  manualTask: { visible: true, width: 80, label: 'Manual', order: 18 },
  multipleItems: { visible: true, width: 80, label: 'Multi', order: 19 },
  orderRequired: { visible: true, width: 100, label: 'Order Time', order: 20 },
  callUpRequired: { visible: true, width: 100, label: 'Call Up', order: 21 },
  planType: { visible: true, width: 80, label: 'Plan', order: 22 },
  actions: { visible: true, width: 80, label: 'Actions', order: 100 }
}

export default function ScheduleTemplateEditor() {
  const location = useLocation()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [rows, setRows] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [documentationCategories, setDocumentationCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', is_default: false })
  const [searchQuery, setSearchQuery] = useState('')
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [columnFilters, setColumnFilters] = useState({})
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)
  const [showGanttView, setShowGanttView] = useState(false)
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [showBugHunterModal, setShowBugHunterModal] = useState(false)
  const [showCopyDropdown, setShowCopyDropdown] = useState(false)
  const hasCollapsedOnLoad = useRef(false)

  // Cascade update batching (prevents multiple reloads from backend cascade updates)
  const cascadeUpdatesRef = useRef(new Map()) // Map of rowId -> response
  const cascadeBatchTimeoutRef = useRef(null)

  // Track pending updates to prevent duplicate API calls
  const pendingUpdatesRef = useRef(new Map()) // Map of "rowId:field" -> value

  // Track when we're applying backend cascade updates (prevents handleUpdateRow calls during batch apply)
  const isApplyingCascadeRef = useRef(false)
  const cascadeDepthRef = useRef(0) // Track nested cascade depth to know when ALL cascades complete
  const cascadeDepthTimeouts = useRef([]) // Track pending setTimeout calls to release cascade depth

  // Request deduplication queue - consolidate rapid API calls to same task
  const updateQueueRef = useRef(new Map()) // Map of rowId -> { updates, options, timeout }
  const DEDUP_WINDOW_MS = 50 // Consolidate user updates within 50ms window
  const CASCADE_DEDUP_WINDOW_MS = 800 // Consolidate cascade updates within 800ms window (longer than cascade timeout)

  // Column resize state
  const [resizingColumn, setResizingColumn] = useState(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)

  // Column drag/reorder state
  const [draggedColumn, setDraggedColumn] = useState(null)

  // Sort state - Default to startDate for Gantt timeline view
  const [sortBy, setSortBy] = useState('startDate')
  const [sortDirection, setSortDirection] = useState('asc')

  // Row selection state for bulk operations
  const [selectedRows, setSelectedRows] = useState(new Set())

  // Column configuration with localStorage persistence
  const [columnConfig, setColumnConfig] = useState(() => {
    const saved = localStorage.getItem('scheduleTemplateColumnConfig')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Remove deprecated columns
        delete parsed.linkedTemplate
        delete parsed.docTabs // Remove old docTabs column

        // Merge with defaults to ensure all columns have required properties
        // Always use the label from defaultColumnConfig to allow updates
        const merged = {}
        Object.keys(defaultColumnConfig).forEach(key => {
          merged[key] = {
            ...defaultColumnConfig[key],
            ...(parsed[key] || {}),
            // Always override with the default label to allow label updates
            label: defaultColumnConfig[key].label
          }
        })

        // Save the cleaned config back to localStorage
        localStorage.setItem('scheduleTemplateColumnConfig', JSON.stringify(merged))

        return merged
      } catch (e) {
        return defaultColumnConfig
      }
    }
    return defaultColumnConfig
  })

  // Update column config when documentation categories are loaded
  useEffect(() => {
    if (documentationCategories.length > 0) {
      setColumnConfig(prev => {
        const newConfig = { ...prev }

        // Remove the old docTabs column
        delete newConfig.docTabs

        // Define the base order for doc tab columns (after planType, before actions)
        const DOC_TABS_START_ORDER = 50
        const ACTIONS_ORDER = 100

        // Add a column for each documentation category
        documentationCategories.forEach((category, index) => {
          const key = `docTab_${category.id}`
          if (!newConfig[key]) {
            newConfig[key] = {
              visible: true,
              width: 80,
              label: category.name,
              order: DOC_TABS_START_ORDER + index,
              categoryId: category.id,
              categoryColor: category.color,
              isDocTabColumn: true // Flag to identify doc tab columns
            }
          } else {
            // Update label and order in case category name changed
            newConfig[key].label = category.name
            newConfig[key].categoryColor = category.color
            newConfig[key].order = DOC_TABS_START_ORDER + index
            newConfig[key].isDocTabColumn = true
          }
        })

        // Ensure actions column stays at the end
        if (newConfig.actions) {
          newConfig.actions.order = ACTIONS_ORDER
        }

        return newConfig
      })
    }
  }, [documentationCategories])

  useEffect(() => {
    loadTemplates()
    loadSuppliers()
    loadDocumentationCategories()

    // Auto-collapse left panel on initial load for better screen space
    if (!hasCollapsedOnLoad.current) {
      setIsLeftPanelCollapsed(true)
      hasCollapsedOnLoad.current = true
    }
  }, [location.search]) // Re-run when URL parameters change

  // Also collapse when navigating to this tab (location change)
  useEffect(() => {
    if (location.pathname === '/admin/system' && location.search.includes('schedule-master')) {
      setIsLeftPanelCollapsed(true)
    }
  }, [location])

  // Track if we've auto-opened for the current URL to prevent reopening on close
  const autoOpenedRef = useRef(false)

  // Auto-open DHtmlx Gantt view when openGantt query parameter is present (from sidebar button)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const openGanttParam = params.get('openGantt')
    const runVisualTestParam = params.get('runVisualTest')

    if ((openGanttParam || runVisualTestParam) && selectedTemplate && rows.length > 0 && !showGanttView && !autoOpenedRef.current) {
      // Mark that we've auto-opened for this URL
      autoOpenedRef.current = true

      // Small delay to ensure everything is loaded
      setTimeout(() => {
        setShowGanttView(true)
      }, 300)
    } else if (!openGanttParam && !runVisualTestParam) {
      // Reset the flag when URL parameter is removed
      autoOpenedRef.current = false
    }
  }, [location.search, selectedTemplate, rows.length])

  // Auto-run visual test when runVisualTest parameter is present and Gantt is loaded
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const runVisualTestParam = params.get('runVisualTest')

    console.log('🔍 Visual test useEffect running...')
    console.log('🔍 URL search params:', location.search)
    console.log('🔍 runVisualTestParam:', runVisualTestParam)
    console.log('🔍 showGanttView:', showGanttView)
    console.log('🔍 selectedTemplate:', selectedTemplate?.id)

    if (runVisualTestParam && showGanttView) {
      console.log('🧪 Visual test mode detected - Gantt view is now open')
      console.log('🧪 Test ID:', runVisualTestParam)
      console.log('🧪 Template ID:', selectedTemplate?.id)

      // Wait for Gantt to fully initialize and expose window.runGanttAutomatedTest
      const runTest = async () => {
        let attempts = 0
        const maxAttempts = 40 // 20 seconds max wait

        // Poll for window.runGanttAutomatedTest to be available
        while (!window.runGanttAutomatedTest && attempts < maxAttempts) {
          console.log(`🧪 Waiting for Gantt test function... (attempt ${attempts + 1}/${maxAttempts})`)
          await new Promise(resolve => setTimeout(resolve, 500))
          attempts++
        }

        if (!window.runGanttAutomatedTest) {
          console.error('❌ Gantt test function not available after 20 seconds')
          alert('Test failed: Gantt did not load properly')
          return
        }

        console.log('🧪 Running automated visual test...')

        // Show a visual indicator that test is running
        const testModal = document.createElement('div')
        testModal.id = 'visual-test-modal'
        testModal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
        `
        testModal.innerHTML = `
          <div style="
            background: white;
            dark:background: #1f2937;
            padding: 2rem;
            border-radius: 0.5rem;
            max-width: 600px;
            width: 90%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          ">
            <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; color: #111827;">
              🧪 Visual Test Running...
            </h2>
            <p id="test-status" style="color: #6b7280; margin-bottom: 1rem;">
              Initializing test...
            </p>
            <div id="test-steps" style="
              max-height: 400px;
              overflow-y: auto;
              background: #f9fafb;
              padding: 1rem;
              border-radius: 0.25rem;
              font-family: monospace;
              font-size: 0.875rem;
              line-height: 1.5;
            ">
              <div style="color: #6b7280;">Test starting...</div>
            </div>
          </div>
        `
        document.body.appendChild(testModal)

        const updateTestStatus = (message, steps = []) => {
          const statusEl = document.getElementById('test-status')
          const stepsEl = document.getElementById('test-steps')
          if (statusEl) statusEl.textContent = message
          if (stepsEl && steps.length > 0) {
            stepsEl.innerHTML = steps.map(step => `<div style="margin-bottom: 0.25rem; color: #111827;">${step}</div>`).join('')
          }
        }

        try {
          // Run the test with visual mode and template ID
          updateTestStatus('Running automated test...')

          const result = await window.runGanttAutomatedTest({
            visual: true,
            templateId: selectedTemplate.id,
            onProgress: (step, allSteps) => {
              updateTestStatus('Running automated test...', allSteps)
            }
          })
          console.log('🧪 Test completed:', result)

          // Update modal with results
          updateTestStatus(result.message, result.steps || [])

          // Save result to database
          await api.post(`/api/v1/bug_hunter_tests/${runVisualTestParam}/run`, {
            template_id: selectedTemplate.id,
            passed: result.passed,
            message: result.message,
            duration: result.testDuration
          })

          // Show results for 3 seconds before closing
          setTimeout(() => {
            document.body.removeChild(testModal)
            setShowGanttView(false)
            // Navigate to Bug Hunter Tests tab
            window.location.href = `/admin/system?tab=schedule-master&subtab=bug-hunter&testResult=${result.passed ? 'pass' : 'fail'}&testId=${runVisualTestParam}`
          }, 3000) // Keep modal visible for 3 seconds to show results
        } catch (error) {
          console.error('❌ Test error:', error)
          updateTestStatus(`❌ Test failed: ${error.message}`)
          setTimeout(() => {
            document.body.removeChild(testModal)
            alert(`Test failed: ${error.message}`)
          }, 2000)
        }
      }

      runTest()
    }
  }, [showGanttView, location.search, selectedTemplate])

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateRows(selectedTemplate.id)
    }
  }, [selectedTemplate])

  const loadTemplates = async () => {
    try {
      const response = await api.get('/api/v1/schedule_templates')
      setTemplates(response)

      if (response.length > 0 && !selectedTemplate) {
        // Check if template ID is specified in URL
        const params = new URLSearchParams(location.search)
        const templateIdParam = params.get('template')

        if (templateIdParam) {
          console.log('🔍 Template ID from URL:', templateIdParam)
          const matchingTemplate = response.find(t => t.id === parseInt(templateIdParam))
          if (matchingTemplate) {
            console.log('✅ Found matching template:', matchingTemplate.name)
            setSelectedTemplate(matchingTemplate)
          } else {
            console.warn('⚠️ Template ID from URL not found, using first template')
            setSelectedTemplate(response[0])
          }
        } else {
          // No URL parameter, default to first template
          setSelectedTemplate(response[0])
        }
      }
    } catch (err) {
      console.error('Failed to load templates:', err)
      showToast('Failed to load templates', 'error')
    }
  }

  const loadTemplateRows = async (templateId, showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setLoading(true)
      }
      console.log('🐛 loadTemplateRows: Fetching rows for template', templateId)
      const response = await api.get(`/api/v1/schedule_templates/${templateId}`)
      console.log('🐛 loadTemplateRows: API response received')
      console.log('  - Response rows count:', response.rows?.length || 0)
      console.log('  - Response row IDs:', response.rows?.map(r => r?.id) || [])
      console.log('  - Response row names:', response.rows?.map(r => r?.name) || [])
      // Filter out any undefined/null rows as a safety measure
      const validRows = (response.rows || []).filter(r => r && r.id)
      setRows(validRows)
      console.log('🐛 loadTemplateRows: State updated with', validRows.length, 'valid rows')
    } catch (err) {
      console.error('Failed to load template rows:', err)
      showToast('Failed to load template rows', 'error')
    } finally {
      if (showLoadingState) {
        setLoading(false)
      }
    }
  }

  const loadSuppliers = async () => {
    try {
      const response = await api.get('/api/v1/suppliers')
      setSuppliers(response.suppliers || [])
    } catch (err) {
      console.error('Failed to load suppliers:', err)
    }
  }

  const loadDocumentationCategories = async () => {
    try {
      const response = await api.get('/api/v1/documentation_categories')
      setDocumentationCategories(response.documentation_categories || [])
    } catch (err) {
      console.error('Failed to load documentation categories:', err)
    }
  }

  const handleCreateTemplate = async () => {
    try {
      const response = await api.post('/api/v1/schedule_templates', {
        schedule_template: templateForm
      })
      showToast('Template created successfully', 'success')
      await loadTemplates()
      setSelectedTemplate(response)
      setShowTemplateModal(false)
      setTemplateForm({ name: '', description: '', is_default: false })
    } catch (err) {
      console.error('Failed to create template:', err)
      showToast('Failed to create template', 'error')
    }
  }

  const handleDuplicateTemplate = async () => {
    if (!selectedTemplate) return

    const newName = prompt('Enter name for duplicated template:', `${selectedTemplate.name} (Copy)`)
    if (!newName) return

    try {
      const response = await api.post(`/api/v1/schedule_templates/${selectedTemplate.id}/duplicate`, {
        new_name: newName
      })
      showToast('Template duplicated successfully', 'success')
      await loadTemplates()
      setSelectedTemplate(response)
    } catch (err) {
      console.error('Failed to duplicate template:', err)
      showToast('Failed to duplicate template', 'error')
    }
  }

  const handleSetAsDefault = async () => {
    if (!selectedTemplate) return

    try {
      await api.post(`/api/v1/schedule_templates/${selectedTemplate.id}/set_as_default`)
      showToast('Template set as default', 'success')
      await loadTemplates()
    } catch (err) {
      console.error('Failed to set default template:', err)
      showToast('Failed to set default template', 'error')
    }
  }

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return

    // Prevent deleting the default template
    if (selectedTemplate.is_default) {
      showToast('Cannot delete the default template. Set another template as default first.', 'error')
      return
    }

    // Confirm deletion
    const confirmMessage = `Are you sure you want to delete "${selectedTemplate.name}"?\n\nThis will permanently delete the template and all its tasks. This action cannot be undone.`
    if (!confirm(confirmMessage)) return

    try {
      await api.delete(`/api/v1/schedule_templates/${selectedTemplate.id}`)
      showToast('Template deleted successfully', 'success')

      // Reload templates and select the first one
      const response = await api.get('/api/v1/schedule_templates')
      setTemplates(response)
      setSelectedTemplate(response.length > 0 ? response[0] : null)
      setRows([])
    } catch (err) {
      console.error('Failed to delete template:', err)
      showToast(err.message || 'Failed to delete template', 'error')
    }
  }

  const handleCopyGanttBible = async () => {
    try {
      // Fetch the Gantt Bible (The Bible - Rules Only)
      const response = await fetch('/GANTT_BIBLE.md')
      if (!response.ok) {
        throw new Error('Failed to load Gantt Bible')
      }

      const bibleText = await response.text()

      // Copy to clipboard
      await navigator.clipboard.writeText(bibleText)

      showToast('Gantt Bible copied to clipboard!', 'success')
    } catch (err) {
      console.error('Failed to copy Gantt Bible:', err)
      showToast('Failed to copy Gantt Bible', 'error')
    }
  }

  const handleCopyGanttBugHunter = async () => {
    try {
      // Fetch the Gantt Bug Hunter Lexicon (bugs and fixes)
      const response = await fetch('/GANTT_BUG_HUNTER_LEXICON.md')
      if (!response.ok) {
        throw new Error('Failed to load Gantt Bug Hunter Lexicon')
      }

      const bugHunterText = await response.text()

      // Copy to clipboard
      await navigator.clipboard.writeText(bugHunterText)

      showToast('Gantt Bug Hunter Lexicon copied to clipboard!', 'success')
    } catch (err) {
      console.error('Failed to copy Gantt Bug Hunter Lexicon:', err)
      showToast('Failed to copy Gantt Bug Hunter', 'error')
    }
  }

  const handleCopyTestStatus = async () => {
    try {
      // Get Bug Hunter report from global instance
      if (!window.ganttBugHunter) {
        showToast('Bug Hunter not initialized - perform operations first', 'warning')
        return
      }

      const report = window.ganttBugHunter.generateReport()

      // Format as markdown table
      let markdown = '# Gantt Bug Hunter - Test Status Report\n\n'
      markdown += `**Generated:** ${getNowInCompanyTimezone().toLocaleString()}\n\n`
      markdown += `**Overall Status:** ${report.health.status.toUpperCase()}\n\n`

      markdown += '## Summary\n\n'
      markdown += `- API Calls: ${report.summary.apiCalls}\n`
      markdown += `- Gantt Reloads: ${report.summary.ganttReloads}\n`
      markdown += `- Drag Operations: ${report.summary.dragOperations}\n`
      markdown += `- Cascade Events: ${report.summary.cascadeEvents}\n`
      markdown += `- Warnings: ${report.summary.warnings}\n`
      markdown += `- Errors: ${report.summary.errors}\n\n`

      markdown += '## Test Results\n\n'
      markdown += '| # | Test Name | Status | Details |\n'
      markdown += '|---|-----------|--------|----------|\n'

      const tests = [
        'Duplicate API Call Detection',
        'Excessive Gantt Reload Detection',
        'Slow Drag Operation Detection',
        'API Call Pattern Analysis',
        'Cascade Event Tracking',
        'State Update Batching',
        'Lock State Monitoring',
        'Performance Timing Analysis',
        'Health Status Assessment',
        'Actionable Recommendations'
      ]

      tests.forEach((name, idx) => {
        const status = report.health.status === 'healthy' ? '✅ PASS'
          : report.health.status === 'warning' ? '⚠️ WARNING'
          : '❌ FAIL'
        markdown += `| ${idx + 1} | ${name} | ${status} | See report |\n`
      })

      markdown += '\n## Detailed Report\n\n'
      markdown += '```json\n'
      markdown += JSON.stringify(report, null, 2)
      markdown += '\n```\n'

      // Copy to clipboard
      await navigator.clipboard.writeText(markdown)

      showToast('Test Status copied to clipboard!', 'success')
    } catch (err) {
      console.error('Failed to copy Test Status:', err)
      showToast('Failed to copy Test Status', 'error')
    }
  }

  const handleCopyGanttRules = async () => {
    try {
      // Fetch the Gantt rules file from the project root
      const response = await fetch('/GANTT_SCHEDULE_RULES.md')
      if (!response.ok) {
        throw new Error('Failed to load Gantt rules')
      }

      const rulesText = await response.text()

      // Copy to clipboard
      await navigator.clipboard.writeText(rulesText)

      showToast('Gantt rules copied to clipboard!', 'success')
    } catch (err) {
      console.error('Failed to copy Gantt rules:', err)
      showToast('Failed to copy Gantt rules', 'error')
    }
  }

  const handleExportToExcel = () => {
    if (!selectedTemplate || rows.length === 0) {
      showToast('No data to export', 'error')
      return
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()

    // Helper function to format predecessors with Excel row numbers (including header)
    const formatPredecessorsForExcel = (predecessorIds) => {
      if (!predecessorIds || predecessorIds.length === 0) return ''

      return predecessorIds.map(pred => {
        const taskId = pred.id || pred['id']
        const depType = pred.type || pred['type'] || 'FS'
        const lag = (pred.lag || pred['lag'] || 0)

        // Add 1 to task ID to account for Excel header row
        // Task 1 becomes row 2, task 2 becomes row 3, etc.
        let result = `${taskId + 1}${depType}`
        if (lag !== 0) {
          result += lag >= 0 ? `+${lag}` : lag
        }
        return result
      }).join(', ')
    }

    // Prepare header row with individual documentation category columns
    const headerRow = [
      'Task Name', 'Supplier', 'Predecessors', 'Duration', 'Start Date',
      // Add a column for each documentation category
      ...documentationCategories.map(cat => cat.name),
      'PO Required', 'Auto PO', 'Critical', 'Tags', 'Photo', 'Cert', 'Cert Lag',
      'Manual', 'Multi', 'Order Time', 'Call Up', 'Plan'
    ]

    // Prepare data rows
    const data = rows.map(row => [
      row.name || '',
      row.supplier_name || '',
      formatPredecessorsForExcel(row.predecessor_ids),
      row.duration || 0,
      row.start_date || 0,
      // Add Yes/No for each documentation category
      ...documentationCategories.map(cat =>
        (row.documentation_category_ids || []).includes(cat.id) ? 'Yes' : 'No'
      ),
      row.po_required ? 'Yes' : 'No',
      row.create_po_on_job_start ? 'Yes' : 'No',
      row.critical_po ? 'Yes' : 'No',
      (row.tags || []).join(', '),
      row.require_photo ? 'Yes' : 'No',
      row.require_certificate ? 'Yes' : 'No',
      row.cert_lag_days || 0,
      row.manual_task ? 'Yes' : 'No',
      row.allow_multiple_instances ? 'Yes' : 'No',
      row.order_required ? 'Yes' : 'No',
      row.call_up_required ? 'Yes' : 'No',
      row.plan_required ? 'Yes' : 'No'
    ])

    // Create worksheet from headers and data
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...data])

    // Set column widths
    const baseColumns = [
      { wch: 30 }, // Task Name
      { wch: 20 }, // Supplier
      { wch: 15 }, // Predecessors
      { wch: 10 }, // Duration
      { wch: 12 }, // Start Date
    ]

    // Add column widths for each documentation category
    const docCategoryColumns = documentationCategories.map(() => ({ wch: 12 }))

    const remainingColumns = [
      { wch: 12 }, // PO Required
      { wch: 10 }, // Auto PO
      { wch: 10 }, // Critical
      { wch: 20 }, // Tags
      { wch: 8 },  // Photo
      { wch: 8 },  // Cert
      { wch: 10 }, // Cert Lag
      { wch: 10 }, // Manual
      { wch: 8 },  // Multi
      { wch: 12 }, // Order Time
      { wch: 10 }, // Call Up
      { wch: 8 }   // Plan
    ]

    ws['!cols'] = [...baseColumns, ...docCategoryColumns, ...remainingColumns]

    XLSX.utils.book_append_sheet(wb, ws, 'Tasks')

    // Generate filename with template name and date
    const date = getTodayAsString()
    const filename = `${selectedTemplate.name.replace(/[^a-z0-9]/gi, '_')}_${date}.xlsx`

    // Write file
    XLSX.writeFile(wb, filename)
    showToast('Template exported successfully', 'success')
  }

  const handleImportFromExcel = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet)

        if (jsonData.length === 0) {
          showToast('No data found in Excel file', 'error')
          return
        }

        // Helper function to parse predecessors from format "2FS+3, 5SS-1"
        // Note: Excel row numbers include the header, so row 2 = task 1, row 3 = task 2, etc.
        // We need to subtract 1 to convert from Excel row number to task sequence number
        const parsePredecessors = (predecessorStr, currentRowIndex) => {
          if (!predecessorStr || predecessorStr === 'None' || predecessorStr.trim() === '') {
            return []
          }

          const predecessors = []
          const parts = predecessorStr.split(',').map(p => p.trim())

          for (const part of parts) {
            // Parse format like "2FS+3" (where 2 is the Excel row number including header)
            const match = part.match(/^(\d+)([A-Z]{2})([+-]?\d+)?$/)
            if (match) {
              const excelRowNumber = parseInt(match[1])
              // Convert Excel row number to task sequence (Excel row 2 = task 1, so subtract 1)
              const taskSequence = excelRowNumber - 1

              // Only add valid predecessors (must reference earlier tasks)
              if (taskSequence > 0 && taskSequence <= currentRowIndex + 1) {
                predecessors.push({
                  id: taskSequence,
                  type: match[2],
                  lag: match[3] ? parseInt(match[3]) : 0
                })
              }
            }
          }

          return predecessors
        }

        // Helper function to parse individual documentation category columns
        const parseDocumentationCategoryIds = (row) => {
          const categoryIds = []

          // Check each documentation category column
          documentationCategories.forEach(category => {
            if (row[category.name] === 'Yes') {
              categoryIds.push(category.id)
            }
          })

          return categoryIds
        }

        // Convert Excel data to task format
        const importedRows = jsonData.map((row, index) => ({
          name: row['Task Name'] || `Task ${index + 1}`,
          supplier_id: null, // Will need to be mapped manually
          predecessor_ids: parsePredecessors(row['Predecessors'], index),
          duration: parseInt(row['Duration']) || 0,
          start_date: parseInt(row['Start Date']) || 0,
          documentation_category_ids: parseDocumentationCategoryIds(row),
          po_required: row['PO Required'] === 'Yes',
          create_po_on_job_start: false, // Set to false on import - can enable manually after assigning supplier
          critical_po: row['Critical'] === 'Yes',
          tags: row['Tags'] ? row['Tags'].split(',').map(t => t.trim()) : [],
          require_photo: row['Photo'] === 'Yes',
          require_certificate: row['Cert'] === 'Yes',
          cert_lag_days: parseInt(row['Cert Lag']) || 0,
          manual_task: row['Manual'] === 'Yes',
          allow_multiple_instances: row['Multi'] === 'Yes',
          order_required: row['Order Time'] === 'Yes',
          call_up_required: row['Call Up'] === 'Yes',
          plan_required: row['Plan'] === 'Yes'
        }))

        // Bulk create rows
        for (const rowData of importedRows) {
          await api.post(`/api/v1/schedule_templates/${selectedTemplate.id}/rows`, {
            schedule_template_row: rowData
          })
        }

        showToast(`Imported ${importedRows.length} tasks successfully`, 'success')
        await loadTemplateRows(selectedTemplate.id)
      } catch (err) {
        console.error('Failed to import Excel file:', err)
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          response: err.response?.data,
          status: err.response?.status
        })

        const errorMessage = err.response?.data?.error ||
                           err.response?.data?.message ||
                           err.message ||
                           'Unknown error occurred'

        showToast(`Failed to import: ${errorMessage}`, 'error')
      }
    }
    reader.readAsArrayBuffer(file)

    // Reset file input
    event.target.value = ''
  }

  const handleAddRow = async () => {
    if (!selectedTemplate) return

    const newRow = {
      name: 'New Task',
      supplier_id: null,
      assigned_role: null,
      predecessor_ids: [],
      duration: 0,
      start_date: 0,
      po_required: false,
      create_po_on_job_start: false,
      price_book_item_ids: [],
      critical_po: false,
      tags: [],
      require_photo: false,
      require_certificate: false,
      cert_lag_days: 10,
      require_supervisor_check: false,
      auto_complete_predecessors: false,
      has_subtasks: false,
      subtask_count: 0,
      subtask_names: [],
      linked_task_ids: [],
      linked_template_id: null,
      sequence_order: rows.length
    }

    try {
      console.log('🐛 handleAddRow: Creating new task')
      const response = await api.post(
        `/api/v1/schedule_templates/${selectedTemplate.id}/rows`,
        { schedule_template_row: newRow }
      )
      console.log('🐛 handleAddRow: Task created with ID:', response.id)
      console.log('🐛 handleAddRow: Adding to rows state')
      setRows(prevRows => [...prevRows, response])
      console.log('🐛 handleAddRow: Task added to state')
      showToast('Row added', 'success')
    } catch (err) {
      console.error('Failed to add row:', err)
      showToast('Failed to add row', 'error')
    }
  }

  // Apply batched cascade updates in a single state update (prevents multiple Gantt reloads)
  const applyBatchedCascadeUpdates = useCallback(() => {
    if (cascadeUpdatesRef.current.size === 0) return

    console.log(`📦 Applying ${cascadeUpdatesRef.current.size} batched cascade updates`)

    // CRITICAL: Update pending values map to prevent infinite loops
    // When we apply batched cascades, we need to update pendingUpdatesRef
    // so that subsequent handleUpdateRow calls know these values are already applied
    cascadeUpdatesRef.current.forEach((response, rowId) => {
      console.log(`🔍 Cascade response for row ${rowId}:`, response)
      // Update pending map with the new values from the cascade response
      if (response.start_date !== undefined) {
        const key = `${rowId}:start_date`
        console.log(`🔧 Updating pending map: ${key} = ${response.start_date}`)
        pendingUpdatesRef.current.set(key, response.start_date)
      }
      if (response.duration !== undefined) {
        const key = `${rowId}:duration`
        pendingUpdatesRef.current.set(key, response.duration)
      }
    })

    setRows(prevRows => {
      let updated = [...prevRows]
      cascadeUpdatesRef.current.forEach((response, rowId) => {
        const index = updated.findIndex(r => r && r.id === rowId)
        if (index !== -1) {
          console.log(`🔍 Updating row ${rowId} in state: current start_date=${updated[index].start_date} → new start_date=${response.start_date}`)
          updated[index] = response
        } else {
          console.warn(`⚠️ Row ${rowId} not found in state`)
        }
      })
      return updated
    })

    // Clear batch
    cascadeUpdatesRef.current.clear()
  }, [])

  // Actual update function that makes API calls
  const handleUpdateRowImmediate = async (rowId, updates, options = {}) => {
    try {
      console.log('🐛 ScheduleTemplateEditor: handleUpdateRow called')
      console.log('  - Row ID:', rowId)
      console.log('  - Updates:', updates)
      console.log('  - Options:', options)

      // ANTI-LOOP: Deduplicate updates - skip API call if same update is already pending or matches current state
      const currentRow = rows.find(r => r && r.id === rowId)
      if (currentRow) {
        // ATOMIC: Check and set pending in one pass to prevent race conditions
        // Multiple synchronous calls were checking the empty pending map before any set values
        const fieldsToUpdate = []

        // DEBUG: Log the entire pending map
        console.log(`🔍 DEBUG - Checking row ${rowId} | Pending map size: ${pendingUpdatesRef.current.size}`)
        if (pendingUpdatesRef.current.size > 0) {
          console.log('🔍 DEBUG - Current pending values:', Array.from(pendingUpdatesRef.current.entries()))
        }

        for (const key of Object.keys(updates)) {
          const newValue = updates[key]
          const currentValue = currentRow[key]
          const pendingKey = `${rowId}:${key}`
          const pendingValue = pendingUpdatesRef.current.get(pendingKey)

          console.log(`🔍 DEBUG - Field ${key}: pending=${pendingValue}, current=${currentValue}, new=${newValue}`)

          // Check if this exact update is already pending
          if (pendingValue !== undefined) {
            const pendingMatches = Array.isArray(newValue)
              ? JSON.stringify(newValue) === JSON.stringify(pendingValue)
              : newValue === pendingValue

            console.log(`🔍 DEBUG - Pending check: ${pendingValue} vs ${newValue} → matches=${pendingMatches}`)

            if (pendingMatches) {
              console.log(`⏭️ Skipping ${key} update - same value already pending`)
              continue // Skip this field
            }
          }

          // Check against current state
          let valueChanged = false
          if (Array.isArray(newValue) && Array.isArray(currentValue)) {
            valueChanged = JSON.stringify(newValue) !== JSON.stringify(currentValue)
          } else {
            valueChanged = newValue !== currentValue
          }

          console.log(`🔍 DEBUG - State check: ${currentValue} vs ${newValue} → changed=${valueChanged}`)

          // CRITICAL: Clear pending value if current state already matches it
          // This prevents infinite loops where pending values persist after state updates
          if (pendingValue !== undefined && !valueChanged) {
            const pendingMatchesState = Array.isArray(currentValue)
              ? JSON.stringify(currentValue) === JSON.stringify(pendingValue)
              : currentValue === pendingValue

            if (pendingMatchesState) {
              console.log(`🧹 Clearing verified pending: ${pendingKey} (state matches pending)`)
              pendingUpdatesRef.current.delete(pendingKey)
            }
          }

          if (valueChanged) {
            // ATOMIC: Set pending IMMEDIATELY when field needs updating
            console.log(`🔍 DEBUG - Setting pending: ${pendingKey} = ${newValue}`)
            pendingUpdatesRef.current.set(pendingKey, newValue)
            fieldsToUpdate.push(key)
          }
        }

        if (fieldsToUpdate.length === 0) {
          console.log('⏭️ Skipping API call - no actual changes detected (all updates match pending or current state)')
          return currentRow
        }

        console.log(`✅ Proceeding with API call - ${fieldsToUpdate.length} fields to update:`, fieldsToUpdate)
      }

      // CRITICAL: Detect cascade updates BEFORE optimistic update
      // Cascade updates are start_date-only changes from backend dependency calculations
      const predecessorsChanged = updates.predecessor_ids !== undefined
      const durationChanged = updates.duration !== undefined
      const onlyStartDateChanged = updates.start_date !== undefined &&
                                   !predecessorsChanged &&
                                   !durationChanged

      // ANTI-FLICKER: Skip optimistic update for cascade updates (they'll be batched)
      // Only apply optimistic update for direct user edits (not start_date-only backend cascades)
      if (!onlyStartDateChanged) {
        // Optimistically update the row immediately to prevent flashing
        setRows(prevRows => {
          const existingRowIndex = prevRows.findIndex(r => r && r.id === rowId)

          if (existingRowIndex !== -1) {
            // Update existing row
            return prevRows.map(r => (r && r.id === rowId) ? { ...r, ...updates } : r)
          } else {
            // Row doesn't exist yet (race condition during create), skip optimistic update
            console.log('⚠️ Skipping optimistic update - row not found:', rowId)
            // Return prevRows unchanged (don't filter out undefined elements)
            return prevRows
          }
        })
      } else {
        console.log('⚡ Skipping optimistic update for cascade (start_date-only) - will batch')
      }

      // Make API call in background
      // BUG HUNTER: Track API call
      bugHunter.trackApiCall('PATCH', `/api/v1/schedule_templates/${selectedTemplate.id}/rows/${rowId}`, rowId, updates)

      const response = await api.patch(
        `/api/v1/schedule_templates/${selectedTemplate.id}/rows/${rowId}`,
        { schedule_template_row: updates }
      )

      // Check if backend returned cascaded tasks (new format)
      const hasCascadedTasks = response.cascaded_tasks && response.cascaded_tasks.length > 0
      const mainTask = response.task || response // Support both new format {task, cascaded_tasks} and old format

      if (hasCascadedTasks) {
        // Backend handled cascading - apply ALL tasks in one batch
        console.log(`🔄 Backend cascaded to ${response.cascaded_tasks.length} dependent tasks - applying batch update`)

        // CRITICAL: Clear frontend batch queue - backend has already calculated everything!
        // This prevents stale queued updates from being applied after backend's correct values
        if (cascadeBatchTimeoutRef.current) {
          console.log('🧹 Clearing frontend cascade batch queue - backend handled it')
          clearTimeout(cascadeBatchTimeoutRef.current)
          cascadeBatchTimeoutRef.current = null
        }
        cascadeUpdatesRef.current.clear()

        // BUG HUNTER: Track cascade event
        bugHunter.trackCascade(rowId, response.cascaded_tasks.map(t => t.id))

        const allAffectedTasks = [mainTask, ...response.cascaded_tasks]

        // BUG HUNTER: Track state update
        bugHunter.trackStateUpdate(`Backend cascade update for task ${rowId}`, allAffectedTasks.map(t => t.id))

        // CRITICAL: Reset cascade depth to 1 for new cascade operation
        // If user drags again before previous cascade completes, we want to start fresh
        // This prevents depth counter from accumulating across rapid consecutive drags

        // Cancel all pending cascade depth release timeouts
        cascadeDepthTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId))
        cascadeDepthTimeouts.current = []

        const previousDepth = cascadeDepthRef.current
        cascadeDepthRef.current = 1
        isApplyingCascadeRef.current = true
        if (previousDepth > 0) {
          console.log(`🔄 Resetting cascade depth from ${previousDepth} to 1 (new drag started)`)
        }
        console.log(`🔒 Cascade depth: ${cascadeDepthRef.current} - blocking handleUpdateRow`)

        // CRITICAL: Update pending values map to prevent infinite loops
        // When backend applies cascade updates, update pendingUpdatesRef so subsequent
        // handleUpdateRow calls know these values are already applied
        allAffectedTasks.forEach(task => {
          if (task.start_date !== undefined) {
            const key = `${task.id}:start_date`
            console.log(`🔧 Backend batch - Updating pending map: ${key} = ${task.start_date}`)
            pendingUpdatesRef.current.set(key, task.start_date)
          }
          if (task.duration !== undefined) {
            const key = `${task.id}:duration`
            pendingUpdatesRef.current.set(key, task.duration)
          }
        })

        // Update all affected tasks in a single state update (no flicker!)
        setRows(prevRows => {
          const updatedRows = [...prevRows]
          allAffectedTasks.forEach(task => {
            const index = updatedRows.findIndex(r => r && r.id === task.id)
            if (index !== -1) {
              updatedRows[index] = task
            }
          })
          return updatedRows
        })

        // Decrement cascade depth after React has updated the DOM AND Gantt has fired all events
        // Use 750ms to ensure ALL Gantt's onAfterTaskUpdate events complete before releasing flag
        // CRITICAL: This must be long enough for Gantt to finish processing all cascade events
        // Including nested cascades that spawn more cascades and multiple event waves
        const timeoutId = setTimeout(() => {
          cascadeDepthRef.current--
          console.log(`🔓 Cascade depth: ${cascadeDepthRef.current}`)

          // Only release blocking flag when ALL cascades complete (depth = 0)
          if (cascadeDepthRef.current === 0) {
            isApplyingCascadeRef.current = false
            console.log('✅ ALL cascades complete - handleUpdateRow re-enabled')

            // ANTI-SHAKE FIX: Trigger a state update to allow Gantt reload now that cascades are done
            // This ensures all cascade updates are displayed in one final reload
            setRows(prevRows => [...prevRows])
          } else {
            console.log('⏳ Waiting for nested cascades to complete...')
          }

          // Remove this timeout from the tracking array
          cascadeDepthTimeouts.current = cascadeDepthTimeouts.current.filter(id => id !== timeoutId)
        }, 750)

        // Track this timeout so it can be cancelled if user drags again
        cascadeDepthTimeouts.current.push(timeoutId)

        console.log('✅ Applied batch update for', allAffectedTasks.length, 'tasks')

        return mainTask
      }

      // Old flow: Backend didn't cascade, handle normally
      // Only reload if predecessors or duration changed (affects other tasks' calculations)
      // Skip reload for start_date-only updates (dragging or auto-cascade from dependencies)
      const needsReload = (predecessorsChanged || durationChanged) && !options.skipReload

      if (needsReload) {
        // Only reload all rows if dependencies/duration changed (affects other rows)
        console.log('🔄 Reloading all rows (calculation fields changed)')
        await loadTemplateRows(selectedTemplate.id, false) // false = don't show loading spinner
      } else if (onlyStartDateChanged) {
        // CRITICAL: Batch cascade updates to prevent multiple Gantt reloads
        // When backend sends cascade updates for dependent tasks, batch them together
        console.log('✋ Batching cascade update (start_date-only) - will apply in batch')

        // Add to batch
        cascadeUpdatesRef.current.set(rowId, mainTask)

        // Clear existing timeout
        if (cascadeBatchTimeoutRef.current) {
          clearTimeout(cascadeBatchTimeoutRef.current)
        }

        // Apply all batched updates after 100ms (allows multiple cascade updates to queue)
        cascadeBatchTimeoutRef.current = setTimeout(() => {
          applyBatchedCascadeUpdates()
          cascadeBatchTimeoutRef.current = null
        }, 100)
      } else {
        // Not a cascade update - apply immediately
        setRows(prevRows => {
          const existingRowIndex = prevRows.findIndex(r => r && r.id === rowId)

          if (existingRowIndex !== -1) {
            // Update existing row with server response
            console.log('📥 Updating row in state with server response:', mainTask)
            return prevRows.map(r => (r && r.id === rowId) ? mainTask : r)
          } else {
            // Row doesn't exist (race condition during create)
            // Force a full reload to get the latest state including the new task
            console.log('⚠️ Row not found in state, triggering reload:', rowId)
            loadTemplateRows(selectedTemplate.id, false)
            // Return prevRows unchanged (don't filter out undefined elements)
            return prevRows
          }
        })
      }

      return mainTask
    } catch (err) {
      console.error('❌ Failed to update row:', err)

      // Clear pending values on error so they can be retried
      Object.keys(updates).forEach(key => {
        const pendingKey = `${rowId}:${key}`
        console.log(`🧹 Clearing pending (error): ${pendingKey}`)
        pendingUpdatesRef.current.delete(pendingKey)
      })

      // Revert optimistic update on error (without loading spinner)
      await loadTemplateRows(selectedTemplate.id, false)
      showToast('Failed to update row', 'error')
      throw err
    }
  }

  // Deduplication wrapper - consolidates rapid updates to same task
  const handleUpdateRow = (rowId, updates, options = {}) => {
    // Detect if this is a cascade update (start_date-only change)
    const isCascadeUpdate = updates.start_date !== undefined &&
                           updates.predecessor_ids === undefined &&
                           updates.duration === undefined

    // Use longer window for cascade updates to catch all waves
    const dedupWindow = isCascadeUpdate ? CASCADE_DEDUP_WINDOW_MS : DEDUP_WINDOW_MS

    // Get existing queue entry for this task
    const existing = updateQueueRef.current.get(rowId)

    if (existing) {
      console.log(`🔄 Deduplicating ${isCascadeUpdate ? 'CASCADE' : 'USER'} update for task ${rowId} - merging with queued update`)
      console.log(`   Existing updates:`, existing.updates)
      console.log(`   New updates:`, updates)
    }

    // Merge updates
    const mergedUpdates = existing ? { ...existing.updates, ...updates } : { ...updates }
    const mergedOptions = existing ? { ...existing.options, ...options } : { ...options }

    if (existing) {
      console.log(`   Merged updates:`, mergedUpdates)
    }

    // Clear existing timeout
    if (existing?.timeout) {
      clearTimeout(existing.timeout)
    }

    // Set new timeout to flush after dedup window
    const timeout = setTimeout(() => {
      console.log(`⚡ Flushing deduplicated ${isCascadeUpdate ? 'CASCADE' : 'USER'} update for task ${rowId}`)
      updateQueueRef.current.delete(rowId)
      handleUpdateRowImmediate(rowId, mergedUpdates, mergedOptions)
    }, dedupWindow)

    // Store in queue
    updateQueueRef.current.set(rowId, { updates: mergedUpdates, options: mergedOptions, timeout })
  }

  const handleDeleteRow = async (rowId) => {
    if (!confirm('Delete this row?')) return

    try {
      await api.delete(`/api/v1/schedule_templates/${selectedTemplate.id}/rows/${rowId}`)
      setRows(prevRows => prevRows.filter(r => r.id !== rowId))
      showToast('Row deleted', 'success')
    } catch (err) {
      console.error('Failed to delete row:', err)
      showToast('Failed to delete row', 'error')
    }
  }

  const handleMoveRow = async (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1

    // Optimistically update the UI using functional update
    let reorderedRowIds = null
    setRows(prevRows => {
      if (newIndex < 0 || newIndex >= prevRows.length) return prevRows

      const newRows = [...prevRows]
      ;[newRows[index], newRows[newIndex]] = [newRows[newIndex], newRows[index]]

      // Store IDs for API call
      reorderedRowIds = newRows.map(r => r.id)

      return newRows
    })

    // If validation failed, bail out
    if (!reorderedRowIds) return

    try {
      await api.post(
        `/api/v1/schedule_templates/${selectedTemplate.id}/rows/reorder`,
        { row_ids: reorderedRowIds }
      )

      // Reload to get updated predecessor_ids from backend
      await loadTemplateRows(selectedTemplate.id, false)
      showToast('Row reordered successfully', 'success')
    } catch (err) {
      console.error('Failed to reorder rows:', err)
      showToast('Failed to reorder rows', 'error')
      // Reload to restore correct order on error
      await loadTemplateRows(selectedTemplate.id, false)
    }
  }

  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Handle closing Gantt view and removing URL parameter
  const handleCloseGantt = () => {
    setShowGanttView(false)

    // Remove openGantt parameter from URL to prevent auto-reopening
    const params = new URLSearchParams(location.search)
    if (params.has('openGantt')) {
      params.delete('openGantt')
      const newSearch = params.toString()
      navigate({
        pathname: location.pathname,
        search: newSearch ? `?${newSearch}` : ''
      }, { replace: true })
    }
  }

  // Row selection handlers
  const handleSelectRow = (rowId) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId)
    } else {
      newSelected.add(rowId)
    }
    setSelectedRows(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedRows.size === filteredAndSortedRows.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredAndSortedRows.map(r => r.id)))
    }
  }

  const handleBulkUpdate = async (field, value) => {
    if (selectedRows.size === 0) return

    try {
      const updates = Array.from(selectedRows).map(rowId => ({
        id: rowId,
        [field]: value
      }))

      // Update all selected rows
      await Promise.all(
        updates.map(update =>
          api.patch(
            `/api/v1/schedule_templates/${selectedTemplate.id}/rows/${update.id}`,
            { schedule_template_row: { [field]: value } }
          )
        )
      )

      // Reload all rows (without loading spinner to prevent flash)
      await loadTemplateRows(selectedTemplate.id, false)
      setSelectedRows(new Set())
      showToast(`Updated ${updates.length} rows`, 'success')
    } catch (err) {
      console.error('Failed to bulk update rows:', err)
      showToast('Failed to bulk update rows', 'error')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return
    if (!confirm(`Delete ${selectedRows.size} selected rows?`)) return

    try {
      await Promise.all(
        Array.from(selectedRows).map(rowId =>
          api.delete(`/api/v1/schedule_templates/${selectedTemplate.id}/rows/${rowId}`)
        )
      )

      setRows(prevRows => prevRows.filter(r => !selectedRows.has(r.id)))
      setSelectedRows(new Set())
      showToast(`Deleted ${selectedRows.size} rows`, 'success')
    } catch (err) {
      console.error('Failed to bulk delete rows:', err)
      showToast('Failed to bulk delete rows', 'error')
    }
  }

  // Column configuration handlers
  const handleColumnVisibilityChange = (columnKey, visible) => {
    const newConfig = {
      ...columnConfig,
      [columnKey]: { ...columnConfig[columnKey], visible }
    }
    setColumnConfig(newConfig)
    localStorage.setItem('scheduleTemplateColumnConfig', JSON.stringify(newConfig))
  }

  const handleResetColumns = () => {
    setColumnConfig(defaultColumnConfig)
    localStorage.removeItem('scheduleTemplateColumnConfig')
  }

  // Column drag/reorder handlers
  const handleDragStart = (e, columnKey) => {
    // Don't start drag if clicking on interactive elements
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL' || e.target.tagName === 'BUTTON') {
      e.preventDefault()
      return
    }

    e.stopPropagation()
    setDraggedColumn(columnKey)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', columnKey)
  }

  const handleDragOver = (e, targetColumnKey) => {
    e.preventDefault()
    e.stopPropagation()

    // Check if drag is valid
    if (draggedColumn && targetColumnKey) {
      const draggedConfig = columnConfig[draggedColumn]
      const targetConfig = columnConfig[targetColumnKey]
      const draggedIsDocTab = draggedConfig?.isDocTabColumn || false
      const targetIsDocTab = targetConfig?.isDocTabColumn || false

      // If trying to move between groups, show "not allowed" cursor
      if (draggedIsDocTab !== targetIsDocTab) {
        e.dataTransfer.dropEffect = 'none'
        return
      }
    }

    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e, targetColumnKey) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null)
      return
    }

    const draggedConfig = columnConfig[draggedColumn]
    const targetConfig = columnConfig[targetColumnKey]

    // Check if both are doc tab columns or both are not
    const draggedIsDocTab = draggedConfig?.isDocTabColumn || false
    const targetIsDocTab = targetConfig?.isDocTabColumn || false

    // Prevent moving doc tab columns outside their group
    if (draggedIsDocTab !== targetIsDocTab) {
      setDraggedColumn(null)
      return
    }

    // Get current orders
    const draggedOrder = draggedConfig.order
    const targetOrder = targetConfig.order

    // Create new config with swapped orders
    const newConfig = { ...columnConfig }

    // Swap the orders
    newConfig[draggedColumn] = { ...newConfig[draggedColumn], order: targetOrder }
    newConfig[targetColumnKey] = { ...newConfig[targetColumnKey], order: draggedOrder }

    setColumnConfig(newConfig)
    localStorage.setItem('scheduleTemplateColumnConfig', JSON.stringify(newConfig))
    setDraggedColumn(null)
  }

  const handleDragEnd = (e) => {
    e.preventDefault()
    setDraggedColumn(null)
  }

  // Sort handler
  const handleSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(columnKey)
      setSortDirection('asc')
    }
  }

  // Column resize handlers (like PriceBooksPage)
  const handleResizeStart = (e, columnKey) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnKey)
    setResizeStartX(e.clientX)
    setResizeStartWidth(columnConfig[columnKey].width)
  }

  const handleResizeMove = useCallback((e) => {
    if (!resizingColumn) return
    const diff = e.clientX - resizeStartX
    const newWidth = Math.max(50, resizeStartWidth + diff)

    const newConfig = {
      ...columnConfig,
      [resizingColumn]: { ...columnConfig[resizingColumn], width: newWidth }
    }
    setColumnConfig(newConfig)
  }, [resizingColumn, resizeStartX, resizeStartWidth, columnConfig])

  const handleResizeEnd = useCallback(() => {
    if (resizingColumn) {
      // Save to localStorage when resize ends
      localStorage.setItem('scheduleTemplateColumnConfig', JSON.stringify(columnConfig))
      setResizingColumn(null)
    }
  }, [resizingColumn, columnConfig])

  // Add mouse event listeners for column resizing
  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd])

  // Get sorted column entries by order
  const getSortedColumns = () => {
    return Object.entries(columnConfig)
      .sort(([, a], [, b]) => a.order - b.order)
  }

  // Column tooltips mapping
  const columnTooltips = {
    taskName: "The name of the task that will appear in the schedule. Be descriptive so builders know exactly what needs to be done.",
    supplierGroup: "For PO tasks: select a supplier. For internal work: assign to a team (Admin, Sales, Site, Supervisor, Builder, Estimator).",
    predecessors: "Tasks that must be completed before this one starts. Supports FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), and SF (Start-to-Finish) dependencies with lag days.",
    duration: "Number of days this task will take to complete.",
    startDate: "Calculated start date based on predecessors and durations. Tasks with no predecessors start on Day 0 (project start).",
    poRequired: "Check if this task requires a purchase order. This tracks whether a PO is needed, but doesn't automatically create one.",
    autoPo: "Automatically create and send a purchase order to the supplier when the job starts. Requires a supplier to be selected.",
    priceItems: "Link price book items to this task. These items will be included in the auto-generated purchase order.",
    critical: "Mark this PO as critical priority. Critical POs will be highlighted and require immediate attention.",
    tags: "Add tags to categorize and filter tasks (e.g., 'electrical', 'foundation', 'inspection'). Useful for filtering views by trade.",
    photo: "Automatically spawn a photo task when this task is completed. Use for tasks that need photo documentation.",
    cert: "Automatically spawn a certificate task when this task is completed. Used for regulatory certifications and compliance documents.",
    certLag: "Number of days after task completion when the certificate is due. Default is 10 days.",
    supCheck: "Require a supervisor to check in on this task. Supervisor will get a prompt to visit the site and verify quality.",
    autoComplete: "Select specific tasks that should be automatically marked as complete when this task is completed. Useful for milestone tasks that signal the completion of multiple other tasks.",
    subtasks: "Automatically create subtasks when this task starts. Useful for breaking down complex tasks into smaller steps.",
    linkedTasks: "Link this task to other tasks in the schedule. Useful for grouping related tasks or creating task dependencies across templates.",
    manualTask: "Manual task - never gets automatically loaded or activated in the schedule. Must be manually created.",
    multipleItems: "When this task is completed, user will be prompted if they need another instance (e.g., 'Frame Inspection', 'Frame Inspection 2', etc.).",
    orderRequired: "Order time required from pricebook items. Tracks order placement timeline requirements.",
    callUpRequired: "Call up time required from pricebook items. Tracks call-up/booking timeline requirements.",
    planType: "This task is for documents that only get activated if a plan tab is selected. Select the plan/drawing type."
  }

  // Handle column filter change
  const handleColumnFilterChange = (columnKey, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }))
  }

  // Filter and sort rows
  const filteredAndSortedRows = (() => {
    // First, filter rows based on search query and column filters
    const filtered = rows.filter(row => {
      // Safety check - skip undefined rows
      if (!row || !row.id) return false

      // Global search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesGlobal = (
          row.name.toLowerCase().includes(query) ||
          (row.supplier_name && row.supplier_name.toLowerCase().includes(query)) ||
          (row.assigned_role && row.assigned_role.toLowerCase().includes(query)) ||
          (row.tags && row.tags.some(tag => tag.toLowerCase().includes(query)))
        )
        if (!matchesGlobal) return false
      }

      // Column-specific filters
      for (const [columnKey, filterValue] of Object.entries(columnFilters)) {
        if (!filterValue || !filterValue.trim()) continue

        const filter = filterValue.toLowerCase()
        let matches = false

        switch (columnKey) {
          case 'taskName':
            matches = row.name.toLowerCase().includes(filter)
            break
          case 'supplierGroup':
            matches = (row.supplier_name && row.supplier_name.toLowerCase().includes(filter)) ||
                     (row.assigned_role && row.assigned_role.toLowerCase().includes(filter))
            break
          case 'tags':
            matches = row.tags && row.tags.some(tag => tag.toLowerCase().includes(filter))
            break
          default:
            matches = true
        }

        if (!matches) return false
      }

      return true
    })

    // Then, sort the filtered rows
    if (sortBy && sortBy !== 'sequence') {
      return [...filtered].sort((a, b) => {
        let aVal, bVal

        switch (sortBy) {
          case 'taskName':
            aVal = a.name || ''
            bVal = b.name || ''
            break
          case 'supplierGroup':
            aVal = a.supplier_name || a.assigned_role || ''
            bVal = b.supplier_name || b.assigned_role || ''
            break
          case 'predecessors':
            aVal = a.predecessor_display || ''
            bVal = b.predecessor_display || ''
            break
          case 'tags':
            aVal = a.tags?.join(', ') || ''
            bVal = b.tags?.join(', ') || ''
            break
          case 'poRequired':
          case 'autoPo':
          case 'critical':
          case 'photo':
          case 'cert':
          case 'supCheck':
          case 'autoComplete':
          case 'lock':
            // Boolean columns
            aVal = a[sortBy === 'autoPo' ? 'create_po_on_job_start' :
                     sortBy === 'poRequired' ? 'po_required' :
                     sortBy === 'lock' ? 'manually_positioned' :
                     sortBy === 'critical' ? 'critical_po' :
                     sortBy === 'photo' ? 'require_photo' :
                     sortBy === 'cert' ? 'require_certificate' :
                     sortBy === 'supCheck' ? 'require_supervisor_check' :
                     'auto_complete_predecessors'] ? 1 : 0
            bVal = b[sortBy === 'autoPo' ? 'create_po_on_job_start' :
                     sortBy === 'poRequired' ? 'po_required' :
                     sortBy === 'lock' ? 'manually_positioned' :
                     sortBy === 'critical' ? 'critical_po' :
                     sortBy === 'photo' ? 'require_photo' :
                     sortBy === 'cert' ? 'require_certificate' :
                     sortBy === 'supCheck' ? 'require_supervisor_check' :
                     'auto_complete_predecessors'] ? 1 : 0
            break
          case 'certLag':
            aVal = a.cert_lag_days || 0
            bVal = b.cert_lag_days || 0
            break
          case 'duration':
            aVal = a.duration || 0
            bVal = b.duration || 0
            break
          case 'startDate':
            aVal = a.start_date || 0
            bVal = b.start_date || 0
            break
          case 'priceItems':
            aVal = a.price_book_item_ids?.length || 0
            bVal = b.price_book_item_ids?.length || 0
            break
          case 'docTabs':
            aVal = a.documentation_category_ids?.length || 0
            bVal = b.documentation_category_ids?.length || 0
            break
          case 'subtasks':
            aVal = a.subtask_count || 0
            bVal = b.subtask_count || 0
            break
          default:
            // Handle dynamic doc category columns
            if (sortBy.startsWith('docTab_')) {
              const categoryId = columnConfig[sortBy]?.categoryId
              aVal = a.documentation_category_ids?.includes(categoryId) ? 1 : 0
              bVal = b.documentation_category_ids?.includes(categoryId) ? 1 : 0
            } else {
              return 0
            }
        }

        // String comparison
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal)
        }

        // Numeric comparison
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      })
    }

    return filtered
  })()

  return (
    <div className="max-w-full px-4 py-6 bg-white dark:bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Schedule Templates
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create reusable schedule templates with full task dependencies and automation
          </p>

          {/* Terminology Legend */}
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg max-w-3xl">
            <div className="flex items-center gap-2 text-xs">
              <InformationCircleIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="font-semibold text-blue-900 dark:text-blue-300">Terminology:</span>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-blue-800 dark:text-blue-200">
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRulesModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            title="View Gantt Bible - High-level guide Claude reads before starting work on Gantt code"
          >
            <BookOpenIcon className="h-5 w-5 mr-2" />
            Gantt Bible
          </button>
          <button
            onClick={() => setShowBugHunterModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            title="View Gantt Bug Hunter - Knowledge base of all previous bugs, fixes, and solutions"
          >
            <BookOpenIcon className="h-5 w-5 mr-2" />
            Gantt Bug Hunter
          </button>
          <div className="relative">
            <button
              onClick={() => setShowCopyDropdown(!showCopyDropdown)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              title="Copy Documentation to Clipboard"
            >
              <ClipboardDocumentIcon className="h-5 w-5 mr-2" />
              Copy Docs
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showCopyDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1" role="menu">
                  <button
                    onClick={() => {
                      handleCopyGanttBible()
                      setShowCopyDropdown(false)
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    role="menuitem"
                  >
                    <ClipboardDocumentIcon className="inline h-4 w-4 mr-2" />
                    Copy Gantt Bible
                  </button>
                  <button
                    onClick={() => {
                      handleCopyGanttBugHunter()
                      setShowCopyDropdown(false)
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    role="menuitem"
                  >
                    <ClipboardDocumentIcon className="inline h-4 w-4 mr-2" />
                    Copy Gantt Bug Hunter
                  </button>
                  <button
                    onClick={() => {
                      handleCopyTestStatus()
                      setShowCopyDropdown(false)
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                    role="menuitem"
                  >
                    <PlayIcon className="inline h-4 w-4 mr-2" />
                    Copy Test Status
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Template
          </button>
        </div>
      </div>

      {/* Template Selector */}
      <div className="mb-4 flex items-center gap-2">
        <select
          value={selectedTemplate?.id || ''}
          onChange={(e) => {
            const template = templates.find(t => t.id === parseInt(e.target.value))
            setSelectedTemplate(template)
          }}
          className="flex-1 max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} {template.is_default ? '(Default)' : ''}
            </option>
          ))}
        </select>

        {selectedTemplate && (
          <>
            <button
              onClick={handleDuplicateTemplate}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
              title="Duplicate Template"
            >
              <DocumentDuplicateIcon className="h-5 w-5" />
            </button>
            <button
              onClick={handleExportToExcel}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              title="Export to Excel"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </button>
            <label className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer" title="Import from Excel">
              <ArrowUpTrayIcon className="h-5 w-5" />
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFromExcel}
                className="hidden"
              />
            </label>
            {/* Gantt Chart Button */}
            <button
              onClick={() => setShowGanttView(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              title="View Gantt Chart"
            >
              <ChartBarIcon className="h-5 w-5" />
            </button>
            {!selectedTemplate.is_default && (
              <>
                <button
                  onClick={handleSetAsDefault}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                  title="Set as Default"
                >
                  <CheckIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={handleDeleteTemplate}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Delete Template"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Search Bar and Column Settings */}
      {selectedTemplate && !isLeftPanelCollapsed && (
        <div className="mb-4 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${rows.length} task${rows.length !== 1 ? 's' : ''} by name, supplier, group, or tags...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Column Settings Button */}
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Cog6ToothIcon className="h-4 w-4 mr-2" />
              Columns
            </button>

            {/* Quick Toggle Doc Tabs Button */}
            {documentationCategories.length > 0 && (
              <button
                onClick={() => {
                  const docTabColumns = Object.keys(columnConfig).filter(key => key.startsWith('docTab_'))
                  const allHidden = docTabColumns.every(key => !columnConfig[key]?.visible)

                  const newConfig = { ...columnConfig }
                  docTabColumns.forEach(key => {
                    newConfig[key] = { ...newConfig[key], visible: allHidden }
                  })

                  setColumnConfig(newConfig)
                  localStorage.setItem('scheduleTemplateColumnConfig', JSON.stringify(newConfig))
                }}
                className="inline-flex items-center px-3 py-1.5 border border-blue-300 dark:border-blue-600 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                title={(() => {
                  const docTabColumns = Object.keys(columnConfig).filter(key => key.startsWith('docTab_'))
                  const allHidden = docTabColumns.every(key => !columnConfig[key]?.visible)
                  return allHidden ? 'Show Documentation Tabs' : 'Hide Documentation Tabs'
                })()}
              >
                {(() => {
                  const docTabColumns = Object.keys(columnConfig).filter(key => key.startsWith('docTab_'))
                  const allHidden = docTabColumns.every(key => !columnConfig[key]?.visible)
                  return allHidden ? (
                    <>
                      <EyeIcon className="h-4 w-4 mr-1.5" />
                      <span>SDT</span>
                    </>
                  ) : (
                    <>
                      <EyeSlashIcon className="h-4 w-4 mr-1.5" />
                      <span>HDT</span>
                    </>
                  )
                })()}
              </button>
            )}
          </div>

          {/* Column Settings Panel - Simple toggle interface */}
          {showColumnSettings && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Column Visibility
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Drag to reorder • Toggle to show/hide • Resize by dragging column edges
                  </p>
                </div>
                <button
                  onClick={handleResetColumns}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline"
                >
                  Reset to Defaults
                </button>
              </div>
              <div className="space-y-4">
                {/* Standard columns */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                    Standard Columns
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {getSortedColumns().map(([key, config]) => {
                      // Don't show sequence, select, and actions in settings (always visible)
                      if (key === 'sequence' || key === 'actions' || key === 'select') return null
                      // Skip doc tab columns - they're shown in their own section
                      if (key.startsWith('docTab_')) return null

                      return (
                        <div
                          key={key}
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOver(e, key)}
                          onDragEnter={handleDragEnter}
                          onDrop={(e) => handleDrop(e, key)}
                          className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all bg-white dark:bg-gray-800 cursor-move ${
                            draggedColumn === key
                              ? 'opacity-50 scale-95 border-2 border-indigo-500'
                              : 'border-2 border-transparent'
                          }`}
                        >
                          {/* Drag handle icon */}
                          <svg
                            className="h-5 w-5 text-gray-400 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>

                          {/* Eye icon */}
                          <div className="flex-shrink-0">
                            {config.visible ? (
                              <EyeIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                            )}
                          </div>

                          {/* Column label */}
                          <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 min-w-0">
                            {config.label}
                          </span>

                          {/* Toggle switch */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleColumnVisibilityChange(key, !config.visible)
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex-shrink-0 ${
                              config.visible
                                ? 'bg-indigo-600'
                                : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                config.visible ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Documentation category columns */}
                {documentationCategories.length > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Documentation Tabs
                      </h4>
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        Grouped together • Can only reorder within this section
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {getSortedColumns().map(([key, config]) => {
                        if (!key.startsWith('docTab_')) return null

                        return (
                          <div
                            key={key}
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, key)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, key)}
                            onDragEnter={handleDragEnter}
                            onDrop={(e) => handleDrop(e, key)}
                            className={`flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all bg-white dark:bg-gray-800 cursor-move ${
                              draggedColumn === key
                                ? 'opacity-50 scale-95 border-2 border-indigo-500'
                                : 'border-2 border-transparent'
                            }`}
                          >
                            {/* Drag handle icon */}
                            <svg
                              className="h-5 w-5 text-gray-400 flex-shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>

                            {/* Eye icon or color swatch */}
                            <div className="flex-shrink-0">
                              {config.visible ? (
                                config.categoryColor ? (
                                  <div
                                    className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600"
                                    style={{ backgroundColor: config.categoryColor }}
                                  />
                                ) : (
                                  <EyeIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                )
                              ) : (
                                <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                              )}
                            </div>

                            {/* Column label */}
                            <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 min-w-0">
                              {config.label}
                            </span>

                            {/* Toggle switch */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleColumnVisibilityChange(key, !config.visible)
                              }}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex-shrink-0 ${
                                config.visible
                                  ? 'bg-indigo-600'
                                  : 'bg-gray-200 dark:bg-gray-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  config.visible ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Operations Toolbar */}
      {selectedRows.size > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm font-medium text-indigo-900 dark:text-indigo-300">
              {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''} selected
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleBulkUpdate('po_required', true)}
                className="px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                Set PO Required
              </button>
              <button
                onClick={() => handleBulkUpdate('po_required', false)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Clear PO Required
              </button>
              <button
                onClick={() => handleBulkUpdate('create_po_on_job_start', true)}
                className="px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                Enable Auto PO
              </button>
              <button
                onClick={() => handleBulkUpdate('create_po_on_job_start', false)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Disable Auto PO
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors flex items-center gap-1"
              >
                <TrashIcon className="h-4 w-4" />
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Column Table */}
      {selectedTemplate && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
          <table className="border-collapse" style={{ minWidth: '100%', width: 'max-content' }}>
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <tr>
                {getSortedColumns().map(([key, config]) => {
                  if (!config.visible) return null
                  const isSorted = sortBy === key
                  const isSortable = key !== 'sequence' && key !== 'actions' && key !== 'select'

                  return (
                    <th
                      key={key}
                      style={{ width: `${config.width}px`, minWidth: `${config.width}px`, position: 'relative' }}
                      className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-left ${draggedColumn === key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                      onDragOver={(e) => handleDragOver(e, key)}
                      onDrop={(e) => handleDrop(e, key)}
                    >
                      <div className="flex items-center gap-2">
                        {/* Drag handle - only this icon is draggable */}
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragEnd={handleDragEnd}
                          className="cursor-move"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Bars3Icon className="h-4 w-4 text-gray-400" />
                        </div>

                        {/* Column label with sort functionality */}
                        {key === 'select' ? (
                          <input
                            type="checkbox"
                            checked={selectedRows.size === filteredAndSortedRows.length && filteredAndSortedRows.length > 0}
                            onChange={handleSelectAll}
                            className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                            title="Select all rows"
                          />
                        ) : (
                          <span
                            className={`text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${isSortable ? 'cursor-pointer' : ''}`}
                            onClick={() => isSortable && handleSort(key)}
                          >
                            {key === 'sequence' ? (
                              '#'
                            ) : key === 'actions' ? (
                              'Actions'
                            ) : columnTooltips[key] ? (
                              <ColumnTooltip text={config.label} tooltip={columnTooltips[key]} />
                            ) : (
                              config.label
                            )}
                          </span>
                        )}

                        {/* Sort indicators */}
                        {isSortable && isSorted && (
                          sortDirection === 'asc' ?
                            <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                            <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        )}
                      </div>

                      {/* Resize handle - draggable column width adjuster */}
                      {key !== 'sequence' && key !== 'actions' && (
                        <div
                          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                          onMouseDown={(e) => handleResizeStart(e, key)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </th>
                  )
                })}
              </tr>

              {/* Filter row */}
              <tr className="bg-gray-100 dark:bg-gray-800">
                {getSortedColumns().map(([key, config]) => {
                  if (!config.visible) return null

                  // Determine if this column is filterable
                  const isFilterable = ['taskName', 'supplierGroup', 'tags'].includes(key)

                  return (
                    <th
                      key={`filter-${key}`}
                      style={{ width: `${config.width}px`, minWidth: `${config.width}px` }}
                      className="px-3 py-1.5 border-r border-gray-200 dark:border-gray-700"
                    >
                      {isFilterable ? (
                        <input
                          type="text"
                          value={columnFilters[key] || ''}
                          onChange={(e) => handleColumnFilterChange(key, e.target.value)}
                          placeholder="Filter..."
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      ) : null}
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={getSortedColumns().filter(([, c]) => c.visible).length} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={getSortedColumns().filter(([, c]) => c.visible).length} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No rows yet. Click "Add Row" to start building your template.
                  </td>
                </tr>
              ) : filteredAndSortedRows.length === 0 ? (
                <tr>
                  <td colSpan={getSortedColumns().filter(([, c]) => c.visible).length} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No tasks match your search.
                  </td>
                </tr>
              ) : (
                filteredAndSortedRows.map((row, index) => {
                  const rowIndex = rows.findIndex(r => r && r.id === row.id)
                  // Skip rows that can't be found in the main array (safety check)
                  if (rowIndex === -1) return null

                  return (
                    <ScheduleTemplateRow
                      key={row.id}
                      row={row}
                      index={rowIndex}
                      suppliers={suppliers}
                      columnConfig={columnConfig}
                      getSortedColumns={getSortedColumns}
                      allRows={rows}
                      onUpdate={(updates) => handleUpdateRow(row.id, updates)}
                      onDelete={() => handleDeleteRow(row.id)}
                      onMoveUp={() => handleMoveRow(rowIndex, 'up')}
                      onMoveDown={() => handleMoveRow(rowIndex, 'down')}
                      canMoveUp={rowIndex > 0}
                      canMoveDown={rowIndex < rows.length - 1}
                      isSelected={selectedRows.has(row.id)}
                      onSelectRow={handleSelectRow}
                      isApplyingCascadeRef={isApplyingCascadeRef}
                    />
                  )
                })
              )}
            </tbody>
          </table>

          {/* Add Row Button */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleAddRow}
              className="inline-flex items-center px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Row
            </button>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center" style={{ zIndex: '2147483647' }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Create New Template
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white"
                  placeholder="e.g., Standard House Build"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white"
                  rows="3"
                />
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={templateForm.is_default}
                  onChange={(e) => setTemplateForm({ ...templateForm, is_default: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Set as default template
                </span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTemplateModal(false)
                  setTemplateForm({ name: '', description: '', is_default: false })
                }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!templateForm.name}
                className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gantt View Modal - DHtmlx Gantt */}
      {showGanttView && (
        <DHtmlxGanttView
          isOpen={showGanttView}
          onClose={handleCloseGantt}
          tasks={rows}
          templateId={selectedTemplate?.id}
          cascadeDepthRef={cascadeDepthRef}
          onUpdateTask={async (taskId, updates, options) => {
            // CRITICAL: Skip if we're applying backend cascade updates
            // This prevents infinite loop from onAfterTaskUpdate events during batch state update
            if (isApplyingCascadeRef.current) {
              console.log('⏸️ Skipping handleUpdateRow - applying backend cascade batch')
              return
            }

            // Find the row and update it
            const rowIndex = rows.findIndex(r => r.id === taskId)
            if (rowIndex !== -1) {
              return await handleUpdateRow(taskId, updates, options)
            }
          }}
        />
      )}

      {/* Gantt Bible Modal */}
      <GanttRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />

      {/* Gantt Bug Hunter Modal */}
      <GanttBugHunterModal
        isOpen={showBugHunterModal}
        onClose={() => setShowBugHunterModal(false)}
      />

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

// Individual row component
function ScheduleTemplateRow({
  row, index, suppliers, columnConfig, getSortedColumns, allRows,
  onUpdate, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
  isSelected, onSelectRow, isApplyingCascadeRef
}) {
  const [localName, setLocalName] = useState(row.name)
  const [localDuration, setLocalDuration] = useState(row.duration || 0)
  const updateTimeoutRef = useRef(null)
  const [showPredecessorEditor, setShowPredecessorEditor] = useState(false)
  const [showPriceItemsModal, setShowPriceItemsModal] = useState(false)
  const [showChecklistModal, setShowChecklistModal] = useState(false)
  const [showLinkedTasksModal, setShowLinkedTasksModal] = useState(false)
  const [showAutoCompleteModal, setShowAutoCompleteModal] = useState(false)
  const [showSubtasksModal, setShowSubtasksModal] = useState(false)

  // Calculate start date based on predecessors
  const calculateStartDate = useCallback(() => {
    if (!row.predecessor_ids || row.predecessor_ids.length === 0) {
      return 0 // No predecessors = start at project start (Day 0)
    }

    // Find the latest end date of all predecessors
    let latestEnd = 0
    row.predecessor_ids.forEach(pred => {
      const predData = typeof pred === 'object' ? pred : { id: pred, type: 'FS', lag: 0 }
      const predTask = allRows[predData.id - 1] // Task numbers are 1-indexed

      if (predTask) {
        // Recursively calculate predecessor's start (simplified - assumes it's already calculated)
        const predStart = predTask.start_date || 0
        const predDuration = predTask.duration || 0
        const predEnd = predStart + predDuration

        // For FS (Finish-to-Start), task starts after predecessor finishes
        if (predData.type === 'FS' || !predData.type) {
          const taskStart = predEnd + (predData.lag || 0)
          if (taskStart > latestEnd) {
            latestEnd = taskStart
          }
        }
      }
    })

    return latestEnd
  }, [row.predecessor_ids, allRows, row.start_date])

  const calculatedStartDate = calculateStartDate()

  // Sync local state when row data changes
  useEffect(() => {
    setLocalName(row.name)
    setLocalDuration(row.duration || 0)
  }, [row.name, row.duration])

  // Update start_date in database when it changes due to predecessors/duration
  // Skip auto-updates for manually positioned tasks
  useEffect(() => {
    if (row.manually_positioned) {
      // Skip auto-calculation for manually positioned tasks
      return
    }

    // CRITICAL: Skip updates during backend cascade application to prevent infinite loops
    if (isApplyingCascadeRef?.current) {
      console.log(`⏸️ ScheduleTemplateRow[${row.id}]: Skipping auto-update - applying backend cascade`)
      return
    }

    if (calculatedStartDate !== row.start_date) {
      // Debounce the update to avoid excessive API calls
      const timer = setTimeout(() => {
        onUpdate({ start_date: calculatedStartDate })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [calculatedStartDate, row.start_date, row.manually_positioned, onUpdate, isApplyingCascadeRef])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  // Debounced update for text fields
  const handleTextChange = (field, value) => {
    if (field === 'name') {
      setLocalName(value)
    } else if (field === 'duration') {
      // Store as number to match the type from the server
      const numValue = parseInt(value) || 0
      setLocalDuration(numValue)
    }

    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // Set new timeout to update after user stops typing
    updateTimeoutRef.current = setTimeout(() => {
      if (field === 'duration') {
        const numValue = parseInt(value) || 0
        onUpdate({ [field]: numValue })
      } else if (value && value.trim()) {
        onUpdate({ [field]: value })
      }
    }, 500)
  }

  // Immediate update for checkboxes and selects
  const handleFieldChange = (field, value) => {
    // Handle interdependent fields
    if (field === 'po_required') {
      if (!value) {
        // If po_required is unchecked, also uncheck create_po_on_job_start and clear supplier
        onUpdate({ po_required: false, create_po_on_job_start: false, supplier_id: null })
      } else {
        // If po_required is checked, clear assigned_role
        onUpdate({ po_required: true, assigned_role: null })
      }
    } else if (field === 'create_po_on_job_start') {
      if (value && !row.supplier_id) {
        // If checking create_po_on_job_start but no supplier, show error and don't update
        alert('Please select a supplier first before enabling Auto PO')
        return
      } else {
        onUpdate({ [field]: value })
      }
    } else {
      onUpdate({ [field]: value })
    }
  }

  // Render individual cell based on key
  const renderCell = (key, config) => {
    const cellWidth = config.width

    switch (key) {
      case 'select':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelectRow(row.id)}
              className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
            />
          </td>
        )

      case 'sequence':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
            {index + 1}
          </td>
        )

      case 'taskName':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
            <input
              type="text"
              value={localName}
              onChange={(e) => handleTextChange('name', e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm"
            />
          </td>
        )

      case 'supplierGroup':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
            {row.po_required ? (
              <select
                value={row.supplier_id || ''}
                onChange={(e) => handleFieldChange('supplier_id', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm"
              >
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <select
                value={row.assigned_role || ''}
                onChange={(e) => handleFieldChange('assigned_role', e.target.value || null)}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm"
              >
                <option value="">Assign to group...</option>
                {ASSIGNABLE_ROLES.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            )}
          </td>
        )

      case 'predecessors':
        // Clickable button to open predecessor editor modal
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowPredecessorEditor(true)}
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-left cursor-pointer"
              title="Click to edit predecessors"
            >
              {row.predecessor_display || 'None'}
            </button>
          </td>
        )

      case 'duration':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
            <input
              type="number"
              value={localDuration}
              onChange={(e) => handleTextChange('duration', e.target.value)}
              onBlur={(e) => {
                // Immediately save on blur
                const numValue = parseInt(e.target.value) || 0
                if (updateTimeoutRef.current) {
                  clearTimeout(updateTimeoutRef.current)
                }
                onUpdate({ duration: numValue })
              }}
              onFocus={(e) => e.target.select()}
              min="0"
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm"
              placeholder="0"
            />
          </td>
        )

      case 'startDate':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
            <div className="w-full px-2 py-1 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
              {calculatedStartDate}
            </div>
          </td>
        )

      case 'lock':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={row.manually_positioned || false}
              onChange={(e) => handleFieldChange('manually_positioned', e.target.checked)}
              className="h-4 w-4"
              title={row.manually_positioned ? 'Locked - prevents cascade updates' : 'Unlocked - allows cascade updates'}
            />
          </td>
        )

      case 'poRequired':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={row.po_required}
              onChange={(e) => handleFieldChange('po_required', e.target.checked)}
              className="h-4 w-4"
            />
          </td>
        )

      case 'autoPo':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={row.create_po_on_job_start}
              onChange={(e) => handleFieldChange('create_po_on_job_start', e.target.checked)}
              disabled={!row.po_required || !row.supplier_id}
              className="h-4 w-4 disabled:opacity-30"
              title={!row.po_required ? "Enable 'PO Required' first" : !row.supplier_id ? "Select a supplier first" : "Automatically create PO when job starts"}
            />
          </td>
        )

      case 'priceItems':
        const canSelectItems = row.create_po_on_job_start && row.po_required && row.supplier_id
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <button
              onClick={() => canSelectItems && setShowPriceItemsModal(true)}
              disabled={!canSelectItems}
              className={`text-xs font-medium ${canSelectItems ? 'text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer' : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'}`}
              title={
                !row.po_required ? "Enable 'PO Required' first" :
                !row.supplier_id ? "Select a supplier first" :
                !row.create_po_on_job_start ? "Enable 'Auto PO' first" :
                "Click to select price book items"
              }
            >
              {row.price_book_item_ids?.length || 0} items
            </button>
          </td>
        )

      case 'docTabs':
        // This column has been replaced by individual doc category columns
        return null

      case 'critical':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={row.critical_po}
              onChange={(e) => handleFieldChange('critical_po', e.target.checked)}
              className="h-4 w-4"
            />
          </td>
        )

      case 'tags':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
            <input
              type="text"
              value={row.tags?.join(', ') || ''}
              onChange={(e) => handleFieldChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
              placeholder="tag1, tag2"
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm"
            />
          </td>
        )

      case 'photo':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={row.require_photo}
              onChange={(e) => handleFieldChange('require_photo', e.target.checked)}
              className="h-4 w-4"
            />
          </td>
        )

      case 'cert':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={row.require_certificate}
              onChange={(e) => handleFieldChange('require_certificate', e.target.checked)}
              className="h-4 w-4"
            />
          </td>
        )

      case 'certLag':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
            <input
              type="number"
              value={row.cert_lag_days}
              onChange={(e) => handleFieldChange('cert_lag_days', parseInt(e.target.value))}
              disabled={!row.require_certificate}
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-900 dark:text-white text-sm disabled:opacity-50"
            />
          </td>
        )

      case 'supCheck':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-2 py-3 border-r border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={row.require_supervisor_check}
                onChange={(e) => handleFieldChange('require_supervisor_check', e.target.checked)}
                className="h-4 w-4"
              />
              {row.require_supervisor_check && (
                <button
                  onClick={handleOpenChecklistModal}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap"
                  title="Click to assign checklist items"
                >
                  {row.supervisor_checklist_template_ids?.length || 0} items
                </button>
              )}
            </div>
          </td>
        )

      case 'autoComplete':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <button
              onClick={() => setShowAutoCompleteModal(true)}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              title="Click to select tasks to auto-complete"
            >
              {row.auto_complete_task_ids?.length || 0} tasks
            </button>
          </td>
        )

      case 'subtasks':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <button
              onClick={() => setShowSubtasksModal(true)}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              title="Click to select subtasks"
            >
              {row.subtask_template_ids?.length || 0} subtasks
            </button>
          </td>
        )

      case 'linkedTasks':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <button
              onClick={() => setShowLinkedTasksModal(true)}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              title="Click to select linked tasks"
            >
              {row.linked_task_ids?.length || 0} tasks
            </button>
          </td>
        )

      case 'manualTask':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={row.manual_task || false}
              onChange={(e) => onUpdate({ manual_task: e.target.checked })}
              className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
            />
          </td>
        )

      case 'multipleItems':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={row.allow_multiple_instances || false}
              onChange={(e) => onUpdate({ allow_multiple_instances: e.target.checked })}
              className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
            />
          </td>
        )

      case 'orderRequired':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={row.order_required || false}
              onChange={(e) => onUpdate({ order_required: e.target.checked })}
              className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
            />
          </td>
        )

      case 'callUpRequired':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={row.call_up_required || false}
              onChange={(e) => onUpdate({ call_up_required: e.target.checked })}
              className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
            />
          </td>
        )

      case 'planType':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center">
            <input
              type="checkbox"
              checked={row.plan_required || false}
              onChange={(e) => onUpdate({ plan_required: e.target.checked })}
              className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
            />
          </td>
        )

      case 'actions':
        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1">
              {canMoveUp && (
                <button onClick={onMoveUp} className="p-1 hover:text-indigo-600" title="Move up">
                  <ArrowUpIcon className="h-4 w-4" />
                </button>
              )}
              {canMoveDown && (
                <button onClick={onMoveDown} className="p-1 hover:text-indigo-600" title="Move down">
                  <ArrowDownIcon className="h-4 w-4" />
                </button>
              )}
              <button onClick={onDelete} className="p-1 hover:text-red-600" title="Delete">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </td>
        )

      default:
        // Handle dynamic documentation category columns
        if (key.startsWith('docTab_')) {
          const categoryId = config.categoryId
          const isChecked = row.documentation_category_ids?.includes(categoryId) || false

          return (
            <td
              key={key}
              style={{
                width: `${cellWidth}px`,
                minWidth: `${cellWidth}px`,
                backgroundColor: config.categoryColor ? `${config.categoryColor}10` : undefined
              }}
              className="px-3 py-3 border-r border-gray-200 dark:border-gray-700 text-center"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => {
                  const currentIds = row.documentation_category_ids || []
                  const newIds = e.target.checked
                    ? [...currentIds, categoryId]
                    : currentIds.filter(id => id !== categoryId)
                  onUpdate({ documentation_category_ids: newIds })
                }}
                className="h-4 w-4 text-indigo-600 rounded cursor-pointer"
                title={`Toggle ${config.label}`}
              />
            </td>
          )
        }

        return (
          <td key={key} style={{ width: `${cellWidth}px`, minWidth: `${cellWidth}px` }} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700">
            -
          </td>
        )
    }
  }

  // Handler for saving predecessors
  const handleSavePredecessors = (predecessors) => {
    onUpdate({ predecessor_ids: predecessors })
  }

  // Handler for saving price book items
  const handleSavePriceItems = (itemIds) => {
    onUpdate({ price_book_item_ids: itemIds })
  }

  // Handler for saving supervisor checklist templates
  const handleSaveChecklistTemplates = (templateIds) => {
    onUpdate({ supervisor_checklist_template_ids: templateIds })
  }

  const handleOpenChecklistModal = () => {
    setShowChecklistModal(true)
  }

  // Handler for saving linked tasks
  const handleSaveLinkedTasks = (taskIds) => {
    onUpdate({ linked_task_ids: taskIds })
  }

  // Handler for saving auto-complete tasks
  const handleSaveAutoCompleteTasks = (taskIds) => {
    onUpdate({ auto_complete_task_ids: taskIds })
  }

  // Handler for saving subtask templates
  const handleSaveSubtasks = (taskIds) => {
    onUpdate({ subtask_template_ids: taskIds })
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
      {getSortedColumns().map(([key, config]) => {
        if (!config.visible) return null
        return renderCell(key, config)
      })}

      {/* Modals - rendered using portals to escape table structure */}
      {showPredecessorEditor && typeof document !== 'undefined' && createPortal(
        <PredecessorEditor
          isOpen={showPredecessorEditor}
          onClose={() => setShowPredecessorEditor(false)}
          currentRow={row}
          allRows={allRows}
          onSave={handleSavePredecessors}
        />,
        document.body
      )}

      {showPriceItemsModal && typeof document !== 'undefined' && createPortal(
        <PriceBookItemsModal
          isOpen={showPriceItemsModal}
          onClose={() => setShowPriceItemsModal(false)}
          currentRow={row}
          onSave={handleSavePriceItems}
        />,
        document.body
      )}

      {showChecklistModal && typeof document !== 'undefined' && createPortal(
        <SupervisorChecklistModal
          isOpen={showChecklistModal}
          onClose={() => setShowChecklistModal(false)}
          currentRow={row}
          onSave={handleSaveChecklistTemplates}
        />,
        document.body
      )}

      {showLinkedTasksModal && typeof document !== 'undefined' && createPortal(
        <LinkedTasksModal
          isOpen={showLinkedTasksModal}
          onClose={() => setShowLinkedTasksModal(false)}
          currentRow={row}
          allRows={allRows}
          onSave={handleSaveLinkedTasks}
        />,
        document.body
      )}

      {showAutoCompleteModal && typeof document !== 'undefined' && createPortal(
        <AutoCompleteTasksModal
          isOpen={showAutoCompleteModal}
          onClose={() => setShowAutoCompleteModal(false)}
          currentRow={row}
          allRows={allRows}
          onSave={handleSaveAutoCompleteTasks}
        />,
        document.body
      )}

      {showSubtasksModal && typeof document !== 'undefined' && createPortal(
        <SubtasksModal
          isOpen={showSubtasksModal}
          onClose={() => setShowSubtasksModal(false)}
          currentRow={row}
          allRows={allRows}
          onSave={handleSaveSubtasks}
        />,
        document.body
      )}
    </tr>
  )
}
