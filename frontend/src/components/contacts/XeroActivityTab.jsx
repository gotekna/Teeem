import { useState, useEffect } from 'react'
import {
  ArrowPathIcon,
  XCircleIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ReceiptRefundIcon,
  ClipboardDocumentListIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LinkIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function XeroActivityTab({ contact, onContactUpdate }) {
  // Transaction data from Xero
  const [xeroInvoices, setXeroInvoices] = useState([])
  const [xeroCreditNotes, setXeroCreditNotes] = useState([])
  const [xeroPayments, setXeroPayments] = useState([])
  const [xeroQuotes, setXeroQuotes] = useState([])

  // Loading states
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)

  // Invoice detail modal
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [loadingInvoiceDetail, setLoadingInvoiceDetail] = useState(false)

  // Xero link info
  const [xeroLinks, setXeroLinks] = useState([])
  const [selectedLinkId, setSelectedLinkId] = useState(null)

  // Sync configuration
  const [syncConfig, setSyncConfig] = useState(null)

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    invoices: true,
    creditNotes: true,
    payments: true,
    quotes: false
  })

  // Show/hide deleted items
  const [showDeleted, setShowDeleted] = useState(false)

  // Load Xero links on mount
  useEffect(() => {
    if (contact?.id) {
      loadXeroLinks()
    }
  }, [contact?.id])

  // Load transactions when link is selected
  useEffect(() => {
    if (selectedLinkId) {
      loadTransactions()
    }
  }, [selectedLinkId])

  const loadXeroLinks = async () => {
    try {
      const response = await api.get(`/api/v1/contacts/${contact.id}/xero_links`)
      if (response.success) {
        const links = response.xero_links || []
        setXeroLinks(links)
        if (links.length > 0 && !selectedLinkId) {
          setSelectedLinkId(links[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load Xero links:', err)
    }
  }

  const loadTransactions = async () => {
    setLoading(true)
    setError(null)

    try {
      const selectedLink = xeroLinks.find(l => l.id === selectedLinkId)
      const xeroContactId = selectedLink?.xero_contact_id
      const xeroTenantId = selectedLink?.xero_tenant_id

      if (!xeroContactId) {
        setLoading(false)
        return
      }

      const tenantParam = xeroTenantId ? `&tenant_id=${xeroTenantId}` : ''

      // Load sync config
      if (xeroTenantId) {
        try {
          const configResponse = await api.get(`/api/v1/sync_configurations/${xeroTenantId}`)
          if (configResponse.success) {
            setSyncConfig(configResponse.sync_configuration)
          }
        } catch (err) {
          console.error('Failed to load sync config:', err)
        }
      }

      // Load invoices
      try {
        const invoicesResponse = await api.get(`/api/v1/xero/invoices?contact_id=${xeroContactId}${tenantParam}`)
        if (invoicesResponse.success) {
          const invoices = invoicesResponse.data?.invoices || []
          setXeroInvoices(invoices)

          // Extract payments from invoices (already filtered by contact)
          const extractedPayments = []
          invoices.forEach(invoice => {
            if (invoice.Payments && invoice.Payments.length > 0) {
              invoice.Payments.forEach(payment => {
                extractedPayments.push({
                  ...payment,
                  InvoiceNumber: invoice.InvoiceNumber,
                  InvoiceID: invoice.InvoiceID
                })
              })
            }
          })
          // Sort by date descending
          extractedPayments.sort((a, b) => {
            const dateA = a.Date ? new Date(a.Date.replace('/Date(', '').replace(')/', '')) : 0
            const dateB = b.Date ? new Date(b.Date.replace('/Date(', '').replace(')/', '')) : 0
            return dateB - dateA
          })
          setXeroPayments(extractedPayments)
        }
      } catch (err) {
        console.error('Failed to load invoices:', err)
      }

      // Load credit notes
      try {
        const creditNotesResponse = await api.get(`/api/v1/xero/credit_notes?contact_id=${xeroContactId}${tenantParam}`)
        if (creditNotesResponse.success) {
          setXeroCreditNotes(creditNotesResponse.data?.credit_notes || [])
        }
      } catch (err) {
        console.log('Credit notes endpoint not available')
      }

      // Load quotes
      try {
        const quotesResponse = await api.get(`/api/v1/xero/quotes?contact_id=${xeroContactId}${tenantParam}`)
        if (quotesResponse.success) {
          setXeroQuotes(quotesResponse.data?.quotes || [])
        }
      } catch (err) {
        console.log('Quotes endpoint not available')
      }
    } catch (err) {
      setError('Failed to load Xero transactions')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncTransactions = async () => {
    setSyncing(true)
    setError(null)

    try {
      // TODO: Implement transaction sync to TEEEM
      // For now, just reload the data
      await loadTransactions()
    } catch (err) {
      setError('Failed to sync transactions')
    } finally {
      setSyncing(false)
    }
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Fetch full invoice details for modal
  const fetchInvoiceDetail = async (invoiceId) => {
    setLoadingInvoiceDetail(true)
    try {
      const selectedLink = xeroLinks.find(l => l.id === selectedLinkId)
      const tenantParam = selectedLink?.xero_tenant_id ? `?tenant_id=${selectedLink.xero_tenant_id}` : ''
      const response = await api.get(`/api/v1/xero/invoices/${invoiceId}${tenantParam}`)
      if (response.success && response.data) {
        setSelectedInvoice(response.data)
      }
    } catch (err) {
      console.error('Failed to fetch invoice details:', err)
    } finally {
      setLoadingInvoiceDetail(false)
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
    const statusMap = {
      'DRAFT': { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: 'Draft' },
      'SUBMITTED': { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', label: 'Submitted' },
      'AUTHORISED': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', label: 'Authorised' },
      'PAID': { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', label: 'Paid' },
      'VOIDED': { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', label: 'Voided' },
      'DELETED': { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', label: 'Deleted' },
      'SENT': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300', label: 'Sent' },
      'ACCEPTED': { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', label: 'Accepted' },
      'DECLINED': { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', label: 'Declined' },
    }
    const statusInfo = statusMap[status] || { color: 'bg-gray-100 text-gray-800', label: status }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    )
  }

  const selectedLink = xeroLinks.find(l => l.id === selectedLinkId)
  const hasXeroConnection = xeroLinks.length > 0 && selectedLink?.xero_contact_id

  // Field mapping definitions for Activity sync
  const activityFieldMappings = [
    {
      section: 'Invoice Fields',
      fields: [
        { xeroField: 'InvoiceNumber', teeemField: 'invoice_number' },
        { xeroField: 'Reference', teeemField: 'reference' },
        { xeroField: 'Type', teeemField: 'invoice_type' },
        { xeroField: 'Status', teeemField: 'status' },
        { xeroField: 'Date', teeemField: 'issue_date' },
        { xeroField: 'DueDate', teeemField: 'due_date' },
        { xeroField: 'SubTotal', teeemField: 'subtotal' },
        { xeroField: 'TotalTax', teeemField: 'total_tax' },
        { xeroField: 'Total', teeemField: 'total' },
        { xeroField: 'AmountDue', teeemField: 'amount_due' },
        { xeroField: 'AmountPaid', teeemField: 'amount_paid' },
        { xeroField: 'CurrencyCode', teeemField: 'currency' },
      ]
    },
    {
      section: 'Payment Fields',
      fields: [
        { xeroField: 'PaymentID', teeemField: 'xero_payment_id' },
        { xeroField: 'Date', teeemField: 'payment_date' },
        { xeroField: 'Amount', teeemField: 'amount' },
        { xeroField: 'Reference', teeemField: 'reference' },
        { xeroField: 'Status', teeemField: 'status' },
      ]
    },
    {
      section: 'Credit Note Fields',
      fields: [
        { xeroField: 'CreditNoteNumber', teeemField: 'credit_note_number' },
        { xeroField: 'Reference', teeemField: 'reference' },
        { xeroField: 'Type', teeemField: 'type' },
        { xeroField: 'Status', teeemField: 'status' },
        { xeroField: 'Date', teeemField: 'date' },
        { xeroField: 'Total', teeemField: 'total' },
        { xeroField: 'RemainingCredit', teeemField: 'remaining_credit' },
      ]
    }
  ]

  if (!hasXeroConnection) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <LinkIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No Xero Connection</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Link this contact to Xero first to view activity.
          </p>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Go to the "XERO Sync" tab to link this contact.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with sync button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Xero Activity</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Invoices, payments, and credit notes from Xero
          </p>
        </div>
        <button
          onClick={handleSyncTransactions}
          disabled={syncing || loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          <ArrowPathIcon className={`-ml-1 mr-2 h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      {/* Link selector if multiple links */}
      {xeroLinks.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Organization:</span>
          <select
            value={selectedLinkId || ''}
            onChange={(e) => setSelectedLinkId(Number(e.target.value))}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800"
          >
            {xeroLinks.map(link => (
              <option key={link.id} value={link.id}>
                {link.xero_tenant_name || 'Unknown Organization'}
              </option>
            ))}
          </select>
        </div>
      )}

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
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading Xero activity...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <DocumentTextIcon className="h-5 w-5 text-blue-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Invoices</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {xeroInvoices.length}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CurrencyDollarIcon className="h-5 w-5 text-green-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Payments</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {xeroPayments.length}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <ReceiptRefundIcon className="h-5 w-5 text-orange-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Credit Notes</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {xeroCreditNotes.length}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardDocumentListIcon className="h-5 w-5 text-purple-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Quotes</span>
              </div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {xeroQuotes.length}
              </div>
            </div>
          </div>

          {/* Invoices Section */}
          {(() => {
            const filteredInvoices = showDeleted
              ? xeroInvoices
              : xeroInvoices.filter(inv => inv.Status !== 'DELETED' && inv.Status !== 'VOIDED')
            const deletedCount = xeroInvoices.length - xeroInvoices.filter(inv => inv.Status !== 'DELETED' && inv.Status !== 'VOIDED').length
            const invoiceTotal = filteredInvoices.reduce((sum, inv) => sum + (inv.Total || 0), 0)
            const invoiceDueTotal = filteredInvoices.reduce((sum, inv) => sum + (inv.AmountDue || 0), 0)

            return (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => toggleSection('invoices')}
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-blue-500" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      Invoices ({filteredInvoices.length})
                    </span>
                    {deletedCount > 0 && !showDeleted && (
                      <span className="text-xs text-gray-400">
                        +{deletedCount} deleted
                      </span>
                    )}
                  </div>
                  {expandedSections.invoices ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {expandedSections.invoices && (
                  <div className="overflow-x-auto">
                    {filteredInvoices.length > 0 ? (
                      <>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Number</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reference</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due Date</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredInvoices.map((invoice, idx) => (
                              <tr
                                key={idx}
                                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                                onClick={() => fetchInvoiceDetail(invoice.InvoiceID)}
                              >
                                <td className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                                  {invoice.InvoiceNumber || '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={invoice.LineItems?.[0]?.Description || ''}>
                                  {invoice.LineItems?.[0]?.Description || '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                  {invoice.Reference || '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                  {formatDate(invoice.Date)}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                  {formatDate(invoice.DueDate)}
                                </td>
                                <td className="px-4 py-2">
                                  {getStatusBadge(invoice.Status)}
                                </td>
                                <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                                  {formatCurrency(invoice.Total)}
                                </td>
                                <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                                  {formatCurrency(invoice.AmountDue)}
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
                                {formatCurrency(invoiceTotal)}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-bold text-gray-900 dark:text-white">
                                {formatCurrency(invoiceDueTotal)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                        {deletedCount > 0 && (
                          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowDeleted(!showDeleted); }}
                              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              {showDeleted ? 'Hide deleted/voided' : `Show ${deletedCount} deleted/voided`}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        No invoices found in Xero
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Payments Section */}
          {(() => {
            const paymentTotal = xeroPayments.reduce((sum, p) => sum + (p.Amount || 0), 0)

            return (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => toggleSection('payments')}
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <CurrencyDollarIcon className="h-5 w-5 text-green-500" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      Payments ({xeroPayments.length})
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
                    {xeroPayments.length > 0 ? (
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Invoice</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reference</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {xeroPayments.map((payment, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                {payment.InvoiceNumber || '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                {formatDate(payment.Date)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                {payment.Reference || '-'}
                              </td>
                              <td className="px-4 py-2">
                                {getStatusBadge(payment.Status)}
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
                              {formatCurrency(paymentTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        No payments found for this contact
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Credit Notes Section */}
          {(() => {
            const creditNoteTotal = xeroCreditNotes.reduce((sum, cn) => sum + (cn.Total || 0), 0)
            const creditNoteRemaining = xeroCreditNotes.reduce((sum, cn) => sum + (cn.RemainingCredit || 0), 0)

            return (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => toggleSection('creditNotes')}
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <ReceiptRefundIcon className="h-5 w-5 text-orange-500" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      Credit Notes ({xeroCreditNotes.length})
                    </span>
                  </div>
                  {expandedSections.creditNotes ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {expandedSections.creditNotes && (
                  <div className="overflow-x-auto">
                    {xeroCreditNotes.length > 0 ? (
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Number</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reference</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Remaining</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {xeroCreditNotes.map((cn, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                {cn.CreditNoteNumber || '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                {cn.Reference || '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                {formatDate(cn.Date)}
                              </td>
                              <td className="px-4 py-2">
                                {getStatusBadge(cn.Status)}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                                {formatCurrency(cn.Total)}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-medium text-orange-600 dark:text-orange-400">
                                {formatCurrency(cn.RemainingCredit)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-300 dark:border-gray-600">
                          <tr>
                            <td colSpan={4} className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white text-right">
                              Total
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-bold text-gray-900 dark:text-white">
                              {formatCurrency(creditNoteTotal)}
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-bold text-orange-600 dark:text-orange-400">
                              {formatCurrency(creditNoteRemaining)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        No credit notes found in Xero
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Quotes Section */}
          {xeroQuotes.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => toggleSection('quotes')}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-5 w-5 text-purple-500" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    Quotes ({xeroQuotes.length})
                  </span>
                </div>
                {expandedSections.quotes ? (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedSections.quotes && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Number</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {xeroQuotes.map((quote, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                            {quote.QuoteNumber || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {quote.Title || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(quote.Date)}
                          </td>
                          <td className="px-4 py-2">
                            {getStatusBadge(quote.Status)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                            {formatCurrency(quote.Total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Field Mappings Reference */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white">Field Mappings</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                How Xero activity fields map to TEEEM
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Xero Field</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">TEEEM Field</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sync Direction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {activityFieldMappings.flatMap(section => [
                    <tr key={`section-${section.section}`} className="bg-gray-100 dark:bg-gray-700/50">
                      <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                        {section.section}
                      </td>
                    </tr>,
                    ...section.fields.map(field => (
                      <tr key={`${section.section}-${field.xeroField}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                          {field.xeroField}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {field.teeemField}
                        </td>
                        <td className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400">
                          Xero → TEEEM
                        </td>
                      </tr>
                    ))
                  ])}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Invoice Detail Modal */}
      {(selectedInvoice || loadingInvoiceDetail) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setSelectedInvoice(null)}
            />

            {/* Modal */}
            <div className="relative inline-block w-full max-w-4xl p-6 my-8 text-left align-middle bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all">
              {loadingInvoiceDetail ? (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-600 dark:text-gray-300">Loading invoice details...</span>
                </div>
              ) : selectedInvoice && (
                <>
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          Invoice {selectedInvoice.InvoiceNumber}
                        </h2>
                        <span className={`px-3 py-1 rounded text-sm font-medium border ${
                          selectedInvoice.Status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                          selectedInvoice.Status === 'DRAFT' ? 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600' :
                          selectedInvoice.Status === 'AUTHORISED' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' :
                          selectedInvoice.Status === 'DELETED' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                          'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
                        }`}>
                          {selectedInvoice.Status}
                        </span>
                        {selectedInvoice.SentToContact && (
                          <span className="text-green-600 dark:text-green-400 text-sm font-medium">✓ Sent</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {selectedInvoice.Type === 'ACCREC' ? 'Sales Invoice' : 'Bill'}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedInvoice(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Invoice Info */}
                  <div className="grid grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Contact</h3>
                      <p className="text-blue-600 dark:text-blue-400 font-medium">{selectedInvoice.Contact?.Name}</p>
                      {selectedInvoice.Contact?.Addresses?.[0] && (
                        <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {selectedInvoice.Contact.Addresses[0].AddressLine1 && <div>{selectedInvoice.Contact.Addresses[0].AddressLine1}</div>}
                          <div>
                            {[selectedInvoice.Contact.Addresses[0].City, selectedInvoice.Contact.Addresses[0].Region, selectedInvoice.Contact.Addresses[0].PostalCode].filter(Boolean).join(', ')}
                          </div>
                          {selectedInvoice.Contact.Addresses[0].Country && <div>{selectedInvoice.Contact.Addresses[0].Country}</div>}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Issue Date</span>
                        <p className="font-medium text-gray-900 dark:text-white">{formatDate(selectedInvoice.Date)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Due Date</span>
                        <p className="font-medium text-gray-900 dark:text-white">{formatDate(selectedInvoice.DueDate)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Invoice Number</span>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedInvoice.InvoiceNumber}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Reference</span>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedInvoice.Reference || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="mb-6">
                    <div className="text-right text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Amounts are {selectedInvoice.LineAmountTypes === 'Inclusive' ? 'tax inclusive' : 'tax exclusive'}
                    </div>
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Job/Tracking</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit Price</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {selectedInvoice.LineItems?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.ItemCode || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">{item.Description}</td>
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
                        <span className="text-gray-900 dark:text-white">{formatCurrency(selectedInvoice.SubTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Tax</span>
                        <span className="text-gray-900 dark:text-white">{formatCurrency(selectedInvoice.TotalTax)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-600 pt-2">
                        <span className="text-gray-900 dark:text-white">Total</span>
                        <span className="text-green-600 dark:text-green-400">{formatCurrency(selectedInvoice.Total)}</span>
                      </div>
                      {selectedInvoice.Payments?.length > 0 && (
                        <>
                          {selectedInvoice.Payments.map((payment, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-blue-600 dark:text-blue-400">Less: Payment ({formatDate(payment.Date)})</span>
                              <span className="text-gray-900 dark:text-white">{formatCurrency(payment.Amount)}</span>
                            </div>
                          ))}
                        </>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-600 pt-2">
                        <span className="text-gray-900 dark:text-white">Amount Due</span>
                        <span className={selectedInvoice.AmountDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}>
                          {formatCurrency(selectedInvoice.AmountDue)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <a
                      href={`https://go.xero.com/AccountsReceivable/View.aspx?invoiceID=${selectedInvoice.InvoiceID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      <LinkIcon className="h-4 w-4" />
                      View in Xero
                    </a>
                    <button
                      onClick={() => setSelectedInvoice(null)}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition"
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
