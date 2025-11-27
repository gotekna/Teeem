import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  Cog6ToothIcon,
  EyeIcon,
  ClockIcon,
  HeartIcon,
  LinkIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline'
import { api } from '../api'

// Status badge component
function StatusBadge({ status }) {
  const styles = {
    healthy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    disabled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  }
  const labels = {
    healthy: 'Healthy',
    warning: 'Warning',
    error: 'Errors',
    disabled: 'Disabled',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.disabled}`}>
      {labels[status] || status}
    </span>
  )
}

// Direction arrow component
function DirectionArrow({ direction }) {
  switch (direction) {
    case 'import':
      return <ArrowLeftIcon className="h-4 w-4 text-blue-500" title="Import from Xero" />
    case 'export':
      return <ArrowRightIcon className="h-4 w-4 text-green-500" title="Export to Xero" />
    case 'bidirectional':
      return <ArrowsRightLeftIcon className="h-4 w-4 text-purple-500" title="Two-way sync" />
    default:
      return <XMarkIcon className="h-4 w-4 text-gray-400" title="Not synced" />
  }
}

// Badge component for accounting system
function AccountingBadge({ system }) {
  const colors = {
    xero: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    quickbooks: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    myob: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[system] || 'bg-gray-100 text-gray-800'}`}>
      {system?.toUpperCase() || 'Unknown'}
    </span>
  )
}

