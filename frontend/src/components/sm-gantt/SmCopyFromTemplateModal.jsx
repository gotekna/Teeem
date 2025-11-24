import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, DocumentDuplicateIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function SmCopyFromTemplateModal({
  constructionId,
  isOpen,
  onClose,
  onCopy
}) {
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [expandedTemplate, setExpandedTemplate] = useState(null)
  const [selectedRows, setSelectedRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true)
      const response = await api.get('/api/v1/schedule_templates')
      setTemplates(response || [])
    } catch (err) {
      console.error('Failed to load templates:', err)
      setError('Failed to load templates')
    } finally {
      setLoadingTemplates(false)
    }
  }

  const loadTemplateRows = async (templateId) => {
    if (expandedTemplate === templateId) {
      setExpandedTemplate(null)
      setSelectedTemplate(null)
      return
    }

    try {
      const response = await api.get(`/api/v1/schedule_templates/${templateId}`)
      setSelectedTemplate(response)
      setExpandedTemplate(templateId)
      setSelectedRows([])
    } catch (err) {
      console.error('Failed to load template rows:', err)
      setError('Failed to load template rows')
    }
  }

  const toggleRowSelection = (rowId) => {
    setSelectedRows(prev =>
      prev.includes(rowId)
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    )
  }

  const selectAllRows = () => {
    if (!selectedTemplate?.rows) return
    if (selectedRows.length === selectedTemplate.rows.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(selectedTemplate.rows.map(r => r.id))
    }
  }

  const handleCopy = async () => {
    if (selectedRows.length === 0) {
      setError('Please select at least one task to copy')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Copy each selected row as a task
      for (const rowId of selectedRows) {
        await onCopy(rowId)
      }

      // Reset and close
      setSelectedRows([])
      setSelectedTemplate(null)
      setExpandedTemplate(null)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to copy tasks')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setError(null)
    setSelectedRows([])
    setSelectedTemplate(null)
    setExpandedTemplate(null)
    onClose()
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-white dark:bg-gray-900 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <DocumentDuplicateIcon className="h-6 w-6 text-indigo-600" />
                    <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Copy from Template
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Error message */}
                {error && (
                  <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                  {loadingTemplates ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <DocumentDuplicateIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No schedule templates available</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {templates.map(template => (
                        <div key={template.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                          {/* Template header */}
                          <button
                            onClick={() => loadTemplateRows(template.id)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {expandedTemplate === template.id ? (
                                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                              ) : (
                                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                              )}
                              <div className="text-left">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {template.name}
                                  {template.is_default && (
                                    <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {template.row_count} tasks
                                </div>
                              </div>
                            </div>
                          </button>

                          {/* Template rows (expanded) */}
                          {expandedTemplate === template.id && selectedTemplate && (
                            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                              {/* Select all */}
                              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedRows.length === selectedTemplate.rows?.length}
                                    onChange={selectAllRows}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Select All ({selectedRows.length} / {selectedTemplate.rows?.length || 0})
                                  </span>
                                </label>
                              </div>

                              {/* Row list */}
                              <div className="max-h-64 overflow-y-auto">
                                {selectedTemplate.rows?.map(row => (
                                  <label
                                    key={row.id}
                                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedRows.includes(row.id)}
                                      onChange={() => toggleRowSelection(row.id)}
                                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                        {row.sequence_order}. {row.name}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {row.duration} days
                                        {row.supplier_name && ` • ${row.supplier_name}`}
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {selectedRows.length > 0 && `${selectedRows.length} task(s) selected`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCopy}
                      disabled={loading || selectedRows.length === 0}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {loading ? 'Copying...' : `Copy ${selectedRows.length} Task${selectedRows.length !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
