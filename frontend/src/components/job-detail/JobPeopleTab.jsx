import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserIcon,
  PlusIcon,
  TrashIcon,
  StarIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  WrenchScrewdriverIcon,
  CalculatorIcon,
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { api } from '../../api'

// Role definitions with labels and icons - grouped by category
const ROLE_GROUPS = [
  {
    key: 'client',
    label: 'Client Roles',
    icon: BuildingOfficeIcon,
    roles: [
      { key: 'client', label: 'Client', icon: BuildingOfficeIcon, color: 'indigo' },
      { key: 'client_representative', label: 'Client Representative', icon: UserIcon, color: 'blue' },
      { key: 'client_broker', label: 'Client Broker', icon: UserIcon, color: 'cyan' },
      { key: 'client_bank', label: 'Client Bank', icon: BuildingOfficeIcon, color: 'slate' },
    ]
  },
  {
    key: 'internal',
    label: 'Internal Team',
    icon: UserGroupIcon,
    roles: [
      { key: 'supervisor', label: 'Supervisor', icon: WrenchScrewdriverIcon, color: 'orange' },
      { key: 'estimator', label: 'Estimator', icon: CalculatorIcon, color: 'green' },
      { key: 'internal_sales', label: 'Internal Sales', icon: CurrencyDollarIcon, color: 'purple' },
      { key: 'coordinator', label: 'Coordinator', icon: ClipboardDocumentListIcon, color: 'teal' },
    ]
  },
  {
    key: 'external',
    label: 'External Team',
    icon: UserGroupIcon,
    roles: [
      { key: 'external_sales', label: 'External Sales', icon: CurrencyDollarIcon, color: 'pink' },
    ]
  }
]

// Flat list of all roles for lookups
const ROLE_TYPES = ROLE_GROUPS.flatMap(g => g.roles)

const getRoleConfig = (roleKey) => {
  return ROLE_TYPES.find(r => r.key === roleKey) || { label: roleKey || 'Contact', icon: UserIcon, color: 'gray' }
}

const getRoleBadgeClasses = (color) => {
  const colorMap = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
    cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-400',
    slate: 'bg-slate-100 dark:bg-slate-900/30 text-slate-800 dark:text-slate-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400',
    pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-400',
    teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-400',
    gray: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400',
  }
  return colorMap[color] || colorMap.gray
}

// Internal team roles that use users instead of contacts
const INTERNAL_ROLES = ['supervisor', 'estimator', 'internal_sales', 'coordinator']

