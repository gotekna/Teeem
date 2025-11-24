import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon } from '@heroicons/react/24/outline'

// Helper to format date
const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
}

// Helper to get days between dates (handles timezone consistently)
const daysBetween = (start, end) => {
  const s = new Date(start)
  const e = new Date(end)
  // Reset to midnight local time to avoid timezone offset issues
  s.setHours(0, 0, 0, 0)
  e.setHours(0, 0, 0, 0)
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1
}

// Helper to get date range for timeline
const getDateRange = (tasks) => {
  if (!tasks || tasks.length === 0) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(start.getDate() - 7)
    const end = new Date(today)
    end.setDate(end.getDate() + 30)
    return { start, end }
  }

  let minDate = new Date(tasks[0].start_date)
  let maxDate = new Date(tasks[0].end_date)
  minDate.setHours(0, 0, 0, 0)
  maxDate.setHours(0, 0, 0, 0)

  tasks.forEach(task => {
    const taskStart = new Date(task.start_date)
    const taskEnd = new Date(task.end_date)
    taskStart.setHours(0, 0, 0, 0)
    taskEnd.setHours(0, 0, 0, 0)
    if (taskStart < minDate) minDate = new Date(taskStart)
    if (taskEnd > maxDate) maxDate = new Date(taskEnd)
  })

  // Add padding (create new dates to avoid mutation issues)
  const start = new Date(minDate)
  start.setDate(start.getDate() - 3)
  const end = new Date(maxDate)
  end.setDate(end.getDate() + 7)

  return { start, end }
}

