import { useState, useEffect } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon, CloudIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'
import OneDriveFolderPicker from './OneDriveFolderPicker'
import PricebookMatchPreview from './PricebookMatchPreview'

export default function OneDriveConnection() {
  const [status, setStatus] = useState({
    loading: true,
    connected: false,
    driveName: null,
    rootFolderPath: null,
    rootFolderWebUrl: null,
    connectedAt: null,
    connectedBy: null,
    error: null,
  })
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState(null)
  const [syncingImages, setSyncingImages] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [folderPath, setFolderPath] = useState('00 - TEEEM/Photos for Price Book')
  const [editingRootFolder, setEditingRootFolder] = useState(false)
  const [newRootFolderName, setNewRootFolderName] = useState('')
  const [changingRootFolder, setChangingRootFolder] = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [folderPickerMode, setFolderPickerMode] = useState(null) // 'sync' or 'root'
  const [showMatchPreview, setShowMatchPreview] = useState(false)
  const [previewMatches, setPreviewMatches] = useState([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Fetch connection status on mount and handle OAuth callback
  useEffect(() => {
    let isMounted = true

    const loadStatus = async () => {
      try {
        if (!isMounted) return

        setStatus(prev => ({ ...prev, loading: true, error: null }))
        const response = await api.get('/api/v1/organization_onedrive/status')

        if (!isMounted) return

        setStatus({
          loading: false,
          connected: response.connected,
          driveName: response.drive_name,
          rootFolderPath: response.root_folder_path,
          rootFolderWebUrl: response.root_folder_web_url,
          connectedAt: response.connected_at,
          connectedBy: response.connected_by,
          metadata: response.metadata,
          error: null,
        })

        // Check if we're returning from OAuth callback
        const params = new URLSearchParams(window.location.search)
        const oneDriveStatus = params.get('onedrive')

        if (oneDriveStatus === 'connected') {
          if (isMounted) {
            setMessage({
              type: 'success',
              text: 'OneDrive connected successfully!',
            })
          }
          // Remove query params from URL
          window.history.replaceState({}, '', '/settings')
        } else if (oneDriveStatus === 'error') {
          const errorMessage = params.get('message') || 'Failed to connect OneDrive'
          if (isMounted) {
            setMessage({
              type: 'error',
              text: decodeURIComponent(errorMessage),
            })
          }
          // Remove query params from URL
          window.history.replaceState({}, '', '/settings')
        }
      } catch (err) {
        if (!isMounted) return

        setStatus({
          loading: false,
          connected: false,
          driveName: null,
          rootFolderPath: null,
          rootFolderWebUrl: null,
          connectedAt: null,
          connectedBy: null,
          error: err.message || 'Failed to fetch connection status',
        })
      }
    }

    loadStatus()

    return () => {
      isMounted = false
    }
  }, [])

  const fetchStatus = async () => {
    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }))
      const response = await api.get('/api/v1/organization_onedrive/status')

      setStatus({
        loading: false,
        connected: response.connected,
        driveName: response.drive_name,
        rootFolderPath: response.root_folder_path,
        rootFolderWebUrl: response.root_folder_web_url,
        connectedAt: response.connected_at,
        connectedBy: response.connected_by,
        metadata: response.metadata,
        error: null,
      })
    } catch (err) {
      setStatus({
        loading: false,
        connected: false,
        driveName: null,
        rootFolderPath: null,
        rootFolderWebUrl: null,
        connectedAt: null,
        connectedBy: null,
        error: err.message || 'Failed to fetch connection status',
      })
    }
  }

  const handleConnect = async () => {
    try {
      setConnecting(true)
      setMessage(null)

      // Get OAuth authorization URL
      const response = await api.get('/api/v1/organization_onedrive/authorize')

      // Redirect user to Microsoft sign-in
      window.location.href = response.auth_url
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to start OneDrive connection',
      })
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true)
      await api.delete('/api/v1/organization_onedrive/disconnect')

      setStatus({
        loading: false,
        connected: false,
        driveName: null,
        rootFolderPath: null,
        rootFolderWebUrl: null,
        connectedAt: null,
        connectedBy: null,
        error: null,
      })

      setMessage({
        type: 'success',
        text: 'Successfully disconnected from OneDrive',
      })

      setShowDisconnectDialog(false)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to disconnect from OneDrive',
      })
    } finally {
      setDisconnecting(false)
    }
  }

  const handlePreviewMatches = async () => {
    if (!folderPath || folderPath.trim() === '') {
      setMessage({
        type: 'error',
        text: 'Please enter a folder path',
      })
      return
    }

    try {
      setLoadingPreview(true)
      setMessage(null)

      const response = await api.get('/api/v1/organization_onedrive/preview_pricebook_matches', {
        params: { folder_path: folderPath.trim() }
      })

      console.log('Preview response:', response)
      console.log('Matches count:', response.matches?.length || 0)
      setPreviewMatches(response.matches || [])
      setShowMatchPreview(true)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to preview matches',
      })
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleApplyMatches = async (acceptedMatches) => {
    try {
      console.log('[OneDrive Apply] Starting to apply matches:', acceptedMatches.length)
      setSyncingImages(true)
      setMessage(null)
      // Don't close modal here - let user see the success message and close manually

      const response = await api.post('/api/v1/organization_onedrive/apply_pricebook_matches', {
        folder_path: folderPath.trim(),
        accepted_matches: acceptedMatches
      })

      console.log('[OneDrive Apply] Response received:', response)

      setMessage({
        type: 'success',
        text: response.message || `Synced ${response.matched || 0} images successfully!`,
      })

      setSyncResult({
        matched: response.matched || 0,
        photos_matched: response.photos_matched || 0,
        specs_matched: response.specs_matched || 0,
        qr_codes_matched: response.qr_codes_matched || 0,
        errors: response.errors || [],
        unmatched_files: response.unmatched_files || []
      })

      console.log('[OneDrive Apply] Sync result set:', {
        matched: response.matched,
        photos: response.photos_matched,
        specs: response.specs_matched,
        qr_codes: response.qr_codes_matched
      })

      // Close the modal after success so results show in parent component
      setShowMatchPreview(false)
    } catch (err) {
      console.error('[OneDrive Apply] Error occurred:', err)
      setMessage({
        type: 'error',
        text: err.message || 'Failed to apply matches',
      })
      throw err // Re-throw so the preview component knows
    } finally {
      setSyncingImages(false)
    }
  }

  const handleSyncPricebookImages = async () => {
    try {
      console.log('[OneDrive Sync] Starting sync with folder path:', folderPath)
      setSyncingImages(true)
      setSyncResult(null)

      const response = await api.post('/api/v1/organization_onedrive/sync_pricebook_images', {
        folder_path: folderPath
      })

      console.log('[OneDrive Sync] Response received:', response)
      setSyncResult(response)
      setMessage({
        type: 'success',
        text: `Synced ${response.matched || 0} images successfully! (${response.photos_matched || 0} photos, ${response.specs_matched || 0} specs, ${response.qr_codes_matched || 0} QR codes)`,
      })
      console.log('[OneDrive Sync] Success! Matched:', response.matched, 'Photos:', response.photos_matched, 'Specs:', response.specs_matched)
    } catch (err) {
      console.error('[OneDrive Sync] Error occurred:', err)
      console.error('[OneDrive Sync] Error message:', err.message)
      console.error('[OneDrive Sync] Error response:', err.response)
      setMessage({
        type: 'error',
        text: err.message || 'Failed to sync pricebook images',
      })
      setSyncResult({
        matched: 0,
        photos_matched: 0,
        specs_matched: 0,
        qr_codes_matched: 0,
        errors: [err.message || 'Unknown error occurred'],
        unmatched_files: []
      })
    } finally {
      console.log('[OneDrive Sync] Sync completed')
      setSyncingImages(false)
    }
  }

  const handleChangeRootFolder = async () => {
    if (!newRootFolderName || newRootFolderName.trim() === '') {
      setMessage({
        type: 'error',
        text: 'Please enter a folder name',
      })
      return
    }

    try {
      setChangingRootFolder(true)
      const response = await api.patch('/api/v1/organization_onedrive/change_root_folder', {
        folder_name: newRootFolderName.trim()
      })

      // Update status with new folder info
      setStatus(prev => ({
        ...prev,
        rootFolderPath: response.root_folder_path,
        rootFolderWebUrl: response.root_folder_web_url
      }))

      setMessage({
        type: 'success',
        text: response.message || 'Root folder updated successfully',
      })

      setEditingRootFolder(false)
      setNewRootFolderName('')
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to change root folder',
      })
    } finally {
      setChangingRootFolder(false)
    }
  }

  const handleOpenFolderPicker = (mode) => {
    setFolderPickerMode(mode)
    setShowFolderPicker(true)
  }

  const handleFolderSelected = (folder) => {
    if (folderPickerMode === 'sync') {
      // Update pricebook sync folder path - use full path
      const folderPath = folder.path || folder.name
      setFolderPath(folderPath)
      setMessage({
        type: 'success',
        text: `Selected folder: ${folderPath}`,
      })
    } else if (folderPickerMode === 'root') {
      // Update root folder - use full path
      const folderPath = folder.path || folder.name
      setNewRootFolderName(folderPath)
      setEditingRootFolder(true)
    }

    setShowFolderPicker(false)
    setFolderPickerMode(null)
  }

  if (status.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-x-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-500"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Loading connection status...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6">
      {/* Message Banner */}
      {message && (
        <div
          className={`mb-6 rounded-md p-4 ${
            message.type === 'success'
              ? 'bg-green-100 dark:bg-green-400/10'
              : 'bg-red-100 dark:bg-red-400/10'
          }`}
        >
          <div className="flex">
            <div className="flex-shrink-0">
              {message.type === 'success' ? (
                <CheckCircleIcon
                  className="h-5 w-5 text-green-700 dark:text-green-400"
                  aria-hidden="true"
                />
              ) : (
                <XCircleIcon
                  className="h-5 w-5 text-red-700 dark:text-red-400"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="ml-3">
              <p
                className={`text-sm ${
                  message.type === 'success'
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {message.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-x-3">
              <CloudIcon className="h-8 w-8 text-blue-600 dark:text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Microsoft OneDrive</h3>
            </div>

            <div className="mt-4">
              {status.connected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-x-2">
                    <span
                      className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20"
                    >
                      Connected (Organization-wide)
                    </span>
                  </div>

                  {status.driveName && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Drive</p>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                        {status.driveName}
                      </p>
                    </div>
                  )}

                  {status.rootFolderPath && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Root Folder</p>
                      {editingRootFolder ? (
                        <div className="mt-1 space-y-2">
                          <div className="flex items-center gap-x-2">
                            <input
                              type="text"
                              value={newRootFolderName}
                              onChange={(e) => setNewRootFolderName(e.target.value)}
                              placeholder={status.rootFolderPath}
                              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleOpenFolderPicker('root')}
                              className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                            >
                              Browse
                            </button>
                          </div>
                          <div className="flex items-center gap-x-2">
                            <button
                              type="button"
                              onClick={handleChangeRootFolder}
                              disabled={changingRootFolder}
                              className="inline-flex items-center rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                            >
                              {changingRootFolder ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRootFolder(false)
                                setNewRootFolderName('')
                              }}
                              disabled={changingRootFolder}
                              className="inline-flex items-center rounded-md bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-x-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {status.rootFolderPath}
                          </p>
                          {status.rootFolderWebUrl && (
                            <a
                              href={status.rootFolderWebUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 hover:bg-indigo-100 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/30 dark:hover:bg-indigo-400/20"
                            >
                              View in OneDrive
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRootFolder(true)
                              setNewRootFolderName(status.rootFolderPath)
                            }}
                            className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-500/10 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-400/20 dark:hover:bg-gray-600"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {status.connectedBy && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Connected by</p>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                        {status.connectedBy.email}
                      </p>
                    </div>
                  )}

                  <div className="mt-6 space-y-3">
                    <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/10">
                      <p className="text-sm text-blue-800 dark:text-blue-400">
                        <strong>All jobs automatically have OneDrive access!</strong> Go to any job's Documents tab to create folder structures and manage files.
                      </p>
                    </div>

                    {/* Pricebook Image Sync Section */}
                    <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Pricebook Image Sync</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Sync product images and QR codes from OneDrive to your pricebook. Files are matched by name to item names.
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label htmlFor="folder-path" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            OneDrive Folder Path
                          </label>
                          <div className="mt-1 flex items-center gap-x-2">
                            <input
                              type="text"
                              id="folder-path"
                              value={folderPath}
                              onChange={(e) => setFolderPath(e.target.value)}
                              placeholder="Pricebook Images"
                              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleOpenFolderPicker('sync')}
                              className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                            >
                              Browse
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Folder name in your OneDrive where images are stored
                          </p>
                        </div>

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={handlePreviewMatches}
                            disabled={loadingPreview || syncingImages}
                            className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                          >
                            {loadingPreview ? (
                              <span className="flex items-center justify-center gap-x-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                Loading...
                              </span>
                            ) : (
                              'Preview & Sync'
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleSyncPricebookImages}
                            disabled={syncingImages || loadingPreview}
                            className="rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
                          >
                            {syncingImages ? (
                              <span className="flex items-center gap-x-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                Syncing...
                              </span>
                            ) : (
                              'Auto Sync'
                            )}
                          </button>
                        </div>

                        {syncResult && (
                          <div className="mt-3 rounded-md bg-white p-3 shadow-sm dark:bg-gray-900">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              Sync Results:
                            </p>
                            <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                              <li>✓ {syncResult.matched} total files matched and linked</li>
                              {syncResult.photos_matched > 0 && (
                                <li className="ml-4">📷 {syncResult.photos_matched} photos</li>
                              )}
                              {syncResult.specs_matched > 0 && (
                                <li className="ml-4">📄 {syncResult.specs_matched} specs</li>
                              )}
                              {syncResult.qr_codes_matched > 0 && (
                                <li className="ml-4">🔲 {syncResult.qr_codes_matched} QR codes</li>
                              )}
                              {syncResult.unmatched_files && syncResult.unmatched_files.length > 0 && (
                                <li>⚠ {syncResult.unmatched_files.length} files couldn't be matched</li>
                              )}
                              {syncResult.unmatched_items && syncResult.unmatched_items.length > 0 && (
                                <li>ℹ {syncResult.unmatched_items.length} items without files</li>
                              )}
                              {syncResult.errors && syncResult.errors.length > 0 && (
                                <li className="text-red-600 dark:text-red-400">
                                  ✗ {syncResult.errors.length} errors occurred
                                </li>
                              )}
                            </ul>

                            {/* Show unmatched files details */}
                            {syncResult.unmatched_files && syncResult.unmatched_files.length > 0 && (
                              <details className="mt-3">
                                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                                  View unmatched files ({syncResult.unmatched_files.length})
                                </summary>
                                <ul className="mt-2 ml-4 space-y-1 text-xs text-gray-600 dark:text-gray-400 max-h-40 overflow-y-auto">
                                  {syncResult.unmatched_files.map((file, idx) => (
                                    <li key={idx}>• {file}</li>
                                  ))}
                                </ul>
                              </details>
                            )}

                            {/* Show unmatched items details */}
                            {syncResult.unmatched_items && syncResult.unmatched_items.length > 0 && (
                              <details className="mt-3">
                                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                                  View items without files ({syncResult.unmatched_items.length})
                                </summary>
                                <ul className="mt-2 ml-4 space-y-1 text-xs text-gray-600 dark:text-gray-400 max-h-40 overflow-y-auto">
                                  {syncResult.unmatched_items.map((item, idx) => (
                                    <li key={idx}>• {item.name} ({item.code})</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowDisconnectDialog(true)}
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:bg-red-500 dark:hover:bg-red-400"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-x-2">
                    <span
                      className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20"
                    >
                      Not Connected
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Connect your organization's OneDrive account once, and all jobs will automatically have access to document management.
                  </p>

                  <div className="mt-4 rounded-md bg-gray-50 p-4 dark:bg-gray-800/50">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">How it works:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <li>Click "Connect OneDrive" below</li>
                      <li>Sign in with your Microsoft account</li>
                      <li>Grant permissions for OneDrive access</li>
                      <li>All jobs immediately gain document management capabilities</li>
                      <li>No need to reconnect for individual jobs!</li>
                    </ol>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                    >
                      {connecting ? (
                        <span className="flex items-center gap-x-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Connecting...
                        </span>
                      ) : (
                        'Connect OneDrive'
                      )}
                    </button>
                  </div>

                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    <strong>Note:</strong> Your Azure app must be configured with Delegated permissions for user sign-in. See setup guide for details.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Folder Picker Dialog */}
      <OneDriveFolderPicker
        isOpen={showFolderPicker}
        onClose={() => {
          setShowFolderPicker(false)
          setFolderPickerMode(null)
        }}
        onSelect={handleFolderSelected}
        title={folderPickerMode === 'sync' ? 'Select Pricebook Images Folder' : 'Select Root Folder'}
      />

      {/* Match Preview Dialog */}
      <PricebookMatchPreview
        isOpen={showMatchPreview}
        onClose={() => setShowMatchPreview(false)}
        matches={previewMatches}
        onApplyMatches={handleApplyMatches}
      />

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={showDisconnectDialog} onClose={setShowDisconnectDialog} className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
        />

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95 dark:bg-gray-900"
            >
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-red-500/10">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-500" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <DialogTitle as="h3" className="text-base font-semibold text-gray-900 dark:text-white">
                    Disconnect OneDrive
                  </DialogTitle>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Are you sure you want to disconnect OneDrive? All jobs will lose access to document management. You will need to reconnect to restore access.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 sm:ml-3 sm:w-auto dark:bg-red-500 dark:hover:bg-red-400"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisconnectDialog(false)}
                  disabled={disconnecting}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 sm:mt-0 sm:w-auto dark:bg-white/5 dark:text-white dark:ring-white/10 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
