import { useEffect, useState } from 'react'
import { api } from '../api'
import TeeemTableView from '../components/documentation/TeeemTableView'
import { UserPlusIcon } from '@heroicons/react/24/outline'
import AddUserModal from '../components/settings/AddUserModal'
import Toast from '../components/Toast'

// Define columns for Users table
const USER_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32, tooltip: 'Select rows for bulk actions' },
  { key: 'id', label: 'ID', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 80, tooltip: 'User ID' },
  { key: 'name', label: 'Name', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200, tooltip: 'User full name' },
  { key: 'email', label: 'Email', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 250, tooltip: 'Email address' },
  { key: 'role', label: 'Role', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 150, tooltip: 'User role (admin, user, etc.)' },
  { key: 'assigned_role', label: 'Group', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 150, tooltip: 'Assigned group/department' },
  { key: 'last_login_at', label: 'Last Login', resizable: true, sortable: true, filterable: false, width: 180, tooltip: 'Last login timestamp' }
]

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/users')
      setUsers(Array.isArray(response) ? response : [])
      setError(null)
    } catch (err) {
      console.error('Failed to load users:', err)
      setError('Failed to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (user) => {
    // TeeemTableView handles inline editing automatically
    // When user edits a field and presses Enter or clicks away, this is called
    try {
      const response = await api.patch(`/api/v1/users/${user.id}`, {
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
          assigned_role: user.assigned_role || ''
        }
      })

      if (response.success) {
        setToast({
          message: 'User updated successfully',
          type: 'success'
        })
        loadUsers()
      }
    } catch (error) {
      console.error('Update error:', error)
      setToast({
        message: error.response?.data?.error || 'Failed to update user',
        type: 'error'
      })
    }
  }

  const handleDelete = async (user) => {
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
        message: 'Failed to remove user',
        type: 'error'
      })
    }
  }

  const handleBulkDelete = async (selectedUsers) => {
    if (!confirm(`Are you sure you want to remove ${selectedUsers.length} user(s)? This action cannot be undone.`)) {
      return
    }

    try {
      const ids = selectedUsers.map(user => user.id)
      // Use batch endpoint - single request instead of N requests
      await api.post('/api/v1/users/bulk_delete', { ids })
      setToast({
        message: `${selectedUsers.length} user(s) removed successfully`,
        type: 'success'
      })
      loadUsers()
    } catch (err) {
      console.error('Failed to remove users:', err)
      setToast({
        message: 'Failed to remove some users',
        type: 'error'
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading users...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage users, roles, and group assignments</p>
        </div>

        {/* TeeemTableView - replaces all the manual table code */}
        <div className="flex-1">
          <TeeemTableView
            category="users"
            foundationId="users"
            tableName="Users"
            entries={users}
            columns={USER_COLUMNS}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            customActions={
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-200 font-medium"
              >
                <UserPlusIcon className="h-5 w-5" />
                Add User
              </button>
            }
          />
        </div>
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onUserAdded={() => {
          setShowAddModal(false)
          loadUsers()
          setToast({
            message: 'User added successfully',
            type: 'success'
          })
        }}
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
