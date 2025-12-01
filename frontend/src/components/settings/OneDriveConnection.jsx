import { useState } from 'react'
import { CheckCircleIcon, XCircleIcon, FolderIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../api'
import OneDriveFolderPicker from './OneDriveFolderPicker'
import PricebookMatchPreview from './PricebookMatchPreview'

// SharePoint sync features component - requires Office 365 connection from OutlookConnection
export default function OneDriveConnection() {
  const { microsoftStatus } = useAuth()
  const [message, setMessage] = useState(null)
  const [syncingImages, setSyncingImages] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [folderPath, setFolderPath] = useState('00 - TEEEM/Photos for Price Book')
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [folderPickerMode, setFolderPickerMode] = useState(null)
  const [showMatchPreview, setShowMatchPreview] = useState(false)
  const [previewMatches, setPreviewMatches] = useState([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Corporate Document Sync state
  const [corporateFolderPath, setCorporateFolderPath] = useState('Corporate File')
  const [syncingCorporate, setSyncingCorporate] = useState(false)
  const [corporateSyncResult, setCorporateSyncResult] = useState(null)

  // Check if Office 365 is connected with SharePoint access
  const isConnected = microsoftStatus?.connected && (microsoftStatus?.services?.onedrive || microsoftStatus?.services?.sharepoint)

  const handlePreviewMatches = async () => {
    if (!folderPath || folderPath.trim() === '') {
      setMessage({ type: 'error', text: 'Please enter a folder path' })
      return
    }

    try {
      setLoadingPreview(true)
      setMessage(null)

      const response = await api.get('/api/v1/organization_onedrive/preview_pricebook_matches', {
        params: { folder_path: folderPath.trim() }
      })

      setPreviewMatches(response.matches || [])
      setShowMatchPreview(true)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to preview matches' })
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleApplyMatches = async (acceptedMatches) => {
    try {
      setSyncingImages(true)
      setMessage(null)

      const response = await api.post('/api/v1/organization_onedrive/apply_pricebook_matches', {
        folder_path: folderPath.trim(),
        accepted_matches: acceptedMatches
      })

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

      setShowMatchPreview(false)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to apply matches' })
      throw err
    } finally {
      setSyncingImages(false)
    }
  }

  const handleSyncPricebookImages = async () => {
    try {
      setSyncingImages(true)
      setSyncResult(null)

      const response = await api.post('/api/v1/organization_onedrive/sync_pricebook_images', {
        folder_path: folderPath
      })

      setSyncResult(response)
      setMessage({
        type: 'success',
        text: `Synced ${response.matched || 0} images successfully! (${response.photos_matched || 0} photos, ${response.specs_matched || 0} specs, ${response.qr_codes_matched || 0} QR codes)`,
      })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to sync pricebook images' })
      setSyncResult({
        matched: 0,
        photos_matched: 0,
        specs_matched: 0,
        qr_codes_matched: 0,
        errors: [err.message || 'Unknown error occurred'],
        unmatched_files: []
      })
    } finally {
      setSyncingImages(false)
    }
  }

  const handleSyncCorporateDocuments = async () => {
    try {
      setSyncingCorporate(true)
      setCorporateSyncResult(null)
      setMessage(null)

      const response = await api.post('/api/v1/organization_onedrive/sync_corporate_documents', {
        folder_path: corporateFolderPath
      })

      setCorporateSyncResult(response)
      setMessage({
        type: 'success',
        text: `Synced ${response.documents_linked || 0} documents to ${response.companies_scanned || 0} companies!`,
      })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to sync corporate documents' })
      setCorporateSyncResult({
        success: false,
        errors: [err.message || 'Unknown error occurred']
      })
    } finally {
      setSyncingCorporate(false)
    }
  }

  const handleOpenFolderPicker = (mode) => {
    setFolderPickerMode(mode)
    setShowFolderPicker(true)
  }

  const handleFolderSelected = (folder) => {
    const selectedPath = folder.path || folder.name
    if (folderPickerMode === 'sync') {
      setFolderPath(selectedPath)
    } else if (folderPickerMode === 'corporate') {
      setCorporateFolderPath(selectedPath)
    }
    setMessage({ type: 'success', text: `Selected folder: ${selectedPath}` })
    setShowFolderPicker(false)
    setFolderPickerMode(null)
  }

  // Don't render if Office 365 is not connected with SharePoint
  if (!isConnected) {
    return null
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center gap-x-3 mb-4">
          <FolderIcon className="h-6 w-6 text-blue-600 dark:text-blue-500" />
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
            SharePoint Sync Features
          </h3>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`mb-4 rounded-md p-4 ${
              message.type === 'success'
                ? 'bg-green-100 dark:bg-green-400/10'
                : 'bg-red-100 dark:bg-red-400/10'
            }`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {message.type === 'success' ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-700 dark:text-green-400" />
                ) : (
                  <XCircleIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm ${message.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {message.text}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pricebook Image Sync Section */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Pricebook Image Sync</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Sync product images and QR codes from SharePoint to your pricebook. Files are matched by name to item names.
          </p>

          <div className="space-y-3">
            <div>
              <label htmlFor="folder-path" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                SharePoint Folder Path
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
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handlePreviewMatches}
                disabled={loadingPreview || syncingImages}
                className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
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
                className="rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
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
                <p className="text-sm font-medium text-gray-900 dark:text-white">Sync Results:</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>✓ {syncResult.matched} total files matched and linked</li>
                  {syncResult.photos_matched > 0 && <li className="ml-4">📷 {syncResult.photos_matched} photos</li>}
                  {syncResult.specs_matched > 0 && <li className="ml-4">📄 {syncResult.specs_matched} specs</li>}
                  {syncResult.qr_codes_matched > 0 && <li className="ml-4">🔲 {syncResult.qr_codes_matched} QR codes</li>}
                  {syncResult.unmatched_files?.length > 0 && <li>⚠ {syncResult.unmatched_files.length} files couldn't be matched</li>}
                  {syncResult.errors?.length > 0 && <li className="text-red-600 dark:text-red-400">✗ {syncResult.errors.length} errors occurred</li>}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Corporate Document Sync Section */}
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Corporate Document Sync</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Sync corporate documents (constitutions, minutes, ASIC documents) from SharePoint to company records.
          </p>

          <div className="space-y-3">
            <div>
              <label htmlFor="corporate-folder-path" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                SharePoint Folder Path
              </label>
              <div className="mt-1 flex items-center gap-x-2">
                <input
                  type="text"
                  id="corporate-folder-path"
                  value={corporateFolderPath}
                  onChange={(e) => setCorporateFolderPath(e.target.value)}
                  placeholder="Corporate File"
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => handleOpenFolderPicker('corporate')}
                  className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Browse
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSyncCorporateDocuments}
              disabled={syncingCorporate}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {syncingCorporate ? (
                <span className="flex items-center justify-center gap-x-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Syncing...
                </span>
              ) : (
                'Sync Documents'
              )}
            </button>

            {corporateSyncResult && (
              <div className="mt-3 rounded-md bg-white p-3 shadow-sm dark:bg-gray-900">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Sync Results:</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  {corporateSyncResult.success !== false ? (
                    <>
                      <li>✓ {corporateSyncResult.companies_scanned || 0} companies scanned</li>
                      <li>✓ {corporateSyncResult.documents_found || 0} documents found</li>
                      <li>✓ {corporateSyncResult.documents_linked || 0} documents linked</li>
                    </>
                  ) : (
                    <li className="text-red-600 dark:text-red-400">✗ Sync failed</li>
                  )}
                  {corporateSyncResult.errors?.length > 0 && (
                    <li className="text-amber-600 dark:text-amber-400">⚠ {corporateSyncResult.errors.length} errors/warnings</li>
                  )}
                </ul>
              </div>
            )}
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
        title={folderPickerMode === 'sync' ? 'Select Pricebook Images Folder' : 'Select Corporate Documents Folder'}
      />

      {/* Match Preview Dialog */}
      <PricebookMatchPreview
        isOpen={showMatchPreview}
        onClose={() => setShowMatchPreview(false)}
        matches={previewMatches}
        onApplyMatches={handleApplyMatches}
      />
    </div>
  )
}
