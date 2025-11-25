import { useState, useEffect } from 'react'
import { api } from '../../api'
import {
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  CheckIcon,
  XMarkIcon,
  PencilIcon
} from '@heroicons/react/24/outline'

// Reusable sortable list component
function SortableList({ items, onReorder, onUpdate, onDelete, onCreate, title, description, colorField = false }) {
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editColor, setEditColor] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemColor, setNewItemColor] = useState('gray')
  const [isAdding, setIsAdding] = useState(false)

  const colors = [
    { value: 'gray', label: 'Gray', bg: 'bg-gray-100', text: 'text-gray-800' },
    { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-100', text: 'text-yellow-800' },
    { value: 'orange', label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-800' },
    { value: 'blue', label: 'Blue', bg: 'bg-blue-100', text: 'text-blue-800' },
    { value: 'purple', label: 'Purple', bg: 'bg-purple-100', text: 'text-purple-800' },
    { value: 'indigo', label: 'Indigo', bg: 'bg-indigo-100', text: 'text-indigo-800' },
    { value: 'green', label: 'Green', bg: 'bg-green-100', text: 'text-green-800' },
    { value: 'teal', label: 'Teal', bg: 'bg-teal-100', text: 'text-teal-800' },
    { value: 'slate', label: 'Slate', bg: 'bg-slate-100', text: 'text-slate-800' },
    { value: 'red', label: 'Red', bg: 'bg-red-100', text: 'text-red-800' }
  ]

  const getColorClasses = (colorValue) => {
    const color = colors.find(c => c.value === colorValue) || colors[0]
    return `${color.bg} ${color.text}`
  }

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newItems = [...items]
    const draggedItem = newItems[draggedIndex]
    newItems.splice(draggedIndex, 1)
    newItems.splice(index, 0, draggedItem)

    // Update positions
    const reorderedIds = newItems.map(item => item.id)
    onReorder(reorderedIds)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditValue(item.name)
    setEditColor(item.color || 'gray')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
    setEditColor('')
  }

  const saveEdit = async () => {
    if (!editValue.trim()) return
    await onUpdate(editingId, { name: editValue, ...(colorField ? { color: editColor } : {}) })
    setEditingId(null)
    setEditValue('')
    setEditColor('')
  }

  const handleCreate = async () => {
    if (!newItemName.trim()) return
    await onCreate({ name: newItemName, ...(colorField ? { color: newItemColor } : {}) })
    setNewItemName('')
    setNewItemColor('gray')
    setIsAdding(false)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4" />
          Add
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Enter name..."
              className="flex-1 rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm dark:bg-white/5 dark:text-white dark:ring-white/10"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setIsAdding(false)
              }}
            />
            {colorField && (
              <select
                value={newItemColor}
                onChange={(e) => setNewItemColor(e.target.value)}
                className="rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm dark:bg-white/5 dark:text-white dark:ring-white/10"
              >
                {colors.map(color => (
                  <option key={color.value} value={color.value}>{color.label}</option>
                ))}
              </select>
            )}
            <button
              onClick={handleCreate}
              className="p-1.5 text-green-600 hover:text-green-700"
            >
              <CheckIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="p-1.5 text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            draggable={editingId !== item.id}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              draggedIndex === index
                ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700'
                : 'bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <div className="cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <Bars3Icon className="h-5 w-5" />
            </div>

            <span className="w-6 text-center text-sm text-gray-400">{index + 1}</span>

            {editingId === item.id ? (
              <>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm dark:bg-white/5 dark:text-white dark:ring-white/10"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                />
                {colorField && (
                  <select
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm dark:bg-white/5 dark:text-white dark:ring-white/10"
                  >
                    {colors.map(color => (
                      <option key={color.value} value={color.value}>{color.label}</option>
                    ))}
                  </select>
                )}
                <button onClick={saveEdit} className="p-1.5 text-green-600 hover:text-green-700">
                  <CheckIcon className="h-5 w-5" />
                </button>
                <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-gray-500">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-gray-900 dark:text-white font-medium">{item.name}</span>
                {colorField && item.color && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getColorClasses(item.color)}`}>
                    {item.color}
                  </span>
                )}
                {item.jobs_count > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.jobs_count} job{item.jobs_count !== 1 ? 's' : ''}
                  </span>
                )}
                <button
                  onClick={() => startEdit(item)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  disabled={item.jobs_count > 0}
                  className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={item.jobs_count > 0 ? 'Cannot delete - in use by jobs' : 'Delete'}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No items yet. Click "Add" to create one.
        </div>
      )}
    </div>
  )
}

// Cascade Sort Configuration Component
function CascadeSortConfig({ config, onUpdate }) {
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [items, setItems] = useState(config || [
    { key: 'job_type', label: 'Job Type', enabled: true },
    { key: 'job_status', label: 'Job Status', enabled: true }
  ])

  useEffect(() => {
    if (config) setItems(config)
  }, [config])

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newItems = [...items]
    const draggedItem = newItems[draggedIndex]
    newItems.splice(draggedIndex, 1)
    newItems.splice(index, 0, draggedItem)

    setItems(newItems)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    onUpdate(items)
  }

  const toggleEnabled = (key) => {
    const newItems = items.map(item =>
      item.key === key ? { ...item, enabled: !item.enabled } : item
    )
    setItems(newItems)
    onUpdate(newItems)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cascade Sort Order</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select which fields to group jobs by and drag to set the order. The first enabled field is the primary grouping.
        </p>
      </div>

      <div className="flex gap-4">
        {items.map((item, index) => (
          <div
            key={item.key}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-grab transition-all ${
              draggedIndex === index
                ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-900/30 dark:border-indigo-500 scale-105'
                : item.enabled
                  ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-600'
                  : 'bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600'
            }`}
          >
            <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <Bars3Icon className="h-5 w-5" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => toggleEnabled(item.key)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className={`font-medium ${
                item.enabled
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                {item.label}
              </span>
            </label>

            <span className={`text-xs px-2 py-0.5 rounded-full ${
              item.enabled && index === items.findIndex(i => i.enabled)
                ? 'bg-indigo-600 text-white'
                : item.enabled
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
            }`}>
              {!item.enabled ? 'Off' : index === items.findIndex(i => i.enabled) ? '1st' : '2nd'}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {items.filter(i => i.enabled).length === 0
          ? 'No cascade sorting - jobs will show in default order'
          : items.filter(i => i.enabled).length === 1
            ? `Jobs grouped by ${items.find(i => i.enabled)?.label}`
            : `Jobs grouped by ${items.find(i => i.enabled)?.label}, then by ${items.filter(i => i.enabled)[1]?.label}`
        }
      </p>
    </div>
  )
}

export default function JobSetupTab() {
  const [jobTypes, setJobTypes] = useState([])
  const [jobStatuses, setJobStatuses] = useState([])
  const [cascadeConfig, setCascadeConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [typesRes, statusesRes] = await Promise.all([
        api.get('/api/v1/job_types'),
        api.get('/api/v1/job_statuses')
      ])
      setJobTypes(typesRes.job_types || [])
      setJobStatuses(statusesRes.job_statuses || [])

      // Load cascade config from company settings or use default
      try {
        const settingsRes = await api.get('/api/v1/company_settings')
        if (settingsRes.company_settings?.job_cascade_sort) {
          setCascadeConfig(settingsRes.company_settings.job_cascade_sort)
        } else {
          // Default config
          setCascadeConfig([
            { key: 'job_type', label: 'Job Type', enabled: true },
            { key: 'job_status', label: 'Job Status', enabled: true }
          ])
        }
      } catch {
        // Default if settings not available
        setCascadeConfig([
          { key: 'job_type', label: 'Job Type', enabled: true },
          { key: 'job_status', label: 'Job Status', enabled: true }
        ])
      }
    } catch (err) {
      console.error('Failed to load job setup data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCascadeConfigUpdate = async (newConfig) => {
    setCascadeConfig(newConfig)
    try {
      await api.patch('/api/v1/company_settings', {
        company_setting: { job_cascade_sort: newConfig }
      })
    } catch (err) {
      console.error('Failed to save cascade config:', err)
    }
  }

  // Job Types handlers
  const handleReorderTypes = async (ids) => {
    // Optimistic update
    const reordered = ids.map(id => jobTypes.find(t => t.id === id))
    setJobTypes(reordered)

    try {
      const res = await api.post('/api/v1/job_types/reorder', { job_type_ids: ids })
      setJobTypes(res.job_types || reordered)
    } catch (err) {
      console.error('Failed to reorder job types:', err)
      loadData() // Reload on error
    }
  }

  const handleUpdateType = async (id, data) => {
    try {
      const res = await api.patch(`/api/v1/job_types/${id}`, { job_type: data })
      setJobTypes(prev => prev.map(t => t.id === id ? res.job_type : t))
    } catch (err) {
      console.error('Failed to update job type:', err)
      alert(err.message || 'Failed to update')
    }
  }

  const handleDeleteType = async (id) => {
    if (!confirm('Are you sure you want to delete this job type?')) return
    try {
      await api.delete(`/api/v1/job_types/${id}`)
      setJobTypes(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error('Failed to delete job type:', err)
      alert(err.message || 'Failed to delete')
    }
  }

  const handleCreateType = async (data) => {
    try {
      const res = await api.post('/api/v1/job_types', { job_type: data })
      setJobTypes(prev => [...prev, res.job_type])
    } catch (err) {
      console.error('Failed to create job type:', err)
      alert(err.message || 'Failed to create')
    }
  }

  // Job Statuses handlers
  const handleReorderStatuses = async (ids) => {
    // Optimistic update
    const reordered = ids.map(id => jobStatuses.find(s => s.id === id))
    setJobStatuses(reordered)

    try {
      const res = await api.post('/api/v1/job_statuses/reorder', { job_status_ids: ids })
      setJobStatuses(res.job_statuses || reordered)
    } catch (err) {
      console.error('Failed to reorder job statuses:', err)
      loadData() // Reload on error
    }
  }

  const handleUpdateStatus = async (id, data) => {
    try {
      const res = await api.patch(`/api/v1/job_statuses/${id}`, { job_status: data })
      setJobStatuses(prev => prev.map(s => s.id === id ? res.job_status : s))
    } catch (err) {
      console.error('Failed to update job status:', err)
      alert(err.message || 'Failed to update')
    }
  }

  const handleDeleteStatus = async (id) => {
    if (!confirm('Are you sure you want to delete this job status?')) return
    try {
      await api.delete(`/api/v1/job_statuses/${id}`)
      setJobStatuses(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete job status:', err)
      alert(err.message || 'Failed to delete')
    }
  }

  const handleCreateStatus = async (data) => {
    try {
      const res = await api.post('/api/v1/job_statuses', { job_status: data })
      setJobStatuses(prev => [...prev, res.job_status])
    } catch (err) {
      console.error('Failed to create job status:', err)
      alert(err.message || 'Failed to create')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/10 p-4">
        <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        <button onClick={loadData} className="mt-2 text-sm text-indigo-600 hover:text-indigo-500">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Job Setup</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure job types and statuses. Drag items to reorder them.
        </p>
      </div>

      {/* Cascade Sort Configuration */}
      <CascadeSortConfig
        config={cascadeConfig}
        onUpdate={handleCascadeConfigUpdate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SortableList
          items={jobTypes}
          onReorder={handleReorderTypes}
          onUpdate={handleUpdateType}
          onDelete={handleDeleteType}
          onCreate={handleCreateType}
          title="Job Types"
          description="Types of construction projects (House, Duplex, etc.)"
        />

        <SortableList
          items={jobStatuses}
          onReorder={handleReorderStatuses}
          onUpdate={handleUpdateStatus}
          onDelete={handleDeleteStatus}
          onCreate={handleCreateStatus}
          title="Job Statuses"
          description="Workflow stages for jobs (Enquiry to Archived)"
          colorField={true}
        />
      </div>
    </div>
  )
}
