import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Switch } from '@headlessui/react'
import { api } from '../api'
import { formatCurrency } from '../utils/formatters'
import {
  ArrowLeftIcon,
  CurrencyDollarIcon,
  BuildingStorefrontIcon,
  TagIcon,
  CalendarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  PlusIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
import AddPriceModal from '../components/modals/AddPriceModal'

export default function PriceBookItemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAddPriceModalOpen, setIsAddPriceModalOpen] = useState(false)

  useEffect(() => {
    loadItem()
  }, [id])

  const loadItem = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/pricebook/${id}`)
      setItem(response)
    } catch (err) {
      setError('Failed to load price book item')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSetDefaultSupplier = async (e, supplierId) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    console.log('Setting default supplier:', supplierId)

    try {
      const response = await api.post(`/api/v1/pricebook/${id}/set_default_supplier`, {
        supplier_id: supplierId
      })
      console.log('Response:', response)
      // Reload item to reflect the new default supplier
      await loadItem()
    } catch (err) {
      console.error('Failed to set default supplier:', err)
      alert('Failed to set default supplier. Please try again.')
    }
  }

  const Badge = ({ color, children }) => {
    const colorClasses = {
      green: 'bg-green-500/15 text-green-700 dark:bg-green-500/10 dark:text-green-400',
      yellow: 'bg-yellow-400/20 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500',
      orange: 'bg-orange-400/20 text-orange-700 dark:bg-orange-400/10 dark:text-orange-500',
      red: 'bg-red-500/15 text-red-700 dark:bg-red-500/10 dark:text-red-400',
      gray: 'bg-gray-400/20 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400'
    }

    return (
      <span className={`inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium ${colorClasses[color] || colorClasses.gray}`}>
        <svg className={`h-1.5 w-1.5 fill-current`} viewBox="0 0 6 6" aria-hidden="true">
          <circle cx={3} cy={3} r={3} />
        </svg>
        {children}
      </span>
    )
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTimeAgo = (days) => {
    if (days === null || days === undefined) return 'Unknown'
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 30) return `${days} days ago`
    if (days < 365) {
      const months = Math.floor(days / 30)
      return `${months} ${months === 1 ? 'month' : 'months'} ago`
    }
    const years = Math.floor(days / 365)
    return `${years} ${years === 1 ? 'year' : 'years'} ago`
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">Error loading item</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/price-books')}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Price Books
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/price-books')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Price Books
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {item.item_name}
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Code: {item.item_code}
              </p>
            </div>
            <div className="flex gap-2">
              {item.price_freshness && (
                <Badge color={item.price_freshness.color}>
                  {item.price_freshness.label}
                </Badge>
              )}
              {item.risk && (
                <Badge color={item.risk.color}>
                  {item.risk.label}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Information Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CurrencyDollarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Pricing Information
              </h2>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Price</dt>
                  <dd className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                    {item.current_price ? formatCurrency(item.current_price, false) : 'No price set'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Unit of Measure</dt>
                  <dd className="mt-1 text-lg text-gray-900 dark:text-white">
                    {item.unit_of_measure}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatDate(item.price_last_updated_at)}
                    {item.price_age_days !== null && (
                      <span className="ml-2 text-gray-500 dark:text-gray-400">
                        ({formatTimeAgo(item.price_age_days)})
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Price Volatility</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      item.price_volatility === 'stable' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      item.price_volatility === 'moderate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      item.price_volatility === 'volatile' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {item.price_volatility || 'Unknown'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Item Details Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TagIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Item Details
              </h2>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {item.category || 'Uncategorized'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Brand</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {item.brand || '-'}
                  </dd>
                </div>
                {item.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {item.notes}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Price History Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <ChartBarIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Price History
                </h2>
                <button
                  onClick={() => setIsAddPriceModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Price
                </button>
              </div>

              {item.price_histories && item.price_histories.length > 0 ? (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Old Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">New Price</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Change</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Default</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Supplier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {item.price_histories.slice(0, 10).map((history, idx) => {
                        const change = history.new_price - history.old_price
                        const changePercent = history.old_price ? ((change / history.old_price) * 100).toFixed(1) : 0
                        const isDefaultSupplier = history.supplier && item.default_supplier && history.supplier.id === item.default_supplier.id

                        return (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                              {formatDate(history.created_at)}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                              {history.old_price ? formatCurrency(history.old_price, false) : '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white font-medium">
                              {formatCurrency(history.new_price, false)}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <span className={change > 0 ? 'text-red-600 dark:text-red-400' : change < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}>
                                {change > 0 ? '+' : ''}{formatCurrency(change, false)}
                                {changePercent !== 0 && ` (${change > 0 ? '+' : ''}${changePercent}%)`}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              {history.supplier ? (
                                <div className="inline-block pointer-events-auto">
                                  <Switch
                                    checked={isDefaultSupplier}
                                    onChange={() => handleSetDefaultSupplier(null, history.supplier.id)}
                                    className={`${
                                      isDefaultSupplier ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                                    } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer`}
                                  >
                                    <span className="sr-only">Set {history.supplier.name} as default supplier</span>
                                    <span
                                      className={`${
                                        isDefaultSupplier ? 'translate-x-5' : 'translate-x-0.5'
                                      } inline-block h-4 w-4 transform rounded-full bg-white transition-transform pointer-events-none`}
                                    />
                                  </Switch>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                              {history.supplier?.name || '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No price changes recorded yet
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Price history will appear here when prices are updated
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Supplier Card */}
            {item.supplier && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <BuildingStorefrontIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Supplier
                </h2>

                <div className="space-y-3">
                  <div>
                    <Link
                      to={`/suppliers/${item.supplier.id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      {item.supplier.name}
                    </Link>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Reliability:</span>
                      <div className="mt-1">
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full"
                              style={{ width: `${item.supplier_reliability}%` }}
                            />
                          </div>
                          <span className="ml-2 text-gray-900 dark:text-white font-medium">
                            {item.supplier_reliability}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Risk Breakdown Card */}
            {item.risk && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <ShieldCheckIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Risk Analysis
                </h2>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Overall Risk Score</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{item.risk.score}/100</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.risk.score < 25 ? 'bg-green-500' :
                          item.risk.score < 50 ? 'bg-yellow-500' :
                          item.risk.score < 75 ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${item.risk.score}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Risk Factors</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <ClockIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Price Age: </span>
                          <span className="text-gray-900 dark:text-white">
                            {item.price_freshness?.label || 'Unknown'}
                          </span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <ChartBarIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Volatility: </span>
                          <span className="text-gray-900 dark:text-white capitalize">
                            {item.price_volatility || 'Unknown'}
                          </span>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <BuildingStorefrontIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Supplier Reliability: </span>
                          <span className="text-gray-900 dark:text-white">
                            {item.supplier_reliability}%
                          </span>
                        </div>
                      </li>
                      {!item.supplier && (
                        <li className="flex items-start gap-2">
                          <ExclamationTriangleIcon className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span className="text-orange-600 dark:text-orange-400">No supplier assigned</span>
                        </li>
                      )}
                      {!item.brand && (
                        <li className="flex items-start gap-2">
                          <ExclamationTriangleIcon className="h-4 w-4 text-orange-500 mt-0.5" />
                          <span className="text-orange-600 dark:text-orange-400">No brand specified</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Price Modal */}
      <AddPriceModal
        isOpen={isAddPriceModalOpen}
        onClose={() => setIsAddPriceModalOpen(false)}
        itemId={id}
        onSuccess={loadItem}
      />
    </div>
  )
}
