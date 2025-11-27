import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderIcon,
  ArrowUpTrayIcon,
  ArrowTopRightOnSquareIcon,
  CloudIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../api'
import DocumentCategoryTabs from './DocumentCategoryTabs'
import DocumentTaskList from './DocumentTaskList'

export default function JobDocumentsTab({ jobId, jobTitle }) {
  const [viewMode, setViewMode] = useState('tasks') // 'tasks' or 'onedrive'
  const [orgStatus, setOrgStatus] = useState({
    loading: true,
    connected: false,
  })
  const [jobFolderStatus, setJobFolderStatus] = useState({
    loading: false,
    exists: false,
    webUrl: null,
  })
  const [folders, setFolders] = useState([])
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  const [creatingFolders, setCreatingFolders] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    checkOrganizationStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  const checkOrganizationStatus = async () => {
    try {
      setOrgStatus({ loading: true, connected: false })
      setError(null)

      const response = await api.get('/api/v1/organization_onedrive/status')

      setOrgStatus({
        loading: false,
        connected: response.connected,
        rootFolderPath: response.root_folder_path,
      })

      // If organization is connected, check if job folder exists
      if (response.connected) {
        await checkJobFolderStatus()
      }
    } catch (err) {
      console.error('Failed to check organization OneDrive status:', err)
      setOrgStatus({ loading: false, connected: false })
      setError(err.message || 'Failed to check OneDrive status')
    }
  }

  const checkJobFolderStatus = async () => {
    try {
      setJobFolderStatus({ loading: true, exists: false, webUrl: null })

      const response = await api.get(`/api/v1/organization_onedrive/job_folders?job_id=${jobId}`)

      setJobFolderStatus({
        loading: false,
        exists: true,
        webUrl: response.job_folder_web_url,
        jobFolderId: response.job_folder_id,
      })

      // Load folder structure
      const items = response.items || []
      const folderItems = items.filter(item => item.folder)
      setFolders(folderItems)

    } catch (err) {
      // 404 means job folder doesn't exist yet
      if (err.response?.status === 404 || err.response?.data?.job_folder_exists === false) {
        setJobFolderStatus({
          loading: false,
          exists: false,
          webUrl: null,
        })
      } else {
        console.error('Failed to check job folder status:', err)
        setError(err.message || 'Failed to load job folders')
      }
    }
  }

  const handleCreateFolders = async () => {
    try {
      setCreatingFolders(true)
      setError(null)
      setMessage(null)

      const response = await api.post(`/api/v1/organization_onedrive/create_job_folders?job_id=${jobId}`)

      setMessage({
        type: 'success',
        text: response.message || 'Folder structure created successfully!',
      })

      // Refresh job folder status
      await checkJobFolderStatus()
    } catch (err) {
      console.error('Failed to create folders:', err)
      setError(err.message || 'Failed to create folder structure')
    } finally {
      setCreatingFolders(false)
    }
  }

  const handleUpload = (folderId) => {
    setUploading(folderId)
    fileInputRef.current.click()
  }

  const handleFileSelect = async (event) => {
    const file = event.target.files[0]
    if (!file || !uploading) return

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('job_id', jobId)
      formData.append('folder_id', uploading)

      await api.post('/api/v1/organization_onedrive/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setMessage({
        type: 'success',
        text: `File "${file.name}" uploaded successfully!`,
      })

      // Refresh folder structure
      await checkJobFolderStatus()
    } catch (err) {
      console.error('Failed to upload file:', err)
      setError(err.message || 'Failed to upload file')
    } finally {
      setUploading(null)
      event.target.value = '' // Reset file input
    }
  }

  const handleOpenInOneDrive = (webUrl) => {
    window.open(webUrl, '_blank', 'noopener,noreferrer')
  }

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  const renderFolder = (folder, level = 0) => {
    const hasChildren = folder.folder?.childCount > 0
    const isExpanded = expandedFolders.has(folder.id)
    const fileCount = folder.folder?.childCount || 0

    return (
      <div key={folder.id}>
        <div
          className="group flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer border-b border-gray-200 dark:border-gray-700"
          style={{ paddingLeft: `${level * 24 + 16}px` }}
          onClick={() => hasChildren && toggleFolder(folder.id)}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {hasChildren && (
              <svg
                className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
            {!hasChildren && <div className="w-4" />}

            <FolderIcon className="h-5 w-5 text-yellow-500 flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {folder.name}
              </p>
              {folder.lastModifiedDateTime && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Modified {new Date(folder.lastModifiedDateTime).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {fileCount} {fileCount === 1 ? 'item' : 'items'}
              </span>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUpload(folder.id)
                  }}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                  title="Upload files"
                >
                  <ArrowUpTrayIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenInOneDrive(folder.webUrl)
                  }}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                  title="Open in OneDrive"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main render with toggle between Tasks and OneDrive
  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('tasks')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'tasks'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4" />
              Document Tasks
            </div>
          </button>
          <button
            onClick={() => setViewMode('onedrive')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'onedrive'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <CloudIcon className="h-4 w-4" />
              SharePoint Folders
            </div>
          </button>
        </div>
      </div>

      {/* Render based on view mode */}
      {viewMode === 'tasks' ? (
        <DocumentCategoryTabs jobId={jobId}>
          {(category) => <DocumentTaskList jobId={jobId} category={category} />}
        </DocumentCategoryTabs>
      ) : (
        <OneDriveView
          orgStatus={orgStatus}
          jobFolderStatus={jobFolderStatus}
          folders={folders}
          jobTitle={jobTitle}
          creatingFolders={creatingFolders}
          error={error}
          message={message}
          uploading={uploading}
          handleCreateFolders={handleCreateFolders}
          handleOpenInOneDrive={handleOpenInOneDrive}
          handleUpload={handleUpload}
          checkJobFolderStatus={checkJobFolderStatus}
          renderFolder={renderFolder}
          fileInputRef={fileInputRef}
          handleFileSelect={handleFileSelect}
        />
      )}
    </div>
  )
}

// Separate OneDrive View Component
function OneDriveView({
  orgStatus,
  jobFolderStatus,
  folders,
  jobTitle,
  creatingFolders,
  error,
  message,
  handleCreateFolders,
  handleOpenInOneDrive,
  checkJobFolderStatus,
  renderFolder,
  fileInputRef,
  handleFileSelect,
}) {
  // Loading state
  if (orgStatus.loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-x-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-500"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Loading OneDrive status...</span>
        </div>
      </div>
    )
  }

  // Organization not connected state
  if (!orgStatus.connected) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 bg-white dark:bg-gray-900 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
          <CloudIcon className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            OneDrive Not Connected
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Your organization hasn't connected OneDrive yet. An admin needs to connect OneDrive in Settings first.
          </p>

          <div className="mt-6">
            <Link
              to="/admin/system?tab=integrations"
              className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Cog6ToothIcon className="h-5 w-5" />
              Go to System Admin
            </Link>
          </div>

          <div className="mt-8 max-w-md mx-auto text-left">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">What is OneDrive Integration?</h4>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Automatically create organized folder structures for each job</li>
              <li>• Upload and manage documents directly from TEEEM</li>
              <li>• Access files from OneDrive or directly in TEEEM</li>
              <li>• One-time setup - works for all jobs automatically</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Connected but no job folder yet
  if (!jobFolderStatus.exists) {
    return (
      <div className="space-y-6">
        {/* Messages */}
        {error && (
          <div className="rounded-md bg-red-100 dark:bg-red-400/10 p-4">
            <div className="flex">
              <ExclamationCircleIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className="rounded-md bg-green-100 dark:bg-green-400/10 p-4">
            <div className="flex">
              <CheckCircleIcon className="h-5 w-5 text-green-700 dark:text-green-400" />
              <div className="ml-3">
                <p className="text-sm text-green-700 dark:text-green-400">{message.text}</p>
              </div>
            </div>
          </div>
        )}

        {/* Create folders prompt */}
        <div className="text-center py-12 bg-white dark:bg-gray-900 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
          <FolderIcon className="mx-auto h-16 w-16 text-yellow-500" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            Create Folder Structure
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Create the Tekna Standard Residential folder structure in OneDrive for <span className="font-medium">{jobTitle}</span>.
          </p>

          <div className="mt-6">
            <button
              onClick={handleCreateFolders}
              disabled={creatingFolders}
              className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {creatingFolders ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Creating Folders...
                </>
              ) : (
                <>
                  <FolderIcon className="h-5 w-5" />
                  Create Folder Structure
                </>
              )}
            </button>
          </div>

          <div className="mt-8 max-w-md mx-auto text-left">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">What will be created:</h4>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>• Job folder in {orgStatus.rootFolderPath || 'TEEEM Jobs'}</li>
              <li>• 29 organized subfolders (Tekna template)</li>
              <li>• Ready for document uploads and management</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Connected and folders exist - show the full interface
  return (
    <div className="space-y-6">
      {/* Messages */}
      {message && (
        <div className="rounded-md bg-green-100 dark:bg-green-400/10 p-4">
          <div className="flex">
            <CheckCircleIcon className="h-5 w-5 text-green-700 dark:text-green-400" />
            <div className="ml-3">
              <p className="text-sm text-green-700 dark:text-green-400">{message.text}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-100 dark:bg-red-400/10 p-4">
          <div className="flex">
            <ExclamationCircleIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header with OneDrive status */}
      <div className="bg-gradient-to-r from-green-50 to-green-50 dark:from-green-900/20 dark:to-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-500" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                OneDrive Connected
              </h3>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Folder structure created for <span className="font-medium">{jobTitle}</span>
            </p>
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              📁 Tekna Standard Residential Template • {folders.length} folders
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={checkJobFolderStatus}
              className="inline-flex items-center gap-2 px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>

            {jobFolderStatus.webUrl && (
              <button
                onClick={() => handleOpenInOneDrive(jobFolderStatus.webUrl)}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                Open in OneDrive
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Folder structure */}
      <div className="bg-white dark:bg-gray-900 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Folder Structure
            </h4>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>{folders.length} folders</span>
            </div>
          </div>
        </div>

        {folders.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {folders.map(folder => renderFolder(folder, 0))}
          </div>
        ) : (
          <div className="px-4 py-12 text-center">
            <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No folders found. Try refreshing.
            </p>
          </div>
        )}

        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Synced with OneDrive • Hover over folders to upload files or open in OneDrive
          </p>
        </div>
      </div>

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  )
}
