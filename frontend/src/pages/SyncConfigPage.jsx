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

// All field mappings grouped by section - mirrors XeroSyncTab
const ALL_FIELD_MAPPINGS = [
  {
    section: 'Basic Information',
    fields: [
      { field: 'full_name', xeroField: 'Name', label: 'Contact Name', readOnly: false },
      { field: 'first_name', xeroField: 'FirstName', label: 'First Name', readOnly: false },
      { field: 'last_name', xeroField: 'LastName', label: 'Last Name', readOnly: false },
      { field: 'email', xeroField: 'EmailAddress', label: 'Email', readOnly: false },
      { field: 'contact_types', xeroField: 'IsSupplier/IsCustomer', label: 'Contact Types', readOnly: false },
      { field: 'xero_id', xeroField: 'ContactID', label: 'Xero ID', readOnly: true }
    ]
  },
  {
    section: 'Contact Details',
    fields: [
      { field: 'mobile_phone', xeroField: 'PhoneNumber (Mobile)', label: 'Mobile Phone', readOnly: false },
      { field: 'office_phone', xeroField: 'PhoneNumber (Office)', label: 'Office Phone', readOnly: false },
      { field: 'fax_phone', xeroField: 'PhoneNumber (Fax)', label: 'Fax', readOnly: false },
      { field: 'website', xeroField: 'Website', label: 'Website', readOnly: false }
    ]
  },
  {
    section: 'Addresses',
    fields: [
      { field: 'address_street', xeroField: 'Address (STREET)', label: 'Street Address', readOnly: false },
      { field: 'address_pobox', xeroField: 'Address (POBOX)', label: 'PO Box Address', readOnly: false },
      { field: 'address_delivery', xeroField: 'Address (DELIVERY)', label: 'Delivery Address', readOnly: false }
    ]
  },
  {
    section: 'Tax & Registration',
    readOnly: true,
    fields: [
      { field: 'tax_number', xeroField: 'TaxNumber', label: 'ABN/Tax Number', readOnly: false },
      { field: 'xero_account_number', xeroField: 'AccountNumber', label: 'Account Number', readOnly: true },
      { field: 'xero_contact_number', xeroField: 'ContactNumber', label: 'Contact Number', readOnly: true },
      { field: 'xero_contact_status', xeroField: 'ContactStatus', label: 'Contact Status', readOnly: true },
      { field: 'company_number', xeroField: 'CompanyNumber', label: 'Company Number', readOnly: true }
    ]
  },
  {
    section: 'Purchase (Accounts Payable)',
    readOnly: true,
    fields: [
      { field: 'default_purchase_account', xeroField: 'DefaultPurchaseAccount', label: 'Default Purchase Account', readOnly: true },
      { field: 'bill_due_day', xeroField: 'PurchaseTerms (Days)', label: 'Bill Due Day', readOnly: true },
      { field: 'bill_due_type', xeroField: 'PurchaseTerms (Type)', label: 'Bill Due Type', readOnly: true },
      { field: 'accounts_payable_outstanding', xeroField: 'AccountsPayable Outstanding', label: 'AP Outstanding', readOnly: true },
      { field: 'accounts_payable_overdue', xeroField: 'AccountsPayable Overdue', label: 'AP Overdue', readOnly: true }
    ]
  },
  {
    section: 'Sales (Accounts Receivable)',
    readOnly: true,
    fields: [
      { field: 'default_sales_account', xeroField: 'DefaultSalesAccount', label: 'Default Sales Account', readOnly: true },
      { field: 'default_discount', xeroField: 'DefaultDiscount', label: 'Default Discount', readOnly: true },
      { field: 'sales_due_day', xeroField: 'SalesTerms (Days)', label: 'Sales Due Day', readOnly: true },
      { field: 'sales_due_type', xeroField: 'SalesTerms (Type)', label: 'Sales Due Type', readOnly: true },
      { field: 'accounts_receivable_outstanding', xeroField: 'AccountsReceivable Outstanding', label: 'AR Outstanding', readOnly: true },
      { field: 'accounts_receivable_overdue', xeroField: 'AccountsReceivable Overdue', label: 'AR Overdue', readOnly: true }
    ]
  },
  {
    section: 'Bank Details',
    readOnly: true,
    fields: [
      { field: 'bank_bsb', xeroField: 'BankAccountBSB', label: 'Bank BSB', readOnly: true },
      { field: 'bank_account_number', xeroField: 'BankAccountNumber', label: 'Bank Account Number', readOnly: true },
      { field: 'bank_account_name', xeroField: 'BankAccountName', label: 'Bank Account Name', readOnly: true }
    ]
  }
]

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

