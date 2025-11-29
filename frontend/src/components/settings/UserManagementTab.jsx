import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import TeeemTableView from '../documentation/TeeemTableView'
import {
  UserIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  PlusIcon,
  UserGroupIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  Bars3Icon,
  CheckCircleIcon,
  TrashIcon,
  XMarkIcon,
  XCircleIcon,
  KeyIcon,
  PhoneIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowTopRightOnSquareIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'

// Available assigned roles (matches backend User::ASSIGNABLE_ROLES)
const ASSIGNABLE_ROLES = ['admin', 'sales', 'site', 'supervisor', 'builder', 'estimator']

// Define user-specific columns for the Quick View table
const USER_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'section', label: 'ID', resizable: true, sortable: true, filterable: false, width: 60 },
  { key: 'title', label: 'Name', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200, column_type: 'single_line_text' },
  { key: 'description', label: 'Email', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 250, column_type: 'email' },
  { key: 'entry_type', label: 'Role', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 140 },
  { key: 'component', label: 'Mobile', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 140, column_type: 'phone' },
  { key: 'status', label: 'Status', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
  { key: 'assigned_roles', label: 'Assigned Role', resizable: true, sortable: true, filterable: true, filterType: 'multiselect', width: 180, options: ASSIGNABLE_ROLES },
  { key: 'actions', label: 'Actions', resizable: false, sortable: false, filterable: false, width: 120 }
]

// Admin secret for impersonation (dev/staging only)
const ADMIN_SECRET = 'tekna-admin-2024'

export default function UserManagementTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [impersonating, setImpersonating] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/users')
      // Transform users to Trinity format
      const trinityUsers = (Array.isArray(response) ? response : []).map((user, index) => ({
        id: user.id,
        category: 'users',
        chapter_number: 0,
        chapter_name: 'Users',
        section_number: String(index + 1),
        title: user.name,
        entry_type: user.role || 'user',
        description: user.email,
        component: user.mobile_phone || '',
        status: user.last_login_at ? 'active' : 'inactive',
        assigned_roles: user.assigned_roles || [],
        _original: user // Keep original for editing
      }))
      setUsers(trinityUsers)
      setError(null)
    } catch (err) {
      console.error('Failed to load users:', err)
      setError('Failed to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (entry) => {
    // TODO: Open edit modal for user
    console.log('Edit user:', entry._original)
  }

  // Handle inline row updates (called by TeeemTableView when editing cells)
  const handleRowUpdate = async (rowId, field, value) => {
    console.log('User row update:', { rowId, field, value })

    // Map TeeemTableView field names to API field names
    const fieldMapping = {
      title: 'name',
      description: 'email',
      component: 'mobile_phone',
      entry_type: 'role',
      status: 'status',
      assigned_roles: 'assigned_roles'
    }

    const apiField = fieldMapping[field] || field

    try {
      const response = await api.patch(`/api/v1/users/${rowId}`, {
        user: { [apiField]: value }
      })

      if (response.success || response.user) {
        setToast({
          message: 'User updated successfully',
          type: 'success'
        })
        // Reload users to get fresh data
        loadUsers()
      }
    } catch (err) {
      console.error('Failed to update user:', err)
      setToast({
        message: `Failed to update user: ${err.message}`,
        type: 'error'
      })
    }
  }

  const handleDelete = async (entry) => {
    const user = entry._original
    if (!confirm(`Are you sure you want to remove ${user.name}? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await api.delete(`/api/v1/users/${user.id}`)
      if (response.success) {
        setToast({
          message: 'User removed successfully',
          type: 'success'
        })
        loadUsers()
      }
    } catch (err) {
      console.error('Failed to remove user:', err)
      setToast({
        message: 'Failed to remove user. Please try again.',
        type: 'error'
      })
    }
  }

  const handleImpersonate = async (entry) => {
    const user = entry._original
    if (!confirm(`Login as ${user.name} (${user.email})?\n\nYou will be logged out of your current session.`)) {
      return
    }

    setImpersonating(user.id)
    try {
      // Pass secret in body since api.post doesn't support custom headers
      const data = await api.post(`/api/v1/auth/impersonate/${user.id}`, {
        secret: ADMIN_SECRET
      })

      if (data.success && data.token) {
        // Store the new token - page reload will pick up the new user
        localStorage.setItem('token', data.token)

        setToast({
          message: `Switching to ${data.user.name}...`,
          type: 'success'
        })

        // Reload the page to refresh all components with new user context
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

  // Custom cell renderer for actions column
  const customCellRenderer = (entry, columnKey) => {
    if (columnKey === 'actions') {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleImpersonate(entry)
          }}
          disabled={impersonating === entry._original?.id}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors disabled:opacity-50"
          title={`Login as ${entry.title}`}
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          {impersonating === entry._original?.id ? 'Logging in...' : 'Login As'}
        </button>
      )
    }
    return null // Use default rendering for other columns
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading users...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      </div>
    )
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
        entries={users}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRowUpdate={handleRowUpdate}
        category="users"
        foundationId="users-quick-view"
        columns={USER_COLUMNS}
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
