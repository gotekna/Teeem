import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  PhotoIcon
} from '@heroicons/react/24/outline'
import ApproveRejectModal from '../components/pay-now/ApproveRejectModal'
import PayNowDetailModal from '../components/pay-now/PayNowDetailModal'
import PayNowStatsWidget from '../components/pay-now/PayNowStatsWidget'

export default function PayNowPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending')
  const [requests, setRequests] = useState([])
  const [stats, setStats] = useState(null)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [modalAction, setModalAction] = useState('approve') // 'approve' or 'reject'

  useEffect(() => {
    loadRequests()
    loadStats()
  }, [activeTab])

  const loadRequests = async () => {
    try {
      const token = localStorage.getItem('token')
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      const params = activeTab === 'all' ? {} : { status: activeTab }
      const response = await axios.get('/api/v1/pay_now_requests', { params })

      if (response.data.success) {
        setRequests(response.data.data.requests)
      }
    } catch (error) {
      console.error('Failed to load Pay Now requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token')
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      const response = await axios.get('/api/v1/pay_now_requests/dashboard_stats')

      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  const handleApprove = (request) => {
    setSelectedRequest(request)
    setModalAction('approve')
    setShowApproveModal(true)
  }

  const handleReject = (request) => {
    setSelectedRequest(request)
    setModalAction('reject')
    setShowApproveModal(true)
  }

  const handleViewDetails = (request) => {
    setSelectedRequest(request)
    setShowDetailModal(true)
  }

  const handleActionSuccess = () => {
    setShowApproveModal(false)
    setSelectedRequest(null)
    loadRequests()
    loadStats()
  }

  const tabs = [
    { key: 'pending', name: 'Pending Approval', icon: ClockIcon, color: 'yellow' },
    { key: 'approved', name: 'Approved', icon: CheckCircleIcon, color: 'green' },
    { key: 'paid', name: 'Paid', icon: CurrencyDollarIcon, color: 'blue' },
    { key: 'rejected', name: 'Rejected', icon: XCircleIcon, color: 'red' },
    { key: 'all', name: 'All', icon: ChartBarIcon, color: 'gray' }
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

  const formatDate = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pay Now Requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and approve early payment requests from suppliers
        </p>
      </div>

      {/* Stats */}
      {stats && <PayNowStatsWidget stats={stats} />}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            const Icon = tab.icon
            const count = requests.length

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
                {activeTab === tab.key && count > 0 && (
                  <span className={`
                    ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-900'}
                    hidden ml-3 py-0.5 px-2.5 rounded-full text-xs font-medium md:inline-block
                  `}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Requests Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {requests.length === 0 ? (
          <div className="text-center py-12">
            <BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No requests</h3>
            <p className="mt-1 text-sm text-gray-500">
              {activeTab === 'pending'
                ? 'There are no pending payment requests to review.'
                : `No ${activeTab} payment requests found.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PO Number
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Original Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Discount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requested
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {request.supplier?.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {request.supplier?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{request.purchase_order?.number}</div>
                      <div className="text-sm text-gray-500">Total: {request.purchase_order?.total}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.original_amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">
                        {request.discounted_amount}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-red-600">
                        -{request.discount_amount}
                      </div>
                      <div className="text-xs text-gray-500">
                        ({request.discount_percentage}%)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(request.status)}`}>
                        {request.status_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(request.requested_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewDetails(request)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        View
                      </button>
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(request)}
                            className="text-green-600 hover:text-green-900 mr-3"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(request)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showApproveModal && selectedRequest && (
        <ApproveRejectModal
          isOpen={showApproveModal}
          onClose={() => setShowApproveModal(false)}
          request={selectedRequest}
          action={modalAction}
          onSuccess={handleActionSuccess}
        />
      )}

      {showDetailModal && selectedRequest && (
        <PayNowDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          request={selectedRequest}
        />
      )}
    </div>
  )
}
