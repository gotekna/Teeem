import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  UserPlusIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline'
import ColumnVisibilityModal from '../components/modals/ColumnVisibilityModal'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [matchStatus, setMatchStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isMatching, setIsMatching] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [selectedContact, setSelectedContact] = useState(null)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showColumnModal, setShowColumnModal] = useState(false)

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    supplier: true,
    rating: true,
    items: true,
    contact: true,
    status: true,
    actions: true
  })

  // Define all available columns
  const availableColumns = [
    { key: 'supplier', label: 'Supplier Name' },
    { key: 'rating', label: 'Rating' },
    { key: 'items', label: 'Items Count' },
    { key: 'contact', label: 'Supplier Details' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' }
  ]

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  useEffect(() => {
    loadSuppliers()
    loadContacts()
  }, [matchStatus])

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (matchStatus !== 'all') params.append('match_status', matchStatus)

      const response = await api.get(`/api/v1/suppliers?${params.toString()}`)
      setSuppliers(response.suppliers || [])
    } catch (err) {
      setError('Failed to load suppliers')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadContacts = async () => {
    try {
      const response = await api.get('/api/v1/contacts')
      setContacts(response.contacts || [])
    } catch (err) {
      console.error('Failed to load contacts:', err)
    }
  }

  const runAutoMatch = async () => {
    setIsMatching(true)
    try {
      const response = await api.post('/api/v1/suppliers/auto_match', {
        threshold: 0.7,
        verify_exact: false
      })

      alert(`✓ Matched ${response.matched_count} suppliers!`)
      loadSuppliers()
    } catch (err) {
      alert('Failed to run auto-matching')
      console.error(err)
    } finally {
      setIsMatching(false)
    }
  }

  const linkSupplierToContact = async () => {
    if (!selectedSupplier || !selectedContact) return

    try {
      await api.post(`/api/v1/suppliers/${selectedSupplier.id}/link_contact`, {
        contact_id: selectedContact.id
      })

      setShowLinkModal(false)
      setSelectedSupplier(null)
      setSelectedContact(null)
      loadSuppliers()
    } catch (err) {
      alert('Failed to link supplier')
      console.error(err)
    }
  }

  const verifyMatch = async (supplierId) => {
    try {
      await api.post(`/api/v1/suppliers/${supplierId}/verify_match`)
      loadSuppliers()
    } catch (err) {
      alert('Failed to verify match')
      console.error(err)
    }
  }

  const unlinkSupplier = async (supplierId) => {
    if (!confirm('Are you sure you want to unlink this supplier?')) return

    try {
      await api.post(`/api/v1/suppliers/${supplierId}/unlink_contact`)
      loadSuppliers()
    } catch (err) {
      alert('Failed to unlink supplier')
      console.error(err)
    }
  }

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = {
    total: suppliers.length,
    verified: suppliers.filter(s => s.is_verified).length,
    needsReview: suppliers.filter(s => s.contact_id && !s.is_verified).length,
    unmatched: suppliers.filter(s => !s.contact_id).length
  }

  const getMatchBadge = (supplier) => {
    if (!supplier.contact_id) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          <XCircleIcon className="h-3 w-3" />
          Unmatched
        </span>
      )
    }

    if (supplier.is_verified) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircleIcon className="h-3 w-3" />
          Verified
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        <ExclamationTriangleIcon className="h-3 w-3" />
        Needs Review
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading suppliers...</div>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Supplier Management</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage supplier-contact relationships and verify matches</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Suppliers</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Verified</p>
          <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{stats.verified}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Needs Review</p>
          <p className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">{stats.needsReview}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Unmatched</p>
          <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{stats.unmatched}</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowColumnModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <AdjustmentsHorizontalIcon className="h-5 w-5" />
            Columns
          </button>

          <select
            value={matchStatus}
            onChange={(e) => setMatchStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Suppliers</option>
            <option value="verified">Verified</option>
            <option value="needs_review">Needs Review</option>
            <option value="unmatched">Unmatched</option>
          </select>

          <button
            onClick={runAutoMatch}
            disabled={isMatching}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 ${isMatching ? 'animate-spin' : ''}`} />
            {isMatching ? 'Matching...' : 'Run Auto-Match'}
          </button>
        </div>
      </div>

      {/* Suppliers List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                {visibleColumns.supplier && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Supplier
                  </th>
                )}
                {visibleColumns.rating && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rating
                  </th>
                )}
                {visibleColumns.items && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Items
                  </th>
                )}
                {visibleColumns.contact && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Supplier Details
                  </th>
                )}
                {visibleColumns.status && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                )}
                {visibleColumns.actions && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  {visibleColumns.supplier && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/suppliers/${supplier.id}`}
                        className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {supplier.name}
                      </Link>
                    </td>
                  )}
                  {visibleColumns.rating && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {supplier.rating || 0}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">/ 5</span>
                      </div>
                    </td>
                  )}
                  {visibleColumns.items && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {supplier.pricebook_items?.length || 0}
                      </span>
                    </td>
                  )}
                  {visibleColumns.contact && (
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {supplier.contact ? (
                          <span className="text-sm text-gray-900 dark:text-white font-medium">
                            {supplier.contact.full_name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">No contact</span>
                        )}

                        {/* Email addresses */}
                        {supplier.contact_emails && supplier.contact_emails.length > 0 && (
                          <div className="space-y-0.5">
                            {supplier.contact_emails.map((email, idx) => (
                              <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs">
                                {email}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Phone numbers */}
                        {supplier.contact_phones && supplier.contact_phones.length > 0 && (
                          <div className="space-y-0.5">
                            {supplier.contact_phones.map((phone, idx) => (
                              <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                                {phone}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                  {visibleColumns.status && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getMatchBadge(supplier)}
                    </td>
                  )}
                  {visibleColumns.actions && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {!supplier.contact_id && (
                          <button
                            onClick={() => {
                              setSelectedSupplier(supplier)
                              setShowLinkModal(true)
                            }}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Link
                          </button>
                        )}
                        {supplier.contact_id && !supplier.is_verified && (
                          <button
                            onClick={() => verifyMatch(supplier.id)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          >
                            Verify
                          </button>
                        )}
                        {supplier.contact_id && (
                          <button
                            onClick={() => unlinkSupplier(supplier.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Unlink
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Link Supplier Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowLinkModal(false)} />

            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Link Supplier to Contact
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Supplier
                </label>
                <div className="text-sm text-gray-900 dark:text-white font-medium">
                  {selectedSupplier?.name}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contact
                </label>
                <select
                  value={selectedContact?.id || ''}
                  onChange={(e) => {
                    const contact = contacts.find(c => c.id === parseInt(e.target.value))
                    setSelectedContact(contact)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a contact...</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={linkSupplierToContact}
                  disabled={!selectedContact}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Link Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Column Visibility Modal */}
      <ColumnVisibilityModal
        isOpen={showColumnModal}
        onClose={() => setShowColumnModal(false)}
        columns={availableColumns}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
      />
    </div>
  )
}
