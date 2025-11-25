import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { api } from '../api'
import POTable from '../components/purchase-orders/POTable'

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadPurchaseOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/purchase_orders')
      setPurchaseOrders(response.purchase_orders || response || [])
    } catch (err) {
      console.error('Failed to load purchase orders:', err)
      setPurchaseOrders([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (poId) => {
    if (!window.confirm('Are you sure you want to delete this purchase order?')) {
      return
    }

    try {
      await api.delete(`/api/v1/purchase_orders/${poId}`)
      await loadPurchaseOrders()
    } catch (err) {
      console.error('Failed to delete purchase order:', err)
      alert('Failed to delete purchase order. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400">Loading purchase orders...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Purchase Orders</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
            View and manage all purchase orders across all jobs.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            to="/jobs"
            className="inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <PlusIcon className="-ml-0.5 h-5 w-5" />
            New Purchase Order
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-gray-800 sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Purchase Orders</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
            {purchaseOrders.length}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-gray-800 sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Draft</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
            {purchaseOrders.filter(po => po.status === 'draft').length}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-gray-800 sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Pending Approval</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
            {purchaseOrders.filter(po => po.status === 'pending').length}
          </dd>
        </div>
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-gray-800 sm:p-6">
          <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Sent</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
            {purchaseOrders.filter(po => po.status === 'sent').length}
          </dd>
        </div>
      </div>

      {/* Global Search */}
      <div className="mt-6 mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search purchase orders..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          {searchQuery && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <span className="sr-only">Clear search</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Searching: "{searchQuery}"
          </div>
        )}
      </div>

      {/* Purchase Orders Table */}
      <div className="mt-2">
        <POTable
          purchaseOrders={purchaseOrders}
          onDelete={handleDelete}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  )
}
