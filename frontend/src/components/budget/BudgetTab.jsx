import { useState, useEffect } from 'react'
import { api } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import Badge from '../Badge'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

export default function BudgetTab({ jobId }) {
  const [loading, setLoading] = useState(true)
  const [budgetData, setBudgetData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadBudgetData()
  }, [jobId])

  const loadBudgetData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get(`/api/v1/jobs/${jobId}/budget_tracking`)
      setBudgetData(response)
    } catch (err) {
      console.error('Failed to load budget data:', err)
      setError('Failed to load budget tracking data')
    } finally {
      setLoading(false)
    }
  }

  const getPaymentStatusBadge = (status) => {
    const statusMap = {
      pending: { color: 'gray', label: 'Pending' },
      part_payment: { color: 'yellow', label: 'Part Payment' },
      complete: { color: 'green', label: 'Complete' },
      manual_review: { color: 'red', label: 'Needs Review' },
    }
    const config = statusMap[status] || statusMap.pending
    return <Badge color={config.color} label={config.label} />
  }

  const getVarianceColor = (variance) => {
    if (variance === 0) return 'text-gray-900 dark:text-gray-100'
    if (variance > 0) return 'text-red-600 dark:text-red-400 font-semibold' // Over budget
    return 'text-green-600 dark:text-green-400 font-semibold' // Under budget
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-5 sm:p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-red-200 dark:border-red-700">
        <div className="px-4 py-5 sm:p-6">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={loadBudgetData}
            className="mt-3 inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!budgetData || !budgetData.budget_items || budgetData.budget_items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            Budget Tracking
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No purchase orders yet. Create purchase orders to start tracking your budget.
          </p>
        </div>
      </div>
    )
  }

  const { budget_items, totals } = budgetData

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Budgeted</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(totals.budgeted, false)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Invoiced</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(totals.invoiced, false)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Variance</p>
          <div className="mt-1">
            <p className={`text-2xl font-semibold ${getVarianceColor(totals.variance)}`}>
              {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance, false)}
            </p>
            {totals.budgeted > 0 && (
              <p className={`text-sm ${getVarianceColor(totals.variance)}`}>
                ({totals.variance_percentage >= 0 ? '+' : ''}{totals.variance_percentage.toFixed(2)}%)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Budget Table */}
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Purchase Orders vs Invoiced
            </h3>
            <button
              onClick={loadBudgetData}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    PO Number
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Supplier
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Item / Description
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    Budgeted
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    Invoiced
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    Variance
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-white">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                {budget_items.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {item.po_number}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {item.supplier_name}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                        {item.item_description}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-900 dark:text-white">
                        {formatCurrency(item.budgeted, false)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-900 dark:text-white">
                        {formatCurrency(item.invoiced, false)}
                      </td>
                      <td className={`whitespace-nowrap px-3 py-4 text-sm text-right ${getVarianceColor(item.variance)}`}>
                        {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance, false)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                        {getPaymentStatusBadge(item.payment_status)}
                      </td>
                    </tr>
                  )
                })}

                {/* Totals Row */}
                <tr className="bg-gray-100 dark:bg-gray-900 font-semibold">
                  <td colSpan="3" className="px-3 py-4 text-sm text-gray-900 dark:text-white">
                    Total
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-900 dark:text-white">
                    {formatCurrency(totals.budgeted, false)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-900 dark:text-white">
                    {formatCurrency(totals.invoiced, false)}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-4 text-sm text-right ${getVarianceColor(totals.variance)}`}>
                    {totals.variance >= 0 ? '+' : ''}{formatCurrency(totals.variance, false)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              About Budget Tracking
            </h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <ul className="list-disc pl-5 space-y-1">
                <li>Positive variance (red) = over budget</li>
                <li>Negative variance (green) = under budget</li>
                <li>Invoiced amounts are updated when invoices are matched in the Purchase Orders tab</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
