import { useState, useEffect } from 'react'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function JobXeroTab({ jobId, job, onUpdate }) {
  const [loading, setLoading] = useState(true)
  const [xeroConnected, setXeroConnected] = useState(false)
  const [trackingOptions, setTrackingOptions] = useState([])
  const [currentOption, setCurrentOption] = useState(null)
  const [suggestedMatch, setSuggestedMatch] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [linking, setLinking] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadXeroData()
  }, [jobId])

  const loadXeroData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check Xero connection status
      const statusResponse = await api.get('/api/v1/xero/status')
      const isConnected = statusResponse.data?.connected && !statusResponse.data?.expired
      setXeroConnected(isConnected)

      if (isConnected) {
        // Load tracking options for this job
        const trackingResponse = await api.get(`/api/v1/jobs/${jobId}/xero_tracking_options`)
        if (trackingResponse.success) {
          setTrackingOptions(trackingResponse.tracking_options || [])
          setCurrentOption(trackingResponse.current_option)
          setSuggestedMatch(trackingResponse.suggested_match)
          setSelectedOption(trackingResponse.current_option?.id || null)
        }
      }
    } catch (err) {
      console.error('Failed to load Xero data:', err)
      setError('Failed to load Xero data')
    } finally {
      setLoading(false)
    }
  }

  const handleLinkTracking = async () => {
    if (!selectedOption) return

    try {
      setLinking(true)
      setError(null)

      const option = trackingOptions.find(o => o.id === selectedOption)
      const response = await api.post(`/api/v1/jobs/${jobId}/link_xero_tracking`, {
        tracking_option_id: selectedOption,
        tracking_option_name: option?.name
      })

      if (response.success) {
        setCurrentOption({ id: selectedOption, name: option?.name })
        onUpdate?.()
      } else {
        setError(response.error || 'Failed to link tracking option')
      }
    } catch (err) {
      console.error('Failed to link tracking:', err)
      setError('Failed to link tracking option')
    } finally {
      setLinking(false)
    }
  }

  const handleImportBills = async () => {
    try {
      setImporting(true)
      setImportResult(null)
      setError(null)

      const response = await api.post(`/api/v1/jobs/${jobId}/import_xero_bills`)
      setImportResult(response)
      onUpdate?.()
    } catch (err) {
      console.error('Failed to import bills:', err)
      setError(err.response?.data?.error || 'Failed to import bills from Xero')
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!xeroConnected) {
    return (
      <div className="space-y-4">
        {/* Warning */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Xero Not Connected</h4>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                Connect to Xero in Settings to pull bills for this job.
              </p>
              <a
                href="/settings"
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                Go to Settings
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>
        </div>

        {/* Job Info Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Job Info for Xero Matching
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Once connected, Xero will match bills to this job using the tracking category.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Job Title</p>
              <p className="font-medium text-gray-900 dark:text-white">{job?.title || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>
              <p className="font-medium text-gray-900 dark:text-white">{job?.location || job?.title || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">TED Number</p>
              <p className="font-medium text-gray-900 dark:text-white">{job?.ted_number || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Contract Value</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {job?.contract_value ? `$${Number(job.contract_value).toLocaleString()}` : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <XMarkIcon className="h-4 w-4 text-red-500" />
            </button>
          </div>
        </div>
      )}

      {/* Pull from Xero Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
          Pull Bills from Xero
        </h3>

        {/* Step 1: Link to Tracking Category */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            1. Link to Xero Tracking Category
          </p>

          {currentOption ? (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 rounded-lg p-2 border border-green-200 dark:border-green-800">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-700 dark:text-green-300">
                Linked to: <strong>{currentOption.name}</strong>
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={selectedOption || ''}
                onChange={(e) => setSelectedOption(e.target.value)}
                className="flex-1 text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select tracking option...</option>
                {trackingOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {suggestedMatch?.id === option.id ? ' (suggested)' : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={handleLinkTracking}
                disabled={!selectedOption || linking}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 rounded-lg"
              >
                <LinkIcon className="h-4 w-4" />
                {linking ? 'Linking...' : 'Link'}
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Pull Bills */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            2. Pull Bills
          </p>

          <button
            onClick={handleImportBills}
            disabled={importing || !currentOption}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 rounded-lg"
          >
            {importing ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Pulling...
              </>
            ) : (
              <>
                <ArrowDownTrayIcon className="h-4 w-4" />
                Pull from Xero
              </>
            )}
          </button>

          {!currentOption && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Link to a tracking category first
            </p>
          )}
        </div>

        {/* Import Result */}
        {importResult && (
          <div className={`mt-4 rounded-lg p-3 border ${
            importResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            {importResult.success ? (
              <div className="text-sm text-green-700 dark:text-green-300">
                <p className="font-medium">Pull Complete</p>
                <ul className="text-xs mt-1 space-y-0.5">
                  <li>Imported: {importResult.imported} bills</li>
                  <li>Skipped (already imported): {importResult.skipped}</li>
                  {importResult.errors?.length > 0 && (
                    <li className="text-red-600">Errors: {importResult.errors.length}</li>
                  )}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-red-700 dark:text-red-300">
                {importResult.error || 'Pull failed'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
