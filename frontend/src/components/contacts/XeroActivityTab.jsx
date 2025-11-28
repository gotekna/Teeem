import { useState, useEffect, Fragment } from 'react'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ReceiptRefundIcon,
  ClipboardDocumentListIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LinkIcon
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
          setXeroInvoices(invoicesResponse.data?.invoices || [])
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

      // Load payments
      try {
        const paymentsResponse = await api.get(`/api/v1/xero/payments?contact_id=${xeroContactId}${tenantParam}`)
        if (paymentsResponse.success) {
          setXeroPayments(paymentsResponse.data?.payments || [])
        }
      } catch (err) {
        console.log('Payments endpoint not available')
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
      icon: DocumentTextIcon,
      fields: [
        { xeroField: 'InvoiceNumber', teeemField: 'invoice_number', label: 'Invoice Number', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Reference', teeemField: 'reference', label: 'Reference', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Type', teeemField: 'invoice_type', label: 'Type (ACCPAY/ACCREC)', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Status', teeemField: 'status', label: 'Status', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Date', teeemField: 'issue_date', label: 'Issue Date', syncDirection: 'xero_to_teeem' },
        { xeroField: 'DueDate', teeemField: 'due_date', label: 'Due Date', syncDirection: 'xero_to_teeem' },
        { xeroField: 'SubTotal', teeemField: 'subtotal', label: 'Subtotal', syncDirection: 'xero_to_teeem' },
        { xeroField: 'TotalTax', teeemField: 'total_tax', label: 'Total Tax', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Total', teeemField: 'total', label: 'Total', syncDirection: 'xero_to_teeem' },
        { xeroField: 'AmountDue', teeemField: 'amount_due', label: 'Amount Due', syncDirection: 'xero_to_teeem' },
        { xeroField: 'AmountPaid', teeemField: 'amount_paid', label: 'Amount Paid', syncDirection: 'xero_to_teeem' },
        { xeroField: 'CurrencyCode', teeemField: 'currency', label: 'Currency', syncDirection: 'xero_to_teeem' },
      ]
    },
    {
      section: 'Payment Fields',
      icon: CurrencyDollarIcon,
      fields: [
        { xeroField: 'PaymentID', teeemField: 'xero_payment_id', label: 'Payment ID', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Date', teeemField: 'payment_date', label: 'Payment Date', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Amount', teeemField: 'amount', label: 'Amount', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Reference', teeemField: 'reference', label: 'Reference', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Status', teeemField: 'status', label: 'Status', syncDirection: 'xero_to_teeem' },
      ]
    },
    {
      section: 'Credit Note Fields',
      icon: ReceiptRefundIcon,
      fields: [
        { xeroField: 'CreditNoteNumber', teeemField: 'credit_note_number', label: 'Credit Note Number', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Reference', teeemField: 'reference', label: 'Reference', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Type', teeemField: 'type', label: 'Type', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Status', teeemField: 'status', label: 'Status', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Date', teeemField: 'date', label: 'Date', syncDirection: 'xero_to_teeem' },
        { xeroField: 'Total', teeemField: 'total', label: 'Total', syncDirection: 'xero_to_teeem' },
        { xeroField: 'RemainingCredit', teeemField: 'remaining_credit', label: 'Remaining Credit', syncDirection: 'xero_to_teeem' },
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleSection('invoices')}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-blue-500" />
                <span className="font-medium text-gray-900 dark:text-white">
                  Invoices ({xeroInvoices.length})
                </span>
              </div>
              {expandedSections.invoices ? (
                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>

            {expandedSections.invoices && (
              <div className="overflow-x-auto">
                {xeroInvoices.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Number</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reference</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {xeroInvoices.map((invoice, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                            {invoice.InvoiceNumber || '-'}
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
                  </table>
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No invoices found in Xero
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payments Section */}
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
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reference</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {xeroPayments.map((payment, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
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
                  </table>
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No payments found in Xero
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Credit Notes Section */}
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
                  </table>
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No credit notes found in Xero
                  </div>
                )}
              </div>
            )}
          </div>

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
                  {activityFieldMappings.map(section => (
                    <Fragment key={`section-${section.section}`}>
                      <tr className="bg-gray-100 dark:bg-gray-700/50">
                        <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                          {section.section}
                        </td>
                      </tr>
                      {section.fields.map(field => (
                        <tr key={field.xeroField} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
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
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
