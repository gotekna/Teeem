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
  const [xeroCreditNotes, setXeroCreditNotes] = useState([])
  const [xeroPayments, setXeroPayments] = useState([])
  const [xeroQuotes, setXeroQuotes] = useState([])
  const [contactPersons, setContactPersons] = useState([])
  const [contactGroups, setContactGroups] = useState([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [transactionsError, setTransactionsError] = useState(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState(null)
  const [companies, setCompanies] = useState([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [deleteOriginal, setDeleteOriginal] = useState(false)

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

      // Fetch Contact Persons from Trapid
      const personsResponse = await api.get(`/api/v1/contacts/${contact.id}/contact_persons`)
      if (personsResponse.success) {
        setContactPersons(personsResponse.contact_persons || [])
      }

      // Fetch Contact Groups from Trapid
      const groupsResponse = await api.get(`/api/v1/contacts/${contact.id}/contact_groups`)
      if (groupsResponse.success) {
        setContactGroups(groupsResponse.contact_groups || [])
      }

      // Fetch Xero data if contact is linked
      if (contact?.xero_id) {
        // Invoices
        const invoicesResponse = await api.get(`/api/v1/xero/invoices?contact_id=${contact.xero_id}`)
        if (invoicesResponse.success) {
          setXeroInvoices(invoicesResponse.data?.invoices || [])
        }

        // Credit Notes
        try {
          const creditNotesResponse = await api.get(`/api/v1/xero/credit_notes?contact_id=${contact.xero_id}`)
          if (creditNotesResponse.success) {
            setXeroCreditNotes(creditNotesResponse.data?.credit_notes || [])
          }
        } catch (e) {
          console.log('Credit Notes endpoint not available yet')
        }

        // Payments
        try {
          const paymentsResponse = await api.get(`/api/v1/xero/payments?contact_id=${contact.xero_id}`)
          if (paymentsResponse.success) {
            setXeroPayments(paymentsResponse.data?.payments || [])
          }
        } catch (e) {
          console.log('Payments endpoint not available yet')
        }

        // Quotes
        try {
          const quotesResponse = await api.get(`/api/v1/xero/quotes?contact_id=${contact.xero_id}`)
          if (quotesResponse.success) {
            setXeroQuotes(quotesResponse.data?.quotes || [])
          }
        } catch (e) {
          console.log('Quotes endpoint not available yet')
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

  const handleChangeToSoleTrader = async () => {
    if (!confirm('Change this contact from Person to Sole Trader (Company)?\n\nThis will:\n1. Update entity_type to "company"\n2. Create a ContactPerson record with the same details\n3. Mark as primary contact\n\nThis matches Xero\'s model where sole traders are companies with a primary contact person.')) {
      return
    }

    setConverting(true)
    setConvertError(null)

    try {
      // Step 1: Update entity_type to 'company'
      const response = await api.patch(`/api/v1/contacts/${contact.id}`, {
        contact: {
          entity_type: 'company'
        }
      })

      if (response.success) {
        // Step 2: Create ContactPerson with same details
        const contactPersonResponse = await api.post(`/api/v1/contacts/${contact.id}/contact_persons`, {
          contact_person: {
            first_name: contact.first_name || '',
            last_name: contact.last_name || '',
            email: contact.email || '',
            phone: contact.mobile_phone || contact.office_phone || '',
            position: contact.position || 'Owner',
            primary_contact: true
          }
        })

        if (contactPersonResponse.success) {
          onContactUpdate(response.contact)
          alert('✅ Contact converted to Sole Trader successfully!\n\n• Entity type changed to Company\n• Primary contact person created\n• Ready to link with Xero')
        } else {
          setConvertError('Contact converted but failed to create primary contact person')
        }
      } else {
        setConvertError(response.error || 'Failed to convert contact')
      }
    } catch (error) {
      setConvertError(error.message || 'Failed to convert contact')
    } finally {
      setConverting(false)
    }
  }

  const loadCompanies = async () => {
    try {
      const response = await api.get('/api/v1/contacts?entity_type=company&limit=100')
      if (response.success) {
        setCompanies(response.contacts || [])
      }
    } catch (error) {
      console.error('Failed to load companies:', error)
    }
  }

  const handleConvertToContactPerson = async () => {
    if (!selectedCompanyId) {
      setConvertError('Please select a company first')
      return
    }

    setConverting(true)
    setConvertError(null)

    try {
      // Create contact person under the selected company
      const response = await api.post(`/api/v1/contacts/${selectedCompanyId}/contact_persons`, {
        contact_person: {
          first_name: contact.first_name || '',
          last_name: contact.last_name || '',
          email: contact.email || '',
          phone: contact.mobile_phone || contact.office_phone || '',
          position: contact.position || ''
        }
      })

      if (response.success) {
        // If user chose to delete original, delete it
        if (deleteOriginal) {
          await api.delete(`/api/v1/contacts/${contact.id}`)
          alert('✅ Contact converted to Contact Person and original contact deleted!')
          // Navigate back to contacts table
          window.location.href = '/tables/214/contacts'
        } else {
          alert('✅ Contact Person created successfully! The original contact still exists.')
          setShowConvertModal(false)
        }
      } else {
        setConvertError(response.error || 'Failed to create contact person')
      }
    } catch (error) {
      setConvertError(error.message || 'Failed to create contact person')
    } finally {
      setConverting(false)
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

      {/* Entity Type Warning */}
      {contact?.entity_type === 'person' && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                ⚠️ Persons Cannot Be Linked to Xero
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                Xero only supports <strong>Company</strong> or <strong>Sole Trader</strong> contacts.
                Choose an option below to enable Xero sync:
              </p>

              {convertError && (
                <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-sm text-red-800 dark:text-red-300">
                  {convertError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleChangeToSoleTrader}
                  disabled={converting}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {converting ? 'Converting...' : 'Change to Sole Trader'}
                </button>
                <button
                  onClick={() => {
                    setShowConvertModal(true)
                    loadCompanies()
                  }}
                  disabled={converting}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Convert to Contact Person
                </button>
              </div>
            </div>
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
                <span className="font-semibold">✅ Linked to Xero</span> • Contact ID: {contact.xero_id}
              </>
            ) : (
              <>
                <span className="font-semibold">❌ Not Linked</span> • Use the "Link Xero Contact" button in the Overview tab to connect this contact
              </>
            )}
          </p>
        </div>
      </div>

      {/* Connection Guide */}
      <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📋 How Trapid Connects to Xero
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">🔗 Contact Fields</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Name, email, phone, tax number, bank details sync bidirectionally via <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">xero_id</code>
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">📝 Purchase Orders</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Trapid POs link to Xero Bills/Invoices via <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">xero_invoice_id</code>. Payment status syncs from Xero.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">🧾 Invoices & Bills</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                All Xero invoices for this contact are fetched via Xero API using the <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">ContactID</code> filter.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">💳 Credit Notes & Payments</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Refunds, adjustments, and payment history fetched from Xero API in real-time.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">💰 Financial Balances</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                AR/AP balances (outstanding/overdue) sync from Xero's contact summary data.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">👥 Contact Persons</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                People at a company (FirstName, LastName, Email) stored in <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">contact_persons</code> table.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">🏷️ Contact Groups</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Xero categories/segments stored in <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">contact_groups</code> for reporting.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History (Purchase Orders & Invoices) */}
      {contact['is_supplier?'] && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Transaction History
          </h3>

          {loadingTransactions ? (
            <div className="flex items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading transactions...</span>
            </div>
          ) : transactionsError ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{transactionsError}</p>
            </div>
          ) : (
            <>
              {/* Trapid Purchase Orders */}
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  Purchase Orders in Trapid ({purchaseOrders.length})
                </h4>
                {purchaseOrders.length > 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">PO Number</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount Paid (Xero)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Xero Link</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">How It Links</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ordered Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {purchaseOrders.slice(0, 10).map((po) => (
                          <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{po.purchase_order_number}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                po.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                po.status === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}>
                                {po.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(po.total)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(po.xero_amount_paid)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {po.xero_invoice_id ? (
                                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <CheckCircleIcon className="h-4 w-4" />
                                  <span className="font-mono text-xs">{po.xero_invoice_id.substring(0, 8)}...</span>
                                </span>
                              ) : (
                                <span className="text-gray-400">Not Linked</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                              <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">xero_invoice_id</code> field stores Xero Bill/Invoice ID
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{formatDate(po.ordered_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {purchaseOrders.length > 10 && (
                      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Showing 10 of {purchaseOrders.length} purchase orders
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">No purchase orders found for this supplier</p>
                  </div>
                )}
              </div>

              {/* Xero Invoices */}
              {contact?.xero_id && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Invoices in Xero ({xeroInvoices.length})
                  </h4>
                  {xeroInvoices.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invoice Number</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount Due</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">How It Links</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {xeroInvoices.slice(0, 10).map((invoice, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{invoice.InvoiceNumber || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{invoice.Type}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  invoice.Status === 'PAID' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                  invoice.Status === 'DRAFT' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                  {invoice.Status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.Total)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(invoice.AmountDue)}</td>
                              <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                                Fetched from Xero API via <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">contact.xero_id</code> filter
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{formatDate(invoice.Date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {xeroInvoices.length > 10 && (
                        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Showing 10 of {xeroInvoices.length} Xero invoices
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400">No Xero invoices found for this contact</p>
                    </div>
                  )}
                </div>
              )}

              {/* Xero Credit Notes */}
              {contact?.xero_id && xeroCreditNotes.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Credit Notes in Xero ({xeroCreditNotes.length})
                  </h4>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Credit Note Number</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">How It Links</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {xeroCreditNotes.slice(0, 10).map((cn, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{cn.CreditNoteNumber || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{cn.Type}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                {cn.Status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatCurrency(cn.Total)}</td>
                            <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                              Fetched from Xero API (Refunds/Adjustments)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{formatDate(cn.Date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Xero Payments */}
              {contact?.xero_id && xeroPayments.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Payments in Xero ({xeroPayments.length})
                  </h4>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Payment Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reference</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">How It Links</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {xeroPayments.slice(0, 10).map((payment, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(payment.Date)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(payment.Amount)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{payment.Reference || '-'}</td>
                            <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                              Linked to invoices via <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">InvoiceID</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Contact Persons */}
              {contactPersons.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Contact Persons in Trapid ({contactPersons.length})
                  </h4>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">First Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">How It Links</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {contactPersons.map((person, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{person.first_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{person.last_name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{person.email || '-'}</td>
                            <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                              Stored in <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">contact_persons</code> table, synced from Xero
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Contact Groups */}
              {contactGroups.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Contact Groups in Trapid ({contactGroups.length})
                  </h4>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex flex-wrap gap-2">
                      {contactGroups.map((group, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                        >
                          {group.name}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                      <strong>How It Links:</strong> Groups are stored in <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">contact_groups</code> table, synced from Xero for categorization/reporting
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

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

      {/* Convert to Contact Person Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Convert to Contact Person
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This will create a new Contact Person under a company contact. The contact person can then be synced with Xero.
              </p>

              {convertError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-300">
                  {convertError}
                </div>
              )}

              {/* Data Preview */}
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Data to be copied:</h4>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• Name: {contact?.first_name || ''} {contact?.last_name || ''}</li>
                  <li>• Email: {contact?.email || '-'}</li>
                  <li>• Phone: {contact?.mobile_phone || contact?.office_phone || '-'}</li>
                  <li>• Position: {contact?.position || '-'}</li>
                </ul>
              </div>

              {/* Company Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Company *
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select a company --</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.full_name || company.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delete Original Option */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteOriginal}
                    onChange={(e) => setDeleteOriginal(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Delete original person contact after conversion
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                  (Recommended if this person will only exist under a company)
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConvertModal(false)
                    setConvertError(null)
                    setSelectedCompanyId('')
                    setDeleteOriginal(false)
                  }}
                  disabled={converting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConvertToContactPerson}
                  disabled={converting || !selectedCompanyId}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {converting ? 'Converting...' : 'Convert'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
