import { useState, useEffect } from 'react'
import { XMarkIcon, DocumentDuplicateIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { api } from '@/lib/api'

export default function CopyFromTemplateModal({ isOpen, onClose, onCopy, constructionId }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [copying, setCopying] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
      setSelectedTemplateId(null)
      setErrorMessage(null)
    }
  }, [isOpen])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/task_templates')
      setTemplates(response.task_templates || [])
    } catch (err) {
      console.error('Failed to load templates:', err)
      setErrorMessage('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!selectedTemplateId) {
      setErrorMessage('Please select a template')
      return
    }

    setCopying(true)
    setErrorMessage(null)
    try {
      await onCopy(selectedTemplateId)
      onClose()
    } catch (error) {
      console.error('Error copying template:', error)
      setErrorMessage(`Failed to copy template: ${error.message}`)
    } finally {
      setCopying(false)
    }
  }

  if (!isOpen) return null

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: '2147483647' }}>
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <DocumentDuplicateIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Copy from Template
                </h3>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Error Message Banner */}
            {errorMessage && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 dark:text-red-200">{errorMessage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select a template to copy all its tasks to this job's schedule master.
            </p>

            {loading ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No templates available. Create templates in Settings first.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedTemplateId === template.id
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-400'
                        : 'border-gray-300 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            {template.name}
                          </h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400">
                            {template.task_type}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                            {template.category}
                          </span>
                          {template.is_milestone && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                              Milestone
                            </span>
                          )}
                        </div>
                        {template.description && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {template.description}
                          </p>
                        )}
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                          Duration: {template.default_duration_days} day{template.default_duration_days !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {selectedTemplateId === template.id && (
                        <div className="ml-4 flex-shrink-0">
                          <div className="h-5 w-5 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
                            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                              <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedTemplate && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Selected:</strong> {selectedTemplate.name}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  This will create a new schedule task in this job.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                disabled={copying}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={copying || !selectedTemplateId}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
                {copying ? 'Copying...' : 'Copy Template'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
