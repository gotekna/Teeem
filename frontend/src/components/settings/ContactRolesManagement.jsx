import { useState, useEffect } from 'react'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'
import TeeemTableView from '../documentation/TeeemTableView'
import Toast from '../Toast'

// Table ID for Contact Roles (from foundations table)
const CONTACT_ROLES_TABLE_ID = 211

// Column definitions matching the contact_roles table columns
// These will be enriched with IDs from the API
const buildContactRolesColumns = () => [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'id', label: 'ID', column_type: 'whole_number', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 60 },
  { key: 'name', label: 'Role Name', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200, is_title: true },
  { key: 'contact_types', label: 'Contact Types', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200 },
  { key: 'created_at', label: 'Created', column_type: 'date_and_time', resizable: true, sortable: true, filterable: false, width: 150 },
  { key: 'updated_at', label: 'Updated', column_type: 'date_and_time', resizable: true, sortable: true, filterable: false, width: 150 }
]

export default function ContactRolesManagement() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [columns, setColumns] = useState(buildContactRolesColumns())
  const [newRole, setNewRole] = useState('')
  const [newRoleTypes, setNewRoleTypes] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedTabIndex, setSelectedTabIndex] = useState(0)
  const [contactTypes, setContactTypes] = useState([])
  const [toast, setToast] = useState(null)

  // Fetch contact types from API (RULE #1.13 - Single Source of Truth)
  useEffect(() => {
    const fetchContactTypes = async () => {
      try {
        const response = await api.get('/api/v1/contact_types')
        setContactTypes(response || [])
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
    fetchColumnIds()
  }, [])

  const fetchRoles = async () => {
    try {
      const response = await api.get('/api/v1/contact_roles')
      // Transform contact_types array to displayable string for the table
      const transformedRoles = (response || []).map(role => ({
        ...role,
        contact_types_display: (!role.contact_types || role.contact_types.length === 0)
          ? 'Universal'
          : role.contact_types.join(', ')
      }))
      setRoles(transformedRoles)
    } catch (error) {
      console.error('Failed to fetch contact roles:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch column IDs from API and merge with static config
  const fetchColumnIds = async () => {
    try {
      const response = await api.get(`/api/v1/foundations/${CONTACT_ROLES_TABLE_ID}`)
      // API returns { success: true, foundation: { columns: [...] } }
      const dbColumns = response?.foundation?.columns || []
      console.log('📥 Contact Roles: Received', dbColumns.length, 'columns from API')

      // Merge database column data with static column config
      const updatedColumns = buildContactRolesColumns().map(col => {
        const dbCol = dbColumns.find(dc => dc.column_name === col.key)
        if (dbCol) {
          console.log(`🔀 Merged column ${col.key}: id=${dbCol.id}`)
          return {
            ...col,
            id: dbCol.id,
            header_align: dbCol.header_align,
            data_align: dbCol.data_align
          }
        }
        return col
      })

      setColumns(updatedColumns)
    } catch (err) {
      console.error('Failed to fetch column IDs:', err)
    }
  }

  const handleAddRole = async () => {
    if (!newRole.trim()) return

    try {
      const response = await api.post('/api/v1/contact_roles', {
        contact_role: {
          name: newRole.trim(),
          contact_types: newRoleTypes
        }
      })

      // Add transformed role to list
      const newRoleData = {
        ...response,
        contact_types_display: (!response.contact_types || response.contact_types.length === 0)
          ? 'Universal'
          : response.contact_types.join(', ')
      }

      setRoles([...roles, newRoleData])
      setNewRole('')
      setNewRoleTypes([])
      setShowAddForm(false)
      setToast({ message: 'Role created successfully', type: 'success' })
    } catch (error) {
      console.error('Failed to add role:', error)
      setToast({ message: error.message || 'Failed to add role', type: 'error' })
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

  const handleEdit = async (entry) => {
    try {
      const response = await api.patch(`/api/v1/contact_roles/${entry.id}`, {
        contact_role: {
          name: entry.name
        }
      })

      // Update transformed role in list
      const updatedRole = {
        ...response,
        contact_types_display: (!response.contact_types || response.contact_types.length === 0)
          ? 'Universal'
          : response.contact_types.join(', ')
      }

      setRoles(roles.map(r => r.id === entry.id ? updatedRole : r))
      setToast({ message: 'Role updated successfully', type: 'success' })
    } catch (error) {
      console.error('Failed to update role:', error)
      setToast({ message: error.message || 'Failed to update role', type: 'error' })
    }
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Are you sure you want to delete "${entry.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await api.delete(`/api/v1/contact_roles/${entry.id}`)
      setRoles(roles.filter(r => r.id !== entry.id))
      setToast({ message: 'Role deleted successfully', type: 'success' })
    } catch (error) {
      console.error('Failed to delete role:', error)
      setToast({ message: 'Failed to delete role', type: 'error' })
    }
  }

  // Bulk delete handler
  const handleBulkDelete = async (entries) => {
    try {
      const ids = entries.map(e => e.id)
      await Promise.all(ids.map(id => api.delete(`/api/v1/contact_roles/${id}`)))
      setRoles(roles.filter(r => !ids.includes(r.id)))
      setToast({ message: `Successfully deleted ${entries.length} roles`, type: 'success' })
    } catch (error) {
      console.error('Failed to bulk delete roles:', error)
      setToast({ message: 'Failed to delete roles', type: 'error' })
    }
  }

  // Filter roles by contact type for current tab
  // Roles with empty contact_types array appear in ALL tabs (universal roles)
  const getFilteredRoles = (contactTypeValue) => {
    return roles.filter(role => {
      // Show role if it has no types (universal) OR includes this specific type
      return (!role.contact_types || role.contact_types.length === 0) ||
             (role.contact_types && role.contact_types.includes(contactTypeValue))
    })
  }

  // Render a table for a specific contact type using TeeemTableView
  const renderRolesTable = (contactTypeValue) => {
    const filteredRoles = getFilteredRoles(contactTypeValue)

    return (
      <div className="h-full flex flex-col">
        <TeeemTableView
          foundationId={`contact-roles-${contactTypeValue}`}
          foundationIdNumeric={CONTACT_ROLES_TABLE_ID}
          tableName="Contact Roles"
          entries={filteredRoles}
          columns={columns}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          enableImport={false}
          enableExport={true}
          enableSchemaEditor={true}
          hideUpdateViewButton={true}
          onColumnUpdate={() => {
            console.log('Contact Roles: Refreshing columns after schema update')
            fetchColumnIds()
          }}
          customActions={
            <button
              onClick={handleOpenAddForm}
              className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
            >
              <PlusIcon className="h-5 w-5" />
              Add Role
            </button>
          }
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
        {contactTypes.map((type) => {
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
          <strong>Tip:</strong> Roles can be assigned to multiple contact types. Roles with no types selected become universal and appear in all tabs.
        </p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </TabGroup>
  )
}
