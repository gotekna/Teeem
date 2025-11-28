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
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'

// Available assigned roles (matches backend User::ASSIGNABLE_ROLES)
const ASSIGNABLE_ROLES = ['admin', 'sales', 'site', 'supervisor', 'builder', 'estimator']

// Define user-specific columns for the Quick View table
const USER_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'section', label: 'ID', resizable: true, sortable: true, filterable: false, width: 60 },
  { key: 'title', label: 'Name', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200 },
  { key: 'description', label: 'Email', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 250 },
  { key: 'entry_type', label: 'Role', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 140 },
  { key: 'component', label: 'Mobile', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 140 },
  { key: 'status', label: 'Status', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
  { key: 'assigned_roles', label: 'Assigned Role', resizable: true, sortable: true, filterable: true, filterType: 'multiselect', width: 180, options: ASSIGNABLE_ROLES }
]

export default function UserManagementTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

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
        category="users"
        foundationId="users-quick-view"
        columns={USER_COLUMNS}
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
