import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import {
  UserGroupIcon,
  ClockIcon,
  CalendarDaysIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
  StarIcon,
  ChevronRightIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { api } from '../../api'
import SmGanttChart from './SmGanttChart'
import SmDependencyEditor from './SmDependencyEditor'

// Resources Sub-Tab
function ResourcesSubTab() {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingResource, setEditingResource] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    resource_type: 'person',
    trade: '',
    hourly_rate: '',
    daily_rate: '',
    unit: '',
    unit_cost: '',
    availability_hours_per_day: '8',
    is_active: true
  })

  useEffect(() => {
    loadResources()
  }, [])

  const loadResources = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/sm_resources')
      setResources(response.resources || [])
    } catch (err) {
      console.error('Failed to load resources:', err)
      setError('Failed to load resources')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        sm_resource: {
          ...formData,
          hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
          daily_rate: formData.daily_rate ? parseFloat(formData.daily_rate) : null,
          unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : null,
          availability_hours_per_day: formData.availability_hours_per_day ? parseFloat(formData.availability_hours_per_day) : 8
        }
      }

      if (editingResource) {
        await api.patch(`/api/v1/sm_resources/${editingResource.id}`, payload)
      } else {
        await api.post('/api/v1/sm_resources', payload)
      }

      await loadResources()
      resetForm()
    } catch (err) {
      console.error('Failed to save resource:', err)
      alert('Failed to save resource: ' + (err.message || 'Unknown error'))
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this resource?')) return
    try {
      await api.delete(`/api/v1/sm_resources/${id}`)
      await loadResources()
    } catch (err) {
      console.error('Failed to delete resource:', err)
      alert('Failed to delete resource')
    }
  }

  const handleEdit = (resource) => {
    setEditingResource(resource)
    setFormData({
      name: resource.name || '',
      code: resource.code || '',
      resource_type: resource.resource_type || 'person',
      trade: resource.trade || '',
      hourly_rate: resource.hourly_rate || '',
      daily_rate: resource.daily_rate || '',
      unit: resource.unit || '',
      unit_cost: resource.unit_cost || '',
      availability_hours_per_day: resource.availability_hours_per_day || '8',
      is_active: resource.is_active !== false
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingResource(null)
    setFormData({
      name: '',
      code: '',
      resource_type: 'person',
      trade: '',
      hourly_rate: '',
      daily_rate: '',
      unit: '',
      unit_cost: '',
      availability_hours_per_day: '8',
      is_active: true
    })
  }

  if (loading) {
    return <div className="p-4 text-gray-500">Loading resources...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Resources</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage people, equipment, and materials for schedule allocation
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <PlusIcon className="h-4 w-4" />
          Add Resource
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            {editingResource ? 'Edit Resource' : 'New Resource'}
          </h4>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
              <select
                value={formData.resource_type}
                onChange={(e) => setFormData({ ...formData, resource_type: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="person">Person</option>
                <option value="equipment">Equipment</option>
                <option value="material">Material</option>
              </select>
            </div>
            {formData.resource_type === 'person' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Trade</label>
                  <input
                    type="text"
                    value={formData.trade}
                    onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                    placeholder="e.g., Carpenter, Electrician"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Hourly Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Daily Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.daily_rate}
                    onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Availability (hrs/day)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.availability_hours_per_day}
                    onChange={(e) => setFormData({ ...formData, availability_hours_per_day: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </>
            )}
            {formData.resource_type === 'equipment' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Daily Rate ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.daily_rate}
                    onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </>
            )}
            {formData.resource_type === 'material' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g., m3, kg, each"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                {editingResource ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resources Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trade</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {resources.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No resources found. Add your first resource to get started.
                </td>
              </tr>
            ) : (
              resources.map((resource) => (
                <tr key={resource.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{resource.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{resource.code || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      resource.resource_type === 'person' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                      resource.resource_type === 'equipment' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {resource.resource_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{resource.trade || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {resource.hourly_rate ? `$${resource.hourly_rate}/hr` :
                     resource.daily_rate ? `$${resource.daily_rate}/day` :
                     resource.unit_cost ? `$${resource.unit_cost}/${resource.unit || 'unit'}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      resource.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {resource.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(resource)}
                      className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(resource.id)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 ml-2"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Hold Reasons Sub-Tab
function HoldReasonsSubTab() {
  const [holdReasons, setHoldReasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingReason, setEditingReason] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#ef4444',
    is_active: true
  })

  useEffect(() => {
    loadHoldReasons()
  }, [])

  const loadHoldReasons = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/sm_hold_reasons')
      setHoldReasons(response.hold_reasons || [])
    } catch (err) {
      console.error('Failed to load hold reasons:', err)
      setError('Failed to load hold reasons')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingReason) {
        await api.patch(`/api/v1/sm_hold_reasons/${editingReason.id}`, { sm_hold_reason: formData })
      } else {
        await api.post('/api/v1/sm_hold_reasons', { sm_hold_reason: formData })
      }
      await loadHoldReasons()
      resetForm()
    } catch (err) {
      console.error('Failed to save hold reason:', err)
      alert('Failed to save hold reason')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this hold reason?')) return
    try {
      await api.delete(`/api/v1/sm_hold_reasons/${id}`)
      await loadHoldReasons()
    } catch (err) {
      console.error('Failed to delete hold reason:', err)
      alert('Failed to delete hold reason')
    }
  }

  const handleEdit = (reason) => {
    setEditingReason(reason)
    setFormData({
      name: reason.name || '',
      description: reason.description || '',
      color: reason.color || '#ef4444',
      is_active: reason.is_active !== false
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingReason(null)
    setFormData({
      name: '',
      description: '',
      color: '#ef4444',
      is_active: true
    })
  }

  if (loading) {
    return <div className="p-4 text-gray-500">Loading hold reasons...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Hold Reasons</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Define reasons for putting tasks on hold
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <PlusIcon className="h-4 w-4" />
          Add Hold Reason
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            {editingReason ? 'Edit Hold Reason' : 'New Hold Reason'}
          </h4>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Waiting for Materials"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 w-16 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hr_is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
              <label htmlFor="hr_is_active" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                {editingReason ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hold Reasons Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {holdReasons.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No hold reasons found. Add your first hold reason to get started.
                </td>
              </tr>
            ) : (
              holdReasons.map((reason) => (
                <tr key={reason.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3">
                    <div
                      className="h-6 w-6 rounded-full border border-gray-200 dark:border-gray-600"
                      style={{ backgroundColor: reason.color || '#ef4444' }}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{reason.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{reason.description || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      reason.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {reason.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleEdit(reason)}
                      className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(reason.id)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 ml-2"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Templates Sub-Tab - SM Schedule Templates
function TemplatesSubTab() {
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [templateRows, setTemplateRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState(null)
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false)
  const [showNewRowForm, setShowNewRowForm] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDesc, setNewTemplateDesc] = useState('')
  const [viewMode, setViewMode] = useState('table') // 'table' or 'gantt'
  const [showDependencyEditor, setShowDependencyEditor] = useState(false)
  const [editingDependencyRow, setEditingDependencyRow] = useState(null)
  const [rowFormData, setRowFormData] = useState({
    name: '',
    duration_days: 1,
    trade: '',
    stage: '',
    require_photo: false,
    require_certificate: false,
    po_required: false,
    pass_fail_enabled: false
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateRows(selectedTemplate.id)
    }
  }, [selectedTemplate])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/sm_templates')
      const templateList = response.sm_templates || []
      setTemplates(templateList)
      // Auto-select default or first template
      if (templateList.length > 0) {
        const defaultTemplate = templateList.find(t => t.is_default) || templateList[0]
        setSelectedTemplate(defaultTemplate)
      }
    } catch (err) {
      console.error('Failed to load templates:', err)
      setError('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplateRows = async (templateId) => {
    try {
      setLoadingRows(true)
      const response = await api.get(`/api/v1/sm_templates/${templateId}/rows`)
      setTemplateRows(response.rows || [])
    } catch (err) {
      console.error('Failed to load template rows:', err)
    } finally {
      setLoadingRows(false)
    }
  }

  const handleCreateTemplate = async (e) => {
    e.preventDefault()
    try {
      const response = await api.post('/api/v1/sm_templates', {
        sm_template: { name: newTemplateName, description: newTemplateDesc }
      })
      await loadTemplates()
      setSelectedTemplate(response.sm_template)
      setShowNewTemplateForm(false)
      setNewTemplateName('')
      setNewTemplateDesc('')
    } catch (err) {
      console.error('Failed to create template:', err)
      alert('Failed to create template')
    }
  }

  const handleSetDefault = async (templateId) => {
    try {
      await api.post(`/api/v1/sm_templates/${templateId}/set_default`)
      await loadTemplates()
    } catch (err) {
      console.error('Failed to set default:', err)
    }
  }

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      await api.delete(`/api/v1/sm_templates/${templateId}`)
      await loadTemplates()
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null)
        setTemplateRows([])
      }
    } catch (err) {
      console.error('Failed to delete template:', err)
    }
  }

  const handleCreateRow = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/api/v1/sm_templates/${selectedTemplate.id}/rows`, { row: rowFormData })
      await loadTemplateRows(selectedTemplate.id)
      await loadTemplates() // Refresh row count
      resetRowForm()
    } catch (err) {
      console.error('Failed to create row:', err)
      alert('Failed to create row: ' + (err.response?.data?.errors?.join(', ') || err.message))
    }
  }

  const handleUpdateRow = async (e) => {
    e.preventDefault()
    try {
      await api.patch(`/api/v1/sm_templates/${selectedTemplate.id}/rows/${editingRow.id}`, { row: rowFormData })
      await loadTemplateRows(selectedTemplate.id)
      resetRowForm()
    } catch (err) {
      console.error('Failed to update row:', err)
      alert('Failed to update row')
    }
  }

  const handleDeleteRow = async (rowId) => {
    if (!confirm('Delete this task from the template?')) return
    try {
      await api.delete(`/api/v1/sm_templates/${selectedTemplate.id}/rows/${rowId}`)
      await loadTemplateRows(selectedTemplate.id)
      await loadTemplates()
    } catch (err) {
      console.error('Failed to delete row:', err)
    }
  }

  const handleEditRow = (row) => {
    setEditingRow(row)
    setRowFormData({
      name: row.name || '',
      duration_days: row.duration_days || 1,
      trade: row.trade || '',
      stage: row.stage || '',
      require_photo: row.require_photo || false,
      require_certificate: row.require_certificate || false,
      po_required: row.po_required || false,
      pass_fail_enabled: row.pass_fail_enabled || false
    })
    setShowNewRowForm(true)
  }

  const resetRowForm = () => {
    setShowNewRowForm(false)
    setEditingRow(null)
    setRowFormData({
      name: '',
      duration_days: 1,
      trade: '',
      stage: '',
      require_photo: false,
      require_certificate: false,
      po_required: false,
      pass_fail_enabled: false
    })
  }

  const handleEditDependencies = (row) => {
    setEditingDependencyRow(row)
    setShowDependencyEditor(true)
  }

  const handleSaveDependencies = async (rowId, predecessorIds) => {
    try {
      await api.patch(`/api/v1/sm_templates/${selectedTemplate.id}/rows/${rowId}`, {
        row: { predecessor_ids: predecessorIds }
      })
      await loadTemplateRows(selectedTemplate.id)
    } catch (err) {
      console.error('Failed to save dependencies:', err)
      throw err
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Templates List */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">SM Templates</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Schedule templates that can be applied to new jobs
          </p>
        </div>
        <button
          onClick={() => setShowNewTemplateForm(true)}
          className="px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          New Template
        </button>
      </div>

      {/* New Template Form */}
      {showNewTemplateForm && (
        <form onSubmit={handleCreateTemplate} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                placeholder="Template name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input
                type="text"
                value={newTemplateDesc}
                onChange={(e) => setNewTemplateDesc(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                placeholder="Optional description"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Create Template
            </button>
            <button type="button" onClick={() => setShowNewTemplateForm(false)} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map(template => (
          <div
            key={template.id}
            onClick={() => setSelectedTemplate(template)}
            className={`bg-white dark:bg-gray-800 rounded-lg border p-4 cursor-pointer transition-all ${
              selectedTemplate?.id === template.id
                ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <DocumentDuplicateIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-medium text-gray-900 dark:text-white">{template.name}</h4>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleSetDefault(template.id); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title={template.is_default ? 'Default template' : 'Set as default'}
              >
                {template.is_default ? (
                  <StarIconSolid className="h-5 w-5 text-yellow-500" />
                ) : (
                  <StarIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {template.row_count} tasks
            </p>
            {template.description && (
              <p className="text-xs text-gray-400 mt-2 line-clamp-2">{template.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* Selected Template Rows */}
      {selectedTemplate && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                {selectedTemplate.name}
                <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">Tasks</span>
              </h3>
              <p className="text-sm text-gray-500">{templateRows.length} tasks in this template</p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    viewMode === 'table'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <CalendarDaysIcon className="h-4 w-4" />
                  Table
                </button>
                <button
                  onClick={() => setViewMode('gantt')}
                  className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                    viewMode === 'gantt'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <ChartBarIcon className="h-4 w-4" />
                  Gantt
                </button>
              </div>
              <button
                onClick={() => setShowNewRowForm(true)}
                className="px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add Task
              </button>
              <button
                onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* New/Edit Row Form */}
          {showNewRowForm && (
            <form onSubmit={editingRow ? handleUpdateRow : handleCreateRow} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Task Name</label>
                  <input
                    type="text"
                    value={rowFormData.name}
                    onChange={(e) => setRowFormData({ ...rowFormData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={rowFormData.duration_days}
                    onChange={(e) => setRowFormData({ ...rowFormData, duration_days: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trade</label>
                  <input
                    type="text"
                    value={rowFormData.trade}
                    onChange={(e) => setRowFormData({ ...rowFormData, trade: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                    placeholder="e.g. carpenter"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stage</label>
                  <input
                    type="text"
                    value={rowFormData.stage}
                    onChange={(e) => setRowFormData({ ...rowFormData, stage: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                    placeholder="e.g. frame"
                  />
                </div>
                <div className="col-span-3 flex items-end gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rowFormData.require_photo}
                      onChange={(e) => setRowFormData({ ...rowFormData, require_photo: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Require Photo</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rowFormData.require_certificate}
                      onChange={(e) => setRowFormData({ ...rowFormData, require_certificate: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Require Certificate</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rowFormData.po_required}
                      onChange={(e) => setRowFormData({ ...rowFormData, po_required: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-700 dark:text-gray-300">PO Required</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rowFormData.pass_fail_enabled}
                      onChange={(e) => setRowFormData({ ...rowFormData, pass_fail_enabled: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Pass/Fail</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  {editingRow ? 'Update Task' : 'Add Task'}
                </button>
                <button type="button" onClick={resetRowForm} className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Content - Table or Gantt */}
          {loadingRows ? (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : viewMode === 'gantt' ? (
            /* Gantt View */
            <div className="h-[500px] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <SmGanttChart
                tasks={(() => {
                  // Build tasks with proper date calculation based on dependencies
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)

                  // First pass: create a map of task_number to calculated start dates
                  const taskDates = {}

                  // Helper to get task start date considering dependencies
                  const calculateStartDate = (row, depth = 0, visitedChain = new Set()) => {
                    // Prevent infinite recursion from circular dependencies
                    if (depth > 50 || visitedChain.has(row.task_number)) {
                      console.warn(`Circular dependency detected for task ${row.task_number}: ${row.name}`)
                      return today
                    }
                    if (taskDates[row.task_number]) return taskDates[row.task_number]

                    visitedChain.add(row.task_number)

                    // If has explicit offset, use it
                    if (row.start_day_offset != null) {
                      const startDate = new Date(today)
                      startDate.setDate(today.getDate() + row.start_day_offset)
                      taskDates[row.task_number] = startDate
                      return startDate
                    }

                    // If has predecessors, calculate based on them
                    if (row.predecessor_ids && row.predecessor_ids.length > 0) {
                      let latestEnd = today
                      row.predecessor_ids.forEach(pred => {
                        const predId = pred.id || pred
                        const predRow = templateRows.find(r => r.task_number === predId)
                        if (predRow) {
                          const predStart = calculateStartDate(predRow, depth + 1, new Set(visitedChain))
                          const predEnd = new Date(predStart)
                          predEnd.setDate(predStart.getDate() + (predRow.duration_days || 1))

                          // Apply lag
                          const lag = pred.lag || 0
                          const depType = pred.type || 'FS'

                          let targetDate
                          if (depType === 'FS') {
                            targetDate = new Date(predEnd)
                            targetDate.setDate(targetDate.getDate() + lag)
                          } else if (depType === 'SS') {
                            targetDate = new Date(predStart)
                            targetDate.setDate(targetDate.getDate() + lag)
                          } else if (depType === 'FF') {
                            targetDate = new Date(predEnd)
                            targetDate.setDate(targetDate.getDate() + lag - (row.duration_days || 1))
                          } else if (depType === 'SF') {
                            targetDate = new Date(predStart)
                            targetDate.setDate(targetDate.getDate() + lag - (row.duration_days || 1))
                          }

                          if (targetDate > latestEnd) latestEnd = targetDate
                        }
                      })
                      taskDates[row.task_number] = latestEnd
                      return latestEnd
                    }

                    // Default: start at today
                    taskDates[row.task_number] = today
                    return today
                  }

                  return templateRows.map((row, index) => {
                    const startDate = calculateStartDate(row)
                    const endDate = new Date(startDate)
                    endDate.setDate(startDate.getDate() + (row.duration_days || 1) - 1)

                    return {
                      id: row.id,
                      task_number: row.task_number,
                      name: row.name,
                      start_date: startDate.toISOString().split('T')[0],
                      end_date: endDate.toISOString().split('T')[0],
                      duration_days: row.duration_days,
                      status: 'not_started',
                      trade: row.trade,
                      stage: row.stage,
                      color: row.color,
                      is_hold_task: false,
                      locked: false
                    }
                  })
                })()}
                dependencies={(() => {
                  // Build dependencies array from predecessor_ids
                  const deps = []
                  templateRows.forEach(row => {
                    if (row.predecessor_ids && row.predecessor_ids.length > 0) {
                      row.predecessor_ids.forEach(pred => {
                        const predId = pred.id || pred
                        const predRow = templateRows.find(r => r.task_number === predId)
                        if (predRow) {
                          deps.push({
                            source: predRow.id,
                            target: row.id,
                            type: pred.type || 'FS',
                            lag: pred.lag || 0
                          })
                        }
                      })
                    }
                  })
                  return deps
                })()}
                onTaskClick={(task) => {
                  const row = templateRows.find(r => r.id === task.id)
                  if (row) handleEditRow(row)
                }}
                onTaskUpdate={async (taskId, updates) => {
                  // Calculate new start_day_offset from the new start_date
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const newStart = new Date(updates.start_date)
                  const diffTime = newStart.getTime() - today.getTime()
                  const newOffset = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                  try {
                    await api.patch(`/api/v1/sm_templates/${selectedTemplate.id}/rows/${taskId}`, {
                      row: { start_day_offset: newOffset }
                    })
                    await loadTemplateRows(selectedTemplate.id)
                  } catch (err) {
                    console.error('Failed to update task position:', err)
                  }
                }}
              />
            </div>
          ) : (
            /* Table View */
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dependencies</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flags</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {templateRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        No tasks in this template. Click "Add Task" to create one.
                      </td>
                    </tr>
                  ) : (
                    templateRows.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-500">{row.task_number}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{row.duration_days}d</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{row.trade || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{row.stage || '-'}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleEditDependencies(row)}
                            className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:underline"
                          >
                            {row.predecessor_display || 'Add...'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {row.require_photo && <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Photo</span>}
                            {row.require_certificate && <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">Cert</span>}
                            {row.po_required && <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">PO</span>}
                            {row.pass_fail_enabled && <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">P/F</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleEditRow(row)}
                            className="p-1 text-gray-400 hover:text-indigo-600"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-1 text-gray-400 hover:text-red-600 ml-2"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Dependency Editor Modal */}
      <SmDependencyEditor
        isOpen={showDependencyEditor}
        onClose={() => {
          setShowDependencyEditor(false)
          setEditingDependencyRow(null)
        }}
        task={editingDependencyRow}
        allTasks={templateRows}
        onSave={handleSaveDependencies}
      />
    </div>
  )
}

// Quick Links Sub-Tab
function QuickLinksSubTab() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRecentJobs = async () => {
      try {
        setLoading(true)
        const response = await api.get('/api/v1/constructions?status=active&limit=6')
        setJobs(response.constructions || [])
      } catch (err) {
        console.error('Failed to load jobs:', err)
      } finally {
        setLoading(false)
      }
    }
    loadRecentJobs()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Quick Links</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Access SM Gantt views for your active jobs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Dynamic Job Cards */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg h-9 w-9"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ) : jobs.length > 0 ? (
          jobs.map(job => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}/sm-gantt`}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50">
                  <ChartBarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{job.name || job.address || `Job #${job.id}`}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">View SM Gantt Chart</p>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">No active jobs found</p>
          </div>
        )}

        {/* Info Card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <CalendarDaysIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">SM Gantt v2</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Access from any job page via the SM Gantt button, or navigate directly to /jobs/:id/sm-gantt
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main Component
export default function SmGanttSetupTab() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">SM Gantt v2 Setup</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Configure templates, resources, hold reasons, and other settings for the Schedule Master Gantt v2 system
        </p>

        <TabGroup>
          <TabList className="flex space-x-1 rounded-xl bg-indigo-900/20 p-1 mb-6">
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center justify-center gap-2
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
              Templates
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center justify-center gap-2
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <UserGroupIcon className="h-4 w-4" />
              Resources
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center justify-center gap-2
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <ExclamationTriangleIcon className="h-4 w-4" />
              Hold Reasons
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center justify-center gap-2
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <ChartBarIcon className="h-4 w-4" />
              Quick Links
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <TemplatesSubTab />
            </TabPanel>
            <TabPanel>
              <ResourcesSubTab />
            </TabPanel>
            <TabPanel>
              <HoldReasonsSubTab />
            </TabPanel>
            <TabPanel>
              <QuickLinksSubTab />
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </div>
  )
}
