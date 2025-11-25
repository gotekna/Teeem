import { useEffect, useState } from 'react'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { api } from '../api'
import { formatCurrency, formatPercentage } from '../utils/formatters'
import {
  PlusIcon,
  BriefcaseIcon,
  ArrowTopRightOnSquareIcon,
  DocumentArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  Bars3Icon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import NewJobModal from '../components/jobs/NewJobModal'
import CsvImportJobModal from '../components/jobs/CsvImportJobModal'
import ColumnVisibilityModal from '../components/modals/ColumnVisibilityModal'
import TrapidTableView from '../components/documentation/TrapidTableView'

export default function ActiveJobsPage() {
  const navigate = useNavigate()
  const [selectedTab, setSelectedTab] = useState(0) // 0 = Custom, 1 = Trinity
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showNewJobModal, setShowNewJobModal] = useState(false)
  const [showCsvImportModal, setShowCsvImportModal] = useState(false)
  const [showColumnModal, setShowColumnModal] = useState(false)

  // Search and filters with localStorage persistence (RULE #20.13)
  const [searchQuery, setSearchQuery] = useState('')
  const [columnFilters, setColumnFilters] = useState(() => {
    const saved = localStorage.getItem('activeJobsTableState_columnFilters')
    return saved ? JSON.parse(saved) : {}
  })

  // Column state with localStorage persistence
  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem('activeJobsTableState_columnOrder')
    return saved ? JSON.parse(saved) : ['checkbox', 'number', 'title', 'contract_value', 'live_profit', 'profit_percentage', 'stage', 'actions']
  })

  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('activeJobsTableState_columnWidths')
    return saved ? JSON.parse(saved) : {
      checkbox: 32,  // RULE #20.1: Must be exactly 32px
      number: 80,
      title: 300,
      contract_value: 150,
      live_profit: 150,
      profit_percentage: 120,
      stage: 150,
      actions: 120
    }
  })

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('activeJobsTableState_visibleColumns')
    return saved ? JSON.parse(saved) : {
      checkbox: true,
      number: true,
      title: true,
      contract_value: true,
      live_profit: true,
      profit_percentage: true,
      stage: true,
      actions: true
    }
  })

  // Column resize state
  const [resizingColumn, setResizingColumn] = useState(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)

  // Column reorder state
  const [draggedColumn, setDraggedColumn] = useState(null)

  // Sort state with localStorage persistence (RULE #20.13)
  const [sortBy, setSortBy] = useState(() => {
    const saved = localStorage.getItem('activeJobsTableState_sortBy')
    return saved ? JSON.parse(saved) : 'title'
  })
  const [sortDirection, setSortDirection] = useState(() => {
    const saved = localStorage.getItem('activeJobsTableState_sortDirection')
    return saved ? JSON.parse(saved) : 'asc'
  })

  // Row selection state
  const [selectedItems, setSelectedItems] = useState(new Set())

  useEffect(() => {
    console.log('🔴 ActiveJobsPage LOADED - FULL ADVANCED TABLE VERSION')
    loadJobs()
  }, [])

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('activeJobsTableState_columnOrder', JSON.stringify(columnOrder))
  }, [columnOrder])

  useEffect(() => {
    localStorage.setItem('activeJobsTableState_columnWidths', JSON.stringify(columnWidths))
  }, [columnWidths])

  useEffect(() => {
    localStorage.setItem('activeJobsTableState_visibleColumns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  // Persist sort state to localStorage (RULE #20.13)
  useEffect(() => {
    localStorage.setItem('activeJobsTableState_sortBy', JSON.stringify(sortBy))
  }, [sortBy])

  useEffect(() => {
    localStorage.setItem('activeJobsTableState_sortDirection', JSON.stringify(sortDirection))
  }, [sortDirection])

  // Persist column filters to localStorage (RULE #20.13)
  useEffect(() => {
    localStorage.setItem('activeJobsTableState_columnFilters', JSON.stringify(columnFilters))
  }, [columnFilters])

  // Column resize handlers
  useEffect(() => {
    if (resizingColumn) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [resizingColumn, resizeStartX, resizeStartWidth])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const response = await api.get(
        `/api/v1/jobs?status=Active&per_page=1000`
      )
      setJobs(response.jobs || [])
    } catch (err) {
      setError('Failed to load active jobs')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCellClick = (jobId, field, currentValue) => {
    setEditingCell({ jobId, field })
    setEditValue(currentValue || '')
  }

  const handleCellBlur = async () => {
    if (!editingCell) return

    const { jobId, field } = editingCell
    const originalJob = jobs.find(j => j.id === jobId)

    if (editValue !== originalJob[field]) {
      try {
        await api.put(`/api/v1/jobs/${jobId}`, {
          job: {
            [field]: editValue
          }
        })
        await loadJobs()
      } catch (err) {
        console.error('Failed to update job:', err)
        alert('Failed to update job')
      }
    }

    setEditingCell(null)
    setEditValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur()
    }
  }

  const handleCreateJob = async (jobData) => {
    try {
      const { createOneDriveFolders, ...jobDataFields } = jobData

      const response = await api.post('/api/v1/jobs', {
        job: jobDataFields,
        create_onedrive_folders: createOneDriveFolders,
        template_id: null
      })

      await loadJobs()

      if (createOneDriveFolders) {
        alert('Job created successfully! OneDrive folders are being created in the background.')
      }

      if (response.job && response.job.id) {
        navigate(`/jobs/${response.job.id}/setup`)
      }
    } catch (err) {
      console.error('Failed to create job:', err)
      throw err
    }
  }

  // Row selection handlers
  const handleSelectItem = (jobId) => {
    const newSet = new Set(selectedItems)
    if (newSet.has(jobId)) {
      newSet.delete(jobId)
    } else {
      newSet.add(jobId)
    }
    setSelectedItems(newSet)
  }

  const handleSelectAll = () => {
    const newSet = selectedItems.size === filteredJobs.length
      ? new Set()
      : new Set(filteredJobs.map(job => job.id))
    setSelectedItems(newSet)
  }

  // Column visibility toggle
  const toggleColumn = (columnKey) => {
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

  // Column filter handler
  const handleColumnFilterChange = (columnKey, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }))
  }

  // Sort handler
  const handleSort = (columnKey) => {
    if (sortBy === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        // Third state: clear sort (RULE #20.14)
        setSortBy(null)
        setSortDirection('asc')
      }
    } else {
      setSortBy(columnKey)
      setSortDirection('asc')
    }
  }

  // Column resize handlers
  const handleResizeStart = (e, columnKey) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnKey)
    setResizeStartX(e.clientX)
    setResizeStartWidth(columnWidths[columnKey])
  }

  const handleResizeMove = (e) => {
    if (!resizingColumn) return
    const diff = e.clientX - resizeStartX
    const newWidth = Math.max(100, resizeStartWidth + diff)
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth
    }))
  }

  const handleResizeEnd = () => {
    setResizingColumn(null)
  }

  // Column reorder handlers
  const handleDragStart = (e, columnKey) => {
    setDraggedColumn(columnKey)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, targetColumnKey) => {
    e.preventDefault()

    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null)
      return
    }

    const draggedIndex = columnOrder.indexOf(draggedColumn)
    const targetIndex = columnOrder.indexOf(targetColumnKey)

    const newOrder = [...columnOrder]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumn)

    setColumnOrder(newOrder)
    setDraggedColumn(null)
  }

  // Get sort value
  const getSortValue = (job, columnKey) => {
    switch (columnKey) {
      case 'number':
        return job.id || 0
      case 'title':
        return job.title?.toLowerCase() || ''
      case 'contract_value':
        return parseFloat(job.contract_value) || 0
      case 'live_profit':
        return parseFloat(job.live_profit) || 0
      case 'profit_percentage':
        return parseFloat(job.profit_percentage) || 0
      case 'stage':
        return job.stage?.toLowerCase() || ''
      default:
        return ''
    }
  }

  // Apply filters and search
  const applyFilters = (items) => {
    let filtered = items

    // Global search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(job =>
        job.title?.toLowerCase().includes(query) ||
        job.stage?.toLowerCase().includes(query) ||
        job.id?.toString().includes(query)
      )
    }

    // Column filters
    if (Object.keys(columnFilters).length > 0) {
      filtered = filtered.filter(job => {
        return Object.entries(columnFilters).every(([key, filterValue]) => {
          if (!filterValue || filterValue.trim() === '') return true

          const lowerFilter = filterValue.toLowerCase()

          switch (key) {
            case 'title':
              return job.title?.toLowerCase().includes(lowerFilter)
            case 'contract_value':
              return job.contract_value?.toString().includes(lowerFilter)
            case 'live_profit':
              return job.live_profit?.toString().includes(lowerFilter)
            case 'profit_percentage':
              return job.profit_percentage?.toString().includes(lowerFilter)
            case 'stage':
              return job.stage?.toLowerCase().includes(lowerFilter)
            default:
              return true
          }
        })
      })
    }

    return filtered
  }

  const filteredJobs = applyFilters(jobs).sort((a, b) => {
    const aVal = getSortValue(a, sortBy)
    const bVal = getSortValue(b, sortBy)

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  // Column configuration
  const columnsConfig = {
    checkbox: { key: 'checkbox', label: 'Select', searchable: false, sortable: false, hideable: false },
    number: { key: 'number', label: '#', searchable: false, sortable: true, hideable: false },
    title: { key: 'title', label: 'Job Title', searchable: true, sortable: true, hideable: true, filterType: 'search' },
    contract_value: { key: 'contract_value', label: 'Contract Value', searchable: true, sortable: true, hideable: true, filterType: 'search' },
    live_profit: { key: 'live_profit', label: 'Live Profit', searchable: true, sortable: true, hideable: true, filterType: 'search' },
    profit_percentage: { key: 'profit_percentage', label: 'Profit %', searchable: true, sortable: true, hideable: true, filterType: 'search' },
    stage: { key: 'stage', label: 'Stage', searchable: true, sortable: true, hideable: true, filterType: 'search' },
    actions: { key: 'actions', label: 'Actions', searchable: false, sortable: false, hideable: false }
  }

  const columns = columnOrder.map(key => columnsConfig[key])

  // Transform jobs to Trinity format for comparison
  const trinityJobs = filteredJobs.map((job, index) => ({
    id: job.id,
    category: 'jobs',
    chapter_number: 0,
    chapter_name: 'Jobs',
    section_number: String(index + 1),
    title: job.job_title,
    entry_type: job.stage,
    description: `${formatCurrency(job.contract_value || 0)} contract`,
    status: job.stage,
    severity: job.profit_percentage > 50 ? 'high' : 'medium',
    _original: job
  }))

  // Render table cell
  const renderCell = (job, index, columnKey) => {
    if (!visibleColumns[columnKey]) return null

    const width = columnWidths[columnKey]
    const cellStyle = { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px`, fontSize: '14px' }

    switch (columnKey) {
      case 'checkbox':
        return (
          <td key="checkbox" style={cellStyle} className="px-3 py-4 border-r border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selectedItems.has(job.id)}
              onChange={() => handleSelectItem(job.id)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </td>
        )

      case 'number':
        return (
          <td key="number" style={cellStyle} className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {index + 1}
          </td>
        )

      case 'title':
        return (
          <td key="title" style={cellStyle} className="px-3 py-4">
            {editingCell?.jobId === job.id && editingCell?.field === 'title' ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full px-2 py-1 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 truncate max-w-md"
                  title={job.title}
                >
                  {job.title || 'Untitled Job'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCellClick(job.id, 'title', job.title)
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Edit title"
                >
                  Edit
                </button>
              </div>
            )}
          </td>
        )

      case 'contract_value':
        return (
          <td key="contract_value" style={cellStyle} className="px-3 py-4 whitespace-nowrap text-right text-sm">
            {editingCell?.jobId === job.id && editingCell?.field === 'contract_value' ? (
              <input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full px-2 py-1 text-sm text-right border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  handleCellClick(job.id, 'contract_value', job.contract_value)
                }}
                className="text-gray-900 dark:text-white cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md"
                title="Click to edit"
              >
                {job.contract_value ? formatCurrency(job.contract_value, false) : '-'}
              </div>
            )}
          </td>
        )

      case 'live_profit':
        return (
          <td key="live_profit" style={cellStyle} className="px-3 py-4 whitespace-nowrap text-right text-sm">
            {editingCell?.jobId === job.id && editingCell?.field === 'live_profit' ? (
              <input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full px-2 py-1 text-sm text-right border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  handleCellClick(job.id, 'live_profit', job.live_profit)
                }}
                className={`cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md font-medium ${
                  job.live_profit >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
                title="Click to edit"
              >
                {job.live_profit ? formatCurrency(job.live_profit, false) : '-'}
              </div>
            )}
          </td>
        )

      case 'profit_percentage':
        return (
          <td key="profit_percentage" style={cellStyle} className="px-3 py-4 whitespace-nowrap text-right text-sm">
            {editingCell?.jobId === job.id && editingCell?.field === 'profit_percentage' ? (
              <input
                type="number"
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full px-2 py-1 text-sm text-right border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  handleCellClick(job.id, 'profit_percentage', job.profit_percentage)
                }}
                className={`cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md font-medium ${
                  job.profit_percentage >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
                title="Click to edit"
              >
                {job.profit_percentage ? formatPercentage(job.profit_percentage, 2) : '-'}
              </div>
            )}
          </td>
        )

      case 'stage':
        return (
          <td key="stage" style={cellStyle} className="px-3 py-4 whitespace-nowrap text-sm">
            {editingCell?.jobId === job.id && editingCell?.field === 'stage' ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleCellBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full px-2 py-1 text-sm border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  handleCellClick(job.id, 'stage', job.stage)
                }}
                className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md inline-block"
                title="Click to edit"
              >
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                  {job.stage || 'Not Set'}
                </span>
              </div>
            )}
          </td>
        )

      case 'actions':
        return (
          <td key="actions" style={cellStyle} className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button
              onClick={() => navigate(`/jobs/${job.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              title="View job details"
            >
              View
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </button>
          </td>
        )

      default:
        return null
    }
  }

  if (loading && jobs.length === 0) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Compact Header with all controls */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title and count + Tabs */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <BriefcaseIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Jobs
                </h1>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-l border-gray-300 dark:border-gray-600 pl-6">
              <button
                onClick={() => setSelectedTab(0)}
                className={`px-3 py-1 text-sm rounded-lg transition ${
                  selectedTab === 0
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Custom Table
              </button>
              <button
                onClick={() => setSelectedTab(1)}
                className={`px-3 py-1 text-sm rounded-lg transition ${
                  selectedTab === 1
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Trinity Table
              </button>
            </div>
          </div>

          {/* Middle: Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Right: Action buttons (conditional based on selection) */}
          <div className="flex gap-2">
            {selectedItems.size > 0 ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400">
                  {selectedItems.size} selected
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Clear selection of ${selectedItems.size} ${selectedItems.size === 1 ? 'job' : 'jobs'}?`)) {
                      setSelectedItems(new Set())
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <XMarkIcon className="h-4 w-4" />
                  Clear Selection
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowColumnModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <EyeIcon className="h-4 w-4" />
                  Columns
                </button>
                <button
                  onClick={() => setShowCsvImportModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-transparent rounded-lg text-white bg-gradient-to-r from-green-600 to-green-600 hover:from-green-700 hover:to-green-700 transition"
                >
                  <DocumentArrowUpIcon className="h-4 w-4" />
                  Import CSV
                </button>
                <button
                  onClick={() => setShowNewJobModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-transparent rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition"
                >
                  <PlusIcon className="h-4 w-4" />
                  New Job
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table Content - Conditional based on selectedTab */}
      {selectedTab === 0 ? (
        /* Custom Table Implementation */
        <div className="flex-1 overflow-hidden bg-white dark:bg-gray-900">
          <div className="w-full h-full overflow-auto" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#9CA3AF #E5E7EB'
          }}>
            <table className="border-collapse" style={{ minWidth: '100%', width: 'max-content' }}>
            {/* Table header with gradient background and sticky positioning */}
            <thead className="backdrop-blur-sm bg-blue-600 dark:bg-blue-800 sticky top-0 z-10">
              <tr>
                {columns.map((column) => {
                  if (!visibleColumns[column.key]) return null
                  const width = columnWidths[column.key]
                  const isSortable = column.sortable
                  const isSorted = sortBy === column.key

                  // Special case for checkbox column
                  if (column.key === 'checkbox') {
                    return (
                      <th
                        key={column.key}
                        style={{ width: `${width}px`, minWidth: `${width}px`, position: 'relative' }}
                        className="px-3 py-2 border-r border-white/20 dark:border-white/10"
                      >
                        <input
                          type="checkbox"
                          checked={filteredJobs.length > 0 && selectedItems.size === filteredJobs.length}
                          onChange={handleSelectAll}
                          className="h-4 w-4 rounded border-2 border-white bg-white/10 checked:bg-white checked:border-white text-blue-600 focus:ring-2 focus:ring-white/50 cursor-pointer"
                        />
                      </th>
                    )
                  }

                  return (
                    <th
                      key={column.key}
                      style={{ width: `${width}px`, minWidth: `${width}px`, position: 'relative' }}
                      className={`px-3 py-2 border-r border-white/20 dark:border-white/10 ${column.key === 'actions' ? 'text-right' : column.key === 'contract_value' || column.key === 'live_profit' || column.key === 'profit_percentage' ? 'text-right' : 'text-left'} ${draggedColumn === column.key ? 'bg-white/10' : ''}`}
                      draggable={column.key !== 'number' && column.key !== 'actions' && column.key !== 'checkbox'}
                      onDragStart={(e) => handleDragStart(e, column.key)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, column.key)}
                    >
                      <div
                        className={`flex items-center gap-2 ${column.key === 'contract_value' || column.key === 'live_profit' || column.key === 'profit_percentage' || column.key === 'actions' ? 'justify-end' : ''} ${isSortable ? 'cursor-pointer' : column.key !== 'number' && column.key !== 'actions' && column.key !== 'checkbox' ? 'cursor-move' : ''}`}
                        onClick={() => isSortable && handleSort(column.key)}
                      >
                        {/* Drag icon on left for left-aligned columns */}
                        {column.key !== 'number' && column.key !== 'actions' && column.key !== 'checkbox' && column.key !== 'contract_value' && column.key !== 'live_profit' && column.key !== 'profit_percentage' && (
                          <Bars3Icon className="h-4 w-4 text-white/70 cursor-move" />
                        )}
                        <span className="font-medium text-white uppercase tracking-wider" style={{ fontSize: '18px', fontWeight: 'bold' }}>{column.label}</span>
                        {isSortable && isSorted && (
                          sortDirection === 'asc' ?
                            <ChevronUpIcon className="h-4 w-4 text-white" /> :
                            <ChevronDownIcon className="h-4 w-4 text-white" />
                        )}
                        {/* Drag icon on right for right-aligned columns */}
                        {(column.key === 'contract_value' || column.key === 'live_profit' || column.key === 'profit_percentage') && (
                          <Bars3Icon className="h-4 w-4 text-white/70 cursor-move" />
                        )}
                      </div>
                      {column.searchable && (
                        <input
                          type="text"
                          placeholder="Search..."
                          value={columnFilters[column.key] || ''}
                          onChange={(e) => handleColumnFilterChange(column.key, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      )}
                      {/* Resize handle */}
                      {column.key !== 'actions' && column.key !== 'checkbox' && (
                        <div
                          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors z-20"
                          onMouseDown={(e) => handleResizeStart(e, column.key)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {searchQuery || Object.keys(columnFilters).length > 0
                      ? 'No jobs found matching your filters'
                      : 'No active jobs found. Click "New Job" to create one.'}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job, index) => (
                  <tr
                    key={job.id}
                    className={`${
                      index % 2 === 0
                        ? 'bg-white dark:bg-gray-900'
                        : 'bg-blue-50 dark:bg-blue-900/20'
                    } hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors duration-150`}
                  >
                    {columns.map((column) => renderCell(job, index, column.key))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        /* Trinity Table Implementation */
        <div className="flex-1 overflow-hidden">
          <TrapidTableView
            entries={trinityJobs}
            onView={(entry) => {
              // Eye icon and row double-click handler - navigate to job tabs
              console.log('View job:', entry._original)
              navigate(`/jobs/${entry._original.id}`)
            }}
            onEdit={(entry) => {
              console.log('Edit job:', entry._original)
              navigate(`/jobs/${entry._original.id}`)
            }}
            onDelete={(entry) => {
              console.log('Delete job:', entry._original)
            }}
            category="jobs"
          />
        </div>
      )}

      {/* New Job Modal */}
      <NewJobModal
        isOpen={showNewJobModal}
        onClose={() => setShowNewJobModal(false)}
        onSuccess={handleCreateJob}
      />

      {/* CSV Import Modal */}
      <CsvImportJobModal
        isOpen={showCsvImportModal}
        onClose={() => setShowCsvImportModal(false)}
        onSuccess={() => {
          setShowCsvImportModal(false)
          loadJobs()
        }}
      />

      {/* Column Visibility Modal */}
      <ColumnVisibilityModal
        isOpen={showColumnModal}
        onClose={() => setShowColumnModal(false)}
        columns={columns}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
      />
    </div>
  )
}
