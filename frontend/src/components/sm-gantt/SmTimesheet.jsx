import { useState, useMemo } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'

// Format hours for display
const formatHours = (hours) => {
  if (!hours || hours === 0) return '-'
  return hours.toFixed(1)
}

// Get week dates starting from a date
const getWeekDates = (startDate) => {
  const dates = []
  const start = new Date(startDate)
  // Adjust to Monday
  const day = start.getDay()
  const diff = start.getDate() - day + (day === 0 ? -6 : 1)
  start.setDate(diff)

  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    dates.push(date)
  }
  return dates
}

// Time entry cell component
const TimeEntryCell = ({ entries, date, onEntryClick, onAddEntry }) => {
  const totalHours = entries.reduce((sum, e) => sum + (e.total_hours || 0), 0)
  const hasApproved = entries.some(e => e.approved)
  const hasPending = entries.some(e => !e.approved)
  const isWeekend = date.getDay() === 0 || date.getDay() === 6

  return (
    <div
      className={`min-h-16 p-1 border-r border-gray-200 ${
        isWeekend ? 'bg-gray-50' : ''
      } group relative`}
    >
      {entries.length > 0 ? (
        <div className="space-y-1">
          {entries.map(entry => (
            <div
              key={entry.id}
              className={`text-xs p-1 rounded cursor-pointer hover:ring-2 hover:ring-blue-400 ${
                entry.approved
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
              onClick={() => onEntryClick?.(entry)}
              title={entry.description || `${entry.entry_type}: ${entry.total_hours}h`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{formatHours(entry.total_hours)}h</span>
                {entry.approved && <CheckCircleSolid className="w-3 h-3 text-green-600" />}
              </div>
              <div className="truncate text-gray-600">{entry.task_name}</div>
            </div>
          ))}
        </div>
      ) : (
        <button
          onClick={() => onAddEntry?.(date)}
          className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <PlusIcon className="w-5 h-5 text-gray-400" />
        </button>
      )}

      {totalHours > 0 && (
        <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-gray-100 text-xs font-medium text-center border-t">
          {formatHours(totalHours)}h
        </div>
      )}
    </div>
  )
}

// Resource timesheet row
const TimesheetRow = ({
  resource,
  timeEntries,
  weekDates,
  onEntryClick,
  onAddEntry,
  onApproveAll,
  selectable = false,
  selected = false,
  onSelect
}) => {
  // Group entries by date
  const entriesByDate = useMemo(() => {
    const grouped = {}
    weekDates.forEach(d => {
      const dateStr = d.toISOString().split('T')[0]
      grouped[dateStr] = []
    })

    timeEntries.forEach(entry => {
      const dateStr = entry.entry_date
      if (grouped[dateStr]) {
        grouped[dateStr].push(entry)
      }
    })

    return grouped
  }, [timeEntries, weekDates])

  // Calculate totals
  const totals = useMemo(() => {
    const regular = timeEntries.filter(e => e.entry_type === 'regular').reduce((sum, e) => sum + e.total_hours, 0)
    const overtime = timeEntries.filter(e => e.entry_type === 'overtime').reduce((sum, e) => sum + e.total_hours, 0)
    const total = timeEntries.reduce((sum, e) => sum + e.total_hours, 0)
    const approved = timeEntries.filter(e => e.approved).reduce((sum, e) => sum + e.total_hours, 0)
    const pending = timeEntries.filter(e => !e.approved).reduce((sum, e) => sum + e.total_hours, 0)

    return { regular, overtime, total, approved, pending }
  }, [timeEntries])

  const hasPendingEntries = totals.pending > 0

  return (
    <div className="flex border-b border-gray-200 hover:bg-gray-50">
      {/* Resource column */}
      <div className="w-52 min-w-52 flex-shrink-0 flex items-center gap-2 px-3 py-2 border-r border-gray-200 bg-white sticky left-0 z-10">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(resource.id, e.target.checked)}
            className="rounded border-gray-300"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{resource.name}</div>
          <div className="text-xs text-gray-500">{resource.trade || resource.resource_type}</div>
        </div>
        {hasPendingEntries && (
          <button
            onClick={() => onApproveAll?.(resource.id, timeEntries.filter(e => !e.approved).map(e => e.id))}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
            title="Approve all pending"
          >
            <CheckCircleIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Day cells */}
      {weekDates.map((date, i) => {
        const dateStr = date.toISOString().split('T')[0]
        return (
          <div key={i} className="w-24 min-w-24">
            <TimeEntryCell
              entries={entriesByDate[dateStr] || []}
              date={date}
              onEntryClick={onEntryClick}
              onAddEntry={onAddEntry}
            />
          </div>
        )
      })}

      {/* Totals columns */}
      <div className="w-20 min-w-20 px-2 py-2 border-l border-gray-300 bg-gray-50 text-center">
        <div className="text-sm font-medium">{formatHours(totals.regular)}</div>
        <div className="text-xs text-gray-500">Regular</div>
      </div>
      <div className="w-20 min-w-20 px-2 py-2 border-l border-gray-200 bg-gray-50 text-center">
        <div className="text-sm font-medium text-amber-600">{formatHours(totals.overtime)}</div>
        <div className="text-xs text-gray-500">OT</div>
      </div>
      <div className="w-20 min-w-20 px-2 py-2 border-l border-gray-200 bg-gray-50 text-center">
        <div className="text-sm font-bold">{formatHours(totals.total)}</div>
        <div className="text-xs text-gray-500">Total</div>
      </div>
    </div>
  )
}

// Time Entry Modal
const TimeEntryModal = ({ isOpen, onClose, entry, tasks, onSave, onDelete }) => {
  const [formData, setFormData] = useState({
    task_id: entry?.task_id || '',
    entry_date: entry?.entry_date || new Date().toISOString().split('T')[0],
    start_time: entry?.start_time || '',
    end_time: entry?.end_time || '',
    break_minutes: entry?.break_minutes || 0,
    total_hours: entry?.total_hours || '',
    entry_type: entry?.entry_type || 'regular',
    description: entry?.description || ''
  })

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave?.(formData)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-medium">{entry?.id ? 'Edit' : 'Log'} Time Entry</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Task */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task</label>
            <select
              value={formData.task_id}
              onChange={(e) => setFormData(prev => ({ ...prev, task_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Select task...</option>
              {tasks?.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={formData.entry_date}
              onChange={(e) => setFormData(prev => ({ ...prev, entry_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          {/* Hours and break */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Hours</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={formData.total_hours}
                onChange={(e) => setFormData(prev => ({ ...prev, total_hours: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Break (mins)</label>
              <input
                type="number"
                step="5"
                min="0"
                value={formData.break_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, break_minutes: parseInt(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          {/* Entry type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.entry_type}
              onChange={(e) => setFormData(prev => ({ ...prev, entry_type: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="regular">Regular</option>
              <option value="overtime">Overtime</option>
              <option value="travel">Travel</option>
              <option value="standby">Standby</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
              placeholder="Optional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            {entry?.id && (
              <button
                type="button"
                onClick={() => {
                  onDelete?.(entry.id)
                  onClose()
                }}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md"
              >
                Delete
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// Main Timesheet component
export default function SmTimesheet({
  resources = [],
  timeEntries = [],
  tasks = [],
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onApproveEntries,
  onExportPayroll,
  className = ''
}) {
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(today)
    monday.setDate(diff)
    return monday
  })

  const [selectedResources, setSelectedResources] = useState(new Set())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [addingDate, setAddingDate] = useState(null)
  const [addingResource, setAddingResource] = useState(null)

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  // Filter entries to current week
  const weekEntries = useMemo(() => {
    const start = weekDates[0].toISOString().split('T')[0]
    const end = weekDates[6].toISOString().split('T')[0]
    return timeEntries.filter(e => e.entry_date >= start && e.entry_date <= end)
  }, [timeEntries, weekDates])

  // Group entries by resource
  const entriesByResource = useMemo(() => {
    const grouped = {}
    weekEntries.forEach(e => {
      if (!grouped[e.resource_id]) {
        grouped[e.resource_id] = []
      }
      grouped[e.resource_id].push(e)
    })
    return grouped
  }, [weekEntries])

  // Navigate weeks
  const navigateWeek = (direction) => {
    setWeekStart(prev => {
      const newDate = new Date(prev)
      newDate.setDate(prev.getDate() + (direction * 7))
      return newDate
    })
  }

  // Handle entry click
  const handleEntryClick = (entry) => {
    setEditingEntry(entry)
    setModalOpen(true)
  }

  // Handle add entry
  const handleAddEntry = (date, resourceId) => {
    setAddingDate(date)
    setAddingResource(resourceId)
    setEditingEntry(null)
    setModalOpen(true)
  }

  // Handle save
  const handleSave = (formData) => {
    if (editingEntry?.id) {
      onUpdateEntry?.(editingEntry.id, formData)
    } else {
      onAddEntry?.({
        ...formData,
        resource_id: addingResource,
        entry_date: addingDate?.toISOString().split('T')[0] || formData.entry_date
      })
    }
  }

  // Handle bulk approve
  const handleApproveAll = (resourceId, entryIds) => {
    onApproveEntries?.(entryIds)
  }

  // Calculate weekly totals
  const weeklyTotals = useMemo(() => {
    return {
      regular: weekEntries.filter(e => e.entry_type === 'regular').reduce((sum, e) => sum + e.total_hours, 0),
      overtime: weekEntries.filter(e => e.entry_type === 'overtime').reduce((sum, e) => sum + e.total_hours, 0),
      total: weekEntries.reduce((sum, e) => sum + e.total_hours, 0),
      approved: weekEntries.filter(e => e.approved).reduce((sum, e) => sum + e.total_hours, 0),
      pending: weekEntries.filter(e => !e.approved).length
    }
  }, [weekEntries])

  return (
    <div className={`flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateWeek(-1)}
            className="p-1.5 rounded hover:bg-gray-200"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <div className="font-semibold">
              Week of {weekDates[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            </div>
            <div className="text-sm text-gray-500">
              {weekDates[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} -{' '}
              {weekDates[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <button
            onClick={() => navigateWeek(1)}
            className="p-1.5 rounded hover:bg-gray-200"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-gray-500">Total:</span>{' '}
            <span className="font-bold">{formatHours(weeklyTotals.total)}h</span>
            {weeklyTotals.pending > 0 && (
              <span className="ml-2 text-amber-600">({weeklyTotals.pending} pending)</span>
            )}
          </div>

          {onExportPayroll && (
            <button
              onClick={() => onExportPayroll(weekDates[0], weekDates[6])}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Export Payroll
            </button>
          )}
        </div>
      </div>

      {/* Timesheet grid */}
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          {/* Date headers */}
          <div className="flex sticky top-0 z-20 bg-white border-b border-gray-300">
            <div className="w-52 min-w-52 flex-shrink-0 px-3 py-2 border-r border-gray-200 bg-gray-50 sticky left-0 z-30">
              <span className="text-sm font-semibold text-gray-600">Resource</span>
            </div>
            {weekDates.map((date, i) => {
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              const isToday = date.toDateString() === new Date().toDateString()

              return (
                <div
                  key={i}
                  className={`w-24 min-w-24 text-center py-2 border-r border-gray-200 ${
                    isWeekend ? 'bg-gray-100' : 'bg-gray-50'
                  } ${isToday ? 'bg-blue-50' : ''}`}
                >
                  <div className="text-xs text-gray-500">
                    {date.toLocaleDateString('en-AU', { weekday: 'short' })}
                  </div>
                  <div className={`text-sm font-medium ${isToday ? 'text-blue-600' : ''}`}>
                    {date.getDate()}
                  </div>
                </div>
              )
            })}
            <div className="w-20 min-w-20 text-center py-2 border-l border-gray-300 bg-gray-100">
              <div className="text-xs text-gray-500">Reg</div>
            </div>
            <div className="w-20 min-w-20 text-center py-2 border-l border-gray-200 bg-gray-100">
              <div className="text-xs text-gray-500">OT</div>
            </div>
            <div className="w-20 min-w-20 text-center py-2 border-l border-gray-200 bg-gray-100">
              <div className="text-xs text-gray-500">Total</div>
            </div>
          </div>

          {/* Resource rows */}
          {resources.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No resources to display
            </div>
          ) : (
            resources.map(resource => (
              <TimesheetRow
                key={resource.id}
                resource={resource}
                timeEntries={entriesByResource[resource.id] || []}
                weekDates={weekDates}
                onEntryClick={handleEntryClick}
                onAddEntry={(date) => handleAddEntry(date, resource.id)}
                onApproveAll={handleApproveAll}
                selectable={false}
              />
            ))
          )}
        </div>
      </div>

      {/* Summary footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">Regular:</span>
            <span className="font-medium">{formatHours(weeklyTotals.regular)}h</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Overtime:</span>
            <span className="font-medium text-amber-600">{formatHours(weeklyTotals.overtime)}h</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4 text-green-500" />
            <span className="text-gray-500">Approved:</span>
            <span className="font-medium text-green-600">{formatHours(weeklyTotals.approved)}h</span>
          </div>
        </div>
      </div>

      {/* Time Entry Modal */}
      <TimeEntryModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingEntry(null)
          setAddingDate(null)
          setAddingResource(null)
        }}
        entry={editingEntry}
        tasks={tasks}
        onSave={handleSave}
        onDelete={onDeleteEntry}
      />
    </div>
  )
}
