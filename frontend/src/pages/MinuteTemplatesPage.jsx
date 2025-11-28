import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline'
import { api } from '../api'
import Toast from '../components/Toast'

export default function MinuteTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [selectedType, setSelectedType] = useState('all')
  const [showInactive, setShowInactive] = useState(false)

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    template_type: 'company',
    body: '',
    required_fields: '',
    active: true
  })
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const templateTypes = ['company', 'trust', 'general']

  useEffect(() => {
    loadTemplates()
  }, [selectedType, showInactive])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const params = { include_inactive: showInactive ? 'true' : 'false' }
      if (selectedType !== 'all') {
        params.template_type = selectedType
      }

      const response = await api.get('/api/v1/minute_templates', { params })
      setTemplates(response.data || [])
    } catch (error) {
      console.error('Failed to load templates:', error)
      setToast({ message: 'Failed to load templates', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const openNewForm = () => {
    setEditingTemplate(null)
    setFormData({
      name: '',
      template_type: 'company',
      body: '',
      required_fields: '',
      active: true
    })
    setFormErrors({})
    setIsFormOpen(true)
  }

  const openEditForm = (template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name || '',
      template_type: template.template_type || 'company',
      body: template.body || '',
      required_fields: template.required_fields || '',
      active: template.active !== false
    })
    setFormErrors({})
    setIsFormOpen(true)

    // Fetch full template with body if needed
    if (!template.body) {
      fetchTemplateBody(template.id)
    }
  }

  const fetchTemplateBody = async (id) => {
    try {
      const response = await api.get(`/api/v1/minute_templates/${id}`)
      if (response.data) {
        setFormData(prev => ({
          ...prev,
          body: response.data.body || ''
        }))
      }
    } catch (error) {
      console.error('Failed to fetch template body:', error)
    }
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.name.trim()) {
      errors.name = 'Template name is required'
    }
    if (!formData.body.trim()) {
      errors.body = 'Template body is required'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setSaving(true)
    try {
      const payload = { minute_template: formData }

      if (editingTemplate) {
        await api.put(`/api/v1/minute_templates/${editingTemplate.id}`, payload)
        setToast({ message: 'Template updated successfully', type: 'success' })
      } else {
        await api.post('/api/v1/minute_templates', payload)
        setToast({ message: 'Template created successfully', type: 'success' })
      }

      setIsFormOpen(false)
      loadTemplates()
    } catch (error) {
      console.error('Failed to save template:', error)
      const errorMsg = error.response?.data?.errors?.[0] || 'Failed to save template'
      setToast({ message: errorMsg, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (template) => {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return

    try {
      await api.delete(`/api/v1/minute_templates/${template.id}`)
      setTemplates(templates.filter(t => t.id !== template.id))
      setToast({ message: 'Template deleted successfully', type: 'success' })
    } catch (error) {
      console.error('Failed to delete template:', error)
      const errorMsg = error.response?.data?.errors?.[0] || 'Failed to delete template'
      setToast({ message: errorMsg, type: 'error' })
    }
  }

  const handlePreview = async (template) => {
    setPreviewLoading(true)
    setPreviewOpen(true)

    try {
      const response = await api.post(`/api/v1/minute_templates/${template.id}/preview`, {})
      setPreviewContent(response.data)
    } catch (error) {
      console.error('Failed to generate preview:', error)
      setToast({ message: 'Failed to generate preview', type: 'error' })
      setPreviewOpen(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDuplicate = async (template) => {
    try {
      // Fetch full template first
      const response = await api.get(`/api/v1/minute_templates/${template.id}`)
      const fullTemplate = response.data

      const payload = {
        minute_template: {
          name: `${fullTemplate.name} (Copy)`,
          template_type: fullTemplate.template_type,
          body: fullTemplate.body,
          required_fields: fullTemplate.required_fields,
          active: true
        }
      }

      await api.post('/api/v1/minute_templates', payload)
      setToast({ message: 'Template duplicated successfully', type: 'success' })
      loadTemplates()
    } catch (error) {
      console.error('Failed to duplicate template:', error)
      setToast({ message: 'Failed to duplicate template', type: 'error' })
    }
  }

  const formatType = (type) => {
    if (!type) return ''
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  // Extract placeholders from template body for display
  const extractPlaceholders = (body) => {
    if (!body) return []
    const matches = body.match(/\{\{(\w+)\}\}/g)
    return matches ? [...new Set(matches)] : []
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-5 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Minute Templates</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Manage templates for company and trust minutes
          </p>
        </div>
        <div className="mt-3 sm:mt-0">
          <button
            onClick={openNewForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            New Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type
          </label>
          <select
            id="type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="block w-40 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:text-white"
          >
            <option value="all">All Types</option>
            {templateTypes.map((type) => (
              <option key={type} value={type}>
                {formatType(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center pt-6">
          <input
            type="checkbox"
            id="showInactive"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="showInactive" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            Show inactive
          </label>
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No templates found</p>
          <button
            onClick={openNewForm}
            className="mt-4 inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
          >
            <PlusIcon className="h-5 w-5" />
            Create your first template
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow border ${
                template.active ? 'border-gray-200 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600 opacity-60'
              } p-5 hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                    {template.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      template.template_type === 'company' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      template.template_type === 'trust' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {formatType(template.template_type)}
                    </span>
                    {!template.active && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                {template.minutes_count > 0 ? (
                  <span>Used in {template.minutes_count} minute{template.minutes_count !== 1 ? 's' : ''}</span>
                ) : (
                  <span>Not used yet</span>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2 border-t border-gray-100 dark:border-gray-700 pt-4">
                <button
                  onClick={() => handlePreview(template)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                  title="Preview"
                >
                  <EyeIcon className="h-4 w-4" />
                  Preview
                </button>
                <button
                  onClick={() => openEditForm(template)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                  title="Edit"
                >
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDuplicate(template)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
                  title="Duplicate"
                >
                  <DocumentDuplicateIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(template)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 ml-auto"
                  title="Delete"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    className={`block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:text-white ${
                      formErrors.name ? 'border-red-300' : ''
                    }`}
                    placeholder="e.g., Annual General Meeting Minutes"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="template_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    id="template_type"
                    name="template_type"
                    value={formData.template_type}
                    onChange={handleFormChange}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:text-white"
                  >
                    {templateTypes.map((type) => (
                      <option key={type} value={type}>
                        {formatType(type)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="body" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Template Body *
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Use {'{{placeholder}}'} syntax for dynamic fields. Example: {'{{company_name}}'}, {'{{director_name}}'}, {'{{meeting_date}}'}
                </p>
                <textarea
                  id="body"
                  name="body"
                  rows={15}
                  value={formData.body}
                  onChange={handleFormChange}
                  className={`block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono dark:bg-gray-900 dark:text-white ${
                    formErrors.body ? 'border-red-300' : ''
                  }`}
                  placeholder={`MINUTES OF MEETING OF DIRECTORS
OF
{{company_name}}
ACN {{acn}}

Date: {{meeting_date}}
Time: {{meeting_time}}
Place: {{meeting_place}}

PRESENT:
{{director_name}} (Chair)

QUORUM:
A quorum being present, the Chair declared the meeting open.

RESOLUTION:
{{resolution_text}}

CLOSURE:
There being no further business, the meeting was declared closed.

_______________________
{{director_name}}
Director`}
                />
                {formErrors.body && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.body}</p>
                )}

                {/* Show detected placeholders */}
                {formData.body && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Detected placeholders: {extractPlaceholders(formData.body).join(', ') || 'None'}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  name="active"
                  checked={formData.active}
                  onChange={handleFormChange}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Active (available for use)
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Template Preview
              </h2>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {previewLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : previewContent ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <strong>Template:</strong> {previewContent.template?.name}
                  </div>
                  {previewContent.variables_used?.length > 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      <strong>Variables:</strong> {previewContent.variables_used.join(', ')}
                    </div>
                  )}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-900">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono">
                      {previewContent.preview}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No preview available</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
