import { useEffect, useState } from 'react'
import { getTodayAsString } from '../utils/timezoneUtils'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { Switch, Menu, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { api } from '../api'
import { formatCurrency } from '../utils/formatters'

// Get API URL for proxy endpoints
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
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
  EllipsisVerticalIcon,
  TrashIcon,
  PhotoIcon,
  QrCodeIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import AddPriceModal from '../components/modals/AddPriceModal'

export default function PriceBookItemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAddPriceModalOpen, setIsAddPriceModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [historyToDelete, setHistoryToDelete] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [historyToEdit, setHistoryToEdit] = useState(null)
  const [enlargedImage, setEnlargedImage] = useState(null)
  const [isSetDefaultModalOpen, setIsSetDefaultModalOpen] = useState(false)
  const [supplierToSetDefault, setSupplierToSetDefault] = useState(null)
  const [savingBooleans, setSavingBooleans] = useState(false)
  const [showAllPrices, setShowAllPrices] = useState(false)
  const [taxRates, setTaxRates] = useState([])
  const [editingGstCode, setEditingGstCode] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [qrCodeError, setQrCodeError] = useState(false)

  // Helper function to get the correct image URL (proxy if file_id exists, otherwise direct URL)
  const getImageUrl = (fileType) => {
    if (!item) return null

    const fileIdField = `${fileType}_file_id`
    const urlField = `${fileType}_url`

    // If we have a file_id, use the proxy endpoint (never expires, no CORS issues)
    if (item[fileIdField]) {
      return `${API_URL}/api/v1/pricebook/${id}/proxy_image/${fileType}`
    }

    // Otherwise fall back to direct URL (may be SharePoint link or old data)
    return item[urlField]
  }

  useEffect(() => {
    loadItem()
    loadTaxRates()
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

  const loadTaxRates = async () => {
    // Skip Xero API calls on localhost since it requires authentication
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (isLocalhost) {
      return
    }

    try {
      const response = await api.get('/api/v1/xero/tax_rates')
      if (response.success && response.tax_rates) {
        setTaxRates(response.tax_rates)
      }
    } catch (err) {
      console.error('Failed to load tax rates:', err)
      // Don't show error to user, just log it
    }
  }

  const handleGstCodeUpdate = async (newGstCode) => {
    try {
      await api.patch(`/api/v1/pricebook/${id}`, {
        pricebook_item: {
          gst_code: newGstCode
        }
      })

      // Update local state
      setItem({ ...item, gst_code: newGstCode })
      setEditingGstCode(false)
    } catch (error) {
      console.error('Failed to update GST code:', error)
      alert('Failed to update GST code')
    }
  }

  const handleBackClick = () => {
    // Use browser back to preserve search and filters
    navigate(-1)
  }

  const handleSetDefaultSupplier = (e, supplierId) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    // Find the supplier details
    const supplier = item.price_histories?.find(h => h.supplier?.id === supplierId)?.supplier
    if (supplier) {
      setSupplierToSetDefault(supplier)
      setIsSetDefaultModalOpen(true)
    }
  }

  const confirmSetDefaultSupplier = async () => {
    if (!supplierToSetDefault) return

    try {
      const response = await api.post(`/api/v1/pricebook/${id}/set_default_supplier`, {
        supplier_id: supplierToSetDefault.id
      })

      // Update the state with the full item data from the response
      if (response.success && response.item) {
        setItem(prevItem => ({
          ...prevItem,
          ...response.item,
          // Preserve price_histories from previous state
          price_histories: prevItem.price_histories
        }))
      }

      setIsSetDefaultModalOpen(false)
      setSupplierToSetDefault(null)
    } catch (err) {
      console.error('Failed to set default supplier:', err)
      alert(`Failed to set default supplier: ${err.response?.data?.error || err.message}`)
    }
  }

  const handleDeletePriceHistory = (history) => {
    setHistoryToDelete(history)
    setIsDeleteModalOpen(true)
  }

  const confirmDeletePriceHistory = async () => {
    if (!historyToDelete) return

    try {
      await api.delete(`/api/v1/pricebook/${id}/price_histories/${historyToDelete.id}`)
      setIsDeleteModalOpen(false)
      setHistoryToDelete(null)
      // Reload the item to refresh price histories
      await loadItem()
    } catch (err) {
      console.error('Failed to delete price history:', err)
      alert('Failed to delete price history. Please try again.')
    }
  }

  const handleEditPriceHistory = (history) => {
    setHistoryToEdit(history)
    setIsEditModalOpen(true)
  }

  const confirmEditPriceHistory = async (updatedData) => {
    if (!historyToEdit) return

    try {
      await api.patch(`/api/v1/pricebook/${id}/price_histories/${historyToEdit.id}`, updatedData)
      setIsEditModalOpen(false)
      setHistoryToEdit(null)
      // Reload the item to refresh price histories
      await loadItem()
    } catch (err) {
      console.error('Failed to update price history:', err)
      alert(`Failed to update price history: ${err.response?.data?.error || err.message}`)
    }
  }

  const handleBooleanToggle = async (fieldName, currentValue) => {
    const newValue = !currentValue

    // Optimistic update
    setItem(prev => ({
      ...prev,
      [fieldName]: newValue
    }))

    try {
      setSavingBooleans(true)
      await api.patch(`/api/v1/pricebook/${id}`, {
        [fieldName]: newValue
      })
    } catch (err) {
      console.error(`Failed to update ${fieldName}:`, err)
      alert(`Failed to update ${fieldName}. Please try again.`)
      // Revert on error
      setItem(prev => ({
        ...prev,
        [fieldName]: currentValue
      }))
    } finally {
      setSavingBooleans(false)
    }
  }

  const Badge = ({ color, children }) => {
    const colorClasses = {
      green: 'bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-500',
      red: 'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400',
      gray: 'bg-gray-100 text-gray-600 dark:bg-gray-400/10 dark:text-gray-400'
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

  // Get the currently active price history for the default supplier
  const getActivePriceHistory = () => {
    if (item && item.default_supplier && item.price_histories) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const defaultSupplierHistory = item.price_histories
        .filter(history => history.supplier && history.supplier.id === item.default_supplier.id)
        .filter(history => {
          // Only include prices with effective date <= today (currently active/live prices)
          if (!history.date_effective) return true // If no date_effective, include it
          const effectiveDate = new Date(history.date_effective)
          effectiveDate.setHours(0, 0, 0, 0)
          return effectiveDate <= today
        })
        .sort((a, b) => {
          // Sort by date_effective (most recent first), fallback to created_at if no date_effective
          const dateA = a.date_effective ? new Date(a.date_effective) : new Date(a.created_at)
          const dateB = b.date_effective ? new Date(b.date_effective) : new Date(b.created_at)
          return dateB - dateA
        })[0]

      return defaultSupplierHistory
    }
    return null
  }

  // Get the price from the default supplier or fall back to current price
  const getDisplayPrice = () => {
    const activePriceHistory = getActivePriceHistory()
    if (activePriceHistory) {
      return activePriceHistory.new_price
    }
    return item?.current_price
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
              onClick={handleBackClick}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back
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
            onClick={handleBackClick}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
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
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {item.default_supplier ? 'Default Supplier Price' : 'Current Price'}
                  </dt>
                  <dd className="mt-1">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {getDisplayPrice() ? formatCurrency(getDisplayPrice(), true) : 'No price set'}
                    </div>
                    {item.default_supplier && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        from {item.default_supplier.name}
                      </div>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Unit of Measure</dt>
                  <dd className="mt-1 text-lg text-gray-900 dark:text-white">
                    {item.unit_of_measure}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {item.default_supplier ? 'Price Effective Date' : 'Last Updated'}
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {(() => {
                      const activePriceHistory = getActivePriceHistory()
                      if (activePriceHistory && activePriceHistory.date_effective) {
                        // Show the effective date of the currently active price
                        return formatDate(activePriceHistory.date_effective)
                      } else if (activePriceHistory && activePriceHistory.created_at) {
                        // Fallback to created_at if no date_effective
                        return formatDate(activePriceHistory.created_at)
                      } else {
                        // Fallback to the item's price_last_updated_at
                        return formatDate(item.price_last_updated_at)
                      }
                    })()}
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
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">GST Code</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {editingGstCode ? (
                      <select
                        autoFocus
                        value={item.gst_code || ''}
                        onChange={(e) => handleGstCodeUpdate(e.target.value)}
                        onBlur={() => setEditingGstCode(false)}
                        onFocus={(e) => {
                          // Prevent any parent handlers from calling .select() on this select element
                          e.stopPropagation()
                        }}
                        className="w-full px-2 py-1 text-sm border border-indigo-500 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:border-indigo-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">Select GST code...</option>
                        {taxRates.map((rate) => (
                          <option key={rate.code} value={rate.code}>
                            {rate.name} ({rate.display_rate})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                        onClick={() => setEditingGstCode(true)}
                      >
                        {item.gst_code ? `${item.gst_code}` : '-'}
                      </span>
                    )}
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAllPrices(!showAllPrices)}
                    className="inline-flex items-center gap-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {showAllPrices ? 'Hide Old Prices' : 'Show All Prices'}
                  </button>
                  <button
                    onClick={() => setIsAddPriceModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Price
                  </button>
                </div>
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
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(() => {
                        // Find the active price history (most recent one for default supplier where date_effective <= today)
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)

                        const activePriceHistory = item?.default_supplier_id ? item.price_histories
                          ?.filter(h => h.supplier?.id === item.default_supplier_id)
                          ?.filter(h => {
                            if (!h.date_effective) return true
                            const effectiveDate = new Date(h.date_effective)
                            effectiveDate.setHours(0, 0, 0, 0)
                            return effectiveDate <= today
                          })
                          ?.sort((a, b) => {
                            const dateA = a.date_effective ? new Date(a.date_effective) : new Date(a.created_at)
                            const dateB = b.date_effective ? new Date(b.date_effective) : new Date(b.created_at)
                            return dateB - dateA
                          })[0] : null

                        // Filter: show all if toggle is on, otherwise show only active + future prices (hide old/expired)
                        const filteredAndSorted = item.price_histories
                          ?.filter(h => {
                            if (showAllPrices) return true // Show all prices when toggle is on

                            const effectiveDate = h.date_effective ? new Date(h.date_effective) : null
                            if (effectiveDate) {
                              effectiveDate.setHours(0, 0, 0, 0)
                            }

                            // Show all future prices (date_effective > today)
                            if (effectiveDate && effectiveDate > today) return true

                            // For current/past prices, only show the most recent one per supplier
                            const mostRecentForSupplier = item.price_histories
                              ?.filter(ph => ph.supplier?.id === h.supplier?.id)
                              ?.filter(ph => {
                                const phDate = ph.date_effective ? new Date(ph.date_effective) : new Date(ph.created_at)
                                phDate.setHours(0, 0, 0, 0)
                                return !ph.date_effective || phDate <= today
                              })
                              ?.sort((a, b) => {
                                const dateA = a.date_effective ? new Date(a.date_effective) : new Date(a.created_at)
                                const dateB = b.date_effective ? new Date(b.date_effective) : new Date(b.created_at)
                                return dateB - dateA // Most recent first
                              })[0]

                            return h.id === mostRecentForSupplier?.id
                          })
                          ?.sort((a, b) => {
                            // First sort: default supplier first
                            const aIsDefault = a.supplier?.id === item?.default_supplier_id ? 1 : 0
                            const bIsDefault = b.supplier?.id === item?.default_supplier_id ? 1 : 0
                            if (aIsDefault !== bIsDefault) return bIsDefault - aIsDefault

                            // Second sort: by date ascending (oldest first)
                            const dateA = a.date_effective ? new Date(a.date_effective) : new Date(a.created_at)
                            const dateB = b.date_effective ? new Date(b.date_effective) : new Date(b.created_at)
                            return dateA - dateB
                          }) || []

                        return filteredAndSorted.slice(0, 10).map((history, idx) => {
                          const change = history.new_price - history.old_price
                          const changePercent = history.old_price ? ((change / history.old_price) * 100).toFixed(1) : 0

                          // Check if this supplier is the default supplier
                          const isDefaultSupplier = history.supplier?.id === item?.default_supplier_id

                          // This is the active price if it matches the activePriceHistory
                          const isActive = activePriceHistory && history.id === activePriceHistory.id

                          return (
                            <tr key={idx}>
                              <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  {formatDate(history.date_effective || history.created_at)}
                                  {isActive && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" title="Currently active price">
                                      Active
                                    </span>
                                  )}
                                </div>
                              </td>
                            <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                              {history.old_price ? formatCurrency(history.old_price, true) : '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white font-medium">
                              {formatCurrency(history.new_price, true)}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <span className={change > 0 ? 'text-red-600 dark:text-red-400' : change < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}>
                                {change > 0 ? '+' : ''}{formatCurrency(change, true)}
                                {changePercent !== 0 && ` (${change > 0 ? '+' : ''}${changePercent}%)`}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {history.supplier ? (
                                <Switch
                                  checked={isDefaultSupplier}
                                  disabled={isDefaultSupplier}
                                  onChange={() => {
                                    handleSetDefaultSupplier(null, history.supplier.id)
                                  }}
                                  className={`${
                                    isDefaultSupplier ? 'bg-indigo-600 opacity-75' : 'bg-gray-200 dark:bg-gray-700'
                                  } relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                    isDefaultSupplier ? 'cursor-default' : 'cursor-pointer'
                                  } disabled:cursor-not-allowed`}
                                >
                                  <span className="sr-only">Set {history.supplier.name} as default supplier</span>
                                  <span
                                    className={`${
                                      isDefaultSupplier ? 'translate-x-5' : 'translate-x-0.5'
                                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out pointer-events-none`}
                                  />
                                </Switch>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm">
                              {history.supplier ? (
                                <Link
                                  to={`/contacts/${history.supplier.id}`}
                                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline"
                                >
                                  {history.supplier.name}
                                </Link>
                              ) : (
                                <span className="text-gray-600 dark:text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Menu as="div" className="relative inline-block text-left">
                                <Menu.Button className="flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                  <EllipsisVerticalIcon className="h-5 w-5" />
                                </Menu.Button>
                                <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                  <div className="py-1">
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => handleEditPriceHistory(history)}
                                          className={`${
                                            active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                          } group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300`}
                                        >
                                          <PencilIcon className="mr-3 h-4 w-4" />
                                          Edit
                                        </button>
                                      )}
                                    </Menu.Item>
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => handleDeletePriceHistory(history)}
                                          className={`${
                                            active ? 'bg-gray-100 dark:bg-gray-700' : ''
                                          } group flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400`}
                                        >
                                          <TrashIcon className="mr-3 h-4 w-4" />
                                          Delete
                                        </button>
                                      )}
                                    </Menu.Item>
                                  </div>
                                </Menu.Items>
                              </Menu>
                            </td>
                          </tr>
                        )
                      })})()}
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
            {/* Data Quality Settings Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Data Quality Settings
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="requires_photo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Needs Photo
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Item requires a product image
                    </p>
                  </div>
                  <input
                    id="requires_photo"
                    type="checkbox"
                    checked={item.requires_photo || false}
                    onChange={() => handleBooleanToggle('requires_photo', item.requires_photo)}
                    disabled={savingBooleans}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label htmlFor="requires_spec" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Needs Spec
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Item requires specification sheet
                    </p>
                  </div>
                  <input
                    id="requires_spec"
                    type="checkbox"
                    checked={item.requires_spec || false}
                    onChange={() => handleBooleanToggle('requires_spec', item.requires_spec)}
                    disabled={savingBooleans}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label htmlFor="photo_attached" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Photo Added
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Product photo has been uploaded
                    </p>
                  </div>
                  <input
                    id="photo_attached"
                    type="checkbox"
                    checked={item.photo_attached || false}
                    onChange={() => handleBooleanToggle('photo_attached', item.photo_attached)}
                    disabled={savingBooleans}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label htmlFor="spec_attached" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Spec Added
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Specification sheet has been uploaded
                    </p>
                  </div>
                  <input
                    id="spec_attached"
                    type="checkbox"
                    checked={item.spec_attached || false}
                    onChange={() => handleBooleanToggle('spec_attached', item.spec_attached)}
                    disabled={savingBooleans}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label htmlFor="needs_pricing_review" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Pricing Review
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Price needs to be reviewed
                    </p>
                  </div>
                  <input
                    id="needs_pricing_review"
                    type="checkbox"
                    checked={item.needs_pricing_review || false}
                    onChange={() => handleBooleanToggle('needs_pricing_review', item.needs_pricing_review)}
                    disabled={savingBooleans}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Images Card */}
            {(item.image_url || item.image_file_id || item.qr_code_url || item.qr_code_file_id) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <PhotoIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Product Images
                </h2>

                <div className="space-y-4">
                  {(item.image_url || item.image_file_id) && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                        <PhotoIcon className="h-4 w-4" />
                        Product Photo
                      </div>
                      <div className="relative group">
                        {!imageError ? (
                          <>
                            <img
                              src={getImageUrl('image')}
                              alt={item.item_name}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ maxHeight: '300px' }}
                              onClick={() => setEnlargedImage({ url: getImageUrl('image'), type: 'photo' })}
                              onError={() => setImageError(true)}
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-lg cursor-pointer pointer-events-none">
                              <MagnifyingGlassIcon className="h-8 w-8 text-white drop-shadow-lg" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-48 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400">Image not available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(item.qr_code_url || item.qr_code_file_id) && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                        <QrCodeIcon className="h-4 w-4" />
                        QR Code
                      </div>
                      <div className="relative group">
                        {!qrCodeError ? (
                          <>
                            <img
                              src={getImageUrl('qr_code')}
                              alt={`QR Code for ${item.item_name}`}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ maxHeight: '300px' }}
                              onClick={() => setEnlargedImage({ url: getImageUrl('qr_code'), type: 'qr' })}
                              onError={() => setQrCodeError(true)}
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-lg cursor-pointer pointer-events-none">
                              <MagnifyingGlassIcon className="h-8 w-8 text-white drop-shadow-lg" />
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-48 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400">QR code not available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {item.requires_photo && !item.image_url && !item.image_file_id && (
                    <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-start gap-1 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
                      <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>This item requires a photo but none has been uploaded yet.</span>
                    </div>
                  )}

                  {item.image_source === 'onedrive' && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      <span>Synced from OneDrive {item.image_fetched_at ? `on ${formatDate(item.image_fetched_at)}` : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Supplier Card */}
            {(item.default_supplier || item.supplier) && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <BuildingStorefrontIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  {item.default_supplier ? 'Default Supplier' : 'Supplier'}
                </h2>

                <div className="space-y-3">
                  <div>
                    <Link
                      to={`/suppliers/${(item.default_supplier || item.supplier).id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      {(item.default_supplier || item.supplier).name}
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
                          item.risk.score < 25 ? 'bg-green-500 dark:bg-green-400' :
                          item.risk.score < 50 ? 'bg-yellow-500 dark:bg-yellow-400' :
                          item.risk.score < 75 ? 'bg-yellow-600 dark:bg-yellow-500' :
                          'bg-red-500 dark:bg-red-400'
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

      {/* Image Enlargement Modal */}
      <Dialog open={!!enlargedImage} onClose={() => setEnlargedImage(null)} className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/90 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
        />

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <DialogPanel
              transition
              className="relative transform overflow-hidden transition-all data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in max-w-5xl w-full"
            >
              <div className="relative">
                <img
                  src={enlargedImage?.url}
                  alt={enlargedImage?.type === 'qr' ? 'QR Code' : 'Product Photo'}
                  className="w-full h-auto rounded-lg"
                  style={{ maxHeight: '90vh', objectFit: 'contain' }}
                />
                <button
                  onClick={() => setEnlargedImage(null)}
                  className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-sm transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="absolute bottom-4 left-4 bg-black/50 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
                  <div className="text-sm font-medium">
                    {enlargedImage?.type === 'qr' ? 'QR Code' : 'Product Photo'}: {item.item_name}
                  </div>
                </div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* Set Default Supplier Confirmation Dialog */}
      <Dialog open={isSetDefaultModalOpen} onClose={() => setIsSetDefaultModalOpen(false)} className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in dark:bg-gray-900/50"
        />

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-4xl data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95 dark:bg-gray-800 dark:outline dark:outline-1 dark:-outline-offset-1 dark:outline-white/10"
            >
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4 dark:bg-gray-800">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:mx-0 sm:size-10 dark:bg-indigo-500/10">
                    <CheckCircleIcon aria-hidden="true" className="size-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                    <DialogTitle as="h3" className="text-base font-semibold text-gray-900 dark:text-white">
                      Set Default Supplier
                    </DialogTitle>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        You are about to set{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {supplierToSetDefault?.name}
                        </span>
                        {' '}as the default supplier for this item. Please review all price history data below to ensure nothing is missing.
                      </p>

                      {/* Price History Table */}
                      <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">All Price History Data</h4>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Default</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Supplier</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Old Price</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">New Price</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Change</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                              {(() => {
                                // Find the active price history (most recent one for default supplier where date_effective <= today)
                                const today = new Date()
                                today.setHours(0, 0, 0, 0)

                                const activePriceHistory = item?.default_supplier_id ? item.price_histories
                                  ?.filter(h => h.supplier?.id === item.default_supplier_id)
                                  ?.filter(h => {
                                    if (!h.date_effective) return true
                                    const effectiveDate = new Date(h.date_effective)
                                    effectiveDate.setHours(0, 0, 0, 0)
                                    return effectiveDate <= today
                                  })
                                  ?.sort((a, b) => {
                                    const dateA = a.date_effective ? new Date(a.date_effective) : new Date(a.created_at)
                                    const dateB = b.date_effective ? new Date(b.date_effective) : new Date(b.created_at)
                                    return dateB - dateA
                                  })[0] : null

                                return item?.price_histories?.map((history, idx) => {
                                  const change = history.new_price - history.old_price
                                  const changePercent = history.old_price ? ((change / history.old_price) * 100).toFixed(1) : 0
                                  const isSelectedSupplier = history.supplier?.id === supplierToSetDefault?.id
                                  const isDefaultSupplier = history.supplier?.id === item?.default_supplier_id

                                  // This is the active price if it matches the activePriceHistory
                                  const isActive = activePriceHistory && history.id === activePriceHistory.id

                                  return (
                                    <tr
                                      key={idx}
                                      className={isSelectedSupplier ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}
                                    >
                                      <td className="px-3 py-2 text-center">
                                        {isDefaultSupplier && (
                                          <svg className="h-5 w-5 text-green-600 dark:text-green-400 inline" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                          </svg>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        {formatDate(history.date_effective || history.created_at)}
                                        {isActive && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" title="Currently active price">
                                            Active
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-sm">
                                      {history.supplier ? (
                                        <span className={isSelectedSupplier ? 'font-medium text-indigo-900 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}>
                                          {history.supplier.name}
                                          {isSelectedSupplier && (
                                            <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-400">
                                              Selected
                                            </span>
                                          )}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400 dark:text-gray-500">No supplier</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-sm">
                                      {history.old_price ? (
                                        <span className="text-gray-600 dark:text-gray-400">{formatCurrency(history.old_price, true)}</span>
                                      ) : (
                                        <span className="text-orange-600 dark:text-orange-400">Missing</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">
                                      {formatCurrency(history.new_price, true)}
                                    </td>
                                    <td className="px-3 py-2 text-sm">
                                      <span className={change > 0 ? 'text-red-600 dark:text-red-400' : change < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}>
                                        {change > 0 ? '+' : ''}{formatCurrency(change, true)}
                                        {changePercent !== 0 && ` (${change > 0 ? '+' : ''}${changePercent}%)`}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })})()}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Summary Stats */}
                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Total Entries</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {item?.price_histories?.length || 0}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Unique Suppliers</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {new Set(item?.price_histories?.map(h => h.supplier?.id).filter(Boolean)).size}
                          </div>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
                          <div className="text-xs text-indigo-600 dark:text-indigo-400">Selected Supplier Prices</div>
                          <div className="text-lg font-semibold text-indigo-900 dark:text-indigo-300">
                            {item?.price_histories?.filter(h => h.supplier?.id === supplierToSetDefault?.id).length || 0}
                          </div>
                        </div>
                      </div>

                      {/* Warning if missing data */}
                      {item?.price_histories?.some(h => !h.old_price) && (
                        <div className="mt-4 rounded-md bg-orange-50 dark:bg-orange-900/20 p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <ExclamationTriangleIcon className="h-5 w-5 text-orange-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">
                                Missing Data Detected
                              </h3>
                              <div className="mt-2 text-sm text-orange-700 dark:text-orange-400">
                                <p>
                                  Some price history entries are missing "Old Price" values. Please review the data above before confirming.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 dark:bg-gray-700/25">
                <button
                  type="button"
                  onClick={confirmSetDefaultSupplier}
                  className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400"
                >
                  Confirm & Set as Default
                </button>
                <button
                  type="button"
                  data-autofocus
                  onClick={() => {
                    setIsSetDefaultModalOpen(false)
                    setSupplierToSetDefault(null)
                  }}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-white/10 dark:text-white dark:shadow-none dark:ring-white/5 dark:hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in dark:bg-gray-900/50"
        />

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95 dark:bg-gray-800 dark:outline dark:outline-1 dark:-outline-offset-1 dark:outline-white/10"
            >
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4 dark:bg-gray-800">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:size-10 dark:bg-red-500/10">
                    <ExclamationTriangleIcon aria-hidden="true" className="size-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <DialogTitle as="h3" className="text-base font-semibold text-gray-900 dark:text-white">
                      Delete Price History
                    </DialogTitle>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to delete this price history entry?
                        {historyToDelete && (
                          <>
                            {' '}This will permanently remove the price change from{' '}
                            <span className="font-medium">{historyToDelete.old_price ? formatCurrency(historyToDelete.old_price, true) : 'N/A'}</span>
                            {' '}to{' '}
                            <span className="font-medium">{formatCurrency(historyToDelete.new_price, true)}</span>
                            {historyToDelete.supplier && (
                              <>
                                {' '}for{' '}
                                <span className="font-medium">{historyToDelete.supplier.name}</span>
                              </>
                            )}
                            . This action cannot be undone.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 dark:bg-gray-700/25">
                <button
                  type="button"
                  onClick={confirmDeletePriceHistory}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto dark:bg-red-500 dark:shadow-none dark:hover:bg-red-400"
                >
                  Delete
                </button>
                <button
                  type="button"
                  data-autofocus
                  onClick={() => {
                    setIsDeleteModalOpen(false)
                    setHistoryToDelete(null)
                  }}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-white/10 dark:text-white dark:shadow-none dark:ring-white/5 dark:hover:bg-white/20"
                >
                  Cancel
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      {/* Edit Price History Dialog */}
      <Dialog open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} className="relative z-50">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in dark:bg-gray-900/50"
        />

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95 dark:bg-gray-800 dark:outline dark:outline-1 dark:-outline-offset-1 dark:outline-white/10"
            >
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.target)
                const updatedData = {
                  old_price: formData.get('old_price'),
                  new_price: formData.get('new_price'),
                  date_effective: formData.get('date_effective'),
                  change_reason: formData.get('change_reason')
                }
                confirmEditPriceHistory(updatedData)
              }}>
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4 dark:bg-gray-800">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:mx-0 sm:size-10 dark:bg-indigo-500/10">
                      <PencilIcon aria-hidden="true" className="size-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="mt-3 w-full text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <DialogTitle as="h3" className="text-base font-semibold text-gray-900 dark:text-white">
                        Edit Price History
                      </DialogTitle>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label htmlFor="old_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Old Price
                          </label>
                          <input
                            type="number"
                          onFocus={(e) => e.target.select()}
                            step="0.01"
                            name="old_price"
                            id="old_price"
                            defaultValue={historyToEdit?.old_price || ''}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label htmlFor="new_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            New Price
                          </label>
                          <input
                            type="number"
                          onFocus={(e) => e.target.select()}
                            step="0.01"
                            name="new_price"
                            id="new_price"
                            defaultValue={historyToEdit?.new_price || ''}
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label htmlFor="date_effective" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Date Effective
                          </label>
                          <input
                            type="date"
                            name="date_effective"
                            id="date_effective"
                            defaultValue={historyToEdit?.date_effective || ''}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label htmlFor="change_reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Change Reason
                          </label>
                          <textarea
                            name="change_reason"
                            id="change_reason"
                            rows={3}
                            defaultValue={historyToEdit?.change_reason || ''}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 dark:bg-gray-700/25">
                  <button
                    type="submit"
                    className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false)
                      setHistoryToEdit(null)
                    }}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-white/10 dark:text-white dark:shadow-none dark:ring-white/5 dark:hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
