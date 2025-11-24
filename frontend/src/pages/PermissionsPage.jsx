import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { usePermission } from '../hooks/usePermission'
import {
  UserGroupIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

export default function PermissionsPage() {
  const { user: currentUser } = useAuth()
  const { can } = usePermission()
  const [users, setUsers] = useState([])
  const [permissions, setPermissions] = useState({})
  const [categories, setCategories] = useState({})
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userPermissions, setUserPermissions] = useState([])
  const [rolePermissions, setRolePermissions] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [updatingPermission, setUpdatingPermission] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load all data in parallel
      const [usersRes, permissionsRes, rolesRes] = await Promise.all([
        api.get('/api/v1/users'),
        api.get('/api/v1/permissions'),
        api.get('/api/v1/permissions/roles')
      ])

      if (usersRes.data.success) {
        setUsers(usersRes.data.users || [])
      }

      if (permissionsRes.data.success) {
        setPermissions(permissionsRes.data.permissions || {})
        setCategories(permissionsRes.data.categories || {})
      }

      if (rolesRes.data.success) {
        setRoles(rolesRes.data.roles || [])
      }
    } catch (err) {
      console.error('Failed to load permissions data:', err)
      setError('Failed to load permissions data')
    } finally {
      setLoading(false)
    }
  }

  const loadUserPermissions = async (userId) => {
    try {
      const response = await api.get(`/api/v1/permissions/user/${userId}`)
      if (response.data.success) {
        setSelectedUser(response.data.user)
        setUserPermissions(response.data.permissions || [])
        setRolePermissions(response.data.role_permissions || [])
      }
    } catch (err) {
      console.error('Failed to load user permissions:', err)
    }
  }

  const togglePermission = async (permissionName, currentlyGranted) => {
    if (!selectedUser) return

    try {
      setUpdatingPermission(permissionName)

      const response = await api.post('/api/v1/permissions/grant', {
        user_id: selectedUser.id,
        permission_name: permissionName,
        granted: !currentlyGranted
      })

      if (response.data.success) {
        // Reload user permissions
        await loadUserPermissions(selectedUser.id)
      }
    } catch (err) {
      console.error('Failed to update permission:', err)
      alert('Failed to update permission')
    } finally {
      setUpdatingPermission(null)
    }
  }

  const hasPermission = (permissionName) => {
    return userPermissions.includes(permissionName)
  }

  const isFromRole = (permissionName) => {
    return rolePermissions.includes(permissionName)
  }

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Check if current user can manage permissions
  // TEMPORARILY DISABLED FOR DEVELOPMENT - TODO: Re-enable before production
  // if (!can('manage_permissions')) {
  //   return (
  //     <div>
  //       <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
  //         <p className="text-red-800 dark:text-red-400">You do not have permission to manage user permissions.</p>
  //       </div>
  //     </div>
  //   )
  // }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
          User Permissions
        </h1>
        <p className="text-gray-600 mt-2">
          Manage user permissions and access control
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* User List */}
        <div className="col-span-4 bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => loadUserPermissions(user.id)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                  selectedUser?.id === user.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{user.name}</h3>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                      {user.role}
                    </span>
                  </div>
                  {selectedUser?.id === user.id && (
                    <CheckIcon className="h-5 w-5 text-blue-600 flex-shrink-0 ml-2" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Permissions Panel */}
        <div className="col-span-8 bg-white rounded-lg shadow">
          {!selectedUser ? (
            <div className="p-12 text-center text-gray-500">
              <UserGroupIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Select a user to manage their permissions</p>
            </div>
          ) : (
            <div>
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900">{selectedUser.name}</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedUser.email}</p>
                <div className="mt-3">
                  <span className="inline-block px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded">
                    Role: {selectedUser.role}
                  </span>
                </div>
              </div>

              <div className="p-6 max-h-[600px] overflow-y-auto">
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Permission Legend</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-gray-700">Permission granted (from role or user override)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-gray-300 rounded"></div>
                      <span className="text-gray-700">Permission not granted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span className="text-gray-700">User override (custom permission)</span>
                    </div>
                  </div>
                </div>

                {Object.entries(permissions).map(([category, perms]) => (
                  <div key={category} className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                      {categories[category] || category}
                    </h3>
                    <div className="space-y-2">
                      {perms.map(perm => {
                        const granted = hasPermission(perm.name)
                        const fromRole = isFromRole(perm.name)
                        const isOverride = granted !== fromRole

                        return (
                          <div
                            key={perm.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border ${
                              granted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                            } ${isOverride ? 'ring-2 ring-blue-400' : ''}`}
                          >
                            <button
                              onClick={() => togglePermission(perm.name, granted)}
                              disabled={updatingPermission === perm.name}
                              className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                granted
                                  ? isOverride
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'bg-green-600 border-green-600'
                                  : 'bg-white border-gray-300 hover:border-gray-400'
                              } ${
                                updatingPermission === perm.name ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                              }`}
                            >
                              {granted && <CheckIcon className="h-4 w-4 text-white" />}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900">{perm.name}</h4>
                                {fromRole && !isOverride && (
                                  <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                                    from role
                                  </span>
                                )}
                                {isOverride && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded">
                                    override
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{perm.description}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
