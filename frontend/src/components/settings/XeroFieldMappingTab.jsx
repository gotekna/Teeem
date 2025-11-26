import { useState, useEffect } from 'react'
import { ArrowsRightLeftIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function XeroFieldMappingTab() {
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [taxRates, setTaxRates] = useState([])
  const [loadingTaxRates, setLoadingTaxRates] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [syncHistory, setSyncHistory] = useState([])
  const [loadingSyncHistory, setLoadingSyncHistory] = useState(false)

  // Define field mappings for Contacts
  const contactFieldMappings = [
    { xeroField: 'Name', teeemField: 'full_name', syncDirection: 'two-way', enabled: true },
    { xeroField: 'EmailAddress', teeemField: 'email', syncDirection: 'two-way', enabled: true },
    { xeroField: 'ContactNumber', teeemField: 'supplier_code', syncDirection: 'two-way', enabled: false },
    { xeroField: 'FirstName', teeemField: 'first_name', syncDirection: 'two-way', enabled: true },
    { xeroField: 'LastName', teeemField: 'last_name', syncDirection: 'two-way', enabled: true },
    { xeroField: 'Phones[DDI].PhoneNumber', teeemField: 'mobile_phone', syncDirection: 'two-way', enabled: true },
    { xeroField: 'Phones[DEFAULT].PhoneNumber', teeemField: 'office_phone', syncDirection: 'two-way', enabled: true },
    { xeroField: 'Addresses[POBOX].AddressLine1', teeemField: 'address', syncDirection: 'two-way', enabled: true },
    { xeroField: 'Addresses[POBOX].City', teeemField: 'city', syncDirection: 'two-way', enabled: false },
    { xeroField: 'Addresses[POBOX].Region', teeemField: 'state', syncDirection: 'two-way', enabled: false },
    { xeroField: 'Addresses[POBOX].PostalCode', teeemField: 'postcode', syncDirection: 'two-way', enabled: false },
    { xeroField: 'TaxNumber', teeemField: 'tax_number (ABN/GST)', syncDirection: 'two-way', enabled: true },
    { xeroField: 'AccountNumber', teeemField: 'xero_account_number', syncDirection: 'xero-to-teeem', enabled: false },
    { xeroField: 'BankAccountDetails.BSB', teeemField: 'bank_bsb', syncDirection: 'xero-to-teeem', enabled: true },
    { xeroField: 'BankAccountDetails.AccountNumber', teeemField: 'bank_account_number', syncDirection: 'xero-to-teeem', enabled: true },
    { xeroField: 'BankAccountDetails.AccountName', teeemField: 'bank_account_name', syncDirection: 'xero-to-teeem', enabled: true },
    { xeroField: 'Website', teeemField: 'website', syncDirection: 'two-way', enabled: true },
    { xeroField: 'PurchaseDetails.AccountCode', teeemField: 'default_purchase_account', syncDirection: 'xero-to-teeem', enabled: true },
    { xeroField: 'PaymentTerms.Bills.Day', teeemField: 'bill_due_day', syncDirection: 'xero-to-teeem', enabled: true },
    { xeroField: 'PaymentTerms.Bills.Type', teeemField: 'bill_due_type', syncDirection: 'xero-to-teeem', enabled: true },
  ]

  // Define field mappings for Price Book Items
  const priceBookFieldMappings = [
    { xeroField: 'Item.Code', teeemField: 'item_code', syncDirection: 'two-way', enabled: false },
    { xeroField: 'Item.Name', teeemField: 'item_name', syncDirection: 'two-way', enabled: false },
    { xeroField: 'Item.Description', teeemField: 'notes', syncDirection: 'two-way', enabled: false },
    { xeroField: 'Item.SalesDetails.UnitPrice', teeemField: 'current_price', syncDirection: 'xero-to-teeem', enabled: false },
    { xeroField: 'Item.SalesDetails.TaxType', teeemField: 'gst_code', syncDirection: 'xero-to-teeem', enabled: true },
    { xeroField: 'Item.PurchaseDetails.UnitPrice', teeemField: 'supplier_price', syncDirection: 'xero-to-teeem', enabled: false },
  ]

  useEffect(() => {
    fetchSyncStatus()
    loadTaxRates()
    loadSyncHistory()
  }, [])

  const fetchSyncStatus = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/xero/sync_status')
      setSyncStatus(response.data)
    } catch (err) {
      console.error('Failed to fetch sync status:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadTaxRates = async () => {
    try {
      setLoadingTaxRates(true)
      const response = await api.get('/api/v1/xero/tax_rates')
      setTaxRates(response.tax_rates || [])
    } catch (err) {
      console.error('Failed to load tax rates:', err)
      // Don't show error to user, just log it
    } finally {
      setLoadingTaxRates(false)
    }
  }

  const loadSyncHistory = async () => {
    try {
      setLoadingSyncHistory(true)
      const response = await api.get('/api/v1/xero/sync_history')
      setSyncHistory(response.history || [])
    } catch (err) {
      console.error('Failed to load sync history:', err)
      // Don't show error to user, just log it
    } finally {
      setLoadingSyncHistory(false)
    }
  }

  const handleSyncContacts = async () => {
    try {
      setSyncing(true)
      setMessage(null)
      const response = await api.post('/api/v1/xero/sync_contacts')

      setMessage({
        type: 'success',
        text: `Contact sync started successfully. Job ID: ${response.data.job_id}`,
      })

      // Poll for status updates and reload history
      setTimeout(() => {
        fetchSyncStatus()
        loadSyncHistory()
      }, 2000)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to start contact sync',
      })
    } finally {
      setSyncing(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
      <div>
        <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">Xero Field Mapping</h2>
        <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
          Configure which fields sync between Xero and TEEEM. Enable two-way sync to keep data in sync across both platforms.
        </p>
      </div>

      <div className="md:col-span-2 space-y-6">
        {/* Message Banner */}
        {message && (
          <div
            className={`rounded-md p-4 ${
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

        {/* Sync Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Contact Sync Status</h3>
            <button
              type="button"
              onClick={handleSyncContacts}
              disabled={syncing || loading}
              className="inline-flex items-center gap-x-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <ArrowPathIcon className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-500"></div>
            </div>
          ) : syncStatus ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Last Sync</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {formatDate(syncStatus.last_sync_at)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Contacts</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {syncStatus.total_contacts}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Synced with Xero</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {syncStatus.synced_contacts} ({syncStatus.sync_percentage}%)
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sync Errors</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {syncStatus.contacts_with_errors}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No sync status available</p>
          )}
        </div>

        {/* Field Mapping Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Contact Field Mappings</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure which fields sync between Xero contacts and TEEEM contacts.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Xero Field
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sync Direction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    TEEEM Field
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Enabled
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {contactFieldMappings.map((mapping, index) => (
                  <tr key={index} className={mapping.enabled ? '' : 'opacity-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {mapping.xeroField}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-x-2">
                        {mapping.syncDirection === 'two-way' ? (
                          <>
                            <ArrowsRightLeftIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-xs text-gray-600 dark:text-gray-400">Two-way</span>
                          </>
                        ) : mapping.syncDirection === 'xero-to-teeem' ? (
                          <>
                            <span className="text-xs text-gray-600 dark:text-gray-400">Xero → TEEEM</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-gray-600 dark:text-gray-400">TEEEM → Xero</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {mapping.teeemField}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        checked={mapping.enabled}
                        disabled
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Note:</strong> Field mappings are currently configured in code. Enabled fields sync automatically when you run "Sync Now" above. Bank account details, purchase accounts, and payment terms are now syncing from Xero to TEEEM.
            </p>
          </div>
        </div>

        {/* Tax Rates Sync Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tax Rates (GST Codes)</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Tax rates are synced from Xero's Tax Rates setup (<a href="https://go.xero.com/Setup/TaxRates.aspx" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Setup → Tax Rates</a>). These GST codes become available for selection on price book items.
            </p>
          </div>

          <div className="px-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Xero Tax Rates → Price Book GST Codes</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Tax rates loaded on demand when editing price book items
                  </p>
                </div>
                {taxRates.length > 0 ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <button
                    onClick={loadTaxRates}
                    disabled={loadingTaxRates}
                    className="inline-flex items-center gap-x-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${loadingTaxRates ? 'animate-spin' : ''}`} />
                    Load Tax Rates
                  </button>
                )}
              </div>

              {loadingTaxRates ? (
                <div className="flex items-center justify-center py-4">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                </div>
              ) : taxRates.length > 0 ? (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                    <strong>Available Tax Rates from Xero:</strong> ({taxRates.length} rates)
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {taxRates.map((rate) => (
                      <div key={rate.code} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded px-3 py-2 border border-gray-200 dark:border-gray-700">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{rate.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({rate.code})</span>
                        </div>
                        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{rate.display_rate}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">
                    These tax rates are available when editing the GST Code field in price books.
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    No tax rates loaded yet. Click "Load Tax Rates" above or they will load automatically when editing price book items.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Price Book Field Mapping Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Price Book Item Field Mappings (Future)</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Potential field mappings if full item sync from Xero Items is implemented. Currently only tax rates are synced.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Xero Field
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sync Direction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    TEEEM Field
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Enabled
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {priceBookFieldMappings.map((mapping, index) => (
                  <tr key={index} className={mapping.enabled ? '' : 'opacity-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {mapping.xeroField}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-x-2">
                        {mapping.syncDirection === 'two-way' ? (
                          <>
                            <ArrowsRightLeftIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-xs text-gray-600 dark:text-gray-400">Two-way</span>
                          </>
                        ) : mapping.syncDirection === 'xero-to-teeem' ? (
                          <>
                            <span className="text-xs text-gray-600 dark:text-gray-400">Xero → TEEEM</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-gray-600 dark:text-gray-400">TEEEM → Xero</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {mapping.teeemField}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        checked={mapping.enabled}
                        disabled
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Note:</strong> GST codes are managed through the Tax Rates sync, which populates available tax types for price book items. Item sync from Xero Items is not yet implemented.
            </p>
          </div>
        </div>

        {/* Sync History */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Sync Activity</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Shows the 50 most recent contact sync operations and their status.
            </p>
          </div>

          <div className="overflow-x-auto">
            {loadingSyncHistory ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-500"></div>
              </div>
            ) : syncHistory.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date/Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {syncHistory.map((item, index) => (
                    <tr key={index} className={item.has_error ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatDate(item.synced_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <div>
                          <div className="font-medium">{item.contact_name}</div>
                          {item.email && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{item.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {item.action}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.has_error ? (
                          <div className="flex items-center gap-x-2">
                            <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                            <span className="text-xs text-red-700 dark:text-red-400" title={item.error_message}>
                              Failed
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-x-2">
                            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                            <span className="text-xs text-green-700 dark:text-green-400">Success</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No sync history available. Run a contact sync to see activity here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
