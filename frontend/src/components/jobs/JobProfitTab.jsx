import { useState, useEffect } from 'react'
import {
  ArrowPathIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ReceiptPercentIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

// Format currency with proper formatting
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '$0.00'
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

// Format percentage
const formatPercentage = (value) => {
  if (value === null || value === undefined) return '0.0%'
  const num = typeof value === 'string' ? parseFloat(value) : value
  return `${num.toFixed(1)}%`
}

export default function JobProfitTab({ job }) {
  // Invoice/Revenue data
  const [invoices, setInvoices] = useState([])
  const [creditNotes, setCreditNotes] = useState([])
  const [quotes, setQuotes] = useState([])

  // Bills/Costs data
  const [bills, setBills] = useState([])
  const [supplierCreditNotes, setSupplierCreditNotes] = useState([])

  // Loading states
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)

  // Load data when job changes
  useEffect(() => {
    if (job?.id) {
      loadFinancialData()
    } else {
      setLoading(false)
    }
  }, [job?.id])

  const loadFinancialData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.get(`/api/v1/external_invoices/by_job/${job.id}`)

      if (response.success) {
        // Revenue side
        setInvoices(response.data?.invoices || [])
        setCreditNotes(response.data?.credit_notes || [])
        setQuotes(response.data?.quotes || [])
        // Cost side
        setBills(response.data?.bills || [])
        setSupplierCreditNotes(response.data?.supplier_credit_notes || [])
        setLastSyncedAt(response.meta?.last_synced_at)
      } else {
        setError(response.error || 'Failed to load financial data')
      }
    } catch (err) {
      console.error('Failed to load financial data:', err)
      setError('Failed to load financial data')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setSyncing(true)
    await loadFinancialData()
    setSyncing(false)
  }

  // Calculate totals (excluding deleted/voided)
  const activeInvoices = invoices.filter(inv => inv.status !== 'DELETED' && inv.status !== 'VOIDED')
  const activeBills = bills.filter(bill => bill.status !== 'DELETED' && bill.status !== 'VOIDED')
  const activeCreditNotes = creditNotes.filter(cn => cn.status !== 'DELETED' && cn.status !== 'VOIDED')
  const activeSupplierCredits = supplierCreditNotes.filter(cn => cn.status !== 'DELETED' && cn.status !== 'VOIDED')

  // Revenue calculations
  const totalInvoiced = activeInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
  const totalCreditNotes = activeCreditNotes.reduce((sum, cn) => sum + (parseFloat(cn.total) || 0), 0)
  const netRevenue = totalInvoiced - totalCreditNotes

  // Paid invoices
  const paidInvoices = activeInvoices.filter(inv => inv.status === 'PAID')
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
  const totalOutstanding = netRevenue - totalPaid

  // Cost calculations
  const totalBills = activeBills.reduce((sum, bill) => sum + (parseFloat(bill.total) || 0), 0)
  const totalSupplierCredits = activeSupplierCredits.reduce((sum, cn) => sum + (parseFloat(cn.total) || 0), 0)
  const netCosts = totalBills - totalSupplierCredits

  // Profit calculations
  const grossProfit = netRevenue - netCosts
  const profitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0

  // Quote totals (potential)
  const acceptedQuotes = quotes.filter(q => q.status === 'ACCEPTED')
  const totalQuoted = acceptedQuotes.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <ExclamationTriangleIcon className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ChartBarIcon className="h-6 w-6 text-indigo-600" />
            Profit & Loss Summary
          </h2>
          {lastSyncedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Data as of {new Date(lastSyncedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Profit Card */}
      <div className={`relative overflow-hidden rounded-2xl p-8 ${
        grossProfit >= 0
          ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
          : 'bg-gradient-to-br from-red-500 to-red-700'
      }`}>
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-40 w-40 rounded-full bg-white/10 blur-3xl"></div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            {grossProfit >= 0 ? (
              <ArrowTrendingUpIcon className="h-8 w-8 text-white/80" />
            ) : (
              <ArrowTrendingDownIcon className="h-8 w-8 text-white/80" />
            )}
            <span className="text-white/80 font-medium text-lg">Gross Profit</span>
          </div>
          <div className="text-5xl font-bold text-white mb-2">
            {formatCurrency(grossProfit)}
          </div>
          <div className="flex items-center gap-4 text-white/80">
            <span className="flex items-center gap-1">
              <ReceiptPercentIcon className="h-5 w-5" />
              {formatPercentage(profitMargin)} margin
            </span>
          </div>
        </div>
      </div>

      {/* Financial Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <BanknotesIcon className="h-5 w-5" />
              Revenue (Invoices)
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {/* Invoices */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <DocumentTextIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Invoices</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{activeInvoices.length} invoices</p>
                </div>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totalInvoiced)}
              </span>
            </div>

            {/* Credit Notes */}
            {totalCreditNotes > 0 && (
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <DocumentTextIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Credit Notes</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{activeCreditNotes.length} credits</p>
                  </div>
                </div>
                <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                  -{formatCurrency(totalCreditNotes)}
                </span>
              </div>
            )}

            {/* Net Revenue */}
            <div className="flex items-center justify-between pt-3 border-t-2 border-blue-200 dark:border-blue-800">
              <span className="text-lg font-bold text-gray-900 dark:text-white">Net Revenue</span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(netRevenue)}
              </span>
            </div>

            {/* Payment Status */}
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Paid</span>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(totalPaid)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Outstanding</span>
                <span className={`text-sm font-semibold ${totalOutstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}`}>
                  {formatCurrency(totalOutstanding)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${netRevenue > 0 ? (totalPaid / netRevenue) * 100 : 0}%` }}
                ></div>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
                {netRevenue > 0 ? Math.round((totalPaid / netRevenue) * 100) : 0}% collected
              </p>
            </div>
          </div>
        </div>

        {/* Costs Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <CurrencyDollarIcon className="h-5 w-5" />
              Costs (Bills)
            </h3>
          </div>
          <div className="p-6 space-y-4">
            {/* Bills */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <DocumentTextIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Bills</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{activeBills.length} bills</p>
                </div>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totalBills)}
              </span>
            </div>

            {/* Supplier Credits */}
            {totalSupplierCredits > 0 && (
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <DocumentTextIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Supplier Credits</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{activeSupplierCredits.length} credits</p>
                  </div>
                </div>
                <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                  -{formatCurrency(totalSupplierCredits)}
                </span>
              </div>
            )}

            {/* Net Costs */}
            <div className="flex items-center justify-between pt-3 border-t-2 border-orange-200 dark:border-orange-800">
              <span className="text-lg font-bold text-gray-900 dark:text-white">Net Costs</span>
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(netCosts)}
              </span>
            </div>

            {/* Cost Breakdown */}
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Cost as % of Revenue</p>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    netRevenue > 0 && (netCosts / netRevenue) > 0.8
                      ? 'bg-red-500'
                      : (netCosts / netRevenue) > 0.6
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${netRevenue > 0 ? Math.min((netCosts / netRevenue) * 100, 100) : 0}%` }}
                ></div>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Costs are <span className="font-semibold">{netRevenue > 0 ? Math.round((netCosts / netRevenue) * 100) : 0}%</span> of revenue
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <DocumentTextIcon className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Invoices</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeInvoices.length}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <DocumentTextIcon className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Bills</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeBills.length}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Paid Invoices</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{paidInvoices.length}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <ReceiptPercentIcon className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Margin</span>
          </div>
          <p className={`text-2xl font-bold ${profitMargin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatPercentage(profitMargin)}
          </p>
        </div>
      </div>

      {/* Detailed P&L Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Profit & Loss Statement
          </h3>
        </div>
        <div className="p-6">
          <table className="w-full">
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {/* Revenue Section */}
              <tr>
                <td colSpan="2" className="py-3">
                  <span className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Revenue</span>
                </td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-sm text-gray-600 dark:text-gray-400">Sales Invoices</td>
                <td className="py-2 text-right text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(totalInvoiced)}</td>
              </tr>
              {totalCreditNotes > 0 && (
                <tr>
                  <td className="py-2 pl-4 text-sm text-gray-600 dark:text-gray-400">Less: Credit Notes</td>
                  <td className="py-2 text-right text-sm font-medium text-red-600 dark:text-red-400">({formatCurrency(totalCreditNotes)})</td>
                </tr>
              )}
              <tr className="bg-blue-50 dark:bg-blue-900/20">
                <td className="py-3 pl-4 text-sm font-bold text-blue-900 dark:text-blue-300">Net Revenue</td>
                <td className="py-3 text-right text-sm font-bold text-blue-900 dark:text-blue-300">{formatCurrency(netRevenue)}</td>
              </tr>

              {/* Costs Section */}
              <tr>
                <td colSpan="2" className="py-3 pt-6">
                  <span className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Cost of Sales</span>
                </td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-sm text-gray-600 dark:text-gray-400">Bills / Expenses</td>
                <td className="py-2 text-right text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(totalBills)}</td>
              </tr>
              {totalSupplierCredits > 0 && (
                <tr>
                  <td className="py-2 pl-4 text-sm text-gray-600 dark:text-gray-400">Less: Supplier Credits</td>
                  <td className="py-2 text-right text-sm font-medium text-green-600 dark:text-green-400">({formatCurrency(totalSupplierCredits)})</td>
                </tr>
              )}
              <tr className="bg-orange-50 dark:bg-orange-900/20">
                <td className="py-3 pl-4 text-sm font-bold text-orange-900 dark:text-orange-300">Net Costs</td>
                <td className="py-3 text-right text-sm font-bold text-orange-900 dark:text-orange-300">{formatCurrency(netCosts)}</td>
              </tr>

              {/* Profit Section */}
              <tr className={`${grossProfit >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <td className={`py-4 pl-4 text-base font-bold ${grossProfit >= 0 ? 'text-emerald-900 dark:text-emerald-300' : 'text-red-900 dark:text-red-300'}`}>
                  GROSS PROFIT
                </td>
                <td className={`py-4 text-right text-xl font-bold ${grossProfit >= 0 ? 'text-emerald-900 dark:text-emerald-300' : 'text-red-900 dark:text-red-300'}`}>
                  {formatCurrency(grossProfit)}
                </td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-sm text-gray-600 dark:text-gray-400">Gross Profit Margin</td>
                <td className={`py-2 text-right text-sm font-bold ${profitMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatPercentage(profitMargin)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
