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

  // Get client contacts for this job
  const clientContacts = job?.contacts?.filter(c => c.role === 'client') || []
  const clientNames = clientContacts.map(c => c.contact?.full_name || c.contact?.company_name).filter(Boolean).join(', ')

  // Sync items configuration - showing TEEEM data that could sync with Xero
  const syncItems = [
    {
      name: 'Tracking Category',
      description: 'Link job to Xero tracking category for bill matching',
      xeroField: 'Tracking Category → Job',
      teeemField: 'Job Title',
      teeemValue: job?.xero_tracking_option_name || null,
      teeemData: job?.title,
      status: job?.xero_tracking_option_id ? 'linked' : 'not_linked'
    },
    {
      name: 'Bills / Purchase Orders',
      description: 'Import bills from Xero as Purchase Orders',
      xeroField: 'Bills (ACCPAY)',
      teeemField: 'Purchase Orders',
      teeemValue: job?.purchase_orders_count ? `${job.purchase_orders_count} POs` : null,
      teeemData: job?.purchase_orders_count || 0,
      status: 'can_sync'
    },
    {
      name: 'Contract Value',
      description: 'Job contract value for budget comparison',
      xeroField: 'Quote / Invoice Total',
      teeemField: 'Contract Value',
      teeemValue: job?.contract_value ? `$${Number(job.contract_value).toLocaleString()}` : null,
      teeemData: job?.contract_value,
      status: job?.contract_value ? 'teeem_only' : 'not_set'
    },
    {
      name: 'Client / Customer',
      description: 'Job client linked to Xero contact',
      xeroField: 'Contact (Customer)',
      teeemField: 'Client Contact',
      teeemValue: clientNames || null,
      teeemData: clientContacts.length,
      status: clientContacts.length > 0 ? 'can_sync' : 'not_set'
    },
    {
      name: 'Job Location',
      description: 'Site address for the job',
      xeroField: 'Tracking Option Name',
      teeemField: 'Location',
      teeemValue: job?.location || job?.title || null,
      teeemData: job?.location,
      status: job?.location ? 'teeem_only' : 'not_set'
    },
    {
      name: 'Start Date',
      description: 'Job commencement date',
      xeroField: '-',
      teeemField: 'Start Date',
      teeemValue: job?.start_date ? new Date(job.start_date).toLocaleDateString() : null,
      teeemData: job?.start_date,
      status: job?.start_date ? 'teeem_only' : 'not_set'
    },
    {
      name: 'TED Number',
      description: 'TED reference number',
      xeroField: 'Reference',
      teeemField: 'TED Number',
      teeemValue: job?.ted_number || null,
      teeemData: job?.ted_number,
      status: job?.ted_number ? 'can_sync' : 'not_set'
    },
    {
      name: 'Certifier Job No',
      description: 'Certifier job reference',
      xeroField: 'Reference',
      teeemField: 'Certifier Job No',
      teeemValue: job?.certifier_job_no || null,
      teeemData: job?.certifier_job_no,
      status: job?.certifier_job_no ? 'can_sync' : 'not_set'
    },
    {
      name: 'Payments',
      description: 'Payment records for bills',
      xeroField: 'Payments',
      teeemField: 'Payments',
      teeemValue: null,
      teeemData: null,
      status: 'can_sync'
    },
    {
      name: 'Live Profit',
      description: 'Current profit calculation',
      xeroField: '-',
      teeemField: 'Live Profit',
      teeemValue: job?.live_profit ? `$${Number(job.live_profit).toLocaleString()}` : null,
      teeemData: job?.live_profit,
      status: job?.live_profit ? 'teeem_only' : 'not_set'
    },
  ]

  const getStatusBadge = (status) => {
    switch (status) {
      case 'linked':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Linked</span>
      case 'synced':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Synced</span>
      case 'can_sync':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Can Sync</span>
      case 'teeem_only':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">TEEEM Only</span>
      case 'not_linked':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Not Linked</span>
      case 'not_set':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500">Not Set</span>
      default:
        return null
    }
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
                Connect to Xero in Settings to sync data for this job.
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

        {/* Potential Sync Items */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Potential Xero Sync Items
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Once connected, you can sync the following data between TEEEM and Xero:
          </p>

          <div className="space-y-3">
            {syncItems.map((item, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                    {getStatusBadge(item.status)}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1">
                      <span className="text-blue-500 dark:text-blue-400 font-medium">Xero: </span>
                      <span className="text-blue-700 dark:text-blue-300">{item.xeroField}</span>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded px-2 py-1">
                      <span className="text-indigo-500 dark:text-indigo-400 font-medium">TEEEM: </span>
                      <span className="text-indigo-700 dark:text-indigo-300">
                        {item.teeemValue || item.teeemField}
                      </span>
                      {!item.teeemValue && item.teeemField && (
                        <span className="text-gray-400 ml-1">(empty)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
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

      {/* Sync Items Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Xero Sync Status
        </h3>

        <div className="space-y-3">
          {syncItems.map((item, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                  {getStatusBadge(item.status)}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1">
                    <span className="text-blue-500 dark:text-blue-400 font-medium">Xero: </span>
                    <span className="text-blue-700 dark:text-blue-300">{item.xeroField}</span>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded px-2 py-1">
                    <span className="text-indigo-500 dark:text-indigo-400 font-medium">TEEEM: </span>
                    <span className="text-indigo-700 dark:text-indigo-300">
                      {item.teeemValue || item.teeemField}
                    </span>
                    {!item.teeemValue && item.teeemField && (
                      <span className="text-gray-400 ml-1">(empty)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
