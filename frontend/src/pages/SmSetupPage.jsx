import { useState, useEffect } from 'react'
import { Tab } from '@headlessui/react'
import {
  Cog6ToothIcon,
  PauseIcon,
  ClockIcon,
  CalendarDaysIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  StarIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { api } from '../api'
import Toast from '../components/Toast'

// Hold Reasons Tab
function HoldReasonsTab() {
  const [holdReasons, setHoldReasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadHoldReasons()
  }, [])

  const loadHoldReasons = async () => {
    try {
      const response = await api.get('/api/v1/sm_hold_reasons')
      setHoldReasons(response.hold_reasons || [])
    } catch (error) {
      console.error('Failed to load hold reasons:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (reason) => {
    setEditingId(reason.id)
    setEditForm({ ...reason })
  }

  const handleSave = async () => {
    try {
      await api.patch(`/api/v1/sm_hold_reasons/${editingId}`, { sm_hold_reason: editForm })
      setToast({ type: 'success', message: 'Hold reason updated' })
      setEditingId(null)
      loadHoldReasons()
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to update hold reason' })
    }
  }

  const handleCreate = async () => {
    const newReason = {
      name: 'New Hold Reason',
      description: 'Description',
      color: '#6B7280',
      is_active: true,
      sequence_order: holdReasons.length + 1
    }
    try {
      const response = await api.post('/api/v1/sm_hold_reasons', { sm_hold_reason: newReason })
      setToast({ type: 'success', message: 'Hold reason created' })
      loadHoldReasons()
      handleEdit(response.hold_reason)
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to create hold reason' })
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this hold reason?')) return
    try {
      await api.delete(`/api/v1/sm_hold_reasons/${id}`)
      setToast({ type: 'success', message: 'Hold reason deleted' })
      loadHoldReasons()
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to delete hold reason' })
    }
  }

  const handleSeedDefaults = async () => {
    try {
      await api.post('/api/v1/sm_hold_reasons/seed_defaults')
      setToast({ type: 'success', message: 'Default hold reasons seeded' })
      loadHoldReasons()
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to seed defaults' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Define reasons for placing jobs on hold
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleSeedDefaults}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Seed Defaults
          </button>
          <button
            onClick={handleCreate}
            className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
          >
            <PlusIcon className="h-4 w-4" />
            Add Reason
          </button>
        </div>
      </div>

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
            {holdReasons.map((reason) => (
              <tr key={reason.id}>
                <td className="px-4 py-3">
                  {editingId === reason.id ? (
                    <input
                      type="color"
                      value={editForm.color || '#6B7280'}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: reason.color }}
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === reason.id ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{reason.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === reason.id ? (
                    <input
                      type="text"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{reason.description}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === reason.id ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.is_active}
                        onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Active</span>
                    </label>
                  ) : (
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      reason.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {reason.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingId === reason.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={handleSave}
                        className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(reason)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(reason.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}

// Rollover Settings Tab
function RolloverSettingsTab() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await api.get('/api/v1/sm_settings')
      setSettings(response.settings || {
        rollover_enabled: false,
        rollover_time: '00:00',
        rollover_timezone: 'Australia/Sydney'
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/api/v1/sm_settings', { sm_setting: settings })
      setToast({ type: 'success', message: 'Settings saved' })
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Configure automatic rollover of past-due tasks
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {/* Enable Rollover */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Enable Rollover</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automatically move past-due tasks to today at midnight
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings?.rollover_enabled || false}
              onChange={(e) => setSettings({ ...settings, rollover_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Rollover Time */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Rollover Time
          </label>
          <input
            type="time"
            value={settings?.rollover_time || '00:00'}
            onChange={(e) => setSettings({ ...settings, rollover_time: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500">Time when rollover job runs daily</p>
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Timezone
          </label>
          <select
            value={settings?.rollover_timezone || 'Australia/Sydney'}
            onChange={(e) => setSettings({ ...settings, rollover_timezone: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
            <option value="Australia/Melbourne">Australia/Melbourne (AEST)</option>
            <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
            <option value="Australia/Perth">Australia/Perth (AWST)</option>
            <option value="Australia/Adelaide">Australia/Adelaide (ACST)</option>
            <option value="Pacific/Auckland">New Zealand (NZST)</option>
          </select>
        </div>

        {/* Save */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}

// Templates Tab
function TemplatesTab() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const response = await api.get('/api/v1/sm_templates')
      setTemplates(response.sm_templates || [])
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSetDefault = async (templateId) => {
    try {
      await api.post(`/api/v1/sm_templates/${templateId}/set_default`)
      setToast({ type: 'success', message: 'Default template updated' })
      loadTemplates()
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to set default template' })
    }
  }

  const handleCreate = async () => {
    const name = prompt('Enter template name:')
    if (!name) return

    try {
      await api.post('/api/v1/sm_templates', {
        sm_template: { name, description: '' }
      })
      setToast({ type: 'success', message: 'Template created' })
      loadTemplates()
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to create template' })
    }
  }

  const handleDelete = async (templateId) => {
    if (!confirm('Archive this template?')) return

    try {
      await api.delete(`/api/v1/sm_templates/${templateId}`)
      setToast({ type: 'success', message: 'Template archived' })
      loadTemplates()
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to archive template' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage schedule templates. The default template is used when creating new jobs.
        </p>
        <button
          onClick={handleCreate}
          className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
        >
          <PlusIcon className="h-4 w-4" />
          New Template
        </button>
      </div>

      <div className="grid gap-4">
        {templates.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <DocumentDuplicateIcon className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No templates yet</p>
            <button
              onClick={handleCreate}
              className="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Create your first template
            </button>
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className={`bg-white dark:bg-gray-800 rounded-lg border p-4 flex items-center justify-between ${
                template.is_default
                  ? 'border-indigo-500 ring-1 ring-indigo-500'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleSetDefault(template.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    template.is_default
                      ? 'text-yellow-500'
                      : 'text-gray-300 hover:text-yellow-500'
                  }`}
                  title={template.is_default ? 'Default template' : 'Set as default'}
                >
                  {template.is_default ? (
                    <StarIconSolid className="h-6 w-6" />
                  ) : (
                    <StarIcon className="h-6 w-6" />
                  )}
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {template.name}
                    </h4>
                    {template.is_default && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {template.row_count || 0} tasks
                    {template.description && ` • ${template.description}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/designer/tables/${template.id}?type=sm_template`}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Edit Tasks
                </a>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}

// Working Days Tab
function WorkingDaysTab() {
  const [workingDays, setWorkingDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  const handleToggle = (day) => {
    setWorkingDays({ ...workingDays, [day]: !workingDays[day] })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/api/v1/company_settings', { company_setting: { working_days: workingDays } })
      setToast({ type: 'success', message: 'Working days saved' })
    } catch (error) {
      setToast({ type: 'error', message: 'Failed to save working days' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Define which days are working days for schedule calculations
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-7 gap-4">
          {days.map((day) => (
            <button
              key={day}
              onClick={() => handleToggle(day)}
              className={`p-4 rounded-lg text-center transition-colors ${
                workingDays[day]
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-2 border-indigo-500'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-2 border-transparent'
              }`}
            >
              <p className="text-sm font-medium capitalize">{day.slice(0, 3)}</p>
              <p className="text-xs mt-1">{workingDays[day] ? 'Working' : 'Off'}</p>
            </button>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Working Days'}
          </button>
        </div>
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}

export default function SmSetupPage() {
  const tabs = [
    { name: 'Hold Reasons', icon: PauseIcon },
    { name: 'Templates', icon: DocumentDuplicateIcon },
    { name: 'Rollover', icon: ClockIcon },
    { name: 'Working Days', icon: CalendarDaysIcon }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <Cog6ToothIcon className="h-8 w-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                SM Gantt Setup
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure Schedule Master settings
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-lg bg-gray-200 dark:bg-gray-800 p-1 mb-6">
            {tabs.map((tab) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors flex items-center justify-center gap-2
                  ${selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`
                }
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </Tab>
            ))}
          </Tab.List>

          <Tab.Panels>
            <Tab.Panel><HoldReasonsTab /></Tab.Panel>
            <Tab.Panel><TemplatesTab /></Tab.Panel>
            <Tab.Panel><RolloverSettingsTab /></Tab.Panel>
            <Tab.Panel><WorkingDaysTab /></Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  )
}
