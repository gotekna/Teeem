import { useState, useEffect } from 'react'
import {
  ArrowPathIcon,
  XCircleIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LinkIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function JobBillsTab({ job }) {
  // Transaction data from cached bills
  const [bills, setBills] = useState([])
  const [supplierCreditNotes, setSupplierCreditNotes] = useState([])

  // Loading states
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)

  // Sync metadata
  const [lastSyncedAt, setLastSyncedAt] = useState(null)

  // Bill detail modal
  const [selectedBill, setSelectedBill] = useState(null)
  const [loadingBillDetail, setLoadingBillDetail] = useState(false)

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    bills: true,
    creditNotes: false,
    payments: true
  })

  // Show/hide deleted items
  const [showDeleted, setShowDeleted] = useState(false)

  // Load transactions when job changes
  useEffect(() => {
    if (job?.id) {
      loadTransactions()
    } else {
      setLoading(false)
    }
  }, [job?.id])

  const loadTransactions = async () => {
    setLoading(true)
    setError(null)

    try {
      // Use the new fast endpoint that reads from local cache
      const response = await api.get(`/api/v1/external_invoices/by_job/${job.id}`)

      if (response.success) {
        setBills(response.data?.bills || [])
        // Credit notes from suppliers (ACCPAYCREDIT) - credits we receive
        setSupplierCreditNotes(response.data?.credit_notes || [])
        setLastSyncedAt(response.meta?.last_synced_at)
      } else {
        setError(response.error || 'Failed to load bills')
      }
    } catch (err) {
      console.error('Failed to load job bills:', err)
      setError('Failed to load bills')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setSyncing(true)
    await loadTransactions()
    setSyncing(false)
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Fetch full bill details for modal
  const fetchBillDetail = async (invoiceId) => {
    setLoadingBillDetail(true)
    try {
      const response = await api.get(`/api/v1/external_invoices/${invoiceId}`)
      if (response.success && response.data) {
        setSelectedBill(response.data)
      }
    } catch (err) {
      console.error('Failed to fetch bill details:', err)
    } finally {
      setLoadingBillDetail(false)
    }
  }

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-'
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    // Handle Xero date format /Date(timestamp)/
    if (dateString.startsWith('/Date(')) {
      const timestamp = parseInt(dateString.replace('/Date(', '').replace(')/', ''))
      return new Date(timestamp).toLocaleDateString('en-AU')
    }
    return new Date(dateString).toLocaleDateString('en-AU')
  }

  const getStatusBadge = (status) => {
    // Using normalized status values (lowercase)
    const statusMap = {
      'draft': { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: 'Draft' },
      'submitted': { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', label: 'Submitted' },
      'approved': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', label: 'Approved' },
      'paid': { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', label: 'Paid' },
      'voided': { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', label: 'Voided' },
      'deleted': { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', label: 'Deleted' },
    }
    const statusInfo = statusMap[status] || { color: 'bg-gray-100 text-gray-800', label: status }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  // Extract payments from bills (using normalized snake_case fields)
  const getAllPayments = () => {
    const payments = []

    bills.forEach(bill => {
      const billPayments = bill.payments || []
      if (billPayments.length > 0) {
        billPayments.forEach(payment => {
          payments.push({
            ...payment,
            invoice_number: bill.invoice_number,
            invoice_id: bill.id,
            supplier_name: bill.contact_name
          })
        })
      }
    })

    // Sort by date descending
    payments.sort((a, b) => {
      const dateA = a.Date ? new Date(a.Date) : 0
      const dateB = b.Date ? new Date(b.Date) : 0
      return dateB - dateA
    })

    return payments
  }

  const payments = getAllPayments()

  // No tracking category linked - show message but still display any linked bills
  const noTrackingCategory = !job?.xero_tracking_option_name

  // Filter out deleted/voided unless showDeleted is true (using lowercase status)
  const filteredBills = showDeleted
    ? bills
    : bills.filter(bill => bill.status !== 'deleted' && bill.status !== 'voided')
  const deletedCount = bills.length - bills.filter(bill => bill.status !== 'deleted' && bill.status !== 'voided').length

  // Filter supplier credit notes
  const filteredCreditNotes = showDeleted
    ? supplierCreditNotes
    : supplierCreditNotes.filter(cn => cn.status !== 'deleted' && cn.status !== 'voided')
  const creditNotesDeletedCount = supplierCreditNotes.length - supplierCreditNotes.filter(cn => cn.status !== 'deleted' && cn.status !== 'voided').length

  // Calculate totals (using snake_case fields)
  const billTotal = filteredBills.reduce((sum, bill) => sum + (parseFloat(bill.total) || 0), 0)
  const billDueTotal = filteredBills.reduce((sum, bill) => sum + (parseFloat(bill.amount_due) || 0), 0)
  const billPaidTotal = filteredBills.reduce((sum, bill) => sum + ((parseFloat(bill.total) || 0) - (parseFloat(bill.amount_due) || 0)), 0)

  // Supplier credit note totals (credits we receive from suppliers reduce our costs)
  const creditNoteTotal = filteredCreditNotes.reduce((sum, cn) => sum + (parseFloat(cn.total) || 0), 0)

  // Format last synced time
  const formatLastSynced = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-AU')
  }

  // Group bills by supplier
  const billsBySupplier = filteredBills.reduce((acc, bill) => {
    const supplierName = bill.contact_name || 'Unknown Supplier'
    if (!acc[supplierName]) {
      acc[supplierName] = { bills: [], total: 0 }
    }
    acc[supplierName].bills.push(bill)
    acc[supplierName].total += parseFloat(bill.total) || 0
    return acc
  }, {})

  // Sort suppliers by total (highest first)
  const sortedSuppliers = Object.entries(billsBySupplier)
    .sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="p-6 space-y-6">
      {/* Header with sync button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Supplier Bills & Costs</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {job.xero_tracking_option_name ? (
              <>Bills from suppliers for: <span className="font-medium text-amber-600 dark:text-amber-400">{job.xero_tracking_option_name}</span></>
            ) : (
              <>Bills linked to this job</>
            )}
          </p>
          {lastSyncedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1">
              <ClockIcon className="h-3 w-3" />
              Last synced: {formatLastSynced(lastSyncedAt)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
            />
            Show deleted
          </label>
          <button
            onClick={handleRefresh}
            disabled={syncing || loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`-ml-1 mr-2 h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex">
            <XCircleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-600 border-t-transparent"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading bills...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards - Row 1: Bills */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <DocumentTextIcon className="h-5 w-5 text-amber-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Bills</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {filteredBills.length}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                from {sortedSuppliers.length} supplier{sortedSuppliers.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CurrencyDollarIcon className="h-5 w-5 text-amber-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Costs</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(billTotal)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CurrencyDollarIcon className="h-5 w-5 text-green-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Paid</span>
              </div>
              <div className="text-2xl font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(billPaidTotal)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CurrencyDollarIcon className="h-5 w-5 text-red-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Outstanding</span>
              </div>
              <div className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(billDueTotal)}
              </div>
            </div>
          </div>

          {/* Summary cards - Row 2: Supplier Credits (only show if any exist) */}
          {filteredCreditNotes.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DocumentTextIcon className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Supplier Credits</span>
                </div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {filteredCreditNotes.length}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CurrencyDollarIcon className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Credit Total</span>
                </div>
                <div className="text-2xl font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(creditNoteTotal)}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  reduces costs
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CurrencyDollarIcon className="h-5 w-5 text-blue-500" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Net Costs</span>
                </div>
                <div className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
                  {formatCurrency(billTotal - creditNoteTotal)}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  bills minus credits
                </div>
              </div>
            </div>
          )}

          {/* Supplier Breakdown */}
          {sortedSuppliers.length > 1 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Costs by Supplier</h3>
              <div className="space-y-2">
                {sortedSuppliers.slice(0, 5).map(([supplier, data]) => {
                  const percentage = billTotal > 0 ? (data.total / billTotal * 100) : 0
                  return (
                    <div key={supplier} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400 truncate">{supplier}</span>
                          <span className="text-gray-900 dark:text-white font-medium ml-2">{formatCurrency(data.total)}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-amber-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 w-12 text-right">{percentage.toFixed(0)}%</span>
                    </div>
                  )
                })}
                {sortedSuppliers.length > 5 && (
                  <div className="text-xs text-gray-400 text-center pt-2">
                    +{sortedSuppliers.length - 5} more suppliers
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bills Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('bills')}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-amber-500" />
                <span className="font-medium text-gray-900 dark:text-white">
                  Bills ({filteredBills.length})
                </span>
                {deletedCount > 0 && !showDeleted && (
                  <span className="text-xs text-gray-400">
                    +{deletedCount} deleted
                  </span>
                )}
              </div>
              {expandedSections.bills ? (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {expandedSections.bills && (
              <div className="overflow-x-auto">
                {filteredBills.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Number</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Supplier</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredBills.map((bill, idx) => (
                        <tr
                          key={bill.id || idx}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                          onClick={() => fetchBillDetail(bill.id)}
                        >
                          <td className="px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline">
                            {bill.invoice_number || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {bill.contact_name || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={bill.line_items?.[0]?.Description || ''}>
                            {bill.line_items?.[0]?.Description || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(bill.invoice_date)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(bill.due_date)}
                          </td>
                          <td className="px-4 py-2">
                            {getStatusBadge(bill.status)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                            {formatCurrency(bill.total)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                            {formatCurrency(bill.amount_due)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-300 dark:border-gray-600">
                      <tr>
                        <td colSpan={6} className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white text-right">
                          Total
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-bold text-gray-900 dark:text-white">
                          {formatCurrency(billTotal)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-bold text-gray-900 dark:text-white">
                          {formatCurrency(billDueTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No bills found for this job
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Supplier Credit Notes Section */}
          {filteredCreditNotes.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => toggleSection('creditNotes')}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    Supplier Credits ({filteredCreditNotes.length})
                  </span>
                  {creditNotesDeletedCount > 0 && !showDeleted && (
                    <span className="text-xs text-gray-400">
                      +{creditNotesDeletedCount} deleted
                    </span>
                  )}
                </div>
                {expandedSections.creditNotes ? (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedSections.creditNotes && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Number</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Supplier</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reference</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Credit Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredCreditNotes.map((cn, idx) => (
                        <tr
                          key={cn.id || idx}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                          onClick={() => fetchBillDetail(cn.id)}
                        >
                          <td className="px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 hover:underline">
                            {cn.invoice_number || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {cn.contact_name || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {cn.reference || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(cn.invoice_date)}
                          </td>
                          <td className="px-4 py-2">
                            {getStatusBadge(cn.status)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(cn.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-300 dark:border-gray-600">
                      <tr>
                        <td colSpan={5} className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white text-right">
                          Total Credits
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(creditNoteTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Payments Section */}
          {payments.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => toggleSection('payments')}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <CurrencyDollarIcon className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    Payments Made ({payments.length})
                  </span>
                </div>
                {expandedSections.payments ? (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedSections.payments && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bill</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Supplier</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reference</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {payments.map((payment, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                            {payment.invoice_number || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {payment.supplier_name || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(payment.Date)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {payment.Reference || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(payment.Amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-300 dark:border-gray-600">
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white text-right">
                          Total
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(payments.reduce((sum, p) => sum + (p.Amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Bill Detail Modal */}
      {(selectedBill || loadingBillDetail) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setSelectedBill(null)}
            />

            {/* Modal */}
            <div className="relative inline-block w-full max-w-4xl p-6 my-8 text-left align-middle bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all">
              {loadingBillDetail ? (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="h-8 w-8 animate-spin text-amber-500" />
                  <span className="ml-3 text-gray-600 dark:text-gray-300">Loading details...</span>
                </div>
              ) : selectedBill && (
                <>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          Bill {selectedBill.InvoiceNumber}
                        </h2>
                        <span className={`px-3 py-1 rounded text-sm font-medium border ${
                          selectedBill.Status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                          selectedBill.Status === 'DRAFT' ? 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600' :
                          selectedBill.Status === 'AUTHORISED' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' :
                          selectedBill.Status === 'DELETED' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                          'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
                        }`}>
                          {selectedBill.Status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Supplier Bill
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedBill(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Bill Info */}
                  <div className="grid grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Supplier</h3>
                      <p className="text-amber-600 dark:text-amber-400 font-medium">{selectedBill.Contact?.Name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Bill Date</span>
                        <p className="font-medium text-gray-900 dark:text-white">{formatDate(selectedBill.Date)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Due Date</span>
                        <p className="font-medium text-gray-900 dark:text-white">{formatDate(selectedBill.DueDate)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Number</span>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedBill.InvoiceNumber}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Reference</span>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedBill.Reference || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="mb-6">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Job/Tracking</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit Price</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {selectedBill.LineItems?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.Description}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              {item.Tracking?.length > 0
                                ? item.Tracking.map(t => t.Option || t.Name).join(', ')
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{item.Quantity}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">{formatCurrency(item.UnitAmount)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">{formatCurrency(item.LineAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-72 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                        <span className="text-gray-900 dark:text-white">{formatCurrency(selectedBill.SubTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Tax</span>
                        <span className="text-gray-900 dark:text-white">{formatCurrency(selectedBill.TotalTax)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-600 pt-2">
                        <span className="text-gray-900 dark:text-white">Total</span>
                        <span className="text-amber-600 dark:text-amber-400">{formatCurrency(selectedBill.Total)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-600 pt-2">
                        <span className="text-gray-900 dark:text-white">Amount Due</span>
                        <span className={selectedBill.AmountDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}>
                          {formatCurrency(selectedBill.AmountDue)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <a
                      href={`https://go.xero.com/AccountsPayable/View.aspx?invoiceID=${selectedBill.InvoiceID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      <LinkIcon className="h-4 w-4" />
                      View in Xero
                    </a>
                    <button
                      onClick={() => setSelectedBill(null)}
                      className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 transition"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
