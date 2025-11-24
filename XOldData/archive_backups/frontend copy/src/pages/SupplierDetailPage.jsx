import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api'
import {
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  StarIcon,
  ClockIcon,
  ChartBarIcon,
  GlobeAltIcon,
  IdentificationIcon,
  ArrowPathRoundedSquareIcon,
  CubeIcon,
  CurrencyDollarIcon,
  TagIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function SupplierDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState(null)
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [loadingPOs, setLoadingPOs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentTab, setCurrentTab] = useState('overview')

  useEffect(() => {
    loadSupplier()
    loadPurchaseOrders()
  }, [id])

  const loadSupplier = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/suppliers/${id}`)
      setSupplier(response.supplier)
    } catch (err) {
      setError('Failed to load supplier')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadPurchaseOrders = async () => {
    try {
      setLoadingPOs(true)
      const response = await api.get(`/api/v1/purchase_orders?supplier_id=${id}`)
      setPurchaseOrders(response.purchase_orders || [])
    } catch (err) {
      console.error('Failed to load purchase orders:', err)
    } finally {
      setLoadingPOs(false)
    }
  }

  const deleteSupplier = async () => {
    if (!confirm('Are you sure you want to delete this supplier? This will unlink the contact.')) return

    try {
      await api.delete(`/api/v1/suppliers/${id}`)
      navigate('/suppliers')
    } catch (err) {
      alert('Failed to delete supplier')
      console.error(err)
    }
  }

  const getMatchBadge = () => {
    if (!supplier.contact_id) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          <XCircleIcon className="h-3 w-3" />
          Unmatched
        </span>
      )
    }

    if (supplier.is_verified) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircleIcon className="h-3 w-3" />
          Verified
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        <ExclamationTriangleIcon className="h-3 w-3" />
        Needs Review
      </span>
    )
  }

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          star <= rating ? (
            <StarIconSolid key={star} className="h-5 w-5 text-yellow-400" />
          ) : (
            <StarIcon key={star} className="h-5 w-5 text-gray-300 dark:text-gray-600" />
          )
        ))}
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
          {rating > 0 ? `${rating}/5` : 'No rating'}
        </span>
      </div>
    )
  }

  const tabs = [
    { name: 'Overview', id: 'overview' },
    { name: 'Price Book', id: 'pricebook' },
    { name: 'Purchase Orders', id: 'purchase_orders' }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading supplier...</div>
      </div>
    )
  }

  if (error || !supplier) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="text-red-600 dark:text-red-400 mb-4">{error || 'Supplier not found'}</div>
          <Link to="/suppliers" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
            Back to Suppliers
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900">
      {/* Page Header with Gradient Background */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Back Button */}
          <button
            onClick={() => navigate('/suppliers')}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 mb-6 group"
          >
            <ArrowLeftIcon className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to Suppliers
          </button>

          {/* Header Content */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {supplier.name}
                </h1>
                {getMatchBadge()}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                {supplier.contact && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Contact:</span>
                    <span>{supplier.contact.full_name}</span>
                  </div>
                )}

                {(supplier.email || supplier.contact?.email) && (
                  <a
                    href={`mailto:${supplier.email || supplier.contact?.email}`}
                    className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                  >
                    <EnvelopeIcon className="h-4 w-4" />
                    <span>{supplier.email || supplier.contact?.email}</span>
                  </a>
                )}

                {supplier.contact_number && (
                  <a
                    href={`tel:${supplier.contact_number}`}
                    className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                  >
                    <PhoneIcon className="h-4 w-4" />
                    <span>{supplier.contact_number}</span>
                  </a>
                )}
              </div>
            </div>

            <div className="flex gap-3 ml-4">
              <button
                onClick={() => navigate(`/suppliers/${id}/edit`)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
              >
                <PencilIcon className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={deleteSupplier}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>

          {/* Stats Grid - Moved to Header */}
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl px-5 py-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <dt className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <CubeIcon className="h-4 w-4" />
                Items
              </dt>
              <dd className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {supplier.pricebook_items?.length || 0}
              </dd>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl px-5 py-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <dt className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <CurrencyDollarIcon className="h-4 w-4" />
                Total Value
              </dt>
              <dd className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                ${supplier.pricebook_items && supplier.pricebook_items.length > 0
                  ? supplier.pricebook_items.reduce((sum, item) => sum + parseFloat(item.current_price || 0), 0).toFixed(2)
                  : '0.00'}
              </dd>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl px-5 py-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <dt className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <StarIcon className="h-4 w-4" />
                Rating
              </dt>
              <dd className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {supplier.rating || 0}/5
              </dd>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl px-5 py-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <dt className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <ChartBarIcon className="h-4 w-4" />
                Response Rate
              </dt>
              <dd className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                {parseFloat(supplier.response_rate || 0).toFixed(0)}%
              </dd>
            </div>
          </dl>

          {/* Secondary Navigation */}
          <nav className="flex gap-1 mt-8 border-b border-gray-200 dark:border-gray-700" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                role="tab"
                aria-selected={tab.id === currentTab}
                className={classNames(
                  tab.id === currentTab
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800',
                  'px-4 py-3 text-sm font-medium border-b-2 transition-all rounded-t-lg'
                )}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Contact Information */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Contact Information</h3>
                </div>
                <div className="px-6 py-5">
                  <dl className="space-y-4">
                  {(supplier.email || supplier.contact?.email) && (
                    <div>
                      <dt className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <EnvelopeIcon className="h-4 w-4" />
                        Email
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        <a href={`mailto:${supplier.email || supplier.contact?.email}`} className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
                          {supplier.email || supplier.contact?.email}
                        </a>
                      </dd>
                    </div>
                  )}
                  {(supplier.phone || supplier.contact?.mobile_phone || supplier.contact?.office_phone) && (
                    <div>
                      <dt className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <PhoneIcon className="h-4 w-4" />
                        Phone
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        <a href={`tel:${supplier.phone || supplier.contact?.mobile_phone || supplier.contact?.office_phone}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                          {supplier.phone || supplier.contact?.mobile_phone || supplier.contact?.office_phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="sm:col-span-2">
                      <dt className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <MapPinIcon className="h-4 w-4" />
                        Address
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">{supplier.address}</dd>
                    </div>
                  )}
                  {(supplier.contact_person || supplier.contact_name) && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact Person</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">{supplier.contact_person || supplier.contact_name}</dd>
                    </div>
                  )}
                  {supplier.contact_number && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact Number</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        <a href={`tel:${supplier.contact_number}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                          {supplier.contact_number}
                        </a>
                      </dd>
                    </div>
                  )}
                  {supplier.contact?.website && (
                    <div>
                      <dt className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <GlobeAltIcon className="h-4 w-4" />
                        Website
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        <a
                          href={supplier.contact.website.startsWith('http') ? supplier.contact.website : `https://${supplier.contact.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          {supplier.contact.website}
                        </a>
                      </dd>
                    </div>
                  )}
                  {supplier.contact?.tax_number && (
                    <div>
                      <dt className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <IdentificationIcon className="h-4 w-4" />
                        Tax Number (ABN)
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{supplier.contact.tax_number}</dd>
                    </div>
                  )}
                  {supplier.contact?.xero_id && (
                    <div>
                      <dt className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <ArrowPathRoundedSquareIcon className="h-4 w-4" />
                        Xero ID
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{supplier.contact.xero_id}</dd>
                    </div>
                  )}
                  {supplier.contact?.sync_with_xero !== null && supplier.contact?.sync_with_xero !== undefined && (
                    <div>
                      <dt className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                        <ArrowPathRoundedSquareIcon className="h-4 w-4" />
                        Sync with Xero
                      </dt>
                      <dd className="mt-1">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          supplier.contact.sync_with_xero
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {supplier.contact.sync_with_xero ? 'Enabled' : 'Disabled'}
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {supplier.notes && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notes</h3>
                </div>
                <div className="px-6 py-5">
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{supplier.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Performance Metrics */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance Metrics</h3>
              </div>
              <div className="px-6 py-5">
                <dl className="space-y-5">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Rating</dt>
                    <dd className="mt-2">{renderStars(supplier.rating || 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                    <dd className="mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        supplier.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {supplier.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                      <ChartBarIcon className="h-4 w-4" />
                      Response Rate
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                      {parseFloat(supplier.response_rate || 0).toFixed(1)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                      <ClockIcon className="h-4 w-4" />
                      Average Response Time
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                      {supplier.avg_response_time ? `${supplier.avg_response_time}h` : 'N/A'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Information</h3>
              </div>
              <div className="px-6 py-5">
                <dl className="space-y-4">
                  <div>
                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier ID</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">#{supplier.id}</dd>
                  </div>
                  {supplier.created_at && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {new Date(supplier.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </dd>
                    </div>
                  )}
                  {supplier.updated_at && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Updated</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        {new Date(supplier.updated_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>
        )}

        {currentTab === 'pricebook' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Price Book Items
                </h3>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {supplier.pricebook_items?.length || 0} items
                </span>
              </div>
            </div>
            {supplier.pricebook_items && supplier.pricebook_items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Code
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Item Name
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Category
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-right text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Current Price
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {supplier.pricebook_items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                          {item.item_code}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {item.item_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {item.category || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900 dark:text-white">
                          ${parseFloat(item.current_price || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <CubeIcon className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" />
                <h3 className="mt-4 text-base font-medium text-gray-900 dark:text-white">No items in price book</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">This supplier doesn't have any items in their price book yet.</p>
              </div>
            )}
          </div>
        )}

        {currentTab === 'purchase_orders' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Purchase Orders
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    All purchase orders for this supplier
                  </p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {purchaseOrders.length} {purchaseOrders.length === 1 ? 'order' : 'orders'}
                </span>
              </div>
            </div>
            {loadingPOs ? (
              <div className="px-6 py-16 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
                  Loading purchase orders...
                </div>
              </div>
            ) : purchaseOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        PO Number
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Job
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-right text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Total
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Required Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            to={`/purchase-orders/${po.id}`}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                          >
                            {po.purchase_order_number}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {po.construction?.title || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {po.description || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                            po.status === 'approved'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : po.status === 'draft'
                              ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                              : po.status === 'ordered'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900 dark:text-white">
                          ${parseFloat(po.total || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {po.required_date ? new Date(po.required_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <CubeIcon className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" />
                <h3 className="mt-4 text-base font-medium text-gray-900 dark:text-white">No purchase orders</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">This supplier doesn't have any purchase orders yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
