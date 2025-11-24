import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon,
  ChartBarIcon,
  PlusIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { SmResourceGantt, SmTimesheet } from '../components/sm-gantt'
import { api } from '../api'

// Resource type badge
const ResourceTypeBadge = ({ type }) => {
  const styles = {
    person: 'bg-blue-100 text-blue-700',
    equipment: 'bg-amber-100 text-amber-700',
    material: 'bg-green-100 text-green-700'
  }

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${styles[type] || 'bg-gray-100 text-gray-700'}`}>
      {type}
    </span>
  )
}

// Resource list item
const ResourceListItem = ({ resource, selected, onClick }) => (
  <div
    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
      selected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
    }`}
    onClick={() => onClick(resource)}
  >
    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
      resource.resource_type === 'person' ? 'bg-blue-100 text-blue-600' :
      resource.resource_type === 'equipment' ? 'bg-amber-100 text-amber-600' :
      'bg-green-100 text-green-600'
    }`}>
      {resource.name?.charAt(0)?.toUpperCase() || '?'}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-gray-900 truncate">{resource.name}</div>
      <div className="text-xs text-gray-500">
        {resource.trade || resource.resource_type} • {resource.availability_hours_per_day || 8}h/day
      </div>
    </div>
    <ResourceTypeBadge type={resource.resource_type} />
  </div>
)

// Add/Edit Resource Modal
const ResourceModal = ({ isOpen, onClose, resource, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    resource_type: 'person',
    trade: '',
    email: '',
    phone: '',
    hourly_rate: '',
    availability_hours_per_day: 8,
    color: '#3b82f6',
    active: true
  })

  useEffect(() => {
    if (resource) {
      setFormData({
        name: resource.name || '',
        code: resource.code || '',
        resource_type: resource.resource_type || 'person',
        trade: resource.trade || '',
        email: resource.email || '',
        phone: resource.phone || '',
        hourly_rate: resource.hourly_rate || '',
        availability_hours_per_day: resource.availability_hours_per_day || 8,
        color: resource.color || '#3b82f6',
        active: resource.active !== false
      })
    }
  }, [resource])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">{resource?.id ? 'Edit' : 'Add'} Resource</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., JD001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={formData.resource_type}
                onChange={(e) => setFormData(prev => ({ ...prev, resource_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="person">Person</option>
                <option value="equipment">Equipment</option>
                <option value="material">Material</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trade</label>
              <input
                type="text"
                value={formData.trade}
                onChange={(e) => setFormData(prev => ({ ...prev, trade: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., Electrician"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.hourly_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hours/Day</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={formData.availability_hours_per_day}
                onChange={(e) => setFormData(prev => ({ ...prev, availability_hours_per_day: parseFloat(e.target.value) || 8 }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                className="w-full h-10 border border-gray-300 rounded-md cursor-pointer"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
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
              {resource?.id ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Tab definitions
const TABS = [
  { id: 'schedule', name: 'Resource Schedule', icon: CalendarDaysIcon },
  { id: 'timesheet', name: 'Timesheet', icon: ClockIcon },
  { id: 'utilization', name: 'Utilization', icon: ChartBarIcon }
]

export default function SmResourcesPage() {
  const { constructionId } = useParams()

  // State
  const [activeTab, setActiveTab] = useState('schedule')
  const [resources, setResources] = useState([])
  const [allocations, setAllocations] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [typeFilter, setTypeFilter] = useState('')
  const [tradeFilter, setTradeFilter] = useState('')

  // Selected resource
  const [selectedResource, setSelectedResource] = useState(null)

  // Modals
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [editingResource, setEditingResource] = useState(null)

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch resources
      const resourcesRes = await api.get('/api/v1/sm_resources', {
        params: { active: 'true', type: typeFilter || undefined }
      })
      setResources(resourcesRes.data.resources || [])

      // Fetch allocations for current date range
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 7)
      const endDate = new Date(today)
      endDate.setDate(endDate.getDate() + 28)

      // If we have a construction context, fetch task-related data
      if (constructionId) {
        const tasksRes = await api.get(`/api/v1/constructions/${constructionId}/sm_tasks`)
        setTasks(tasksRes.data.tasks || [])
      }

      // Fetch allocations
      const allocationsRes = await api.get('/api/v1/sm_resource_allocations/gantt_data', {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      })
      setAllocations(allocationsRes.data.allocations || [])

      // Fetch time entries
      const timeRes = await api.get('/api/v1/sm_time_entries/timesheet', {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      })

      // Flatten timesheet entries
      const entries = (timeRes.data.timesheet || []).flatMap(day =>
        day.entries.map(e => ({ ...e, entry_date: day.date }))
      )
      setTimeEntries(entries)

    } catch (err) {
      console.error('Error fetching resource data:', err)
      setError(err.message || 'Failed to load resources')
    } finally {
      setLoading(false)
    }
  }, [constructionId, typeFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter resources
  const filteredResources = resources.filter(r => {
    if (typeFilter && r.resource_type !== typeFilter) return false
    if (tradeFilter && r.trade !== tradeFilter) return false
    return true
  })

  // Get unique trades for filter
  const trades = [...new Set(resources.map(r => r.trade).filter(Boolean))]

  // Handle resource save
  const handleResourceSave = async (data) => {
    try {
      if (editingResource?.id) {
        await api.patch(`/api/v1/sm_resources/${editingResource.id}`, { sm_resource: data })
      } else {
        await api.post('/api/v1/sm_resources', { sm_resource: data })
      }
      fetchData()
    } catch (err) {
      console.error('Error saving resource:', err)
      alert('Failed to save resource')
    }
  }

  // Handle time entry operations
  const handleAddTimeEntry = async (entry) => {
    try {
      await api.post('/api/v1/sm_time_entries/log_time', entry)
      fetchData()
    } catch (err) {
      console.error('Error adding time entry:', err)
      alert('Failed to add time entry')
    }
  }

  const handleUpdateTimeEntry = async (id, data) => {
    try {
      await api.patch(`/api/v1/sm_time_entries/${id}`, { sm_time_entry: data })
      fetchData()
    } catch (err) {
      console.error('Error updating time entry:', err)
      alert('Failed to update time entry')
    }
  }

  const handleDeleteTimeEntry = async (id) => {
    if (!confirm('Delete this time entry?')) return
    try {
      await api.delete(`/api/v1/sm_time_entries/${id}`)
      fetchData()
    } catch (err) {
      console.error('Error deleting time entry:', err)
      alert('Failed to delete time entry')
    }
  }

  const handleApproveEntries = async (entryIds) => {
    try {
      await api.post('/api/v1/sm_time_entries/bulk_approve', { entry_ids: entryIds })
      fetchData()
    } catch (err) {
      console.error('Error approving entries:', err)
      alert('Failed to approve entries')
    }
  }

  const handleExportPayroll = async (startDate, endDate) => {
    try {
      const res = await api.get('/api/v1/sm_time_entries/export_payroll', {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      })
      // Download as JSON for now (could be CSV)
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payroll_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.json`
      a.click()
    } catch (err) {
      console.error('Error exporting payroll:', err)
      alert('Failed to export payroll')
    }
  }

  if (loading && resources.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserGroupIcon className="w-8 h-8 text-gray-400" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Resource Management</h1>
              <p className="text-sm text-gray-500">
                {filteredResources.length} resources • {allocations.length} allocations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Types</option>
              <option value="person">People</option>
              <option value="equipment">Equipment</option>
              <option value="material">Materials</option>
            </select>

            {/* Trade filter */}
            {trades.length > 0 && (
              <select
                value={tradeFilter}
                onChange={(e) => setTradeFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All Trades</option>
                {trades.map(trade => (
                  <option key={trade} value={trade}>{trade}</option>
                ))}
              </select>
            )}

            <button
              onClick={fetchData}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Refresh"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => {
                setEditingResource(null)
                setShowResourceModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <PlusIcon className="w-4 h-4" />
              Add Resource
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'bg-white border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Resource list sidebar */}
        <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-medium text-gray-700">Resources</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredResources.map(resource => (
              <ResourceListItem
                key={resource.id}
                resource={resource}
                selected={selectedResource?.id === resource.id}
                onClick={(r) => {
                  setSelectedResource(r)
                  setEditingResource(r)
                }}
              />
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'schedule' && (
            <SmResourceGantt
              resources={filteredResources}
              allocations={allocations}
              className="h-full"
              onAllocationClick={(allocation) => {
                // Could open task modal
                console.log('Allocation clicked:', allocation)
              }}
            />
          )}

          {activeTab === 'timesheet' && (
            <SmTimesheet
              resources={filteredResources}
              timeEntries={timeEntries}
              tasks={tasks}
              onAddEntry={handleAddTimeEntry}
              onUpdateEntry={handleUpdateTimeEntry}
              onDeleteEntry={handleDeleteTimeEntry}
              onApproveEntries={handleApproveEntries}
              onExportPayroll={handleExportPayroll}
              className="h-full"
            />
          )}

          {activeTab === 'utilization' && (
            <SmResourceGantt
              resources={filteredResources}
              allocations={allocations}
              showUtilization={true}
              className="h-full"
            />
          )}
        </div>
      </div>

      {/* Resource Modal */}
      <ResourceModal
        isOpen={showResourceModal}
        onClose={() => {
          setShowResourceModal(false)
          setEditingResource(null)
        }}
        resource={editingResource}
        onSave={handleResourceSave}
      />
    </div>
  )
}
