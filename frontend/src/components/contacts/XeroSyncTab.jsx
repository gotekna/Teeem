import { useState, useEffect } from 'react'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  LinkIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function XeroSyncTab({ contact, onContactUpdate }) {
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [xeroInvoices, setXeroInvoices] = useState([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [transactionsError, setTransactionsError] = useState(null)

  // Define the field mappings between Xero and Trapid
  const fieldMappings = [
    {
      section: 'Basic Information',
      fields: [
        { xeroField: 'Name', trapidField: 'full_name', value: contact?.full_name, syncStatus: 'synced' },
        { xeroField: 'FirstName', trapidField: 'first_name', value: contact?.first_name, syncStatus: 'synced' },
        { xeroField: 'LastName', trapidField: 'last_name', value: contact?.last_name, syncStatus: 'synced' },
        { xeroField: 'EmailAddress', trapidField: 'email', value: contact?.email, syncStatus: 'synced' },
        { xeroField: 'ContactID', trapidField: 'xero_id', value: contact?.xero_id, syncStatus: contact?.xero_id ? 'synced' : 'not_linked' }
      ]
    },
    {
      section: 'Contact Details',
      fields: [
        { xeroField: 'PhoneNumber (Mobile)', trapidField: 'mobile_phone', value: contact?.mobile_phone, syncStatus: 'synced' },
        { xeroField: 'PhoneNumber (Office)', trapidField: 'office_phone', value: contact?.office_phone, syncStatus: 'synced' },
        { xeroField: 'PhoneNumber (Fax)', trapidField: 'fax_phone', value: contact?.fax_phone, syncStatus: 'synced' },
        { xeroField: 'Website', trapidField: 'website', value: contact?.website, syncStatus: 'synced' }
      ]
    },
    {
      section: 'Tax & Registration',
      fields: [
        { xeroField: 'TaxNumber', trapidField: 'tax_number', value: contact?.tax_number, syncStatus: 'synced' },
        { xeroField: 'AccountNumber', trapidField: 'xero_account_number', value: contact?.xero_account_number, syncStatus: 'synced' },
        { xeroField: 'ContactNumber', trapidField: 'xero_contact_number', value: contact?.xero_contact_number, syncStatus: 'synced' },
        { xeroField: 'ContactStatus', trapidField: 'xero_contact_status', value: contact?.xero_contact_status, syncStatus: 'synced' },
        { xeroField: 'CompanyNumber', trapidField: 'company_number', value: contact?.company_number, syncStatus: 'synced' }
      ]
    },
    {
      section: 'Purchase (Accounts Payable)',
      fields: [
        { xeroField: 'DefaultPurchaseAccount', trapidField: 'default_purchase_account', value: contact?.default_purchase_account, syncStatus: 'synced' },
        { xeroField: 'PurchaseTerms (Days)', trapidField: 'bill_due_day', value: contact?.bill_due_day, syncStatus: 'synced' },
        { xeroField: 'PurchaseTerms (Type)', trapidField: 'bill_due_type', value: contact?.bill_due_type, syncStatus: 'synced' },
        { xeroField: 'AccountsPayable Outstanding', trapidField: 'accounts_payable_outstanding', value: contact?.accounts_payable_outstanding, syncStatus: 'read_only', type: 'currency' },
        { xeroField: 'AccountsPayable Overdue', trapidField: 'accounts_payable_overdue', value: contact?.accounts_payable_overdue, syncStatus: 'read_only', type: 'currency' }
      ]
    },
    {
      section: 'Sales (Accounts Receivable)',
      fields: [
        { xeroField: 'DefaultSalesAccount', trapidField: 'default_sales_account', value: contact?.default_sales_account, syncStatus: 'synced' },
        { xeroField: 'DefaultDiscount', trapidField: 'default_discount', value: contact?.default_discount, syncStatus: 'synced', type: 'percentage' },
        { xeroField: 'SalesTerms (Days)', trapidField: 'sales_due_day', value: contact?.sales_due_day, syncStatus: 'synced' },
        { xeroField: 'SalesTerms (Type)', trapidField: 'sales_due_type', value: contact?.sales_due_type, syncStatus: 'synced' },
        { xeroField: 'AccountsReceivable Outstanding', trapidField: 'accounts_receivable_outstanding', value: contact?.accounts_receivable_outstanding, syncStatus: 'read_only', type: 'currency' },
        { xeroField: 'AccountsReceivable Overdue', trapidField: 'accounts_receivable_overdue', value: contact?.accounts_receivable_overdue, syncStatus: 'read_only', type: 'currency' }
      ]
    },
    {
      section: 'Bank Details',
      fields: [
        { xeroField: 'BankAccountBSB', trapidField: 'bank_bsb', value: contact?.bank_bsb, syncStatus: 'synced' },
        { xeroField: 'BankAccountNumber', trapidField: 'bank_account_number', value: contact?.bank_account_number, syncStatus: 'synced' },
        { xeroField: 'BankAccountName', trapidField: 'bank_account_name', value: contact?.bank_account_name, syncStatus: 'synced' }
      ]
    },
    {
      section: 'Sync Status',
      fields: [
        { xeroField: 'SyncEnabled', trapidField: 'sync_with_xero', value: contact?.sync_with_xero ? 'Yes' : 'No', syncStatus: contact?.sync_with_xero ? 'enabled' : 'disabled' },
        { xeroField: 'LastSyncedAt', trapidField: 'last_synced_at', value: contact?.last_synced_at ? new Date(contact.last_synced_at).toLocaleString() : 'Never', syncStatus: contact?.last_synced_at ? 'synced' : 'never' },
        { xeroField: 'SyncError', trapidField: 'xero_sync_error', value: contact?.xero_sync_error || 'None', syncStatus: contact?.xero_sync_error ? 'error' : 'ok' }
      ]
    }
  ]

  // Load transaction data when component mounts
  useEffect(() => {
    if (contact?.id && contact['is_supplier?']) {
      loadTransactions()
    }
  }, [contact?.id])

  const loadTransactions = async () => {
    setLoadingTransactions(true)
    setTransactionsError(null)

    try {
      // Fetch Purchase Orders from Trapid
      const poResponse = await api.get(`/api/v1/purchase_orders?supplier_id=${contact.id}`)
      if (poResponse.success) {
        setPurchaseOrders(poResponse.purchase_orders || [])
      }

      // Fetch Xero Invoices if contact is linked
      if (contact?.xero_id) {
        const xeroResponse = await api.get(`/api/v1/xero/invoices?contact_id=${contact.xero_id}`)
        if (xeroResponse.success) {
          setXeroInvoices(xeroResponse.data?.invoices || [])
        }
      }
    } catch (error) {
      setTransactionsError(error.message || 'Failed to load transactions')
    } finally {
      setLoadingTransactions(false)
    }
  }

  const formatValue = (field) => {
    if (!field.value && field.value !== 0) return '-'
    if (field.type === 'currency') {
      return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(field.value)
    }
    if (field.type === 'percentage') {
      return `${field.value}%`
    }
    return field.value
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-'
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-AU')
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'synced':
      case 'enabled':
      case 'ok':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'not_linked':
      case 'disabled':
      case 'never':
        return <XCircleIcon className="h-5 w-5 text-gray-400" />
      case 'read_only':
        return <ExclamationTriangleIcon className="h-5 w-5 text-blue-500" />
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      default:
        return <XCircleIcon className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'synced': return 'Synced'
      case 'not_linked': return 'Not Linked'
      case 'read_only': return 'Read Only'
      case 'enabled': return 'Enabled'
      case 'disabled': return 'Disabled'
      case 'never': return 'Never Synced'
      case 'ok': return 'OK'
      case 'error': return 'Error'
      default: return 'Unknown'
    }
  }

  const handleSync = async () => {
    if (!contact?.xero_id) {
      setSyncError('Contact must be linked to Xero first')
      return
    }

    setSyncing(true)
    setSyncError(null)

    try {
      const response = await api.post(`/api/v1/contacts/${contact.id}/sync_from_xero`)
      if (response.success) {
        onContactUpdate(response.contact)
      } else {
        setSyncError(response.error || 'Sync failed')
      }
    } catch (error) {
      setSyncError(error.message || 'Failed to sync with Xero')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="py-6">
      {/* Header with Sync Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Xero Sync</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Field mappings between Xero and Trapid
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || !contact?.xero_id}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            contact?.xero_id
              ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync from Xero'}
        </button>
      </div>

      {/* Sync Error Message */}
      {syncError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-300">{syncError}</p>
          </div>
        </div>
      )}

      {/* Link Status */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            {contact?.xero_id ? (
              <>
                <span className="font-semibold">Linked to Xero</span> • Contact ID: {contact.xero_id}
              </>
            ) : (
              <>
                <span className="font-semibold">Not Linked</span> • Use the "Link Xero Contact" button in the Overview tab to connect this contact
              </>
            )}
          </p>
        </div>
      </div>

      {/* Field Mappings Table */}
      {fieldMappings.map((section, idx) => (
        <div key={idx} className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {section.section}
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Xero Field
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trapid Field
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Current Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {section.fields.map((field, fieldIdx) => (
                  <tr key={fieldIdx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {field.xeroField}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {field.trapidField}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {formatValue(field)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(field.syncStatus)}
                        <span className="text-gray-700 dark:text-gray-300">
                          {getStatusLabel(field.syncStatus)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Status Legend</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span className="text-gray-700 dark:text-gray-300">Synced</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircleIcon className="h-4 w-4 text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">Not Linked</span>
          </div>
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-blue-500" />
            <span className="text-gray-700 dark:text-gray-300">Read Only</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircleIcon className="h-4 w-4 text-red-500" />
            <span className="text-gray-700 dark:text-gray-300">Error</span>
          </div>
        </div>
      </div>
    </div>
  )
}
