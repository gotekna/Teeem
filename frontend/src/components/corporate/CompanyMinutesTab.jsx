import { useState, useEffect } from 'react'
import {
  PlusIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import api from '../../api'

export default function CompanyMinutesTab({ company, onUpdate }) {
  const [minutes, setMinutes] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [editingMinute, setEditingMinute] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  useEffect(() => {
    loadData()
  }, [company.id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [minutesRes, templatesRes] = await Promise.all([
        api.get(`/api/v1/companies/${company.id}/minutes`),
        api.get('/api/v1/minute_templates')
      ])
      setMinutes(minutesRes.minutes || [])
      setTemplates(templatesRes.minute_templates || [])
    } catch (error) {
      console.error('Failed to load minutes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMinute = async (id) => {
    if (!confirm('Are you sure you want to delete this minute?')) return
    try {
      await api.delete(`/api/v1/companies/${company.id}/minutes/${id}`)
      await loadData()
    } catch (error) {
      console.error('Failed to delete minute:', error)
      alert('Failed to delete minute')
    }
  }

  const handleSaveMinute = async (formData) => {
    try {
      if (editingMinute) {
        await api.put(`/api/v1/companies/${company.id}/minutes/${editingMinute.id}`, {
          company_minute: formData
        })
      } else if (selectedTemplate) {
        // Create from template
        await api.post(`/api/v1/companies/${company.id}/minutes/create_from_template`, {
          minute_template_id: selectedTemplate.id,
          company_minute: formData
        })
      } else {
        await api.post(`/api/v1/companies/${company.id}/minutes`, {
          company_minute: formData
        })
      }
      setShowForm(false)
      setEditingMinute(null)
      setSelectedTemplate(null)
      await loadData()
      if (onUpdate) onUpdate()
    } catch (error) {
      throw error
    }
  }

  const handleSignMinute = async (minuteId) => {
    const signedBy = prompt('Enter the name(s) of the signatory(ies):')
    if (!signedBy) return

    try {
      await api.post(`/api/v1/companies/${company.id}/minutes/${minuteId}/sign`, {
        signed_by: signedBy
      })
      await loadData()
    } catch (error) {
      console.error('Failed to sign minute:', error)
      alert(error.response?.data?.error || 'Failed to sign minute')
    }
  }

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template)
    setShowTemplateSelector(false)
    setEditingMinute(null)
    setShowForm(true)
  }

  // Group by status
  const draftMinutes = minutes.filter(m => m.status === 'draft')
  const signedMinutes = minutes.filter(m => m.status === 'signed' || m.status === 'approved')
  const filedMinutes = minutes.filter(m => m.status === 'filed')

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading minutes...</div>
  }

  // Show template selector
  if (showTemplateSelector) {
    return (
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select Template</h3>
        <p className="text-sm text-gray-500 mb-4">Choose a template to generate minutes from:</p>

        {templates.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">No templates available.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="w-full text-left p-4 rounded-lg border border-gray-200 bg-white hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
              >
                <div className="font-medium text-gray-900">{template.name}</div>
                <div className="text-sm text-gray-500">{template.template_type}</div>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            onClick={() => setShowTemplateSelector(false)}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Show form view
  if (showForm) {
    return (
      <MinuteForm
        minute={editingMinute}
        template={selectedTemplate}
        company={company}
        onSave={handleSaveMinute}
        onCancel={() => { setShowForm(false); setEditingMinute(null); setSelectedTemplate(null) }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Minutes</div>
          <div className="text-2xl font-bold text-gray-900">{minutes.length}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center text-sm text-yellow-700">
            <PencilSquareIcon className="h-4 w-4 mr-1" />
            Drafts
          </div>
          <div className="text-2xl font-bold text-yellow-900">{draftMinutes.length}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center text-sm text-green-700">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            Signed
          </div>
          <div className="text-2xl font-bold text-green-900">{signedMinutes.length}</div>
        </div>
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-sm text-gray-500">Filed</div>
          <div className="text-2xl font-bold text-gray-900">{filedMinutes.length}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={() => setShowTemplateSelector(true)}
          className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
          From Template
        </button>
        <button
          onClick={() => { setEditingMinute(null); setSelectedTemplate(null); setShowForm(true) }}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          New Minute
        </button>
      </div>

      {/* Content */}
      {minutes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No minutes</h3>
          <p className="mt-1 text-sm text-gray-500">Create corporate minutes from templates or from scratch.</p>
          <div className="mt-4 flex justify-center space-x-3">
            <button
              onClick={() => setShowTemplateSelector(true)}
              className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
              From Template
            </button>
            <button
              onClick={() => { setEditingMinute(null); setSelectedTemplate(null); setShowForm(true) }}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              New Minute
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {minutes.map((minute) => (
            <div key={minute.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <h4 className="text-sm font-medium text-gray-900">{minute.title}</h4>
                    <span className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      minute.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                      minute.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                      minute.status === 'signed' ? 'bg-green-100 text-green-800' :
                      minute.status === 'filed' ? 'bg-gray-100 text-gray-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {minute.status === 'draft' && <PencilSquareIcon className="h-3 w-3 mr-1" />}
                      {minute.status === 'signed' && <CheckCircleIcon className="h-3 w-3 mr-1" />}
                      {minute.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {minute.meeting_date ? new Date(minute.meeting_date).toLocaleDateString() : '-'}
                    {minute.minute_template && (
                      <span className="ml-2 text-xs text-gray-400">
                        Template: {minute.minute_template.name}
                      </span>
                    )}
                  </div>
                  {minute.signed_by && (
                    <div className="mt-1 text-xs text-gray-400">
                      Signed by: {minute.signed_by}
                      {minute.signed_date && ` on ${new Date(minute.signed_date).toLocaleDateString()}`}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {minute.status === 'draft' && (
                    <button
                      onClick={() => handleSignMinute(minute.id)}
                      className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
                    >
                      Sign
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingMinute(minute); setSelectedTemplate(null); setShowForm(true) }}
                    className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteMinute(minute.id)}
                    className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MinuteForm({ minute, template, company, onSave, onCancel }) {
  // Parse template placeholders and create field mapping
  const [formData, setFormData] = useState({
    title: minute?.title || template?.name || '',
    meeting_date: minute?.meeting_date || new Date().toISOString().split('T')[0],
    content: minute?.content || template?.body || '',
    status: minute?.status || 'draft',
    notes: minute?.notes || ''
  })

  // Template field values (for placeholder replacement)
  const [templateFields, setTemplateFields] = useState({
    company_name: company.name,
    company_acn: company.acn || '',
    company_abn: company.abn || '',
    registered_office: company.registered_office_address || '',
    date: new Date().toLocaleDateString(),
    ...parseRequiredFields(template?.required_fields)
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [previewContent, setPreviewContent] = useState('')

  // Parse required fields from template
  function parseRequiredFields(fields) {
    if (!fields) return {}
    try {
      const parsed = typeof fields === 'string' ? JSON.parse(fields) : fields
      return Array.isArray(parsed) ? parsed.reduce((acc, f) => ({ ...acc, [f]: '' }), {}) : {}
    } catch {
      return {}
    }
  }

  // Get required fields from template
  const requiredFields = template?.required_fields ? (
    typeof template.required_fields === 'string'
      ? JSON.parse(template.required_fields)
      : template.required_fields
  ) : []

  // Generate preview with placeholders replaced
  useEffect(() => {
    if (template?.body) {
      let content = template.body
      Object.entries(templateFields).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi')
        content = content.replace(regex, value || `[${key}]`)
      })
      setPreviewContent(content)
      setFormData(prev => ({ ...prev, content }))
    }
  }, [template, templateFields])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        ...formData,
        content: previewContent || formData.content
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save minute')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {minute ? 'Edit Minute' : template ? `New: ${template.name}` : 'New Minute'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Meeting Date</label>
          <input
            type="date"
            value={formData.meeting_date}
            onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        {/* Template Fields */}
        {template && requiredFields.length > 0 && (
          <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700">Template Fields</h4>
            {requiredFields.map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 capitalize">
                  {field.replace(/_/g, ' ')}
                </label>
                <input
                  type="text"
                  value={templateFields[field] || ''}
                  onChange={(e) => setTemplateFields({ ...templateFields, [field]: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Content</label>
          <textarea
            value={template ? previewContent : formData.content}
            onChange={(e) => {
              if (!template) setFormData({ ...formData, content: e.target.value })
            }}
            rows={15}
            readOnly={!!template}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono text-sm ${template ? 'bg-white' : ''}`}
          />
          {template && (
            <p className="mt-1 text-xs text-gray-500">
              Content is generated from template. Fill in the fields above to customize.
            </p>
          )}
        </div>

        {minute && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="signed">Signed</option>
              <option value="filed">Filed</option>
            </select>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : (minute ? 'Update' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  )
}
