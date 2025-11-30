import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  TruckIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  ClockIcon,
  PencilIcon,
  ArrowLeftIcon,
  PhotoIcon
} from '@heroicons/react/24/outline'
import api from '../api'
import AssetInsuranceTab from '../components/corporate/AssetInsuranceTab'
import AssetServiceHistoryTab from '../components/corporate/AssetServiceHistoryTab'

export default function AssetDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)

  const tabs = [
    { id: 'overview', name: 'Overview', icon: TruckIcon },
    { id: 'insurance', name: 'Insurance', icon: ShieldCheckIcon },
    { id: 'service', name: 'Service History', icon: WrenchScrewdriverIcon },
    { id: 'activity', name: 'Activity', icon: ClockIcon }
  ]

  useEffect(() => {
    loadAsset()
  }, [id])

  const loadAsset = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/assets/${id}`)
      setAsset(response.asset)
    } catch (error) {
      console.error('Failed to load asset:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId })
  }

  const formatAssetType = (type) => {
    if (!type) return ''
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading asset...</div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Asset not found</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Fixed Header with Tabs */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          {/* Back Button */}
          <button
            onClick={() => navigate('/corporate/assets')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Assets
          </button>

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {asset.photo_url ? (
                <img
                  src={asset.photo_url}
                  alt={asset.description}
                  className="h-16 w-16 rounded object-cover mr-4"
                />
              ) : (
                <div className="h-16 w-16 rounded bg-gray-100 flex items-center justify-center mr-4">
                  <PhotoIcon className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{asset.description}</h1>
                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                  <span>{formatAssetType(asset.asset_type)}</span>
                  {asset.make && asset.model && (
                    <span>{asset.make} {asset.model}</span>
                  )}
                  {asset.registration && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                      {asset.registration}
                    </span>
                  )}
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    asset.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {asset.status}
                  </span>
                  {asset.needs_attention && (
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                      Needs Attention
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate(`/corporate/assets/${id}/edit`)}
              className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 -mb-px">
            <nav className="flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`
                      group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium
                      ${isActive
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }
                    `}
                  >
                    <Icon
                      className={`
                        -ml-0.5 mr-2 h-5 w-5
                        ${isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}
                      `}
                    />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-none p-6">
        {/* Tab Content */}
        <div className="bg-white shadow rounded-lg p-6">
          {activeTab === 'overview' && <OverviewTab asset={asset} />}
          {activeTab === 'insurance' && <AssetInsuranceTab asset={asset} onUpdate={loadAsset} />}
          {activeTab === 'service' && <AssetServiceHistoryTab asset={asset} onUpdate={loadAsset} />}
          {activeTab === 'activity' && <ActivityTab asset={asset} />}
        </div>
      </div>
    </div>
  )
}

// Placeholder tab components (we'll create full versions separately)
function OverviewTab({ asset }) {
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
      <h3 className="text-lg font-medium">Asset Information</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        {asset.company && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Owner</dt>
            <dd className="mt-1 text-sm text-gray-900">{asset.company.name}</dd>
          </div>
        )}
        {asset.abbreviation && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Abbreviation</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {asset.abbreviation}
              </span>
            </dd>
          </div>
        )}
        {asset.make && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Make</dt>
            <dd className="mt-1 text-sm text-gray-900">{asset.make}</dd>
          </div>
        )}
        {asset.model && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Model</dt>
            <dd className="mt-1 text-sm text-gray-900">{asset.model}</dd>
          </div>
        )}
        {asset.year && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Year</dt>
            <dd className="mt-1 text-sm text-gray-900">{asset.year}</dd>
          </div>
        )}
        {asset.vin && (
          <div>
            <dt className="text-sm font-medium text-gray-500">VIN</dt>
            <dd className="mt-1 text-sm text-gray-900">{asset.vin}</dd>
          </div>
        )}
        {asset.registration && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Registration</dt>
            <dd className="mt-1 text-sm text-gray-900">{asset.registration}</dd>
          </div>
        )}
        {asset.purchase_date && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Purchase Date</dt>
            <dd className="mt-1 text-sm text-gray-900">{new Date(asset.purchase_date).toLocaleDateString()}</dd>
          </div>
        )}
        {asset.purchase_price && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Purchase Price</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCurrency(asset.purchase_price)}</dd>
          </div>
        )}
        {asset.current_value && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Current Value</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCurrency(asset.current_value)}</dd>
          </div>
        )}
        {asset.disposal_date && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Disposal Date</dt>
            <dd className="mt-1 text-sm text-gray-900">{new Date(asset.disposal_date).toLocaleDateString()}</dd>
          </div>
        )}
        {asset.disposal_value && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Disposal Value</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCurrency(asset.disposal_value)}</dd>
          </div>
        )}
      </dl>

      {asset.notes && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-2">Notes</h4>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{asset.notes}</p>
        </div>
      )}
    </div>
  )
}

function ActivityTab({ asset }) {
  return <div>Activity tab - Component will be created separately</div>
}
