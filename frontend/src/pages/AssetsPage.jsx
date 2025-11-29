import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  TruckIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import api from '../api'

export default function AssetsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || 'all')
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'all')
  const [needsAttention, setNeedsAttention] = useState(searchParams.get('needs_attention') === 'true')

  const assetTypes = ['all', 'vehicle', 'equipment', 'property', 'other']
  const statuses = ['all', 'active', 'disposed', 'sold', 'written_off']

  useEffect(() => {
    loadAssets()
  }, [selectedType, selectedStatus, needsAttention])

  const loadAssets = async () => {
    try {
      setLoading(true)

      const params = {}
      if (selectedType !== 'all') params.asset_type = selectedType
      if (selectedStatus !== 'all') params.status = selectedStatus
      if (needsAttention) params.needs_attention = 'true'
      if (searchQuery) params.search = searchQuery

      const response = await api.get('/api/v1/assets', { params })
      setAssets(response.assets || [])
    } catch (error) {
      console.error('Failed to load assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    loadAssets()
  }

  const handleTypeChange = (type) => {
    setSelectedType(type)
    if (type === 'all') {
      searchParams.delete('type')
    } else {
      searchParams.set('type', type)
    }
    setSearchParams(searchParams)
  }

  const handleStatusChange = (status) => {
    setSelectedStatus(status)
    if (status === 'all') {
      searchParams.delete('status')
    } else {
      searchParams.set('status', status)
    }
    setSearchParams(searchParams)
  }

  const handleNeedsAttentionToggle = () => {
    const newValue = !needsAttention
    setNeedsAttention(newValue)
    if (newValue) {
      searchParams.set('needs_attention', 'true')
    } else {
      searchParams.delete('needs_attention')
    }
    setSearchParams(searchParams)
  }

  const getAssetTypeIcon = (type) => {
    return TruckIcon
  }

  const formatAssetType = (type) => {
    if (!type) return ''
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const formatCurrency = (amount) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assets</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage vehicles, equipment, property and other company assets
          </p>
        </div>
        <div className="mt-3 sm:ml-4 sm:mt-0">
          <button
            onClick={() => navigate('/corporate/assets/new')}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
            Add Asset
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {/* Search */}
          <div className="sm:col-span-1">
            <form onSubmit={handleSearch} className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </form>
          </div>

          {/* Type Filter */}
          <div className="sm:col-span-1">
            <select
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
            >
              {assetTypes.map((type) => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : formatAssetType(type)}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-1">
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Statuses' : status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Needs Attention Toggle */}
          <div className="sm:col-span-1">
            <button
              onClick={handleNeedsAttentionToggle}
              className={`w-full inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-semibold ${
                needsAttention
                  ? 'bg-orange-600 text-white hover:bg-orange-500'
                  : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
              }`}
            >
              <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
              Needs Attention
            </button>
          </div>
        </div>
      </div>

      {/* Assets List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Loading assets...</div>
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12">
          <TruckIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No assets</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding a new asset.</p>
          <div className="mt-6">
            <button
              onClick={() => navigate('/corporate/assets/new')}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" />
              Add Asset
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul role="list" className="divide-y divide-gray-200">
            {assets.map((asset) => {
              const Icon = getAssetTypeIcon(asset.asset_type)
              return (
                <li key={asset.id}>
                  <div
                    onClick={() => navigate(`/corporate/assets/${asset.id}`)}
                    className="block hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Icon className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <p className="truncate text-sm font-medium text-indigo-600">
                              {asset.description}
                              {asset.abbreviation && (
                                <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                  {asset.abbreviation}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatAssetType(asset.asset_type)}
                              {asset.make && asset.model && ` • ${asset.make} ${asset.model}`}
                              {asset.registration && ` • Rego: ${asset.registration}`}
                            </p>
                          </div>
                        </div>
                        <div className="ml-2 flex flex-shrink-0 items-center space-x-2">
                          {asset.needs_attention && (
                            <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                              <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                              Attention
                            </span>
                          )}
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            asset.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {asset.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex space-x-6">
                          {asset.company && (
                            <p className="flex items-center text-sm text-gray-500">
                              <span className="font-medium mr-1">Owner:</span> {asset.company.name}
                            </p>
                          )}
                          {asset.purchase_price && (
                            <p className="flex items-center text-sm text-gray-500">
                              <span className="font-medium mr-1">Value:</span> {formatCurrency(asset.purchase_price)}
                            </p>
                          )}
                          {asset.purchase_date && (
                            <p className="flex items-center text-sm text-gray-500">
                              <span className="font-medium mr-1">Purchased:</span> {new Date(asset.purchase_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          {asset.current_insurance && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                              Insured
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Results count */}
      {!loading && assets.length > 0 && (
        <div className="text-sm text-gray-700">
          Showing {assets.length} {assets.length === 1 ? 'asset' : 'assets'}
        </div>
      )}
    </div>
  )
}
