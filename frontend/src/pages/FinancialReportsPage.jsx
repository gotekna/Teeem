import { useState, useEffect } from 'react'
import { DocumentChartBarIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import api from '../api'

export default function FinancialReportsPage() {
  const [activeReport, setActiveReport] = useState('balance_sheet')
  const [balanceSheet, setBalanceSheet] = useState(null)
  const [profitLoss, setProfitLoss] = useState(null)
  const [jobProfitability, setJobProfitability] = useState([])
  const [loading, setLoading] = useState(false)

  // Date filters
  const [balanceSheetDate, setBalanceSheetDate] = useState(new Date().toISOString().split('T')[0])
  const [plFromDate, setPlFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [plToDate, setPlToDate] = useState(new Date().toISOString().split('T')[0])
  const [jobFromDate, setJobFromDate] = useState('')
  const [jobToDate, setJobToDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (activeReport === 'balance_sheet') {
      fetchBalanceSheet()
    } else if (activeReport === 'profit_loss') {
      fetchProfitLoss()
    } else if (activeReport === 'job_profitability') {
      fetchJobProfitability()
    }
  }, [activeReport, balanceSheetDate, plFromDate, plToDate, jobFromDate, jobToDate])

  const fetchBalanceSheet = async () => {
    try {
      setLoading(true)
      const response = await api.get('/financial_reports/balance_sheet', {
        params: { as_of_date: balanceSheetDate }
      })
      if (response.data.success) {
        setBalanceSheet(response.data.balance_sheet)
      }
    } catch (err) {
      console.error('Failed to load balance sheet:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchProfitLoss = async () => {
    try {
      setLoading(true)
      const response = await api.get('/financial_reports/profit_loss', {
        params: {
          from_date: plFromDate,
          to_date: plToDate
        }
      })
      if (response.data.success) {
        setProfitLoss(response.data.profit_loss)
      }
    } catch (err) {
      console.error('Failed to load profit & loss:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchJobProfitability = async () => {
    try {
      setLoading(true)
      const params = { to_date: jobToDate }
      if (jobFromDate) params.from_date = jobFromDate

      const response = await api.get('/financial_reports/job_profitability', { params })
      if (response.data.success) {
        setJobProfitability(response.data.jobs)
      }
    } catch (err) {
      console.error('Failed to load job profitability:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExportBalanceSheet = async () => {
    try {
      const response = await api.get('/financial_exports/balance_sheet', {
        params: { as_of_date: balanceSheetDate },
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `balance_sheet_${balanceSheetDate}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Error exporting balance sheet:', err)
      alert('Failed to export balance sheet')
    }
  }

  const handleExportProfitLoss = async () => {
    try {
      const response = await api.get('/financial_exports/profit_loss', {
        params: {
          from_date: plFromDate,
          to_date: plToDate
        },
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `profit_loss_${plFromDate}_${plToDate}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Error exporting profit & loss:', err)
      alert('Failed to export profit & loss')
    }
  }

  const handleExportJobProfitability = async () => {
    try {
      const params = { to_date: jobToDate }
      if (jobFromDate) params.from_date = jobFromDate

      const response = await api.get('/financial_exports/job_profitability', {
        params,
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `job_profitability_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Error exporting job profitability:', err)
      alert('Failed to export job profitability')
    }
  }

  const formatCurrency = (amount) => {
    return `$${(amount || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Financial Reports
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          View balance sheets, profit & loss statements, and job profitability reports
        </p>
      </div>

      {/* Report Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveReport('balance_sheet')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeReport === 'balance_sheet'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Balance Sheet
          </button>
          <button
            onClick={() => setActiveReport('profit_loss')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeReport === 'profit_loss'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Profit & Loss
          </button>
          <button
            onClick={() => setActiveReport('job_profitability')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeReport === 'job_profitability'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Job Profitability
          </button>
        </nav>
      </div>

      {/* Balance Sheet */}
      {activeReport === 'balance_sheet' && (
        <div>
          {/* Filters */}
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  As of Date:
                </label>
                <input
                  type="date"
                  value={balanceSheetDate}
                  onChange={(e) => setBalanceSheetDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <button
                onClick={handleExportBalanceSheet}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Balance Sheet Report */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading balance sheet...</p>
            </div>
          ) : balanceSheet ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Balance Sheet as of {balanceSheetDate}
                </h3>

                {/* Assets */}
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    Assets
                  </h4>
                  {Object.entries(balanceSheet.assets?.details || {}).map(([account, amount]) => (
                    <div key={account} className="flex justify-between py-2 px-4 text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{account}</span>
                      <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 px-4 text-sm font-bold border-t border-gray-200 dark:border-gray-600 mt-2">
                    <span className="text-gray-900 dark:text-white">Total Assets</span>
                    <span className="text-gray-900 dark:text-white">{formatCurrency(balanceSheet.assets?.total)}</span>
                  </div>
                </div>

                {/* Liabilities */}
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    Liabilities
                  </h4>
                  {Object.entries(balanceSheet.liabilities?.details || {}).map(([account, amount]) => (
                    <div key={account} className="flex justify-between py-2 px-4 text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{account}</span>
                      <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 px-4 text-sm font-bold border-t border-gray-200 dark:border-gray-600 mt-2">
                    <span className="text-gray-900 dark:text-white">Total Liabilities</span>
                    <span className="text-gray-900 dark:text-white">{formatCurrency(balanceSheet.liabilities?.total)}</span>
                  </div>
                </div>

                {/* Equity */}
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    Equity
                  </h4>
                  {Object.entries(balanceSheet.equity?.details || {}).map(([account, amount]) => (
                    <div key={account} className="flex justify-between py-2 px-4 text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{account}</span>
                      <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 px-4 text-sm font-bold border-t border-gray-200 dark:border-gray-600 mt-2">
                    <span className="text-gray-900 dark:text-white">Total Equity</span>
                    <span className="text-gray-900 dark:text-white">{formatCurrency(balanceSheet.equity?.total)}</span>
                  </div>
                </div>

                {/* Balance Check */}
                <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4 mt-6">
                  <div className="flex justify-between py-2 px-4 text-lg font-bold">
                    <span className="text-gray-900 dark:text-white">Total Liabilities + Equity</span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency((balanceSheet.liabilities?.total || 0) + (balanceSheet.equity?.total || 0))}
                    </span>
                  </div>
                  {balanceSheet.balanced ? (
                    <p className="text-sm text-green-600 dark:text-green-400 text-center mt-2">
                      ✓ Balance Sheet is balanced
                    </p>
                  ) : (
                    <p className="text-sm text-red-600 dark:text-red-400 text-center mt-2">
                      ✗ Balance Sheet does not balance
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No balance sheet data available
            </div>
          )}
        </div>
      )}

      {/* Profit & Loss */}
      {activeReport === 'profit_loss' && (
        <div>
          {/* Filters */}
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  From:
                </label>
                <input
                  type="date"
                  value={plFromDate}
                  onChange={(e) => setPlFromDate(e.target.value)}
                  max={plToDate}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  To:
                </label>
                <input
                  type="date"
                  value={plToDate}
                  onChange={(e) => setPlToDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <button
                onClick={handleExportProfitLoss}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* P&L Report */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading profit & loss...</p>
            </div>
          ) : profitLoss ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Profit & Loss Statement
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {plFromDate} to {plToDate}
                </p>

                {/* Revenue */}
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                    Revenue
                  </h4>
                  {Object.entries(profitLoss.revenue?.details || {}).map(([category, amount]) => (
                    <div key={category} className="flex justify-between py-2 px-4 text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{category}</span>
                      <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 px-4 text-sm font-bold border-t border-gray-200 dark:border-gray-600 mt-2">
                    <span className="text-gray-900 dark:text-white">Total Revenue</span>
                    <span className="text-green-600 dark:text-green-400">{formatCurrency(profitLoss.revenue?.total)}</span>
                  </div>
                </div>

                {/* Expenses */}
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-3 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    Expenses
                  </h4>
                  {Object.entries(profitLoss.expenses?.details || {}).map(([category, amount]) => (
                    <div key={category} className="flex justify-between py-2 px-4 text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{category}</span>
                      <span className="text-red-600 dark:text-red-400 font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 px-4 text-sm font-bold border-t border-gray-200 dark:border-gray-600 mt-2">
                    <span className="text-gray-900 dark:text-white">Total Expenses</span>
                    <span className="text-red-600 dark:text-red-400">{formatCurrency(profitLoss.expenses?.total)}</span>
                  </div>
                </div>

                {/* Net Profit */}
                <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4 mt-6">
                  <div className="flex justify-between py-2 px-4 text-lg font-bold">
                    <span className="text-gray-900 dark:text-white">Net Profit</span>
                    <span className={
                      (profitLoss.net_profit || 0) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }>
                      {formatCurrency(profitLoss.net_profit)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 px-4 text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Profit Margin</span>
                    <span className={
                      (profitLoss.profit_margin || 0) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }>
                      {profitLoss.profit_margin}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No profit & loss data available
            </div>
          )}
        </div>
      )}

      {/* Job Profitability */}
      {activeReport === 'job_profitability' && (
        <div>
          {/* Filters */}
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  From (optional):
                </label>
                <input
                  type="date"
                  value={jobFromDate}
                  onChange={(e) => setJobFromDate(e.target.value)}
                  max={jobToDate}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  To:
                </label>
                <input
                  type="date"
                  value={jobToDate}
                  onChange={(e) => setJobToDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <button
                onClick={handleExportJobProfitability}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Job Profitability Report */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading job profitability...</p>
            </div>
          ) : jobProfitability.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Job Name
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Income
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Expenses
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Net Profit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Margin
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {jobProfitability.map((job) => (
                    <tr key={job.construction_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {job.job_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 text-right">
                        {formatCurrency(job.income)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400 text-right">
                        {formatCurrency(job.expenses)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                        (job.net_profit || 0) >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatCurrency(job.net_profit)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                        (job.profit_margin || 0) >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {job.profit_margin}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No job profitability data available
            </div>
          )}
        </div>
      )}
    </div>
  )
}