// Generate array of dates for timeline header
const generateDateColumns = (start, end) => {
  const dates = []
  const current = new Date(start)
  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

// Task bar component with drag support
const TaskBar = ({ task, startOffset, width, dayWidth, onClick, onDrag, onDragEnd, dateRange }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [currentOffset, setCurrentOffset] = useState(startOffset)
  const barRef = useRef(null)

  // Reset offset when startOffset prop changes
  useEffect(() => {
    setCurrentOffset(startOffset)
  }, [startOffset])

  // Stage-based color mapping
  const STAGE_COLORS = {
    'pre-construction': { bg: 'bg-slate-500', hex: '#64748b' },
    'slab': { bg: 'bg-amber-600', hex: '#d97706' },
    'frame': { bg: 'bg-orange-500', hex: '#f97316' },
    'lockup': { bg: 'bg-blue-500', hex: '#3b82f6' },
    'fixing': { bg: 'bg-indigo-500', hex: '#6366f1' },
    'finishing': { bg: 'bg-purple-500', hex: '#a855f7' },
    'handover': { bg: 'bg-green-500', hex: '#22c55e' },
  }

  const getBarColor = () => {
    // Priority 1: Hold tasks are always red
    if (task.is_hold_task) return 'bg-red-500'

    // Priority 2: Status-based colors for active jobs
    if (task.status === 'completed') return 'bg-green-600'
    if (task.status === 'started') return 'bg-blue-600'

    // Priority 3: Lock types
    if (task.locked) {
      if (task.lock_type === 'supplier_confirm') return 'bg-purple-500'
      if (task.lock_type === 'confirm') return 'bg-indigo-500'
    }

    // Priority 4: Custom color from task (hex format)
    if (task.color) return null // Will use inline style instead

    // Priority 5: Stage-based color
    if (task.stage && STAGE_COLORS[task.stage]) {
      return STAGE_COLORS[task.stage].bg
    }

    // Priority 6: Trade-based colors (for templates without stage)
    const TRADE_COLORS = {
      'earthworks': 'bg-amber-700',
      'surveyor': 'bg-slate-600',
      'concreter': 'bg-stone-500',
      'carpenter': 'bg-orange-600',
      'roofer': 'bg-red-600',
      'plumber': 'bg-blue-600',
      'electrician': 'bg-yellow-500',
      'plasterer': 'bg-gray-400',
      'tiler': 'bg-cyan-600',
      'painter': 'bg-pink-500',
      'joiner': 'bg-amber-600',
      'insulation': 'bg-violet-500',
      'cleaner': 'bg-emerald-500',
      'supervisor': 'bg-indigo-600',
    }

    if (task.trade && TRADE_COLORS[task.trade]) {
      return TRADE_COLORS[task.trade]
    }

    return 'bg-gray-400'
  }

  // Get hex color for inline style (when custom color is set)
  const getBarHexColor = () => {
    if (task.color) return task.color
    if (task.stage && STAGE_COLORS[task.stage]) return STAGE_COLORS[task.stage].hex
    return null
  }

  const getProgressWidth = () => {
    if (task.status === 'completed') return '100%'
    return `${task.progress_percentage || 0}%`
  }

  const handleMouseDown = (e) => {
    if (task.locked) return // Don't allow dragging locked tasks
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setDragStartX(e.clientX)
  }

  // Touch event handler for mobile
  const handleTouchStart = (e) => {
    if (task.locked) return
    e.stopPropagation()
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStartX(touch.clientX)
  }

  // Global mouse listeners for drag - use refs to avoid stale closures
  const dragStateRef = useRef({ isDragging: false, dragStartX: 0, startOffset: 0 })

  useEffect(() => {
    dragStateRef.current = { isDragging, dragStartX, startOffset }
  }, [isDragging, dragStartX, startOffset])

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (!dragStateRef.current.isDragging) return
      const deltaX = e.clientX - dragStateRef.current.dragStartX
      const daysDelta = Math.round(deltaX / dayWidth)
      const newOffset = Math.max(0, dragStateRef.current.startOffset + daysDelta)
      setCurrentOffset(newOffset)
      onDrag?.(task.id, newOffset)
    }

    const handleGlobalMouseUp = () => {
      if (!dragStateRef.current.isDragging) return
      setIsDragging(false)
      const newStartDate = new Date(dateRange.start)
      newStartDate.setDate(newStartDate.getDate() + currentOffset)
      onDragEnd?.(task.id, newStartDate.toISOString().split('T')[0], currentOffset)
    }

    const handleGlobalTouchMove = (e) => {
      if (!dragStateRef.current.isDragging) return
      e.preventDefault()
      const touch = e.touches[0]
      const deltaX = touch.clientX - dragStateRef.current.dragStartX
      const daysDelta = Math.round(deltaX / dayWidth)
      const newOffset = Math.max(0, dragStateRef.current.startOffset + daysDelta)
      setCurrentOffset(newOffset)
      onDrag?.(task.id, newOffset)
    }

    const handleGlobalTouchEnd = () => {
      if (!dragStateRef.current.isDragging) return
      setIsDragging(false)
      const newStartDate = new Date(dateRange.start)
      newStartDate.setDate(newStartDate.getDate() + currentOffset)
      onDragEnd?.(task.id, newStartDate.toISOString().split('T')[0], currentOffset)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove)
      window.addEventListener('mouseup', handleGlobalMouseUp)
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false })
      window.addEventListener('touchend', handleGlobalTouchEnd)
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove)
        window.removeEventListener('mouseup', handleGlobalMouseUp)
        window.removeEventListener('touchmove', handleGlobalTouchMove)
        window.removeEventListener('touchend', handleGlobalTouchEnd)
      }
    }
  }, [isDragging, dayWidth, dateRange.start, task.id, currentOffset, onDrag, onDragEnd])

  return (
    <div
      ref={barRef}
      className={`absolute h-6 rounded group transition-all ${
        isDragging ? 'cursor-grabbing z-50 shadow-lg scale-105' : 'cursor-grab hover:brightness-110'
      } ${task.locked ? 'cursor-not-allowed opacity-75' : ''}`}
      style={{
        left: `${currentOffset * dayWidth}px`,
        width: `${Math.max(width * dayWidth, dayWidth)}px`,
        top: '4px',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={(e) => {
        if (!isDragging) onClick?.(task)
      }}
      title={`${task.name}\n${task.start_date} - ${task.end_date}\nStatus: ${task.status}${task.stage ? `\nStage: ${task.stage}` : ''}${task.trade ? `\nTrade: ${task.trade}` : ''}${task.locked ? '\n(Locked - cannot drag)' : '\n(Drag to move)'}`}
    >
      {/* Background bar */}
      <div
        className={`absolute inset-0 rounded ${getBarColor() || ''} ${isDragging ? 'opacity-50' : 'opacity-30'}`}
        style={getBarHexColor() && !getBarColor() ? { backgroundColor: getBarHexColor() } : undefined}
      />

      {/* Progress fill */}
      <div
        className={`absolute inset-y-0 left-0 rounded-l ${getBarColor() || ''}`}
        style={{
          width: getProgressWidth(),
          ...(getBarHexColor() && !getBarColor() ? { backgroundColor: getBarHexColor() } : {})
        }}
      />

      {/* Task label */}
      <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
        {task.is_hold_task && <PauseIcon className="h-3 w-3 text-white mr-1 flex-shrink-0" />}
        <span className="text-xs text-white font-medium truncate drop-shadow-sm">
          {task.task_number}. {task.name}
        </span>
      </div>

      {/* Lock indicator */}
      {task.locked && (
        <div className="absolute -right-1 -top-1 w-3 h-3 bg-yellow-400 rounded-full border border-white" />
      )}

      {/* Drag handles on hover */}
      {!task.locked && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30 rounded-l" />
          <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/30 rounded-r" />
        </>
      )}
    </div>
  )
}