export default function JobPeopleTab({ jobId, onUpdate }) {
  const navigate = useNavigate()
  const searchInputRef = useRef(null)
  const [contacts, setContacts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingRole, setAddingRole] = useState(null) // Which role type we're adding
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  const isInternalRole = (role) => INTERNAL_ROLES.includes(role)

  useEffect(() => {
    loadContacts()
    loadUsers()
  }, [jobId])

  // Auto-focus search input when adding (only for non-internal roles)
  useEffect(() => {
    if (addingRole && !isInternalRole(addingRole) && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [addingRole])

  // Auto-select if only one user for internal roles
  useEffect(() => {
    if (addingRole && isInternalRole(addingRole) && users.length === 1) {
      // Check if this user isn't already assigned to this role
      const alreadyAssigned = contacts.some(c => c.user_id === users[0].id && c.role === addingRole)
      if (!alreadyAssigned) {
        handleAddUser(users[0].id)
      }
    }
  }, [addingRole, users])

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/v1/users')
      setUsers(response.users || response || [])
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  const loadContacts = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/jobs/${jobId}/job_contacts`)
      setContacts(response.job_contacts || [])
    } catch (err) {
      console.error('Failed to load contacts:', err)
      setError('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }

  const searchContacts = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }

    try {
      setSearching(true)
      const response = await api.get('/api/v1/contacts', {
        params: {
          search: query,
          per_page: 10
        }
      })

      // Filter out contacts already added with the same role
      const existingForRole = contacts
        .filter(c => c.role === addingRole)
        .map(c => c.contact_id)
      const filtered = (response.contacts || []).filter(
        contact => !existingForRole.includes(contact.id)
      )
      setSearchResults(filtered)
    } catch (err) {
      console.error('Failed to search contacts:', err)
    } finally {
      setSearching(false)
    }
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (addingRole) {
        searchContacts(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, addingRole])

  const handleAddContact = async (contactId) => {
    try {
      setError(null)
      const isFirstClient = addingRole === 'client' &&
        !contacts.some(c => c.role === 'client')

      const response = await api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
        job_contact: {
          contact_id: contactId,
          primary: isFirstClient, // First client is primary
          role: addingRole
        }
      })

      setContacts([...contacts, response])
      setAddingRole(null)
      setSearchQuery('')
      setSearchResults([])
      onUpdate?.()
    } catch (err) {
      console.error('Failed to add contact:', err)
      setError(err.response?.data?.error || err.response?.data?.errors?.join(', ') || 'Failed to add contact')
    }
  }

  const handleAddUser = async (userId) => {
    try {
      setError(null)

      const response = await api.post(`/api/v1/jobs/${jobId}/job_contacts`, {
        job_contact: {
          user_id: userId,
          primary: false, // Internal team members are never primary
          role: addingRole
        }
      })

      setContacts([...contacts, response])
      setAddingRole(null)
      onUpdate?.()
    } catch (err) {
      console.error('Failed to add user:', err)
      setError(err.response?.data?.error || err.response?.data?.errors?.join(', ') || 'Failed to add user')
    }
  }

  const handleRemoveContact = async (constructionContactId) => {
    const contact = contacts.find(c => c.id === constructionContactId)
    const clientContacts = contacts.filter(c => c.role === 'client')

    if (contact?.role === 'client' && clientContacts.length === 1) {
      alert('Cannot remove the last client. At least one client is required.')
      return
    }

    if (!confirm('Are you sure you want to remove this person from the job?')) return

    try {
      setError(null)
      await api.delete(`/api/v1/jobs/${jobId}/job_contacts/${constructionContactId}`)
      setContacts(contacts.filter(c => c.id !== constructionContactId))
      onUpdate?.()
    } catch (err) {
      console.error('Failed to remove contact:', err)
      setError(err.response?.data?.error || 'Failed to remove contact')
    }
  }

  const handleSetPrimary = async (constructionContactId) => {
    try {
      setError(null)
      await api.put(
        `/api/v1/jobs/${jobId}/job_contacts/${constructionContactId}`,
        {
          job_contact: {
            primary: true
          }
        }
      )

      setContacts(contacts.map(c => ({
        ...c,
        primary: c.id === constructionContactId
      })))
      onUpdate?.()
    } catch (err) {
      console.error('Failed to set primary contact:', err)
      setError('Failed to set primary contact')
    }
  }

  const getContactDisplayName = (contact) => {
    return contact.full_name ||
           contact.company_name ||
           `${contact.first_name || ''} ${contact.last_name || ''}`.trim() ||
           'Unnamed Contact'
  }

  const getContactSubtitle = (contact) => {
    const parts = []
    if (contact.company_name && contact.full_name !== contact.company_name) {
      parts.push(contact.company_name)
    }
    if (contact.email) parts.push(contact.email)
    if (contact.mobile_phone) parts.push(contact.mobile_phone)
    return parts.join(' • ')
  }

  // Group contacts by role
  const contactsByRole = ROLE_TYPES.reduce((acc, role) => {
    acc[role.key] = contacts.filter(c => c.role === role.key)
    return acc
  }, {})

  // Contacts without a role
  const unassignedContacts = contacts.filter(c => !c.role || !ROLE_TYPES.find(r => r.key === c.role))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Add Role Buttons */}
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <PlusIcon className="h-5 w-5 mr-2 text-gray-400" />
          Add People to Job
        </h3>
        <div className="space-y-4">
          {ROLE_GROUPS.map((group) => {
            const GroupIcon = group.icon
            return (
              <div key={group.key}>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center">
                  <GroupIcon className="h-4 w-4 mr-1.5" />
                  {group.label}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {group.roles.map((role) => {
                    const Icon = role.icon
                    return (
                      <button
                        key={role.key}
                        onClick={() => {
                          setAddingRole(role.key)
                          setSearchQuery('')
                          setSearchResults([])
                        }}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        Add {role.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Add Person Modal - shows users for internal roles, search for external */}
      {addingRole && !isInternalRole(addingRole) && (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
              Add {getRoleConfig(addingRole).label}
            </h4>
            <button
              onClick={() => {
                setAddingRole(null)
                setSearchQuery('')
                setSearchResults([])
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by name, email, or company..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Search Results */}
          {searching && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              Searching...
            </div>
          )}

          {!searching && searchResults.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
              {searchResults.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => handleAddContact(contact.id)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    {getContactDisplayName(contact)}
                  </div>
                  {getContactSubtitle(contact) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {getContactSubtitle(contact)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              No contacts found
            </div>
          )}

          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center py-2">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}

      {/* Internal Team User Selection - shows list of users */}
      {addingRole && isInternalRole(addingRole) && users.length > 1 && (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
              Select {getRoleConfig(addingRole).label}
            </h4>
            <button
              onClick={() => setAddingRole(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-1">
            {users
              .filter(user => !contacts.some(c => c.user_id === user.id && c.role === addingRole))
              .map(user => (
                <button
                  key={user.id}
                  onClick={() => handleAddUser(user.id)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    {user.name || user.email}
                  </div>
                  {user.name && user.email && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {user.email}
                    </div>
                  )}
                </button>
              ))}
            {users.filter(user => !contacts.some(c => c.user_id === user.id && c.role === addingRole)).length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                All users have already been assigned this role
              </div>
            )}
          </div>
        </div>
      )}

      {/* People by Role Group */}
      {ROLE_GROUPS.map((group) => {
        // Get all contacts for this group
        const groupContacts = group.roles.flatMap(role =>
          (contactsByRole[role.key] || []).map(c => ({ ...c, roleConfig: role }))
        )
        if (groupContacts.length === 0) return null

        const GroupIcon = group.icon
        return (
          <div
            key={group.key}
            className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center mb-4">
                <GroupIcon className="h-5 w-5 mr-2 text-gray-400" />
                {group.label} ({groupContacts.length})
              </h3>

              <div className="space-y-3">
                {groupContacts.map(contact => (
                  <div
                    key={contact.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    {/* Primary Star (only for main client role) */}
                    {contact.role === 'client' && (
                      <button
                        onClick={() => !contact.primary && handleSetPrimary(contact.id)}
                        className={`flex-shrink-0 mt-0.5 ${
                          contact.primary
                            ? 'text-yellow-500 cursor-default'
                            : 'text-gray-300 dark:text-gray-600 hover:text-yellow-500 dark:hover:text-yellow-500'
                        }`}
                        title={contact.primary ? 'Primary client' : 'Set as primary client'}
                      >
                        {contact.primary ? (
                          <StarIconSolid className="h-5 w-5" />
                        ) : (
                          <StarIcon className="h-5 w-5" />
                        )}
                      </button>
                    )}

                    {/* Person Info - handles both contacts and users */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {contact.user ? (
                              <span className="font-medium text-sm text-gray-900 dark:text-white">
                                {contact.user.name || contact.user.email}
                              </span>
                            ) : (
                              <button
                                onClick={() => navigate(`/contacts/${contact.contact_id}`)}
                                className="font-medium text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                              >
                                {getContactDisplayName(contact.contact)}
                              </button>
                            )}
                            {/* Role Badge */}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeClasses(contact.roleConfig.color)}`}>
                              {contact.roleConfig.label}
                            </span>
                            {contact.primary && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                                Primary
                              </span>
                            )}
                          </div>

                          {/* Email and Mobile */}
                          <div className="mt-2 space-y-1">
                            {(contact.user?.email || contact.contact?.email) && (
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Email:</span> {contact.user?.email || contact.contact?.email}
                              </div>
                            )}
                            {contact.contact?.mobile_phone && (
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Mobile:</span> {contact.contact.mobile_phone}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleRemoveContact(contact.id)}
                          className="flex-shrink-0 p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Remove from job"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {/* Unassigned Contacts (legacy) */}
      {unassignedContacts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center mb-4">
              <UserGroupIcon className="h-5 w-5 mr-2 text-gray-400" />
              Other Contacts ({unassignedContacts.length})
            </h3>

            <div className="space-y-3">
              {unassignedContacts.map(contact => (
                <div
                  key={contact.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => navigate(`/contacts/${contact.contact_id}`)}
                          className="font-medium text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                        >
                          {getContactDisplayName(contact.contact)}
                        </button>

                        <div className="mt-2 space-y-1">
                          {contact.contact?.email && (
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Email:</span> {contact.contact.email}
                            </div>
                          )}
                          {contact.contact?.mobile_phone && (
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Mobile:</span> {contact.contact.mobile_phone}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveContact(contact.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Remove from job"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {contacts.length === 0 && (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-12 text-center">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No people added</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by adding a client or other team members to this job.
            </p>
          </div>
        </div>
      )}

      {/* Help text */}
      {contacts.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <StarIconSolid className="inline h-3 w-3 text-yellow-500 mr-1" />
          Click the star to set the primary client for this job.
        </div>
      )}
    </div>
  )
}
