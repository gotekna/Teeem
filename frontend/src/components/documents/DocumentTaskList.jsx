import { useState, useEffect } from 'react'
import {
  DocumentIcon,
  PaperClipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowUpTrayIcon,
  EyeIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function DocumentTaskList({ jobId, category }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadDocumentTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, category.id])

  const loadDocumentTasks = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get(`/api/v1/jobs/${jobId}/document_tasks?category=${category.id}`)
      setTasks(response.tasks || [])
    } catch (err) {
      console.error('Failed to load document tasks:', err)
      setError(err.message)
      // Set default tasks if API fails
      setTasks(getDefaultTasks(category.id))
    } finally {
      setLoading(false)
    }
  }

  const getDefaultTasks = (categoryId) => {
    const tasksByCategory = {
      'site': [
        { id: 1, name: 'Survey Plan', description: 'Property survey plan documentation', required: true },
        { id: 2, name: 'Soil Test', description: 'Soil test report for foundations', required: true },
      ],
      'site-plan': [
        { id: 1, name: 'Survey Plan', description: 'Property survey plan documentation', required: true },
        { id: 2, name: 'Soil Test', description: 'Soil test report for foundations', required: true },
      ],
      'sales': [
        { id: 4, name: 'Sales Contract', description: 'Signed sales contract', required: true },
        { id: 5, name: 'Payment Schedule', description: 'Agreed payment schedule', required: true },
        { id: 6, name: 'Client Information Form', description: 'Completed client information', required: true },
      ],
      'certification': [
        { id: 7, name: 'Building Consent', description: 'Approved building consent', required: true },
        { id: 8, name: 'Engineering Certificates', description: 'Structural engineering certificates', required: true },
        { id: 9, name: 'Plumbing Certificate', description: 'Plumbing compliance certificate', required: false },
        { id: 10, name: 'Electrical Certificate', description: 'Electrical compliance certificate', required: false },
      ],
      'client': [
        { id: 11, name: 'Client ID Verification', description: 'Copy of client ID', required: true },
        { id: 12, name: 'Contact Details', description: 'Emergency contact information', required: true },
        { id: 13, name: 'Insurance Documents', description: 'Home insurance documents', required: false },
      ],
      'client-photo': [
        { id: 14, name: 'Before Photos', description: 'Site photos before construction', required: true },
        { id: 15, name: 'Progress Photos', description: 'Construction progress photos', required: false },
        { id: 16, name: 'Completion Photos', description: 'Final completion photos', required: true },
      ],
      'final-certificate': [
        { id: 17, name: 'Code Compliance Certificate', description: 'CCC from council', required: true },
        { id: 18, name: 'Warranty Documents', description: 'Builder warranty documents', required: true },
        { id: 19, name: 'As-Built Plans', description: 'Final as-built construction plans', required: true },
        { id: 20, name: 'Maintenance Guide', description: 'Home maintenance guide', required: false },
      ],
    }

    return (tasksByCategory[categoryId] || []).map(task => ({
      ...task,
      has_document: false,
      is_validated: false,
      document_url: null,
      uploaded_at: null,
      validated_at: null,
      validated_by: null,
    }))
  }

  const handleUpload = async (taskId, file) => {
    try {
      setUploading(taskId)
      setError(null)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('task_id', taskId)
      formData.append('construction_id', jobId)
      formData.append('category', category.id)

      const response = await api.post(`/api/v1/jobs/${jobId}/document_tasks/${taskId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // Update task in list
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId
            ? { ...task, has_document: true, document_url: response.document_url, uploaded_at: response.uploaded_at }
            : task
        )
      )
    } catch (err) {
      console.error('Failed to upload document:', err)
      setError(err.message || 'Failed to upload document')
    } finally {
      setUploading(null)
    }
  }

  const handleValidate = async (taskId) => {
    try {
      setError(null)
      const response = await api.post(`/api/v1/jobs/${jobId}/document_tasks/${taskId}/validate`)

      // Update task in list
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId
            ? {
                ...task,
                is_validated: true,
                validated_at: response.validated_at,
                validated_by: response.validated_by,
              }
            : task
        )
      )
    } catch (err) {
      console.error('Failed to validate document:', err)
      setError(err.message || 'Failed to validate document')
    }
  }

  const handleView = (task) => {
    if (task.document_url) {
      window.open(task.document_url, '_blank', 'noopener,noreferrer')
    }
  }

  const getStatusBadge = (task) => {
    if (task.is_validated) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Validated
        </span>
      )
    }
    if (task.has_document) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <PaperClipIcon className="h-3.5 w-3.5" />
          Attached
        </span>
      )
    }
    if (task.required) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          <XCircleIcon className="h-3.5 w-3.5" />
          Required
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
        Optional
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Loading document tasks...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {tasks.filter(t => t.has_document).length}/{tasks.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Documents Attached</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {tasks.filter(t => t.is_validated).length}/{tasks.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Validated</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {tasks.filter(t => t.required && !t.has_document).length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Required Missing</div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-100 dark:bg-red-400/10 p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Document Task List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Document
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <DocumentIcon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {task.name}
                          {task.required && <span className="text-red-500 ml-1">*</span>}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{task.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(task)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {task.uploaded_at ? new Date(task.uploaded_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {/* Upload Button */}
                      <label
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                          uploading === task.id
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20'
                        }`}
                      >
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0]
                            if (file) {
                              handleUpload(task.id, file)
                            }
                          }}
                          disabled={uploading === task.id}
                        />
                        {uploading === task.id ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <ArrowUpTrayIcon className="h-4 w-4" />
                            {task.has_document ? 'Replace' : 'Upload'}
                          </>
                        )}
                      </label>

                      {/* View Button */}
                      {task.has_document && (
                        <button
                          onClick={() => handleView(task)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                        >
                          <EyeIcon className="h-4 w-4" />
                          View
                        </button>
                      )}

                      {/* Validate Button */}
                      {task.has_document && !task.is_validated && (
                        <button
                          onClick={() => handleValidate(task.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 transition-colors"
                        >
                          <ShieldCheckIcon className="h-4 w-4" />
                          Validate
                        </button>
                      )}

                      {/* Validated By Info */}
                      {task.is_validated && task.validated_by && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          by {task.validated_by}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-12">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No document tasks</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            No documents are required for this category yet.
          </p>
        </div>
      )}
    </div>
  )
}