// Dependency line component with type support
// Types: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish)
const DependencyLine = ({ fromTask, toTask, tasks, dateRange, dayWidth, rowHeight, depType = 'FS', lag = 0 }) => {
  // Find task positions
  const fromIndex = tasks.findIndex(t => t.id === fromTask.id)
  const toIndex = tasks.findIndex(t => t.id === toTask.id)

  if (fromIndex === -1 || toIndex === -1) return null

  // Calculate X positions based on dependency type
  let fromX, toX
  const fromStartOffset = daysBetween(dateRange.start, new Date(fromTask.start_date)) - 1
  const fromEndOffset = daysBetween(dateRange.start, new Date(fromTask.end_date))
  const toStartOffset = daysBetween(dateRange.start, new Date(toTask.start_date)) - 1
  const toEndOffset = daysBetween(dateRange.start, new Date(toTask.end_date))

  // Set connection points based on dependency type
  switch (depType) {
    case 'SS': // Start-to-Start
      fromX = fromStartOffset * dayWidth
      toX = toStartOffset * dayWidth
      break
    case 'FF': // Finish-to-Finish
      fromX = fromEndOffset * dayWidth
      toX = toEndOffset * dayWidth
      break
    case 'SF': // Start-to-Finish
      fromX = fromStartOffset * dayWidth
      toX = toEndOffset * dayWidth
      break
    case 'FS': // Finish-to-Start (default)
    default:
      fromX = fromEndOffset * dayWidth
      toX = toStartOffset * dayWidth
      break
  }

  // Task bars have top: 4px and height: 24px (h-6), so center is at 4 + 12 = 16px from row top
  const taskBarOffset = 4 + 12 // top offset + half of bar height
  const fromY = fromIndex * rowHeight + taskBarOffset
  const toY = toIndex * rowHeight + taskBarOffset

  // Determine path style based on dependency type
  const getStrokeDasharray = () => {
    switch (depType) {
      case 'SS': return '4,4'      // Dashed
      case 'FF': return '2,2'      // Dotted
      case 'SF': return '6,3,2,3'  // Dash-dot
      case 'FS':
      default: return 'none'       // Solid
    }
  }

  // Build path - route dependency lines cleanly between task bars
  const buildPath = () => {
    const padding = 8

    // For FS dependencies going to the next row, use a simple elbow connector
    if (depType === 'FS') {
      if (toIndex > fromIndex) {
        // Going down: exit right from end, go down, enter left to start
        const midX = fromX + padding
        return `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`
      } else {
        // Going up: need to route around
        const midX = Math.max(fromX, toX) + padding * 2
        return `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`
      }
    }

    if (depType === 'SS') {
      // Start-to-Start: exit left, go to target start
      const minX = Math.min(fromX, toX) - padding
      return `M ${fromX} ${fromY} L ${minX} ${fromY} L ${minX} ${toY} L ${toX} ${toY}`
    }

    if (depType === 'FF') {
      // Finish-to-Finish: exit right, go to target end
      const maxX = Math.max(fromX, toX) + padding
      return `M ${fromX} ${fromY} L ${maxX} ${fromY} L ${maxX} ${toY} L ${toX} ${toY}`
    }

    if (depType === 'SF') {
      // Start-to-Finish: exit left from start, route to end
      const midX = fromX - padding
      return `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`
    }

    // Default fallback
    return `M ${fromX} ${fromY} L ${toX} ${toY}`
  }

  // Marker ID based on type (for correct arrowhead color)
  const markerId = `arrowhead-${depType.toLowerCase()}`
  const pathD = buildPath()

  return (
    <g>
      <path
        d={pathD}
        fill="none"
        stroke="#F59E0B"
        strokeWidth="2.5"
        strokeDasharray={getStrokeDasharray()}
        markerEnd={`url(#${markerId})`}
        className="pointer-events-none"
        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }}
      />
      {/* Show lag label if non-zero */}
      {lag !== 0 && (
        <text
          x={(fromX + toX) / 2}
          y={Math.min(fromY, toY) - 4}
          fontSize="10"
          fill="#F59E0B"
          textAnchor="middle"
          className="pointer-events-none font-medium"
        >
          {lag > 0 ? `+${lag}d` : `${lag}d`}
        </text>
      )}
    </g>
  )
}

