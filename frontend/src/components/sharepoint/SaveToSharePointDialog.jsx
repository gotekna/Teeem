import { useState, useEffect } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { FolderIcon, ChevronRightIcon, HomeIcon, PlusIcon, CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function SaveToSharePointDialog({
  isOpen,
  onClose,
  selectedRecordIds = [],
  foundationId,
  onSuccess,
  onError
}) {
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'My Drive' }])
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [onedriveConnected, setOnedriveConnected] = useState(null)

  useEffect(() => {
    if (isOpen) {
      checkOnedriveStatus()
    }
  }, [isOpen])

  const checkOnedriveStatus = async () => {
    try {
      const response = await api.get('/api/v1/organization_onedrive/status')
      setOnedriveConnected(response.connected)
      if (response.connected) {
        loadFolders(null)
      }
    } catch (err) {
      setOnedriveConnected(false)
      setError('Failed to check OneDrive connection status')
    }
  }

  const loadFolders = async (folderId) => {
    setLoading(true)
    setError(null)

    try {
      const options = folderId ? { params: { folder_id: folderId } } : {}
      const response = await api.get('/api/v1/organization_onedrive/browse_folders', options)

      setFolders(response.folders || [])
      setCurrentFolderId(folderId)
    } catch (err) {
      setError(err.message || 'Failed to load folders')
    } finally {
      setLoading(false)
    }
  }

  const handleFolderClick = (folder) => {
    loadFolders(folder.id)
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }])
    setSelectedFolder(folder)
  }

  const handleBreadcrumbClick = (index) => {
    const clickedBreadcrumb = breadcrumbs[index]
    loadFolders(clickedBreadcrumb.id)
    setBreadcrumbs(breadcrumbs.slice(0, index + 1))

    if (index === 0) {
      setSelectedFolder(null)
    } else {
      setSelectedFolder(clickedBreadcrumb)
    }
  }

  const handleSaveToFolder = async (targetFolderId, newFolderNameToCreate = null) => {
    setUploading(true)
    setError(null)

    try {
      const payload = {
        foundation_id: foundationId,
        record_ids: selectedRecordIds,
        folder_id: targetFolderId
      }

      if (newFolderNameToCreate) {
        payload.new_folder_name = newFolderNameToCreate
      }

      const response = await api.post('/api/v1/organization_onedrive/copy_files', payload)

      if (response.success) {
        if (onSuccess) {
          onSuccess(response)
        }
        onClose()
      } else {
        setError(response.error || 'Failed to save files')
        if (onError) {
          onError(response.error)
        }
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to save files to SharePoint'
      setError(errorMsg)
      if (onError) {
        onError(errorMsg)
      }
    } finally {
      setUploading(false)
    }
  }

  const handleSaveToCurrentFolder = () => {
    handleSaveToFolder(currentFolderId)
  }

  const handleCreateAndSave = () => {
    if (newFolderName.trim()) {
      handleSaveToFolder(currentFolderId, newFolderName.trim())
    }
  }

  const handleSelectSpecificFolder = (folder) => {
    handleSaveToFolder(folder.id)
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto max-w-2xl w-full rounded-lg bg-white dark:bg-gray-800 shadow-xl">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <CloudArrowUpIcon className="h-6 w-6 text-blue-600" />
                Save to SharePoint
              </DialogTitle>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Selected records info */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <span className="font-medium">{selectedRecordIds.length}</span> {selectedRecordIds.length === 1 ? 'record' : 'records'} selected
              </p>
            </div>

            {/* OneDrive not connected state */}
            {onedriveConnected === false && (
              <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  OneDrive is not connected. Please connect OneDrive in Settings to use this feature.
                </p>
              </div>
            )}

            {/* Connected - show folder browser */}
            {onedriveConnected === true && (
              <>
                {/* Breadcrumbs */}
                <div className="flex items-center gap-x-2 mb-4 overflow-x-auto">
                  {breadcrumbs.map((crumb, index) => (
                    <div key={index} className="flex items-center gap-x-2">
                      <button
                        onClick={() => handleBreadcrumbClick(index)}
                        className="flex items-center gap-x-1 text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        {index === 0 ? (
                          <HomeIcon className="h-4 w-4" />
                        ) : null}
                        <span>{crumb.name}</span>
                      </button>
                      {index < breadcrumbs.length - 1 && (
                        <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Current folder actions */}
                <div className="mb-4 flex items-center gap-3">
                  <button
                    onClick={handleSaveToCurrentFolder}
                    disabled={uploading}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CloudArrowUpIcon className="h-5 w-5" />
                    {uploading ? 'Saving...' : `Save Here (${breadcrumbs[breadcrumbs.length - 1].name})`}
                  </button>
                  <button
                    onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1"
                  >
                    <PlusIcon className="h-4 w-4" />
                    New Folder
                  </button>
                </div>

                {/* New folder input */}
                {showNewFolderInput && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Create new folder and save files:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Enter folder name..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newFolderName.trim()) {
                            handleCreateAndSave()
                          }
                        }}
                      />
                      <button
                        onClick={handleCreateAndSave}
                        disabled={!newFolderName.trim() || uploading}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploading ? 'Creating...' : 'Create & Save'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                )}

                {/* Folder list */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-md max-h-72 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-500"></div>
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading folders...</span>
                    </div>
                  ) : folders.length === 0 ? (
                    <div className="py-12 text-center">
                      <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        No subfolders in this location
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {folders.map((folder) => (
                        <li key={folder.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <div className="flex items-center justify-between px-4 py-3">
                            <button
                              onClick={() => handleFolderClick(folder)}
                              className="flex items-center gap-x-3 flex-1 text-left"
                            >
                              <FolderIcon className="h-5 w-5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {folder.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {folder.child_count} {folder.child_count === 1 ? 'item' : 'items'}
                                </p>
                              </div>
                              <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            </button>
                            <button
                              onClick={() => handleSelectSpecificFolder(folder)}
                              disabled={uploading}
                              className="ml-3 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
                            >
                              Save Here
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}

            {/* Footer buttons */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
