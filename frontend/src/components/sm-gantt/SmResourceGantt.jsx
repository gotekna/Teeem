import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, UserIcon, WrenchIcon, CubeIcon } from '@heroicons/react/24/outline'

// Helper to format date
const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
}

// Helper to get days between dates
const daysBetween = (start, end) => {
  const s = new Date(start)
  const e = new Date(end)
  return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1
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

// Resource type icons
const ResourceTypeIcon = ({ type }) => {
  switch (type) {
    case 'person':
      return <UserIcon className="w-4 h-4" />
    case 'equipment':
      return <WrenchIcon className="w-4 h-4" />
    case 'material':
      return <CubeIcon className="w-4 h-4" />
    default:
      return <UserIcon className="w-4 h-4" />
  }
}

// Allocation bar component
const AllocationBar = ({ allocation, startOffset, width, dayWidth, onClick }) => {
  // Color based on status
  const getBarColor = () => {
    switch (allocation.status) {
      case 'completed': return 'bg-green-500'
      case 'in_progress': return 'bg-blue-500'
      case 'confirmed': return 'bg-indigo-500'
      default: return 'bg-gray-400'
    }
  }

  return (
    <div
      className={`absolute h-6 ${getBarColor()} rounded cursor-pointer shadow-sm
        hover:shadow-md transition-shadow flex items-center justify-center text-white text-xs truncate px-1`}
      style={{
        left: `${startOffset * dayWidth}px`,
        width: `${width * dayWidth - 2}px`,
        top: '4px'
      }}
      onClick={() => onClick?.(allocation)}
      title={`${allocation.task_name}: ${allocation.allocated_hours}h`}
    >
      {width > 2 && allocation.task_name}
    </div>
  )
}

// Utilization cell - shows daily utilization with color coding
const UtilizationCell = ({ hours, capacity, dayWidth }) => {
  const utilization = capacity > 0 ? (hours / capacity) * 100 : 0

  const getColor = () => {
    if (utilization === 0) return 'bg-gray-100'
    if (utilization < 50) return 'bg-green-100'
    if (utilization < 80) return 'bg-yellow-100'
    if (utilization < 100) return 'bg-orange-100'
    return 'bg-red-200' // Over-allocated
  }

  return (
    <div
      className={`h-full ${getColor()} border-r border-gray-200 flex items-end justify-center`}
      style={{ width: `${dayWidth}px` }}
      title={`${hours.toFixed(1)}h / ${capacity}h (${utilization.toFixed(0)}%)`}
    >
      {hours > 0 && (
        <div
          className={`w-full ${utilization > 100 ? 'bg-red-500' : 'bg-blue-500'} transition-all`}
          style={{ height: `${Math.min(utilization, 100)}%` }}
        />
      )}
    </div>
  )
}

// Resource row component
const ResourceRow = ({
  resource,
  allocations,
  dateRange,
  dayWidth,
  onAllocationClick,
  showUtilization
}) => {
  const dates = generateDateColumns(dateRange.start, dateRange.end)

  // Calculate daily hours
  const dailyHours = useMemo(() => {
    const hours = {}
    dates.forEach(d => {
      const dateStr = d.toISOString().split('T')[0]
      hours[dateStr] = 0
    })

    allocations.forEach(a => {
      const dateStr = a.allocation_date
      if (hours[dateStr] !== undefined) {
        hours[dateStr] += a.allocated_hours
      }
    })

    return hours
  }, [allocations, dates])

  // Group consecutive allocations by task for bar rendering
  const groupedAllocations = useMemo(() => {
    const groups = []
    const byTask = {}

    allocations.forEach(a => {
      if (!byTask[a.task_id]) {
        byTask[a.task_id] = []
      }
      byTask[a.task_id].push(a)
    })

    Object.entries(byTask).forEach(([taskId, taskAllocations]) => {
      // Sort by date
      taskAllocations.sort((a, b) => new Date(a.allocation_date) - new Date(b.allocation_date))

      // Find contiguous ranges
      let currentGroup = null
      taskAllocations.forEach(a => {
        if (!currentGroup) {
          currentGroup = {
            task_id: a.task_id,
            task_name: a.task_name,
            task_number: a.task_number,
            status: a.status,
            start_date: a.allocation_date,
            end_date: a.allocation_date,
            allocated_hours: a.allocated_hours,
            allocations: [a]
          }
        } else {
          // Check if contiguous (within 1 day)
          const prevDate = new Date(currentGroup.end_date)
          const currDate = new Date(a.allocation_date)
          const diffDays = Math.ceil((currDate - prevDate) / (1000 * 60 * 60 * 24))

          if (diffDays <= 1) {
            currentGroup.end_date = a.allocation_date
            currentGroup.allocated_hours += a.allocated_hours
            currentGroup.allocations.push(a)
          } else {
            groups.push(currentGroup)
            currentGroup = {
              task_id: a.task_id,
              task_name: a.task_name,
              task_number: a.task_number,
              status: a.status,
              start_date: a.allocation_date,
              end_date: a.allocation_date,
              allocated_hours: a.allocated_hours,
              allocations: [a]
            }
          }
        }
      })

      if (currentGroup) {
        groups.push(currentGroup)
      }
    })

    return groups
  }, [allocations])

  const capacity = resource.availability_hours_per_day || 8

  return (
    <div className="flex border-b border-gray-200 hover:bg-gray-50">
      {/* Resource info column */}
      <div className="w-64 min-w-64 flex-shrink-0 flex items-center gap-2 px-3 py-2 border-r border-gray-200 bg-white sticky left-0 z-10">
        <div className={`p-1.5 rounded ${
          resource.resource_type === 'person' ? 'bg-blue-100 text-blue-600' :
          resource.resource_type === 'equipment' ? 'bg-amber-100 text-amber-600' :
          'bg-green-100 text-green-600'
        }`}>
          <ResourceTypeIcon type={resource.resource_type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{resource.name}</div>
          <div className="text-xs text-gray-500 truncate">
            {resource.trade || resource.resource_type} • {capacity}h/day
          </div>
        </div>
      </div>

      {/* Timeline cells */}
      <div className="flex-1 relative" style={{ minWidth: `${dates.length * dayWidth}px` }}>
        {showUtilization ? (
          <div className="flex h-8">
            {dates.map((date, i) => {
              const dateStr = date.toISOString().split('T')[0]
              return (
                <UtilizationCell
                  key={i}
                  hours={dailyHours[dateStr] || 0}
                  capacity={capacity}
                  dayWidth={dayWidth}
                />
              )
            })}
          </div>
        ) : (
          <div className="h-8 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex">
              {dates.map((date, i) => (
                <div
                  key={i}
                  className={`border-r border-gray-200 ${
                    date.getDay() === 0 || date.getDay() === 6 ? 'bg-gray-50' : ''
                  }`}
                  style={{ width: `${dayWidth}px` }}
                />
              ))}
            </div>

            {/* Allocation bars */}
            {groupedAllocations.map((group, i) => {
              const startOffset = daysBetween(dateRange.start, group.start_date) - 1
              const width = daysBetween(group.start_date, group.end_date)

              return (
                <AllocationBar
                  key={`${group.task_id}-${i}`}
                  allocation={group}
                  startOffset={startOffset}
                  width={width}
                  dayWidth={dayWidth}
                  onClick={onAllocationClick}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Main Resource Gantt component
export default function SmResourceGantt({
  resources = [],
  allocations = [],
  startDate,
  endDate,
  onAllocationClick,
  onResourceClick,
  showUtilization = false,
  dayWidth = 40,
  className = ''
}) {
  const [dateRange, setDateRange] = useState(() => {
    const start = startDate ? new Date(startDate) : new Date()
    const end = endDate ? new Date(endDate) : new Date()

    if (!startDate || !endDate) {
      start.setDate(start.getDate() - 7)
      end.setDate(end.getDate() + 28)
    }

    return { start, end }
  })

  const scrollContainerRef = useRef(null)
  const dates = useMemo(() => generateDateColumns(dateRange.start, dateRange.end), [dateRange])

  // Scroll to today on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const today = new Date()
      const offset = daysBetween(dateRange.start, today) - 1
      if (offset > 0) {
        const scrollPosition = offset * dayWidth - (scrollContainerRef.current.clientWidth / 2)
        scrollContainerRef.current.scrollLeft = Math.max(0, scrollPosition)
      }
    }
  }, [])

  // Navigate timeline
  const shiftTimeline = (days) => {
    setDateRange(prev => ({
      start: new Date(prev.start.getTime() + days * 24 * 60 * 60 * 1000),
      end: new Date(prev.end.getTime() + days * 24 * 60 * 60 * 1000)
    }))
  }

  // Group allocations by resource
  const allocationsByResource = useMemo(() => {
    const grouped = {}
    allocations.forEach(a => {
      if (!grouped[a.resource_id]) {
        grouped[a.resource_id] = []
      }
      grouped[a.resource_id].push(a)
    })
    return grouped
  }, [allocations])

  // Calculate totals
  const totals = useMemo(() => {
    const totalCapacity = resources.reduce((sum, r) =>
      sum + ((r.availability_hours_per_day || 8) * dates.length), 0)
    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocated_hours, 0)

    return {
      capacity: totalCapacity,
      allocated: totalAllocated,
      utilization: totalCapacity > 0 ? (totalAllocated / totalCapacity) * 100 : 0
    }
  }, [resources, allocations, dates])

  return (
    <div className={`flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Header with navigation */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftTimeline(-7)}
            className="p-1 rounded hover:bg-gray-200"
            title="Previous week"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium">
            {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
          </span>
          <button
            onClick={() => shiftTimeline(7)}
            className="p-1 rounded hover:bg-gray-200"
            title="Next week"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-gray-500">Resources:</span>{' '}
            <span className="font-medium">{resources.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Utilization:</span>{' '}
            <span className={`font-medium ${
              totals.utilization > 100 ? 'text-red-600' :
              totals.utilization > 80 ? 'text-amber-600' :
              'text-green-600'
            }`}>
              {totals.utilization.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Timeline container */}
      <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
        <div className="inline-block min-w-full">
          {/* Date header */}
          <div className="flex sticky top-0 z-20 bg-white border-b border-gray-300">
            <div className="w-64 min-w-64 flex-shrink-0 px-3 py-2 border-r border-gray-200 bg-gray-50 sticky left-0 z-30">
              <span className="text-xs font-semibold text-gray-600">Resource</span>
            </div>
            <div className="flex">
              {dates.map((date, i) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                const isToday = date.toDateString() === new Date().toDateString()

                return (
                  <div
                    key={i}
                    className={`text-center border-r border-gray-200 py-1 ${
                      isWeekend ? 'bg-gray-100' : 'bg-gray-50'
                    } ${isToday ? 'bg-blue-50' : ''}`}
                    style={{ width: `${dayWidth}px` }}
                  >
                    <div className="text-xs text-gray-500">
                      {date.toLocaleDateString('en-AU', { weekday: 'short' })}
                    </div>
                    <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                      {date.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Resource rows */}
          <div>
            {resources.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No resources to display
              </div>
            ) : (
              resources.map(resource => (
                <ResourceRow
                  key={resource.id}
                  resource={resource}
                  allocations={allocationsByResource[resource.id] || []}
                  dateRange={dateRange}
                  dayWidth={dayWidth}
                  onAllocationClick={onAllocationClick}
                  showUtilization={showUtilization}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs">
        <span className="text-gray-500">Status:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-400" />
          <span>Planned</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-indigo-500" />
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Completed</span>
        </div>
      </div>
    </div>
  )
}
