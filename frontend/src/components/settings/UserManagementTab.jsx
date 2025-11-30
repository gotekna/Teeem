import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import TeeemTableView from '../documentation/TeeemTableView'
import {
  CheckCircleIcon,
  XMarkIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'

// Admin secret for impersonation (dev/staging only)
const ADMIN_SECRET = 'tekna-admin-2024'

export default function UserManagementTab() {
  const [toast, setToast] = useState(null)
  const [impersonating, setImpersonating] = useState(null)

  const handleImpersonate = async (entry) => {
    if (!confirm(`Login as ${entry.name} (${entry.email})?\n\nYou will be logged out of your current session.`)) {
      return
    }

    setImpersonating(entry.id)
    try {
      const data = await api.post(`/api/v1/auth/impersonate/${entry.id}`, {
        secret: ADMIN_SECRET
      })

      if (data.success && data.token) {
        localStorage.setItem('token', data.token)
        setToast({
          message: `Switching to ${data.user.name}...`,
          type: 'success'
        })
        setTimeout(() => {
          window.location.reload()
        }, 500)
      } else {
        throw new Error(data.error || 'Impersonation failed')
      }
    } catch (err) {
      console.error('Failed to impersonate user:', err)
      setToast({
        message: `Failed to impersonate: ${err.message}`,
        type: 'error'
      })
    } finally {
      setImpersonating(null)
    }
  }

  // Custom cell renderer for actions column (Login As button)
  const customCellRenderer = (entry, columnKey) => {
    if (columnKey === 'actions') {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleImpersonate(entry)
          }}
          disabled={impersonating === entry.id}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors disabled:opacity-50"
          title={`Login as ${entry.name}`}
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          {impersonating === entry.id ? 'Logging in...' : 'Login As'}
        </button>
      )
    }
    return null // Use default rendering for other columns
  }

  return (
    <div className="h-full flex flex-col">
      {/* Link to full table view */}
      <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Quick View</p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
            This is a lightweight view embedded in System Admin. For the full table interface with advanced features, open the dedicated page.
          </p>
        </div>
        <Link
          to="/tables/212"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap"
        >
          Open Full Table
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </Link>
      </div>

      <TeeemTableView
        foundationId={212}
        customCellRenderer={customCellRenderer}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`rounded-lg shadow-lg p-4 ${toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
            <div className="flex items-center gap-3">
              {toast.type === 'success' ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <p className={`text-sm font-medium ${toast.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                {toast.message}
              </p>
              <button
                onClick={() => setToast(null)}
                className={`ml-4 ${toast.type === 'success' ? 'text-green-500 hover:text-green-700' : 'text-red-500 hover:text-red-700'}`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
