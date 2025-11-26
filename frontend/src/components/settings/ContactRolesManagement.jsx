import { useState, useEffect } from 'react'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { PlusIcon, PencilIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'
import TeeemTableView from '../documentation/TeeemTableView'

export default function ContactRolesManagement() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingRole, setEditingRole] = useState(null)
  const [newRole, setNewRole] = useState('')
  const [newRoleTypes, setNewRoleTypes] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedTabIndex, setSelectedTabIndex] = useState(0)
  const [contactTypes, setContactTypes] = useState([])

  // Fetch contact types from API (RULE #1.13 - Single Source of Truth)
  useEffect(() => {
    const fetchContactTypes = async () => {
      try {
        const response = await api.get('/api/v1/contact_types')
        setContactTypes(response.data || [])
      } catch (error) {
        console.error('Failed to fetch contact types:', error)
        // Fallback to hardcoded types
        setContactTypes([
          { value: 'customer', label: 'Customer', tabLabel: 'Customer' },
          { value: 'supplier', label: 'Supplier', tabLabel: 'Supplier' }
        ])
      }
    }
    fetchContactTypes()
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      const response = await api.get('/api/v1/contact_roles')
      // Transform roles to Trinity format
      const trinityRoles = response.map((role, index) => ({
        id: role.id,
        category: 'contact_roles',
        chapter_number: 0,
        chapter_name: 'Contact Roles',
        section_number: String(index + 1),
        title: role.name,
        entry_type: (!role.contact_types || role.contact_types.length === 0)
          ? 'universal'
          : role.contact_types.join(', '),
        description: (!role.contact_types || role.contact_types.length === 0)
          ? 'Universal (All Types)'
          : role.contact_types.map(t => contactTypes.find(ct => ct.value === t)?.label).join(', '),
        status: role.active ? 'active' : 'inactive',
        _original: role // Keep original for operations
      }))
      setRoles(trinityRoles)
    } catch (error) {
      console.error('Failed to fetch contact roles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRole = async () => {
    if (!newRole.trim()) return

    try {
      const response = await api.post('/api/v1/contact_roles', {
        contact_role: {
          name: newRole.trim(),
          contact_types: newRoleTypes,
          active: true
        }
      })

      // Transform new role to Trinity format
      const trinityRole = {
        id: response.id,
        category: 'contact_roles',
        chapter_number: 0,
        chapter_name: 'Contact Roles',
        section_number: String(roles.length + 1),
        title: response.name,
        entry_type: (!response.contact_types || response.contact_types.length === 0)
          ? 'universal'
          : response.contact_types.join(', '),
        description: (!response.contact_types || response.contact_types.length === 0)
          ? 'Universal (All Types)'
          : response.contact_types.map(t => contactTypes.find(ct => ct.value === t)?.label).join(', '),
        status: response.active ? 'active' : 'inactive',
        _original: response
      }

      setRoles([...roles, trinityRole])
      setNewRole('')
      setNewRoleTypes([])
      setShowAddForm(false)
    } catch (error) {
      console.error('Failed to add role:', error)
      alert(error.message || 'Failed to add role')
    }
  }

  const handleOpenAddForm = () => {
    // Pre-select the current tab's contact type
    const currentContactType = contactTypes[selectedTabIndex]?.value
    setNewRoleTypes(currentContactType ? [currentContactType] : [])
    setShowAddForm(true)
  }

  const handleCancelAddForm = () => {
    setShowAddForm(false)
    setNewRole('')
    setNewRoleTypes([])
  }

  const handleUpdateRole = async (role) => {
    try {
      const response = await api.patch(`/api/v1/contact_roles/${role.id}`, {
        contact_role: {
          name: role.name,
          contact_types: role.contact_types || [],
          active: role.active
        }
      })
      setRoles(roles.map(r => r.id === role.id ? response : r))
      setEditingRole(null)
    } catch (error) {
      console.error('Failed to update role:', error)
      alert(error.message || 'Failed to update role')
    }
  }

  const handleToggleActive = async (role) => {
    try {
      const response = await api.patch(`/api/v1/contact_roles/${role.id}`, {
        contact_role: {
          active: !role.active
        }
      })
      setRoles(roles.map(r => r.id === role.id ? response : r))
    } catch (error) {
      console.error('Failed to toggle role status:', error)
      alert('Failed to update role status')
    }
  }

  const handleDeleteRole = async (roleId) => {
    if (!confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      return
    }

    try {
      await api.delete(`/api/v1/contact_roles/${roleId}`)
      setRoles(roles.filter(r => r.id !== roleId))
    } catch (error) {
      console.error('Failed to delete role:', error)
      alert('Failed to delete role')
    }
  }

  // Filter roles by contact type for current tab
  // Roles with empty contact_types array appear in ALL tabs (universal roles)
  const getFilteredRoles = (contactTypeValue) => {
    return roles.filter(role => {
      const original = role._original
      // Show role if it has no types (universal) OR includes this specific type
      return (!original.contact_types || original.contact_types.length === 0) ||
             (original.contact_types && original.contact_types.includes(contactTypeValue))
    })
  }

  const handleEdit = (entry) => {
    // TODO: Open edit modal
    console.log('Edit role:', entry._original)
  }

  const handleDelete = async (entry) => {
    const role = entry._original
    if (!confirm(`Are you sure you want to delete ${role.name}? This action cannot be undone.`)) {
      return
    }

    try {
      await api.delete(`/api/v1/contact_roles/${role.id}`)
      setRoles(roles.filter(r => r.id !== role.id))
    } catch (error) {
      console.error('Failed to delete role:', error)
      alert('Failed to delete role')
    }
  }

  // Render a table for a specific contact type
  const renderRolesTable = (contactTypeValue) => {
    const filteredRoles = getFilteredRoles(contactTypeValue)

    // Custom action button for adding roles (Chapter 20: h-[42px] alignment)
    const addRoleButton = (
      <button
        onClick={handleOpenAddForm}
        className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
      >
        <PlusIcon className="h-5 w-5" />
        Add Role
      </button>
    )

    return (
      <div className="h-full flex flex-col">
        <TeeemTableView
          entries={filteredRoles}
          onEdit={handleEdit}
          onDelete={handleDelete}
          category="contact_roles"
          customActions={addRoleButton}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <TabGroup selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Contact Person Roles
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage roles for contact persons by type. Universal roles (with no types assigned) appear in all tabs, while type-specific roles only appear for their designated contact types.
        </p>
      </div>

      <TabList className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-6">
        {contactTypes.map((type, index) => {
          const count = getFilteredRoles(type.value).length
          return (
            <Tab
              key={type.value || 'shared'}
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-all
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              {({ selected }) => (
                <span className="flex items-center justify-center gap-2">
                  {type.tabLabel}
                  <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold
                    ${
                      selected
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`
                  }>
                    {count}
                  </span>
                </span>
              )}
            </Tab>
          )
        })}
      </TabList>

      <TabPanels>
        {contactTypes.map((type) => (
          <TabPanel key={type.value || 'shared'}>
            {renderRolesTable(type.value)}
          </TabPanel>
        ))}
      </TabPanels>

      {/* Add Role Form */}
      {showAddForm && (
        <div className="mt-6 p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add New Role</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Role Name
              </label>
              <input
                type="text"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="Enter role name..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contact Types (leave empty for universal role)
              </label>
              <div className="space-y-2">
                {contactTypes.map((type) => (
                  <label key={type.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newRoleTypes.includes(type.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewRoleTypes([...newRoleTypes, type.value])
                        } else {
                          setNewRoleTypes(newRoleTypes.filter(t => t !== type.value))
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAddRole}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Add Role
              </button>
              <button
                onClick={handleCancelAddForm}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Tip:</strong> Roles can be assigned to multiple contact types by editing them and checking the desired types. Roles with no types selected become universal and appear in all tabs. Inactive roles won't appear in dropdowns but existing contact persons will still display them.
        </p>
      </div>
    </TabGroup>
  )
}