export default function SmGanttChart({ tasks = [], dependencies = [], onTaskClick, onTaskUpdate }) {
  const containerRef = useRef(null)
  const gridScrollRef = useRef(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [dayWidth, setDayWidth] = useState(40)
  const [isMobile, setIsMobile] = useState(false)
  const [gridScrollTop, setGridScrollTop] = useState(0)
  const [gridHeight, setGridHeight] = useState(400)
  const rowHeight = 34
  const overscan = 5 // Extra rows to render above/below visible area

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Track grid container height for virtualization
  useEffect(() => {
    const updateHeight = () => {
      if (gridScrollRef.current) {
        setGridHeight(gridScrollRef.current.clientHeight)
      }
    }
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  // Calculate visible rows for virtualization
  const visibleRowRange = useMemo(() => {
    const startRow = Math.max(0, Math.floor(gridScrollTop / rowHeight) - overscan)
    const visibleCount = Math.ceil(gridHeight / rowHeight) + overscan * 2
    const endRow = Math.min(tasks.length, startRow + visibleCount)
    return { startRow, endRow }
  }, [gridScrollTop, gridHeight, tasks.length, rowHeight])

  const dateRange = useMemo(() => getDateRange(tasks), [tasks])
  const dateColumns = useMemo(() => generateDateColumns(dateRange.start, dateRange.end), [dateRange])

  // Scroll to today on mount
  useEffect(() => {
    if (containerRef.current) {
      const today = new Date()
      const daysFromStart = daysBetween(dateRange.start, today)
      const scrollTo = Math.max(0, (daysFromStart - 5) * dayWidth)
      containerRef.current.scrollLeft = scrollTo
    }
  }, [dateRange, dayWidth])

  const handleZoomIn = () => setDayWidth(prev => Math.min(prev + 10, 100))
  const handleZoomOut = () => setDayWidth(prev => Math.max(prev - 10, 20))

  const totalWidth = dateColumns.length * dayWidth
  const totalHeight = tasks.length * rowHeight

  // Group dates by month for header
  const monthGroups = useMemo(() => {
    const groups = []
    let currentMonth = null
    let currentGroup = null

    dateColumns.forEach((date, index) => {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`
      if (monthKey !== currentMonth) {
        if (currentGroup) groups.push(currentGroup)
        currentMonth = monthKey
        currentGroup = {
          label: date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }),
          startIndex: index,
          count: 1
        }
      } else {
        currentGroup.count++
      }
    })
    if (currentGroup) groups.push(currentGroup)
    return groups
  }, [dateColumns])

  if (!tasks || tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium">No tasks to display</p>
          <p className="text-sm mt-2">Create tasks to see them on the Gantt chart</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {tasks.length} tasks
          </span>
          {/* Stage Legend - hidden on mobile */}
          {!isMobile && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Stages:</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-slate-500" title="Pre-construction" />
                <span className="text-gray-500">Pre</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-600" title="Slab" />
                <span className="text-gray-500">Slab</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-orange-500" title="Frame" />
                <span className="text-gray-500">Frame</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500" title="Lockup" />
                <span className="text-gray-500">Lockup</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-indigo-500" title="Fixing" />
                <span className="text-gray-500">Fixing</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-purple-500" title="Finishing" />
                <span className="text-gray-500">Finish</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500" title="Handover" />
                <span className="text-gray-500">Handover</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Zoom out"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-500 min-w-[40px] text-center">{dayWidth}px</span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Zoom in"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Task grid (fixed left panel) - responsive width */}
        <div
          className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden"
          style={{ width: isMobile ? '200px' : '420px' }}
        >
          {/* Grid Header */}
          <div className="h-[52px] border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center">
            <div className="w-10 px-2 text-xs font-medium text-gray-500 uppercase">#</div>
            <div className="flex-1 min-w-[100px] md:min-w-[180px] px-2 text-xs font-medium text-gray-500 uppercase">Task Name</div>
            {!isMobile && (
              <>
                <div className="w-14 px-2 text-xs font-medium text-gray-500 uppercase text-center">Days</div>
                <div className="w-20 px-2 text-xs font-medium text-gray-500 uppercase">Trade</div>
                <div className="w-20 px-2 text-xs font-medium text-gray-500 uppercase">Stage</div>
              </>
            )}
          </div>
          {/* Grid Rows - Virtualized */}
          <div
            ref={gridScrollRef}
            className="overflow-y-auto"
            style={{ height: `calc(100% - 52px)` }}
            onScroll={(e) => setGridScrollTop(e.target.scrollTop)}
          >
            <div style={{ height: `${tasks.length * rowHeight}px`, position: 'relative' }}>
              {tasks.slice(visibleRowRange.startRow, visibleRowRange.endRow).map((task, index) => {
                const actualIndex = visibleRowRange.startRow + index
                return (
                  <div
                    key={task.id}
                    className={`flex items-center border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      task.is_hold_task ? 'bg-red-50 dark:bg-red-900/20' : ''
                    }`}
                    style={{
                      height: `${rowHeight}px`,
                      position: 'absolute',
                      top: `${actualIndex * rowHeight}px`,
                      left: 0,
                      right: 0
                    }}
                    onClick={() => onTaskClick?.(task)}
                  >
                    <div className="w-10 px-2 text-xs text-gray-400 font-medium">{task.task_number}</div>
                    <div className="flex-1 min-w-[100px] md:min-w-[180px] px-2 flex items-center gap-2 overflow-hidden">
                      {/* Color indicator */}
                      <div
                        className="w-2 h-4 rounded-sm flex-shrink-0"
                        style={{
                          backgroundColor: task.color || (task.stage ? {
                            'pre-construction': '#64748b',
                            'slab': '#d97706',
                            'frame': '#f97316',
                            'lockup': '#3b82f6',
                            'fixing': '#6366f1',
                            'finishing': '#a855f7',
                            'handover': '#22c55e',
                          }[task.stage] : '#9ca3af')
                        }}
                      />
                      <span className={`text-sm truncate ${task.is_hold_task ? 'text-red-600 font-medium' : 'text-gray-900 dark:text-gray-100'}`}>
                        {task.name}
                      </span>
                    </div>
                    {!isMobile && (
                      <>
                        <div className="w-14 px-2 text-xs text-gray-500 text-center">{task.duration_days || '-'}</div>
                        <div className="w-20 px-2 text-xs text-gray-500 truncate capitalize">{task.trade || '-'}</div>
                        <div className="w-20 px-2 text-xs text-gray-500 truncate capitalize">{task.stage?.replace('-', ' ') || '-'}</div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Timeline area (scrollable) */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto"
          onScroll={(e) => setScrollLeft(e.target.scrollLeft)}
        >
          {/* Timeline header */}
          <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {/* Month row */}
            <div className="flex h-6 border-b border-gray-200 dark:border-gray-700" style={{ width: `${totalWidth}px` }}>
              {monthGroups.map((group, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700"
                  style={{ width: `${group.count * dayWidth}px` }}
                >
                  {group.label}
                </div>
              ))}
            </div>
            {/* Day row */}
            <div className="flex h-6" style={{ width: `${totalWidth}px` }}>
              {dateColumns.map((date, i) => {
                const isToday = date.toDateString() === new Date().toDateString()
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-center text-xs border-r border-gray-200 dark:border-gray-700 ${
                      isToday ? 'bg-blue-100 dark:bg-blue-900/30 font-bold text-blue-600' :
                      isWeekend ? 'bg-gray-100 dark:bg-gray-800 text-gray-400' :
                      'text-gray-500'
                    }`}
                    style={{ width: `${dayWidth}px` }}
                  >
                    {date.getDate()}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Task bars area */}
          <div className="relative" style={{ width: `${totalWidth}px`, height: `${totalHeight}px` }}>
            {/* Grid lines */}
            {dateColumns.map((date, i) => {
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              const isToday = date.toDateString() === new Date().toDateString()
              return (
                <div
                  key={i}
                  className={`absolute top-0 bottom-0 border-r ${
                    isToday ? 'border-blue-400 border-dashed' :
                    isWeekend ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50' :
                    'border-gray-100 dark:border-gray-800'
                  }`}
                  style={{ left: `${i * dayWidth}px`, width: `${dayWidth}px` }}
                />
              )
            })}

            {/* Row backgrounds */}
            {tasks.map((task, i) => (
              <div
                key={task.id}
                className={`absolute left-0 right-0 border-b border-gray-100 dark:border-gray-800 ${
                  task.is_hold_task ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                }`}
                style={{ top: `${i * rowHeight}px`, height: `${rowHeight}px` }}
              />
            ))}

            {/* Dependency lines SVG - rendered with z-index to appear above task bars */}
            <svg
              className="absolute inset-0 pointer-events-none z-20"
              style={{ width: `${totalWidth}px`, height: `${totalHeight}px` }}
            >
              <defs>
                {/* Yellow arrowheads for each dependency type */}
                <marker
                  id="arrowhead-fs"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 0, 8 4, 0 8" fill="#F59E0B" />
                </marker>
                <marker
                  id="arrowhead-ss"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 0, 8 4, 0 8" fill="#F59E0B" />
                </marker>
                <marker
                  id="arrowhead-ff"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 0, 8 4, 0 8" fill="#F59E0B" />
                </marker>
                <marker
                  id="arrowhead-sf"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <polygon points="0 0, 8 4, 0 8" fill="#F59E0B" />
                </marker>
              </defs>
              {dependencies.map((dep, i) => {
                const fromTask = tasks.find(t => t.id === dep.source || t.id === dep.predecessor_id)
                const toTask = tasks.find(t => t.id === dep.target || t.id === dep.successor_id)
                if (!fromTask || !toTask) {
                  return null
                }
                return (
                  <DependencyLine
                    key={i}
                    fromTask={fromTask}
                    toTask={toTask}
                    tasks={tasks}
                    dateRange={dateRange}
                    dayWidth={dayWidth}
                    rowHeight={rowHeight}
                    depType={dep.type || dep.dependency_type || 'FS'}
                    lag={dep.lag || dep.lag_days || 0}
                  />
                )
              })}
            </svg>

            {/* Task bars - z-10 to be below dependency lines */}
            {tasks.map((task, index) => {
              const taskStart = new Date(task.start_date)
              const taskEnd = new Date(task.end_date)
              const startOffset = daysBetween(dateRange.start, taskStart) - 1
              const duration = daysBetween(taskStart, taskEnd)

              return (
                <div
                  key={task.id}
                  className="absolute left-0 right-0 z-10"
                  style={{ top: `${index * rowHeight}px`, height: `${rowHeight}px` }}
                >
                  <TaskBar
                    task={task}
                    startOffset={startOffset}
                    width={duration}
                    dayWidth={dayWidth}
                    onClick={onTaskClick}
                    dateRange={dateRange}
                    onDragEnd={(taskId, newStartDate, newOffset) => {
                      // Calculate new end date based on duration
                      const start = new Date(newStartDate)
                      const end = new Date(start)
                      end.setDate(start.getDate() + (task.duration_days || duration) - 1)

                      onTaskUpdate?.(taskId, {
                        start_date: newStartDate,
                        end_date: end.toISOString().split('T')[0]
                      })
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