export default function SyncConfigPage() {
  const [configs, setConfigs] = useState([])
  const [selectedConfig, setSelectedConfig] = useState(null)
  const [fieldMappings, setFieldMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState(null)
  const [healthData, setHealthData] = useState(null)
  const [showHealth, setShowHealth] = useState(true)

  useEffect(() => {
    loadData()
    loadHealthData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load sync configurations
      const configsResponse = await api.get('/api/v1/sync_configurations')
      const configsList = configsResponse.data.sync_configurations || []
      setConfigs(configsList)

      // Select the first config if available
      if (configsList.length > 0) {
        setSelectedConfig(configsList[0])
      }

      // Load available field mappings
      const mappingsResponse = await api.get('/api/v1/sync_configurations/field_mappings')
      setFieldMappings(mappingsResponse.data.available_fields || [])
    } catch (err) {
      console.error('Failed to load sync configurations:', err)
      setError('Failed to load sync configurations. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadHealthData = async () => {
    try {
      const response = await api.get('/api/v1/sync_configurations/health')
      setHealthData(response.data.health)
    } catch (err) {
      console.error('Failed to load sync health:', err)
      // Non-critical error, don't show to user
    }
  }

  const handleFieldDirectionChange = (fieldName, newDirection) => {
    if (!selectedConfig) return

    const updatedMappings = {
      ...selectedConfig.field_mappings,
      [fieldName]: {
        ...selectedConfig.field_mappings[fieldName],
        direction: newDirection
      }
    }

    setSelectedConfig({
      ...selectedConfig,
      field_mappings: updatedMappings
    })
  }

  const handleCleanupOptionChange = (optionName, value) => {
    if (!selectedConfig) return

    setSelectedConfig({
      ...selectedConfig,
      cleanup_options: {
        ...selectedConfig.cleanup_options,
        [optionName]: value
      }
    })
  }

  const handleSave = async () => {
    if (!selectedConfig) return

    try {
      setSaving(true)
      setError(null)

      await api.patch(`/api/v1/sync_configurations/${selectedConfig.xero_tenant_id}`, {
        sync_configuration: {
          field_mappings: selectedConfig.field_mappings,
          cleanup_options: selectedConfig.cleanup_options,
          sync_enabled: selectedConfig.sync_enabled
        }
      })

      // Refresh data
      await loadData()
      alert('Sync configuration saved successfully!')
    } catch (err) {
      console.error('Failed to save sync configuration:', err)
      setError('Failed to save configuration. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    if (!selectedConfig) return

    try {
      setShowPreview(true)
      const response = await api.post(`/api/v1/sync_configurations/${selectedConfig.xero_tenant_id}/preview`)
      setPreviewData(response.data.preview)
    } catch (err) {
      console.error('Failed to load preview:', err)
      setPreviewData({ error: 'Failed to load preview' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading sync configuration...</p>
        </div>
      </div>
    )
  }

  if (configs.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Cog6ToothIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No Xero Connection</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Connect to Xero first to configure contact sync settings.
          </p>
          <div className="mt-6">
            <Link
              to="/xero"
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <Cog6ToothIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
              Connect to Xero
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Contact Sync Configuration</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure how contacts sync between TEEEM and your accounting system.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePreview}
              className="inline-flex items-center rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <EyeIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
              Preview Sync
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? (
                <ArrowPathIcon className="-ml-0.5 mr-1.5 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircleIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
              )}
              Save Configuration
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex">
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sync Health Dashboard */}
      {healthData && (
        <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <button
            onClick={() => setShowHealth(!showHealth)}
            className="w-full px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <div className="flex items-center gap-3">
              <HeartIcon className="h-5 w-5 text-indigo-600" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Sync Health Dashboard</h3>
              <StatusBadge status={healthData.overall_status} />
            </div>
            <svg
              className={`h-5 w-5 text-gray-400 transition-transform ${showHealth ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showHealth && (
            <div className="p-4">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <LinkIcon className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Linked Contacts</span>
                  </div>
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {healthData.total_linked_contacts || 0}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">With Errors</span>
                  </div>
                  <div className={`text-2xl font-semibold ${healthData.total_contacts_with_errors > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                    {healthData.total_contacts_with_errors || 0}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Conflicts</span>
                  </div>
                  <div className={`text-2xl font-semibold ${healthData.total_contacts_with_conflicts > 0 ? 'text-yellow-600' : 'text-gray-900 dark:text-white'}`}>
                    {healthData.total_contacts_with_conflicts || 0}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BellAlertIcon className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Webhooks Active</span>
                  </div>
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {healthData.webhooks_enabled_count || 0} / {healthData.total_organizations || 0}
                  </div>
                </div>
              </div>

              {/* Organization Health */}
              {healthData.organizations && healthData.organizations.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Organization Status</h4>
                  <div className="space-y-2">
                    {healthData.organizations.map((org) => (
                      <div
                        key={org.xero_tenant_id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <StatusBadge status={org.status} />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {org.xero_tenant_name || 'Unnamed Organization'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>{org.linked_contacts} linked</span>
                          {org.contacts_with_errors > 0 && (
                            <span className="text-red-600">{org.contacts_with_errors} errors</span>
                          )}
                          {org.contacts_with_conflicts > 0 && (
                            <span className="text-yellow-600">{org.contacts_with_conflicts} conflicts</span>
                          )}
                          <span className="flex items-center gap-1">
                            <ClockIcon className="h-4 w-4" />
                            {org.last_sync_activity
                              ? new Date(org.last_sync_activity).toLocaleDateString()
                              : 'Never synced'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Errors */}
              {healthData.recent_errors && healthData.recent_errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recent Sync Errors</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Contact
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Error
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Last Attempt
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {healthData.recent_errors.map((error, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              <Link
                                to={`/contacts/${error.contact_id}`}
                                className="text-indigo-600 hover:text-indigo-500"
                              >
                                {error.contact_name || `Contact #${error.contact_id}`}
                              </Link>
                            </td>
                            <td className="px-4 py-2 text-sm text-red-600 dark:text-red-400 max-w-xs truncate">
                              {error.error}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {error.last_attempt ? new Date(error.last_attempt).toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">
                              <Link
                                to={`/contacts/${error.contact_id}?tab=xero`}
                                className="text-indigo-600 hover:text-indigo-500"
                              >
                                View Details
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* No Issues */}
              {healthData.total_contacts_with_errors === 0 && healthData.total_contacts_with_conflicts === 0 && (
                <div className="text-center py-4">
                  <CheckCircleIcon className="mx-auto h-8 w-8 text-green-500" />
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    All contacts are syncing correctly. No issues detected.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Organization Tabs */}
      {configs.length > 1 && (
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {configs.map((config) => (
              <button
                key={config.xero_tenant_id}
                onClick={() => setSelectedConfig(config)}
                className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
                  selectedConfig?.xero_tenant_id === config.xero_tenant_id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                <AccountingBadge system={config.accounting_system} />
                <span className="ml-2">{config.xero_tenant_name || 'Unnamed Organization'}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {selectedConfig && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Field Mappings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Connection Status */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AccountingBadge system={selectedConfig.accounting_system} />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedConfig.xero_tenant_name || 'Unnamed Organization'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <ClockIcon className="h-4 w-4" />
                  Last sync: {selectedConfig.last_full_sync_at
                    ? new Date(selectedConfig.last_full_sync_at).toLocaleDateString()
                    : 'Never'}
                </div>
              </div>
            </div>

            {/* Field Mapping Table */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Field Mappings</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Configure which fields sync in which direction.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        TEEEM Field
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Direction
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Xero Field
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Required
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {fieldMappings.map((field) => {
                      const mapping = selectedConfig.field_mappings?.[field.field] || { direction: 'bidirectional' }
                      return (
                        <tr key={field.field}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {field.label}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              <DirectionArrow direction={mapping.direction} />
                              <select
                                value={mapping.direction || 'bidirectional'}
                                onChange={(e) => handleFieldDirectionChange(field.field, e.target.value)}
                                className="ml-2 text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value="bidirectional">Two-way</option>
                                <option value="import">Import only</option>
                                <option value="export">Export only</option>
                                <option value="none">Don't sync</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {field.xero_field}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {field.required ? (
                              <CheckCircleIcon className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar - Cleanup Options */}
          <div className="space-y-6">
            {/* Cleanup Options */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Cleanup Options</h3>
              <div className="space-y-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedConfig.cleanup_options?.delete_primary_person_after_import || false}
                    onChange={(e) => handleCleanupOptionChange('delete_primary_person_after_import', e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Delete Primary Person from Xero after import
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Keeps Xero tidy by removing redundant contact data
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedConfig.cleanup_options?.archive_duplicates || false}
                    onChange={(e) => handleCleanupOptionChange('archive_duplicates', e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Archive duplicates in Xero
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Automatically archive duplicate contacts found in Xero
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedConfig.cleanup_options?.standardize_abn_format || false}
                    onChange={(e) => handleCleanupOptionChange('standardize_abn_format', e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Standardize ABN format
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Format ABN as XX XXX XXX XXX in both systems
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Sync Status */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Sync Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Sync Enabled</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedConfig.sync_enabled}
                      onChange={(e) => setSelectedConfig({ ...selectedConfig, sync_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Webhooks</span>
                  <span className={`text-sm ${selectedConfig.webhooks_enabled ? 'text-green-600' : 'text-gray-400'}`}>
                    {selectedConfig.webhooks_enabled ? 'Active' : 'Not configured'}
                  </span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Direction Legend</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowsRightLeftIcon className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Two-way sync</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowLeftIcon className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Import from Xero only</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRightIcon className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Export to Xero only</span>
                </div>
                <div className="flex items-center gap-2">
                  <XMarkIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Not synced</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500/75 transition-opacity" onClick={() => setShowPreview(false)} />
            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  className="rounded-md text-gray-400 hover:text-gray-500"
                  onClick={() => setShowPreview(false)}
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <EyeIcon className="h-6 w-6 text-indigo-600" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Sync Preview</h3>
                </div>
                {previewData ? (
                  <div className="mt-4 space-y-4">
                    {previewData.error ? (
                      <p className="text-red-600">{previewData.error}</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                            <div className="text-gray-500 dark:text-gray-400">Linked Contacts</div>
                            <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                              {previewData.total_linked_contacts}
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                            <div className="text-gray-500 dark:text-gray-400">With Errors</div>
                            <div className="text-2xl font-semibold text-red-600">
                              {previewData.contacts_with_errors}
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                            <div className="text-gray-500 dark:text-gray-400">With Conflicts</div>
                            <div className="text-2xl font-semibold text-yellow-600">
                              {previewData.contacts_with_conflicts}
                            </div>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
                            <div className="text-gray-500 dark:text-gray-400">Webhooks</div>
                            <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                              {previewData.webhooks_enabled ? 'Active' : 'Off'}
                            </div>
                          </div>
                        </div>
                        {previewData.pending_changes && (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Pending Changes</h4>
                            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                              <li>Will import: {previewData.pending_changes.will_import} contacts</li>
                              <li>Will export: {previewData.pending_changes.will_export} contacts</li>
                              <li>Conflicts to resolve: {previewData.pending_changes.conflicts_to_resolve}</li>
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 flex justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
                  </div>
                )}
              </div>
              <div className="mt-5">
                <button
                  type="button"
                  className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  onClick={() => setShowPreview(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
