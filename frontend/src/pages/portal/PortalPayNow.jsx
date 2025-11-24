import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
  CalendarIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'
import RequestPaymentModal from '../../components/portal/RequestPaymentModal'
import PayNowRequestDetailModal from '../../components/portal/PayNowRequestDetailModal'

export default function PortalPayNow() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending')
  const [requests, setRequests] = useState({
    pending: [],
    approved: [],
    paid: [],
    rejected: [],
    cancelled: []
  })
  const [stats, setStats] = useState({})
  const [weeklyLimit, setWeeklyLimit] = useState({})
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    try {
      const token = localStorage.getItem('portal_token')
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      const response = await axios.get('/api/v1/portal/pay_now_requests')

      if (response.data.success) {
        setRequests(response.data.data.requests)
        setStats(response.data.data.stats)
        setWeeklyLimit(response.data.data.weekly_limit)
      }
    } catch (error) {
      console.error('Failed to load Pay Now requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestSuccess = () => {
    setShowRequestModal(false)
    loadRequests()
  }

  const handleViewDetails = (request) => {
    setSelectedRequest(request)
    setShowDetailModal(true)
  }

  const handleCancelRequest = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this payment request?')) {
      return
    }

    try {
      const token = localStorage.getItem('portal_token')
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      const response = await axios.delete(`/api/v1/portal/pay_now_requests/${requestId}`)

      if (response.data.success) {
        alert('Payment request cancelled successfully')
        loadRequests()
      }
    } catch (error) {
      console.error('Failed to cancel request:', error)
      alert('Failed to cancel request. Please try again.')
    }
  }

  const tabs = [
    { key: 'pending', name: 'Pending', count: requests.pending.length, icon: ClockIcon, color: 'yellow' },
    { key: 'approved', name: 'Approved', count: requests.approved.length, icon: CheckCircleIcon, color: 'green' },
    { key: 'paid', name: 'Paid', count: requests.paid.length, icon: CurrencyDollarIcon, color: 'blue' },
    { key: 'rejected', name: 'Rejected', count: requests.rejected.length, icon: XCircleIcon, color: 'red' }
  ]

  const getStatusBadgeClass = (status) => {
    const classes = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    return classes[status] || 'bg-gray-100 text-gray-800'
  }

  const formatCurrency = (amount) => {
    if (typeof amount === 'string') {
      return amount // Already formatted from backend
    }
    return `$${Number(amount).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const currentRequests = requests[activeTab] || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pay Now</h1>
          <p className="mt-1 text-sm text-gray-500">
            Request early payment with a 5% discount
          </p>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <BanknotesIcon className="-ml-1 mr-2 h-5 w-5" />
          Request Payment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BanknotesIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Requests
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.total_requests || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Paid
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatCurrency(stats.total_paid || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Savings
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatCurrency(stats.total_savings || 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarIcon className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    This Week
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.this_week_requests || 0} requests
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Limit Info */}
      {weeklyLimit && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-indigo-800">Weekly Limit Available</h3>
              <p className="mt-1 text-2xl font-semibold text-indigo-900">
                {weeklyLimit.remaining_amount}
              </p>
              <p className="mt-1 text-xs text-indigo-600">
                {weeklyLimit.utilization_percentage}% of {weeklyLimit.total_limit} used
              </p>
            </div>
            <div className="w-32 h-32">
              <div className="relative">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-indigo-200"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${(weeklyLimit.utilization_percentage || 0) * 3.52} 352`}
                    className="text-indigo-600"
                  />
                </svg>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                  <span className="text-xl font-bold text-indigo-900">
                    {Math.round(weeklyLimit.utilization_percentage || 0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  ${isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                `}
              >
                <Icon
                  className={`
                    ${isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}
                    -ml-0.5 mr-2 h-5 w-5
                  `}
                />
                <span>{tab.name}</span>
                {tab.count > 0 && (
                  <span className={`
                    ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-900'}
                    hidden ml-3 py-0.5 px-2.5 rounded-full text-xs font-medium md:inline-block
                  `}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Requests List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {currentRequests.length === 0 ? (
          <div className="text-center py-12">
            <BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No requests</h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeTab === 'pending'
                ? 'You have no pending payment requests.'
                : `No ${activeTab} payment requests found.`}
            </p>
            {activeTab === 'pending' && (
              <div className="mt-6">
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <BanknotesIcon className="-ml-1 mr-2 h-5 w-5" />
                  Request Payment
                </button>
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {currentRequests.map((request) => (
              <li key={request.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer" onClick={() => handleViewDetails(request)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-indigo-600 truncate">
                          PO #{request.purchase_order_number}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(request.status)}`}>
                            {request.status_display}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <div className="flex items-center text-sm text-gray-500">
                          <BanknotesIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                          <span className="font-medium text-gray-900">{request.discounted_amount}</span>
                          <span className="ml-1">(saved {request.discount_amount})</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <CalendarIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                          {formatDate(request.requested_at)}
                        </div>
                      </div>
                      {request.rejection_reason && (
                        <div className="mt-2 flex items-start text-sm text-red-600">
                          <XCircleIcon className="flex-shrink-0 mr-1.5 h-5 w-5" />
                          <span>{request.rejection_reason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {request.status === 'pending' && (
                    <div className="mt-2 flex items-center justify-end space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCancelRequest(request.id)
                        }}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Cancel Request
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modals */}
      {showRequestModal && (
        <RequestPaymentModal
          isOpen={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          onSuccess={handleRequestSuccess}
        />
      )}

      {showDetailModal && selectedRequest && (
        <PayNowRequestDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          request={selectedRequest}
        />
      )}
    </div>
  )
}
