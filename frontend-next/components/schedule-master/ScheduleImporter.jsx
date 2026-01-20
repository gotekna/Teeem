import { useState, useRef } from 'react'
import { ArrowUpTrayIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline'
import { api } from '@/lib/api'

export default function ScheduleImporter({ constructionId, onImportSuccess, compact = false }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = async (file) => {
    setError(null)

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setError('Please upload a CSV or Excel file')
      return
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB')
      return
    }

    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('file', file)

      const response = await api.postFormData(
        `/api/v1/jobs/${constructionId}/schedule_tasks/import`,
        formData
      )

      if (response.success) {
        onImportSuccess(response)
      } else {
        setError(response.error || 'Import failed')
      }
    } catch (err) {
      setError('Failed to import schedule. Please try again.')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  // Compact mode - just a button
  if (compact) {
    return (
      <div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls"
          onChange={handleChange}
          disabled={uploading}
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
          {uploading ? 'Importing...' : 'Re-import Schedule'}
        </button>
        {error && (
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="text-red-800 dark:text-red-400 text-sm">{error}</div>
          </div>
        )}
      </div>
    )
  }

  // Full upload area
  return (
    <div className="max-w-2xl mx-auto">
      <div
        className={`relative border-2 border-dashed rounded-lg p-12 text-center transition ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls"
          onChange={handleChange}
          disabled={uploading}
        />

        <div className="space-y-4">
          <div className="text-gray-400 dark:text-gray-500">
            <DocumentArrowUpIcon className="mx-auto h-16 w-16" />
          </div>

          {uploading ? (
            <div className="text-gray-600 dark:text-gray-400">
              <div className="font-medium">Importing schedule...</div>
              <div className="text-sm mt-1">Please wait while we process your file</div>
            </div>
          ) : (
            <>
              <div className="text-lg font-medium text-gray-900 dark:text-white">
                Drop your schedule file here, or{' '}
                <button
                  type="button"
                  onClick={handleClick}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  browse
                </button>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Supports CSV, XLS, and XLSX files up to 50MB
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="text-red-800 dark:text-red-400 text-sm">{error}</div>
        </div>
      )}

      <div className="mt-8 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
        <h3 className="text-sm font-medium text-indigo-900 dark:text-indigo-300 mb-2">What happens next?</h3>
        <ul className="text-sm text-indigo-800 dark:text-indigo-400 space-y-2">
          <li className="flex items-start">
            <span className="mr-2">1.</span>
            <span>We'll import all schedule tasks from your file</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">2.</span>
            <span>You can match each task to purchase orders</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">3.</span>
            <span>Once matched, view your timeline in the Gantt chart</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
