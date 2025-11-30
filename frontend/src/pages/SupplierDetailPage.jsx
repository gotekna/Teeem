import { useEffect, useState, useRef } from 'react'
import { getNowInCompanyTimezone, getTodayAsString, getRelativeTime } from '../utils/timezoneUtils'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
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
  TagIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import EditSupplierModal from '../components/suppliers/EditSupplierModal'
import Toast from '../components/Toast'

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function SupplierDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [supplier, setSupplier] = useState(null)
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [loadingPOs, setLoadingPOs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const currentTab = searchParams.get('tab') || 'overview'
  const [editingItemId, setEditingItemId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [savingItemId, setSavingItemId] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState(null)
  const fileInputRef = useRef(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadSupplier()
    loadPurchaseOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleSaveSupplier = async (supplierId, formData) => {
    try {
      const response = await api.patch(`/api/v1/suppliers/${supplierId}`, {
        supplier: formData
      })

      if (response.success) {
        setToast({
          message: 'Supplier updated successfully',
          type: 'success'
        })
        setShowEditModal(false)
        await loadSupplier() // Refresh supplier data
      }
    } catch (error) {
      console.error('Update error:', error)
      throw error // Re-throw to be handled by the modal
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

  const handleExportPricebook = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/suppliers/${id}/pricebook/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${supplier.name.replace(/[^a-z0-9]/gi, '_')}_pricebook_${getTodayAsString()}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Failed to export price book')
      console.error(err)
    }
  }

  const handleImportClick = () => {
    setShowImportModal(true)
    setImportResults(null)
    setImportFile(null)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImportFile(file)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      alert('Please select a file')
      return
    }

    try {
      setImporting(true)
      const formData = new FormData()
      formData.append('file', importFile)

      const response = await api.post(`/api/v1/suppliers/${id}/pricebook/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      setImportResults(response)

      // Reload supplier data to get updated pricebook items
      await loadSupplier()

      // Show success notification
      if (response.success) {
        alert(`Import completed!\nCreated: ${response.created}\nUpdated: ${response.updated}\nPrice Changes: ${response.price_changes}${response.errors.length > 0 ? `\nErrors: ${response.errors.length}` : ''}`)
      }
    } catch (err) {
      alert('Failed to import price book')
      console.error(err)
    } finally {
      setImporting(false)
    }
  }

  const startEdit = (item) => {
    setEditingItemId(item.id)
    setEditForm({
      item_name: item.item_name,
      category: item.category || '',
      current_price: item.current_price || ''
    })
  }

  const cancelEdit = () => {
    setEditingItemId(null)
    setEditForm({})
  }

  const saveEdit = async (itemId) => {
    try {
      setSavingItemId(itemId)

      const response = await api.patch(`/api/v1/suppliers/${id}/pricebook/${itemId}`, {
        item: {
          item_name: editForm.item_name,
          category: editForm.category,
          current_price: parseFloat(editForm.current_price)
        }
      })

      if (response.success) {
        // Update the supplier state with the new item data
        setSupplier(prev => ({
          ...prev,
          pricebook_items: prev.pricebook_items.map(item =>
            item.id === itemId ? { ...item, ...response.item } : item
          )
        }))

        setEditingItemId(null)
        setEditForm({})
      } else {
        alert(`Failed to update: ${response.errors?.join(', ')}`)
      }
    } catch (err) {
      alert('Failed to save changes')
      console.error(err)
    } finally {
      setSavingItemId(null)
    }
  }

  const getMatchBadge = () => {
    if (!supplier.contact_id) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50">
          <XCircleIcon className="h-3.5 w-3.5" />
          Unmatched
        </span>
      )
    }

    if (supplier.is_verified) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Verified
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-500">
        <ExclamationTriangleIcon className="h-3.5 w-3.5" />
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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Fixed Header with Tabs */}
      <div className="flex-shrink-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 mb-6 group"
          >
            <ArrowLeftIcon className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back
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
                onClick={() => setShowEditModal(true)}
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
                onClick={() => setSearchParams({ tab: tab.id })}
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

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-none">
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
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border ${
                          supplier.contact.sync_with_xero
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50'
                            : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/50'
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
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                        supplier.is_active
                          ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50'
                          : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/50'
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
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Price Book Items
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50">
                    {supplier.pricebook_items?.length || 0} items
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportPricebook}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Export to Excel
                  </button>
                  <button
                    onClick={handleImportClick}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                  >
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    Import from Excel
                  </button>
                </div>
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
                      <th scope="col" className="px-6 py-3.5 text-right text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {supplier.pricebook_items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                          {item.item_code}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {editingItemId === item.id ? (
                            <input
                              type="text"
                              value={editForm.item_name}
                              onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                          ) : (
                            <span className="text-gray-900 dark:text-white">{item.item_name}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {editingItemId === item.id ? (
                            <input
                              type="text"
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                          ) : (
                            <span className="text-gray-600 dark:text-gray-400">{item.category || '—'}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {editingItemId === item.id ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.current_price}
                              onChange={(e) => setEditForm({ ...editForm, current_price: e.target.value })}
                              onFocus={(e) => e.target.select()}
                              className="w-32 px-2 py-1 text-sm text-right border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                          ) : (
                            <span className="font-semibold text-gray-900 dark:text-white">
                              ${parseFloat(item.current_price || 0).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {editingItemId === item.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => saveEdit(item.id)}
                                disabled={savingItemId === item.id}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {savingItemId === item.id ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={savingItemId === item.id}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(item)}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <PencilIcon className="h-3 w-3" />
                              Edit
                            </button>
                          )}
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
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50">
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
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium capitalize border ${
                            po.status === 'approved'
                              ? 'bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400'
                              : po.status === 'draft'
                              ? 'bg-gray-100 text-gray-600 dark:bg-gray-400/10 dark:text-gray-400'
                              : po.status === 'ordered'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-500'
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Price Book from Excel
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Excel File
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none"
                  />
                  {importFile && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Selected: {importFile.name}
                    </p>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                    Excel File Format
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-400 mb-2">
                    Your Excel file should have the following columns:
                  </p>
                  <ul className="text-sm text-blue-800 dark:text-blue-400 list-disc list-inside space-y-1">
                    <li><strong>Item Code</strong> (required) - Used to match existing items</li>
                    <li>Item Name</li>
                    <li>Category</li>
                    <li>Unit of Measure</li>
                    <li>Current Price</li>
                    <li>Brand</li>
                    <li>Notes</li>
                  </ul>
                  <p className="text-sm text-blue-800 dark:text-blue-400 mt-2">
                    Price changes will automatically create price history entries.
                  </p>
                </div>

                {importResults && (
                  <div className={`border rounded-lg p-4 ${
                    importResults.success
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  }`}>
                    <h4 className={`text-sm font-medium mb-2 ${
                      importResults.success
                        ? 'text-green-900 dark:text-green-300'
                        : 'text-red-900 dark:text-red-300'
                    }`}>
                      Import Results
                    </h4>
                    <div className={`text-sm space-y-1 ${
                      importResults.success
                        ? 'text-green-800 dark:text-green-400'
                        : 'text-red-800 dark:text-red-400'
                    }`}>
                      {importResults.success && (
                        <>
                          <p>Created: {importResults.created} items</p>
                          <p>Updated: {importResults.updated} items</p>
                          <p>Price Changes: {importResults.price_changes}</p>
                        </>
                      )}
                      {importResults.errors?.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium">Errors:</p>
                          <ul className="list-disc list-inside ml-2 mt-1">
                            {importResults.errors.map((error, idx) => (
                              <li key={idx}>
                                Row {error.row} ({error.item_code}): {error.errors.join(', ')}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!importResults.success && importResults.error && (
                        <p>{importResults.error}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Close
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      <EditSupplierModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        supplier={supplier}
        onSave={handleSaveSupplier}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
