import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  PlusIcon,
  Cog6ToothIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

// Accounting system badge configurations
const ACCOUNTING_SYSTEMS = {
  xero: {
    name: 'Xero',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-500'
  },
  quickbooks: {
    name: 'QuickBooks',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500'
  },
  myob: {
    name: 'MYOB',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    dotColor: 'bg-purple-500'
  }
}

// Map badge_color to accounting system
const getBadgeColorClass = (badgeColor) => {
  const colorMap = {
    blue: ACCOUNTING_SYSTEMS.xero.color,
    green: ACCOUNTING_SYSTEMS.quickbooks.color,
    purple: ACCOUNTING_SYSTEMS.myob.color
  }
  return colorMap[badgeColor] || ACCOUNTING_SYSTEMS.xero.color
}

const getDotColorClass = (badgeColor) => {
  const colorMap = {
    blue: ACCOUNTING_SYSTEMS.xero.dotColor,
    green: ACCOUNTING_SYSTEMS.quickbooks.dotColor,
    purple: ACCOUNTING_SYSTEMS.myob.dotColor
  }
  return colorMap[badgeColor] || ACCOUNTING_SYSTEMS.xero.dotColor
}

export default function XeroConnectionsSection({ contact, onContactUpdate }) {
  const [xeroLinks, setXeroLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncingLink, setSyncingLink] = useState(null)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [availableTenants, setAvailableTenants] = useState([])
  const [selectedTenant, setSelectedTenant] = useState('')
  const [xeroContacts, setXeroContacts] = useState([])
  const [selectedXeroContact, setSelectedXeroContact] = useState('')
  const [searchingXero, setSearchingXero] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (contact?.id) {
      loadXeroLinks()
      loadAvailableTenants()
    }
  }, [contact?.id])

  const loadXeroLinks = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/contacts/${contact.id}/xero_links`)
      if (response.success) {
        setXeroLinks(response.xero_links || [])
      }
    } catch (err) {
      console.error('Failed to load Xero links:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableTenants = async () => {
    try {
      const response = await api.get('/api/v1/sync_configurations')
      if (response.success) {
        setAvailableTenants(response.sync_configurations || [])
      }
    } catch (err) {
      console.error('Failed to load tenants:', err)
    }
  }

  const searchXeroContacts = async (tenantId) => {
    if (!tenantId) return

    setSearchingXero(true)
    try {
      // Search Xero for contacts matching the current contact's name
      const searchName = contact.full_name || contact.company_name || ''
      const response = await api.get(`/api/v1/xero/contacts?tenant_id=${tenantId}&search=${encodeURIComponent(searchName)}`)
      if (response.success) {
        setXeroContacts(response.data?.contacts || [])
      }
    } catch (err) {
      console.error('Failed to search Xero contacts:', err)
    } finally {
      setSearchingXero(false)
    }
  }

  const handleTenantChange = (tenantId) => {
    setSelectedTenant(tenantId)
    setSelectedXeroContact('')
    if (tenantId) {
      searchXeroContacts(tenantId)
    }
  }

  const handleCreateLink = async () => {
    if (!selectedTenant || !selectedXeroContact) return

    setCreating(true)
    try {
      const tenant = availableTenants.find(t => t.xero_tenant_id === selectedTenant)
      const xeroContact = xeroContacts.find(c => c.ContactID === selectedXeroContact)

      const response = await api.post(`/api/v1/contacts/${contact.id}/xero_links`, {
        xero_link: {
          xero_tenant_id: selectedTenant,
          xero_tenant_name: tenant?.xero_tenant_name || 'Unknown',
          xero_contact_id: selectedXeroContact,
          sync_enabled: true,
          sync_direction: 'bidirectional'
        }
      })

      if (response.success) {
        await loadXeroLinks()
        setShowAddModal(false)
        setSelectedTenant('')
        setSelectedXeroContact('')
        setXeroContacts([])
      } else {
        setError(response.errors?.join(', ') || 'Failed to create link')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleSyncLink = async (linkId) => {
    setSyncingLink(linkId)
    try {
      const response = await api.post(`/api/v1/contacts/${contact.id}/xero_links/${linkId}/sync`)
      if (response.success) {
        await loadXeroLinks()
        if (onContactUpdate) {
          onContactUpdate(response.contact || contact)
        }
      } else {
        setError(response.errors?.join(', ') || 'Sync failed')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncingLink(null)
    }
  }

  const handleDeleteLink = async (linkId) => {
    if (!confirm('Remove this Xero connection? This will unlink the contact from this Xero organization.')) {
      return
    }

    try {
      const response = await api.delete(`/api/v1/contacts/${contact.id}/xero_links/${linkId}`)
      if (response.success) {
        await loadXeroLinks()
      } else {
        setError(response.errors?.join(', ') || 'Failed to delete link')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const formatLastSynced = (dateString) => {
    if (!dateString) return 'Never synced'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-AU')
  }

  const getSyncStatusIcon = (link) => {
    if (link.sync_error) {
      return <XCircleIcon className="h-5 w-5 text-red-500" />
    }
    if (link.has_conflicts) {
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
    }
    if (link.last_synced_at) {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />
    }
    return <XCircleIcon className="h-5 w-5 text-gray-400" />
  }

  const getSyncStatusText = (link) => {
    if (link.sync_error) {
      return `Error: ${link.sync_error}`
    }
    if (link.has_conflicts) {
      return `${link.conflict_count} conflict${link.conflict_count > 1 ? 's' : ''} to resolve`
    }
    if (!link.sync_enabled) {
      return 'Sync disabled'
    }
    return formatLastSynced(link.last_synced_at)
  }

  // Filter out tenants that already have a link
  const linkedTenantIds = xeroLinks.map(l => l.xero_tenant_id)
  const availableTenantsToLink = availableTenants.filter(t => !linkedTenantIds.includes(t.xero_tenant_id))

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-indigo-600 rounded-full" />
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading Xero connections...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Accounting Connections
          </h2>
          {xeroLinks.length > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({xeroLinks.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/contacts/sync-config"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Cog6ToothIcon className="h-4 w-4" />
            Settings
          </Link>
          {availableTenantsToLink.length > 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition"
            >
              <PlusIcon className="h-4 w-4" />
              Link to Xero
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              <XCircleIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* No connections state */}
      {xeroLinks.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <LinkIcon className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            No accounting connections yet
          </p>
          {availableTenantsToLink.length > 0 ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              <PlusIcon className="h-4 w-4" />
              Link to Xero Organization
            </button>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              No Xero organizations available.{' '}
              <Link to="/contacts/sync-config" className="text-indigo-600 hover:text-indigo-700">
                Configure sync settings
              </Link>
            </p>
          )}
        </div>
      ) : (
        /* Connections list */
        <div className="space-y-3">
          {xeroLinks.map((link) => (
            <div
              key={link.id}
              className={`border rounded-lg p-4 transition ${
                link.sync_error
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                  : link.has_conflicts
                  ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {/* Accounting system badge */}
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${getBadgeColorClass(link.badge_color)}`}>
                    <span className={`w-2 h-2 rounded-full ${getDotColorClass(link.badge_color)}`}></span>
                    {link.accounting_system === 'xero' ? 'Xero' :
                     link.accounting_system === 'quickbooks' ? 'QuickBooks' :
                     link.accounting_system === 'myob' ? 'MYOB' : 'Xero'}
                  </span>

                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      {link.xero_tenant_name || 'Unknown Organization'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getSyncStatusIcon(link)}
                      <span className={`text-xs ${
                        link.sync_error
                          ? 'text-red-600 dark:text-red-400'
                          : link.has_conflicts
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {getSyncStatusText(link)}
                      </span>
                    </div>
                    {/* Xero Contact ID */}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                      ID: {link.xero_contact_id?.substring(0, 8)}...
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Sync direction indicator */}
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    link.sync_direction === 'bidirectional'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : link.sync_direction === 'import'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : link.sync_direction === 'export'
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {link.sync_direction === 'bidirectional' ? 'Two-way' :
                     link.sync_direction === 'import' ? 'Import only' :
                     link.sync_direction === 'export' ? 'Export only' : 'Disabled'}
                  </span>

                  {/* Sync button */}
                  <button
                    onClick={() => handleSyncLink(link.id)}
                    disabled={syncingLink === link.id || !link.sync_enabled}
                    className={`p-2 rounded-md transition ${
                      link.sync_enabled
                        ? 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 dark:text-gray-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20'
                        : 'text-gray-400 cursor-not-allowed'
                    }`}
                    title={link.sync_enabled ? 'Sync now' : 'Sync disabled'}
                  >
                    <ArrowPathIcon className={`h-5 w-5 ${syncingLink === link.id ? 'animate-spin' : ''}`} />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteLink(link.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-md transition"
                    title="Remove connection"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Conflict resolution link */}
              {link.has_conflicts && link.conflict_count > 0 && (
                <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800">
                  <Link
                    to={`/contacts/${contact.id}/xero-conflicts?link_id=${link.id}`}
                    className="text-sm text-yellow-700 dark:text-yellow-400 hover:underline"
                  >
                    Resolve {link.conflict_count} conflict{link.conflict_count > 1 ? 's' : ''}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Link to Xero Organization
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setSelectedTenant('')
                    setSelectedXeroContact('')
                    setXeroContacts([])
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Step 1: Select Organization */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  1. Select Xero Organization
                </label>
                <select
                  value={selectedTenant}
                  onChange={(e) => handleTenantChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select an organization --</option>
                  {availableTenantsToLink.map((tenant) => (
                    <option key={tenant.xero_tenant_id} value={tenant.xero_tenant_id}>
                      {tenant.xero_tenant_name || tenant.xero_tenant_id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select Xero Contact */}
              {selectedTenant && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    2. Select Xero Contact
                  </label>
                  {searchingXero ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-indigo-600 rounded-full" />
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Searching Xero...</span>
                    </div>
                  ) : xeroContacts.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                      No matching contacts found in Xero. You may need to create this contact in Xero first.
                    </p>
                  ) : (
                    <select
                      value={selectedXeroContact}
                      onChange={(e) => setSelectedXeroContact(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Select a contact --</option>
                      {xeroContacts.map((xc) => (
                        <option key={xc.ContactID} value={xc.ContactID}>
                          {xc.Name} {xc.EmailAddress ? `(${xc.EmailAddress})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setSelectedTenant('')
                    setSelectedXeroContact('')
                    setXeroContacts([])
                  }}
                  disabled={creating}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateLink}
                  disabled={creating || !selectedTenant || !selectedXeroContact}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Linking...' : 'Link Contact'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