export default function SyncConfigPage({ embedded = false }) {
  const [configs, setConfigs] = useState([])
  const [selectedConfig, setSelectedConfig] = useState(null)
  const [fieldMappings, setFieldMappings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSyncDirection, setSavingSyncDirection] = useState(false)
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
      let configsList = configsResponse.sync_configurations || []

      // If no configs exist, try to get available tenants and create configs for them
      if (configsList.length === 0) {
        try {
          const tenantsResponse = await api.get('/api/v1/xero/tenants')
          const tenants = tenantsResponse.tenants || []

          // For each tenant, fetch its config (which will auto-create if missing)
          for (const tenant of tenants) {
            try {
              const configResponse = await api.get(`/api/v1/sync_configurations/${tenant.tenant_id}`)
              if (configResponse.sync_configuration) {
                configsList.push(configResponse.sync_configuration)
              }
            } catch (err) {
              console.error(`Failed to load/create config for tenant ${tenant.tenant_name}:`, err)
            }
          }
        } catch (err) {
          console.error('Failed to load Xero tenants:', err)
        }
      }

      setConfigs(configsList)

      // Select the first config if available
      if (configsList.length > 0) {
        setSelectedConfig(configsList[0])
      }

      // Load available field mappings
      const mappingsResponse = await api.get('/api/v1/sync_configurations/field_mappings')
      setFieldMappings(mappingsResponse.available_fields || [])
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
      setHealthData(response.health)
    } catch (err) {
      console.error('Failed to load sync health:', err)
      // Non-critical error, don't show to user
    }
  }

  const handleFieldDirectionChange = async (fieldName, newDirection) => {
    if (!selectedConfig) return

    const updatedMappings = {
      ...selectedConfig.field_mappings,
      [fieldName]: {
        ...selectedConfig.field_mappings[fieldName],
        direction: newDirection
      }
    }

    // Update local state immediately for responsive UI
    setSelectedConfig({
      ...selectedConfig,
      field_mappings: updatedMappings
    })

    // Auto-save to backend
    try {
      await api.patch(`/api/v1/sync_configurations/${selectedConfig.xero_tenant_id}`, {
        sync_configuration: {
          field_mappings: updatedMappings
        }
      })
    } catch (err) {
      console.error('Failed to save field direction:', err)
      // Optionally show error to user
    }
  }

  const handleCleanupOptionChange = async (optionName, value) => {
    if (!selectedConfig) return

    const updatedCleanupOptions = {
      ...selectedConfig.cleanup_options,
      [optionName]: value
    }

    // Update local state immediately for responsive UI
    setSelectedConfig({
      ...selectedConfig,
      cleanup_options: updatedCleanupOptions
    })

    // Auto-save to backend
    try {
      await api.patch(`/api/v1/sync_configurations/${selectedConfig.xero_tenant_id}`, {
        sync_configuration: {
          cleanup_options: updatedCleanupOptions
        }
      })
    } catch (err) {
      console.error('Failed to save cleanup option:', err)
    }
  }

  // Handle global sync direction change (applies to ALL contacts for this tenant)
  const handleSyncDirectionChange = async (newDirection) => {
    if (!selectedConfig) return

    setSavingSyncDirection(true)
    try {
      const response = await api.put(`/api/v1/sync_configurations/${selectedConfig.xero_tenant_id}`, {
        sync_configuration: {
          default_sync_direction: newDirection
        }
      })

      if (response.sync_configuration) {
        // Update local state
        setSelectedConfig({
          ...selectedConfig,
          default_sync_direction: response.sync_configuration.default_sync_direction,
          import_enabled: response.sync_configuration.import_enabled,
          export_enabled: response.sync_configuration.export_enabled
        })
        // Update in configs list too
        setConfigs(prev => prev.map(c =>
          c.xero_tenant_id === selectedConfig.xero_tenant_id
            ? { ...c, default_sync_direction: response.sync_configuration.default_sync_direction }
            : c
        ))
      }
    } catch (err) {
      console.error('Failed to update sync direction:', err)
      setError('Failed to update sync direction. Please try again.')
    } finally {
      setSavingSyncDirection(false)
    }
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
      setPreviewData(response.preview)
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
    <div className={embedded ? '' : 'p-6 max-w-6xl mx-auto'}>
      {/* Header - hidden when embedded */}
      {!embedded && (
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
      )}

      {/* Action buttons when embedded */}
      {embedded && (
        <div className="mb-4 flex justify-end gap-3">
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
      )}

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

      {/* Global Sync Direction Setting */}
      {selectedConfig && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <span className="font-semibold">Sync Direction</span>
                {selectedConfig.xero_tenant_name && (
                  <> • {selectedConfig.xero_tenant_name}</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-600 dark:text-blue-400">
                Direction:
              </span>
              <select
                className="text-sm border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                value={selectedConfig.default_sync_direction || 'import_only'}
                onChange={(e) => handleSyncDirectionChange(e.target.value)}
                disabled={savingSyncDirection}
              >
                <option value="import_only">Xero → TEEEM</option>
                <option value="export_only">TEEEM → Xero</option>
                <option value="bidirectional">↔ Both Ways</option>
                <option value="disabled">Disabled</option>
              </select>
              {savingSyncDirection && (
                <ArrowPathIcon className="h-4 w-4 text-blue-600 animate-spin" />
              )}
            </div>
          </div>
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

            {/* Field Mapping Table - mirrors XeroSyncTab layout with sections */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Field Mappings</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Configure sync direction for each field. Read-only fields can only sync from Xero.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Xero Field
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        TEEEM Field
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Sync
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {ALL_FIELD_MAPPINGS.flatMap((section) => [
                      <tr key={`section-${section.section}`} className="bg-gray-100 dark:bg-gray-700/50">
                        <td colSpan={4} className="px-6 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          {section.section}
                          {section.readOnly && (
                            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                              (Synced from Xero - edit in Xero to update)
                            </span>
                          )}
                        </td>
                      </tr>,
                      ...section.fields.map((field) => {
                        const mapping = selectedConfig.field_mappings?.[field.field] || { direction: 'import' }
                        const isReadOnly = field.readOnly
                        return (
                          <tr key={`${section.section}-${field.field}`} className={isReadOnly ? 'bg-gray-50 dark:bg-gray-800/50' : ''}>
                            <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {field.xeroField}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                              {field.field}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-2">
                                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                <span className="text-gray-700 dark:text-gray-300">Enabled</span>
                              </div>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm">
                              {isReadOnly ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  Xero → TEEEM
                                </span>
                              ) : (
                                <select
                                  value={mapping.direction || 'import'}
                                  onChange={(e) => handleFieldDirectionChange(field.field, e.target.value)}
                                  className="text-sm border border-blue-300 dark:border-blue-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="import">Xero → TEEEM</option>
                                  <option value="export">TEEEM → Xero</option>
                                  <option value="bidirectional">↔ Both Ways</option>
                                  <option value="none">Disabled</option>
                                </select>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    ])}
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
