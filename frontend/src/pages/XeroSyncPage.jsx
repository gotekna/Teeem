import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  UserGroupIcon,
  DocumentTextIcon,
  BanknotesIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { api } from '../api'
import XeroConnection from '../components/settings/XeroConnection'

function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function XeroSyncPage() {
  const [connectionStatus, setConnectionStatus] = useState({ loading: true, connected: false })
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncHistory, setSyncHistory] = useState([])
  const [syncing, setSyncing] = useState({
    contacts: false,
    invoices: false,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadConnectionStatus(),
        loadSyncStatus(),
        loadSyncHistory(),
      ])
    } finally {
      setLoading(false)
    }
  }

  const loadConnectionStatus = async () => {
    try {
      const response = await api.get('/api/v1/xero/status')
      setConnectionStatus({
        loading: false,
        connected: response.data.connected,
        organizationName: response.data.tenant_name,
      })
    } catch (err) {
      console.error('Failed to load Xero status:', err)
      setConnectionStatus({ loading: false, connected: false })
    }
  }

  const loadSyncStatus = async () => {
    try {
      const response = await api.get('/api/v1/xero/sync_status')
      setSyncStatus(response.data)
    } catch (err) {
      console.error('Failed to load sync status:', err)
      setSyncStatus(null)
    }
  }

  const loadSyncHistory = async () => {
    try {
      const response = await api.get('/api/v1/xero/sync_history')
      setSyncHistory(response.history || [])
    } catch (err) {
      console.error('Failed to load sync history:', err)
      setSyncHistory([])
    }
  }

  const handleSyncContacts = async () => {
    if (!window.confirm('This will sync all contacts from TEEEM to Xero. Continue?')) {
      return
    }

    try {
      setSyncing({ ...syncing, contacts: true })
      await api.post('/api/v1/xero/sync_contacts')
      alert('Contact sync started successfully! This may take a few minutes.')
      await loadSyncStatus()
      await loadSyncHistory()
    } catch (err) {
      console.error('Failed to sync contacts:', err)
      alert('Failed to sync contacts. Please try again.')
    } finally {
      setSyncing({ ...syncing, contacts: false })
    }
  }

  const getSyncStatusBadge = (status) => {
    const badges = {
      success: { class: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/30', icon: CheckCircleIcon, text: 'Success' },
      in_progress: { class: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30', icon: ClockIcon, text: 'In Progress' },
      failed: { class: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30', icon: ExclamationCircleIcon, text: 'Failed' },
      pending: { class: 'bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/30', icon: ClockIcon, text: 'Pending' },
    }
    return badges[status] || badges.pending
  }

  if (!connectionStatus.connected && !loading) {
    return (
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Xero Integration</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
            Connect your Xero account to sync contacts, invoices, and payments automatically.
          </p>
        </div>

        <XeroConnection />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Xero Sync</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
            Manage your Xero integration and sync data between TEEEM and Xero.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <ArrowPathIcon className="-ml-0.5 h-5 w-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Connection Status</h2>
        <XeroConnection />
      </div>

      {connectionStatus.connected && (
        <>
          {/* Sync Stats */}
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Sync Overview</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-gray-800 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UserGroupIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Contacts Synced</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                        {syncStatus?.contacts_synced || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-gray-800 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <DocumentTextIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Invoices Matched</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                        {syncStatus?.invoices_matched || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-gray-800 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BanknotesIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Payments Synced</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                        {syncStatus?.payments_synced || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-gray-800 sm:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Last Sync</dt>
                      <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                        {syncStatus?.last_sync ? formatDate(syncStatus.last_sync).split(',')[0] : 'Never'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <button
                onClick={handleSyncContacts}
                disabled={syncing.contacts}
                className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
              >
                <div className="flex-shrink-0">
                  {syncing.contacts ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-500"></div>
                  ) : (
                    <UserGroupIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {syncing.contacts ? 'Syncing Contacts...' : 'Sync Contacts'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Push contacts to Xero</p>
                </div>
              </button>

              <Link
                to="/contacts"
                className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
              >
                <div className="flex-shrink-0">
                  <DocumentTextIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Match Invoices</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Link POs to Xero invoices</p>
                </div>
              </Link>

              <Link
                to="/jobs"
                className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
              >
                <div className="flex-shrink-0">
                  <BanknotesIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">View Payments</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">See synced payments</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Sync History */}
          <div className="mb-8">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Sync History</h2>
            <div className="overflow-hidden bg-white shadow dark:bg-gray-800 sm:rounded-md">
              {syncHistory.length === 0 ? (
                <div className="px-4 py-12 text-center sm:px-6">
                  <ClockIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No sync history</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Sync history will appear here as you sync data with Xero.
                  </p>
                </div>
              ) : (
                <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700">
                  {syncHistory.map((entry, index) => {
                    const badge = getSyncStatusBadge(entry.status)
                    const Icon = badge.icon

                    return (
                      <li key={index} className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-x-3 min-w-0 flex-1">
                            <Icon className={`h-5 w-5 flex-shrink-0 ${
                              entry.status === 'success' ? 'text-green-600 dark:text-green-400' :
                              entry.status === 'failed' ? 'text-red-600 dark:text-red-400' :
                              'text-blue-600 dark:text-blue-400'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {entry.type === 'contacts' && 'Contact Sync'}
                                {entry.type === 'invoices' && 'Invoice Match'}
                                {entry.type === 'payments' && 'Payment Sync'}
                              </p>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {entry.message || 'No details available'}
                              </p>
                            </div>
                          </div>
                          <div className="ml-4 flex flex-shrink-0 items-center gap-x-4">
                            <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ring-1 ring-inset ${badge.class}`}>
                              {badge.text}
                            </span>
                            <time className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {formatDate(entry.timestamp)}
                            </time>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Help & Documentation */}
          <div className="rounded-lg bg-blue-50 p-6 dark:bg-blue-900/20">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400">Need help with Xero integration?</h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Contacts sync automatically when you create or update suppliers</li>
                    <li>Match Xero invoices to purchase orders for automatic payment tracking</li>
                    <li>Payments recorded in TEEEM sync to Xero automatically</li>
                    <li>Visit the <Link to="/settings" className="font-medium underline">Settings page</Link> for advanced configuration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
