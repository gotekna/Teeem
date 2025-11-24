import { useState, useEffect } from 'react'
import { UserIcon, WrenchIcon, CubeIcon, PlusIcon, XMarkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

const RESOURCE_TYPES = [
  { value: 'person', label: 'Person', icon: UserIcon },
  { value: 'equipment', label: 'Equipment', icon: WrenchIcon },
  { value: 'material', label: 'Material', icon: CubeIcon }
]

const ResourceTypeIcon = ({ type, className }) => {
  const typeConfig = RESOURCE_TYPES.find(t => t.value === type)
  const Icon = typeConfig?.icon || UserIcon
  return <Icon className={className} />
}

export default function SmResourcePanel({ constructionId, onClose }) {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingResource, setEditingResource] = useState(null)

  useEffect(() => {
    loadResources()
  }, [filter])

  const loadResources = async () => {
    try {
      setLoading(true)
      const params = filter !== 'all' ? `?type=${filter}` : ''
      const response = await api.get(`/api/v1/sm_resources${params}`)
      setResources(response.resources || [])
    } catch (err) {
      console.error('Failed to load resources:', err)
      setError('Failed to load resources')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveResource = async (resourceData) => {
    try {
      if (editingResource) {
        await api.patch(`/api/v1/sm_resources/${editingResource.id}`, { sm_resource: resourceData })
      } else {
        await api.post('/api/v1/sm_resources', { sm_resource: resourceData })
      }
      await loadResources()
      setShowAddModal(false)
      setEditingResource(null)
    } catch (err) {
      console.error('Failed to save resource:', err)
      throw err
    }
  }

  const handleDeleteResource = async (resourceId) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) return

    try {
      await api.delete(`/api/v1/sm_resources/${resourceId}`)
      await loadResources()
    } catch (err) {
      console.error('Failed to delete resource:', err)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Resources</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[{ value: 'all', label: 'All' }, ...RESOURCE_TYPES].map(type => (
          <button
            key={type.value}
            onClick={() => setFilter(type.value)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              filter === type.value
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Resource List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500 text-sm">{error}</div>
        ) : resources.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p>No resources found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-2 text-indigo-600 hover:text-indigo-800"
            >
              Add your first resource
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {resources.map(resource => (
              <div
                key={resource.id}
                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 group ${
                  !resource.is_active ? 'opacity-50' : ''
                }`}
              >
                <div className={`p-1.5 rounded ${
                  resource.resource_type === 'person' ? 'bg-blue-100 text-blue-600' :
                  resource.resource_type === 'equipment' ? 'bg-orange-100 text-orange-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  <ResourceTypeIcon type={resource.resource_type} className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {resource.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {resource.trade && `${resource.trade} • `}
                    {resource.hourly_rate && `$${resource.hourly_rate}/hr`}
                    {resource.daily_rate && `$${resource.daily_rate}/day`}
                    {resource.unit && `${resource.unit_cost}/${resource.unit}`}
                  </div>
                </div>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingResource(resource)
                      setShowAddModal(true)
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteResource(resource.id)}
                    className="p-1 hover:bg-red-100 text-red-600 rounded"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <ResourceFormModal
          resource={editingResource}
          onSave={handleSaveResource}
          onClose={() => {
            setShowAddModal(false)
            setEditingResource(null)
          }}
        />
      )}
    </div>
  )
}

function ResourceFormModal({ resource, onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: resource?.name || '',
    code: resource?.code || '',
    description: resource?.description || '',
    resource_type: resource?.resource_type || 'person',
    trade: resource?.trade || '',
    hourly_rate: resource?.hourly_rate || '',
    daily_rate: resource?.daily_rate || '',
    unit: resource?.unit || '',
    unit_cost: resource?.unit_cost || '',
    availability_hours_per_day: resource?.availability_hours_per_day || 8,
    is_active: resource?.is_active ?? true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Name is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSave(formData)
    } catch (err) {
      setError(err.message || 'Failed to save resource')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {resource ? 'Edit Resource' : 'Add Resource'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Resource Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type *
            </label>
            <div className="flex gap-2">
              {RESOURCE_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, resource_type: type.value }))}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    formData.resource_type === type.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <type.icon className="h-4 w-4" />
                  <span className="text-sm">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder={formData.resource_type === 'person' ? 'John Smith' : formData.resource_type === 'equipment' ? 'Crane #1' : 'Concrete Mix'}
            />
          </div>

          {/* Trade (for person) */}
          {formData.resource_type === 'person' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trade
              </label>
              <input
                type="text"
                value={formData.trade}
                onChange={(e) => setFormData(prev => ({ ...prev, trade: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="e.g., Carpenter, Electrician"
              />
            </div>
          )}

          {/* Rates */}
          <div className="grid grid-cols-2 gap-4">
            {formData.resource_type === 'person' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hourly Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData(prev => ({ ...prev, hourly_rate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="0.00"
                />
              </div>
            )}
            {formData.resource_type === 'equipment' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Daily Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.daily_rate}
                  onChange={(e) => setFormData(prev => ({ ...prev, daily_rate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="0.00"
                />
              </div>
            )}
            {formData.resource_type === 'material' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="m³, kg, each"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit Cost
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unit_cost}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit_cost: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder="0.00"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hours/Day
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.availability_hours_per_day}
                onChange={(e) => setFormData(prev => ({ ...prev, availability_hours_per_day: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Active */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
              Active
            </label>
          </div>
        </form>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : resource ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
