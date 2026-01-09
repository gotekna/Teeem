import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, CheckIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import { api } from '@/lib/api'

/**
 * SupervisorChecklistModal
 *
 * Modal for assigning supervisor checklist templates to a schedule template task.
 * Allows multi-select so a task can have multiple checklist items.
 */

export default function SupervisorChecklistModal({ isOpen, onClose, currentRow, onSave }) {
  const [availableTemplates, setAvailableTemplates] = useState([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadChecklistTemplates()
      // Initialize selected templates from current row
      setSelectedTemplateIds(currentRow?.supervisor_checklist_template_ids || [])
    }
  }, [isOpen, currentRow])

  const loadChecklistTemplates = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/v1/supervisor_checklist_templates')
      setAvailableTemplates(response || [])
    } catch (error) {
      console.error('Failed to load supervisor checklist templates:', error)
      setAvailableTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const toggleTemplate = (templateId) => {
    setSelectedTemplateIds(prev => {
      if (prev.includes(templateId)) {
        return prev.filter(id => id !== templateId)
      } else {
        return [...prev, templateId]
      }
    })
  }

  const toggleAll = () => {
    if (selectedTemplateIds.length === availableTemplates.length) {
      setSelectedTemplateIds([])
    } else {
      setSelectedTemplateIds(availableTemplates.map(template => template.id))
    }
  }

  const handleSave = () => {
    onSave(selectedTemplateIds)
    onClose()
  }

  // Group templates by category
  const groupedTemplates = availableTemplates.reduce((acc, template) => {
    const category = template.category || 'Uncategorized'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(template)
    return acc
  }, {})

  const categories = Object.keys(groupedTemplates).sort()

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: 99999 }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" style={{ zIndex: 100000 }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Assign Supervisor Checklist Items
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Task: {currentRow?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500 dark:text-gray-400">Loading checklist templates...</div>
            </div>
          ) : availableTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <ClipboardDocumentListIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-center">
                No supervisor checklist templates found.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 text-center">
                Create checklist templates in Settings → Supervisor Checklist first.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Select All */}
              <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={selectedTemplateIds.length === availableTemplates.length && availableTemplates.length > 0}
                  onChange={toggleAll}
                  className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="select-all"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Select All ({availableTemplates.length} items)
                </label>
              </div>

              {/* Grouped Template List */}
              {categories.map(category => (
                <div key={category} className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {groupedTemplates[category].map(template => {
                      const isSelected = selectedTemplateIds.includes(template.id)
                      return (
                        <div
                          key={template.id}
                          onClick={() => toggleTemplate(template.id)}
                          className={`flex items-start gap-4 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by div onClick
                            className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {template.name}
                            </div>
                            {template.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {template.description}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedTemplateIds.length} item(s) selected
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2"
            >
              <CheckIcon className="h-4 w-4" />
              Save Selection
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
