import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Tab, TabGroup, TabList, TabPanel, TabPanels, Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/react'
import { api } from '../api'
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  EyeIcon,
  PhoneIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ArrowsRightLeftIcon,
  TrashIcon,
  Bars3Icon,
  ChevronUpIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline'
import ColumnVisibilityModal from '../components/modals/ColumnVisibilityModal'
import MergeContactsModal from '../components/contacts/MergeContactsModal'
import Toast from '../components/Toast'

export default function ContactsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [contacts, setContacts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showColumnModal, setShowColumnModal] = useState(false)

  // Map tab names to indices
  const tabs = ['contacts', 'suppliers', 'raw']

  // Get initial tab index from URL query parameter
  const getInitialTabIndex = () => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    const index = tabs.indexOf(tab)
    return index >= 0 ? index : 0
  }

  const [activeTab, setActiveTab] = useState(getInitialTabIndex())
  const [selectedCategories, setSelectedCategories] = useState([])
  const [filter, setFilter] = useState('all') // 'all', 'customers', 'suppliers', 'both'
  const [xeroSyncFilter, setXeroSyncFilter] = useState('all') // 'all', 'synced', 'not_synced'

  // Bulk selection state
  const [selectedContacts, setSelectedContacts] = useState(new Set())
  const [selectedSuppliers, setSelectedSuppliers] = useState(new Set())
  const [openDropdownId, setOpenDropdownId] = useState(null)
  const [bulkContactType, setBulkContactType] = useState('')
  const [updating, setUpdating] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [updatingContactId, setUpdatingContactId] = useState(null)
  const [toast, setToast] = useState(null)
  const [deletingContactId, setDeletingContactId] = useState(null)

  // Column order state for Contacts tab with localStorage persistence
  const [contactColumnOrder, setContactColumnOrder] = useState(() => {
    const saved = localStorage.getItem('contacts_columnOrder')
    return saved ? JSON.parse(saved) : ['name', 'type', 'email', 'phone', 'website', 'xero', 'actions']
  })

  // Column order state for Suppliers tab with localStorage persistence
  const [supplierColumnOrder, setSupplierColumnOrder] = useState(() => {
    const saved = localStorage.getItem('suppliers_columnOrder')
    return saved ? JSON.parse(saved) : ['supplier', 'categories', 'rating', 'items', 'contact', 'status', 'actions']
  })

  // Column-specific search filters
  const [columnFilters, setColumnFilters] = useState({})
  const [draggedColumn, setDraggedColumn] = useState(null)

  // Sort state with primary and secondary sorting
  const [sortBy, setSortBy] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [secondarySortBy, setSecondarySortBy] = useState('type')
  const [secondarySortDirection, setSecondarySortDirection] = useState('asc')

  // Column widths with localStorage persistence
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('contacts_columnWidths')
    return saved ? JSON.parse(saved) : {
      name: 200,
      type: 150,
      email: 250,
      phone: 200,
      website: 150,
      xero: 150,
      actions: 100
    }
  })

  // Column resize state
  const [resizingColumn, setResizingColumn] = useState(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)

  // Column visibility state for Contacts tab
  const [visibleContactColumns, setVisibleContactColumns] = useState({
    name: true,
    type: true,
    email: true,
    phone: true,
    website: true,
    xero: true,
    actions: true
  })

  // Column visibility state for Clients tab
  const [visibleClientColumns, setVisibleClientColumns] = useState({
    supplier: true,
    categories: true,
    rating: true,
    items: true,
    contact: true,
    status: true,
    actions: true
  })

  // Define available columns for each tab
  const contactColumnsConfig = {
    name: { key: 'name', label: 'Contact Name', searchable: true, filterType: 'search' },
    type: { key: 'type', label: 'Contact Type', searchable: true, filterType: 'dropdown' },
    email: { key: 'email', label: 'Email', searchable: true, filterType: 'search' },
    phone: { key: 'phone', label: 'Phone Numbers', searchable: true, filterType: 'search' },
    website: { key: 'website', label: 'Website', searchable: false },
    xero: { key: 'xero', label: 'Xero Status', searchable: true, filterType: 'dropdown' },
    actions: { key: 'actions', label: 'Actions', searchable: false }
  }

  const contactColumns = contactColumnOrder.map(key => contactColumnsConfig[key])

  const clientColumnsConfig = {
    supplier: { key: 'supplier', label: 'Supplier Name', searchable: true },
    categories: { key: 'categories', label: 'Trade Categories', searchable: true },
    rating: { key: 'rating', label: 'Rating', searchable: false },
    items: { key: 'items', label: 'Items Count', searchable: false },
    contact: { key: 'contact', label: 'Supplier Details', searchable: true },
    status: { key: 'status', label: 'Status', searchable: false },
    actions: { key: 'actions', label: 'Actions', searchable: false }
  }

  const clientColumns = supplierColumnOrder.map(key => clientColumnsConfig[key])

  // Update URL when tab changes
  const handleTabChange = (index) => {
    setActiveTab(index)
    const tabName = tabs[index]
    navigate(`/contacts?tab=${tabName}`, { replace: true })
  }

  // Update selected tab when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const newIndex = getInitialTabIndex()
    if (newIndex !== activeTab) {
      setActiveTab(newIndex)
    }
  }, [location.search])

  useEffect(() => {
    loadContacts()
    loadSuppliers()
  }, [filter, xeroSyncFilter])

  // Listen for global search event from AppLayout
  useEffect(() => {
    const handleGlobalSearch = (event) => {
      setSearchQuery(event.detail)
    }

    window.addEventListener('global-search', handleGlobalSearch)
    return () => {
      window.removeEventListener('global-search', handleGlobalSearch)
    }
  }, [])

  // Persist column widths to localStorage
  useEffect(() => {
    localStorage.setItem('contacts_columnWidths', JSON.stringify(columnWidths))
  }, [columnWidths])

  // Persist column order to localStorage
  useEffect(() => {
    localStorage.setItem('contacts_columnOrder', JSON.stringify(contactColumnOrder))
  }, [contactColumnOrder])

  useEffect(() => {
    localStorage.setItem('suppliers_columnOrder', JSON.stringify(supplierColumnOrder))
  }, [supplierColumnOrder])

  const loadContacts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filter !== 'all') {
        params.append('type', filter)
      }
      if (xeroSyncFilter !== 'all') {
        params.append('xero_sync', xeroSyncFilter)
      }
      const endpoint = params.toString() ? `/api/v1/contacts?${params.toString()}` : '/api/v1/contacts'
      const response = await api.get(endpoint)
      setContacts(response.contacts || [])
    } catch (err) {
      setError('Failed to load contacts')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadSuppliers = async () => {
    try {
      const response = await api.get('/api/v1/suppliers')
      setSuppliers(response.suppliers || [])
    } catch (err) {
      console.error('Failed to load suppliers:', err)
    }
  }

  const toggleContactColumn = (columnKey) => {
    setVisibleContactColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  const toggleClientColumn = (columnKey) => {
    setVisibleClientColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  // Column reordering handlers
  const handleDragStart = (e, columnKey) => {
    setDraggedColumn(columnKey)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, targetColumnKey) => {
    e.preventDefault()

    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null)
      return
    }

    const currentOrder = activeTab === 0 ? contactColumnOrder : supplierColumnOrder
    const setOrder = activeTab === 0 ? setContactColumnOrder : setSupplierColumnOrder

    const draggedIndex = currentOrder.indexOf(draggedColumn)
    const targetIndex = currentOrder.indexOf(targetColumnKey)

    const newOrder = [...currentOrder]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumn)

    setOrder(newOrder)
    setDraggedColumn(null)
  }

  // Column filter handler
  const handleColumnFilterChange = (columnKey, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: value
    }))
  }

  // Sort handler
  const handleSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(columnKey)
      setSortDirection('asc')
    }
  }

  // Column resize handlers
  const handleResizeStart = (e, columnKey) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnKey)
    setResizeStartX(e.clientX)
    setResizeStartWidth(columnWidths[columnKey])
  }

  const handleResizeMove = (e) => {
    if (!resizingColumn) return
    const diff = e.clientX - resizeStartX
    const newWidth = Math.max(100, resizeStartWidth + diff)
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth
    }))
  }

  const handleResizeEnd = () => {
    setResizingColumn(null)
  }

  // Add mouse move and mouse up listeners for column resizing
  useEffect(() => {
    if (resizingColumn) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [resizingColumn, resizeStartX, resizeStartWidth])

  // Apply column filters to contacts
  const applyColumnFilters = (items) => {
    if (Object.keys(columnFilters).length === 0) return items

    return items.filter(item => {
      return Object.entries(columnFilters).every(([key, filterValue]) => {
        if (!filterValue || filterValue.trim() === '') return true

        const lowerFilter = filterValue.toLowerCase()

        switch (key) {
          case 'name':
            return item.full_name?.toLowerCase().includes(lowerFilter)
          case 'type':
            return item.primary_contact_type?.toLowerCase().includes(lowerFilter)
          case 'email':
            return item.email?.toLowerCase().includes(lowerFilter)
          case 'phone':
            return item.mobile_phone?.toLowerCase().includes(lowerFilter) ||
                   item.office_phone?.toLowerCase().includes(lowerFilter)
          case 'xero':
            if (filterValue === 'synced') {
              return !!item.xero_id
            } else if (filterValue === 'not_synced') {
              return !item.xero_id
            }
            return true
          case 'supplier':
            return item.name?.toLowerCase().includes(lowerFilter)
          case 'categories':
            return item.trade_categories?.some(cat =>
              cat.toLowerCase().includes(lowerFilter)
            )
          case 'contact':
            return item.contact?.full_name?.toLowerCase().includes(lowerFilter)
          default:
            return true
        }
      })
    })
  }

  // Bulk selection handlers
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)))
    } else {
      setSelectedContacts(new Set())
    }
  }

  const handleSelectContact = (contactId, checked) => {
    const newSelected = new Set(selectedContacts)
    if (checked) {
      newSelected.add(contactId)
    } else {
      newSelected.delete(contactId)
    }
    setSelectedContacts(newSelected)
  }

  const handleBulkUpdate = async () => {
    if (selectedContacts.size === 0) return

    setUpdating(true)
    try {
      const response = await api.patch('/api/v1/contacts/bulk_update', {
        contact_ids: Array.from(selectedContacts),
        contact_types: [bulkContactType],
        primary_contact_type: bulkContactType
      })

      if (response.success) {
        setToast({
          message: `Successfully updated ${response.updated_count} contact${response.updated_count !== 1 ? 's' : ''} to ${bulkContactType}`,
          type: 'success'
        })
        setSelectedContacts(new Set())
        loadContacts() // Refresh the list
      }
    } catch (error) {
      console.error('Bulk update error:', error)
      setToast({
        message: 'Failed to update contacts. Please try again.',
        type: 'error'
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleClearSelection = () => {
    setSelectedContacts(new Set())
  }

  const handleMergeContacts = async (targetId, sourceIds) => {
    try {
      const response = await api.post('/api/v1/contacts/merge', {
        target_id: targetId,
        source_ids: sourceIds
      })

      if (response.success) {
        setToast({
          message: response.message,
          type: 'success'
        })
        setSelectedContacts(new Set())
        setShowMergeModal(false)
        loadContacts() // Refresh the list
      }
    } catch (error) {
      console.error('Merge error:', error)
      throw error // Re-throw to be handled by the modal
    }
  }

  const handleDeleteContact = async (contactId, contactName) => {
    if (!confirm(`Are you sure you want to delete ${contactName}? This action cannot be undone.`)) {
      return
    }

    setDeletingContactId(contactId)
    try {
      const response = await api.delete(`/api/v1/contacts/${contactId}`)

      if (response.success) {
        setToast({
          message: response.message || 'Contact deleted successfully',
          type: 'success'
        })
        loadContacts() // Refresh the list
      }
    } catch (error) {
      console.error('Delete error:', error)
      setToast({
        message: error.message || 'Failed to delete contact',
        type: 'error'
      })
    } finally {
      setDeletingContactId(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return

    const count = selectedContacts.size
    const contactWord = count === 1 ? 'contact' : 'contacts'

    if (!confirm(`Are you sure you want to delete ${count} ${contactWord}? This action cannot be undone.`)) {
      return
    }

    setUpdating(true)
    try {
      const deletePromises = Array.from(selectedContacts).map(contactId =>
        api.delete(`/api/v1/contacts/${contactId}`)
      )

      const results = await Promise.allSettled(deletePromises)

      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      if (succeeded > 0) {
        setToast({
          message: `Successfully deleted ${succeeded} ${succeeded === 1 ? 'contact' : 'contacts'}${failed > 0 ? `. ${failed} failed.` : ''}`,
          type: succeeded === count ? 'success' : 'warning'
        })
      } else {
        setToast({
          message: 'Failed to delete contacts. Please try again.',
          type: 'error'
        })
      }

      setSelectedContacts(new Set())
      loadContacts() // Refresh the list
    } catch (error) {
      console.error('Bulk delete error:', error)
      setToast({
        message: 'Failed to delete contacts. Please try again.',
        type: 'error'
      })
    } finally {
      setUpdating(false)
    }
  }

  // Supplier selection handlers
  const handleSelectSupplier = (supplierId, checked) => {
    const newSelected = new Set(selectedSuppliers)
    if (checked) {
      newSelected.add(supplierId)
    } else {
      newSelected.delete(supplierId)
    }
    setSelectedSuppliers(newSelected)
  }

  const handleSelectAllSuppliers = (checked) => {
    if (checked) {
      setSelectedSuppliers(new Set(filteredSuppliers.map(s => s.id)))
    } else {
      setSelectedSuppliers(new Set())
    }
  }

  const handleUpdateSingleContact = async (contactId, newTypes, newPrimaryType) => {
    setUpdatingContactId(contactId)
    try {
      await api.patch(`/api/v1/contacts/${contactId}`, {
        contact: {
          contact_types: newTypes,
          primary_contact_type: newPrimaryType
        }
      })
      setToast({
        message: `Contact types updated`,
        type: 'success'
      })
      await loadContacts() // Refresh the list
    } catch (error) {
      console.error('Update error:', error)
      setToast({
        message: 'Failed to update contact. Please try again.',
        type: 'error'
      })
    } finally {
      setUpdatingContactId(null)
    }
  }

  const getTypeBadge = (type) => {
    const badges = {
      customer: {
        label: 'Customer',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
      },
      supplier: {
        label: 'Supplier',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
      },
      sales: {
        label: 'Sales',
        className: 'bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400'
      },
      land_agent: {
        label: 'Land Agent',
        className: 'bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400'
      }
    }
    return badges[type] || badges.customer
  }

  // Helper function to render contact table cells in the correct order
  const renderContactCell = (contact, columnKey) => {
    if (!visibleContactColumns[columnKey]) return null

    const width = columnWidths[columnKey]
    const cellStyle = { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }

    switch (columnKey) {
      case 'name':
        return (
          <td key="name" style={cellStyle} className="px-6 py-4 whitespace-nowrap">
            <Link
              to={`/contacts/${contact.id}`}
              className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
            >
              {contact.full_name}
            </Link>
            {(contact.first_name || contact.last_name) && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {contact.first_name} {contact.last_name}
              </div>
            )}
          </td>
        )

      case 'type':
        return (
          <td key="type" style={cellStyle} className="px-6 py-4">
            <div className="flex items-center gap-2 flex-wrap">
              {updatingContactId === contact.id ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  <span className="text-sm text-gray-500">Updating...</span>
                </div>
              ) : contact.primary_contact_type ? (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenDropdownId(openDropdownId === contact.id ? null : contact.id)
                    }}
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${getTypeBadge(contact.primary_contact_type).className}`}
                  >
                    {getTypeBadge(contact.primary_contact_type).label}
                    <ChevronDownIcon className="ml-1 h-3 w-3" />
                  </button>
                  {openDropdownId === contact.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenDropdownId(null)}
                      />
                      <div className="absolute z-20 mt-1 w-56 bg-white dark:bg-gray-800 shadow-lg rounded-md py-2 text-sm border border-gray-200 dark:border-gray-700">
                        <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          Select Types
                        </div>
                        {['customer', 'supplier', 'sales', 'land_agent'].map((type) => {
                          const badge = getTypeBadge(type)
                          const isSelected = contact.contact_types?.includes(type)
                          const isPrimary = contact.primary_contact_type === type
                          return (
                            <div
                              key={type}
                              className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            >
                              <label className="flex items-center gap-2 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    const currentTypes = contact.contact_types || []
                                    let newTypes
                                    let newPrimaryType = contact.primary_contact_type

                                    if (isSelected) {
                                      newTypes = currentTypes.filter(t => t !== type)
                                      if (isPrimary) {
                                        newPrimaryType = newTypes[0] || null
                                      }
                                    } else {
                                      newTypes = [...currentTypes, type]
                                    }

                                    handleUpdateSingleContact(contact.id, newTypes, newPrimaryType)
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                />
                                <span className={isSelected ? 'font-medium' : 'font-normal'}>
                                  {badge.label}
                                </span>
                              </label>
                              {isSelected && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleUpdateSingleContact(contact.id, contact.contact_types, type)
                                  }}
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    isPrimary
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                  }`}
                                >
                                  {isPrimary ? 'Primary' : 'Set Primary'}
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-sm text-gray-400">No type</span>
              )}
            </div>
          </td>
        )

      case 'email':
        return (
          <td key="email" style={cellStyle} className="px-6 py-4">
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <EnvelopeIcon className="h-4 w-4" />
                {contact.email}
              </a>
            ) : (
              <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
            )}
          </td>
        )

      case 'phone':
        return (
          <td key="phone" style={cellStyle} className="px-6 py-4">
            <div className="space-y-1">
              {contact.mobile_phone && (
                <div className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                  <PhoneIcon className="h-4 w-4" />
                  {contact.mobile_phone}
                </div>
              )}
              {contact.office_phone && (
                <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <BuildingOfficeIcon className="h-4 w-4" />
                  {contact.office_phone}
                </div>
              )}
              {!contact.mobile_phone && !contact.office_phone && (
                <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
              )}
            </div>
          </td>
        )

      case 'website':
        return (
          <td key="website" style={cellStyle} className="px-6 py-4">
            {contact.website ? (
              <a
                href={contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <GlobeAltIcon className="h-4 w-4" />
                Visit
              </a>
            ) : (
              <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
            )}
          </td>
        )

      case 'xero':
        return (
          <td key="xero" style={cellStyle} className="px-6 py-4 whitespace-nowrap">
            {contact.xero_id ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Synced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800/50">
                <XCircleIcon className="h-3.5 w-3.5" />
                Not Synced
              </span>
            )}
          </td>
        )

      case 'actions':
        return (
          <td key="actions" style={cellStyle} className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <div className="flex items-center justify-end gap-3">
              <Link
                to={`/contacts/${contact.id}`}
                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View
              </Link>
              <button
                onClick={() => handleDeleteContact(contact.id, contact.full_name)}
                disabled={deletingContactId === contact.id}
                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                title="Delete contact"
              >
                {deletingContactId === contact.id ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                ) : (
                  <TrashIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </td>
        )

      default:
        return null
    }
  }

  // Get unique categories from all suppliers
  const allCategories = Array.from(
    new Set(
      suppliers.flatMap(s => s.trade_categories || [])
    )
  ).sort()

  // Helper function to get sort value for a contact by column key
  const getSortValue = (contact, columnKey) => {
    switch (columnKey) {
      case 'name':
        return contact.full_name?.toLowerCase() || ''
      case 'type':
        return contact.primary_contact_type?.toLowerCase() || ''
      case 'email':
        return contact.email?.toLowerCase() || ''
      case 'phone':
        return contact.mobile_phone?.toLowerCase() || contact.office_phone?.toLowerCase() || ''
      case 'website':
        return contact.website?.toLowerCase() || ''
      case 'xero':
        return contact.xero_id ? '1' : '0'
      default:
        return ''
    }
  }

  const filteredContacts = applyColumnFilters(
    contacts.filter(c =>
      c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  ).sort((a, b) => {
    // Primary sort
    const aPrimaryVal = getSortValue(a, sortBy)
    const bPrimaryVal = getSortValue(b, sortBy)

    if (aPrimaryVal !== bPrimaryVal) {
      if (aPrimaryVal < bPrimaryVal) return sortDirection === 'asc' ? -1 : 1
      if (aPrimaryVal > bPrimaryVal) return sortDirection === 'asc' ? 1 : -1
    }

    // Secondary sort (if primary values are equal)
    const aSecondaryVal = getSortValue(a, secondarySortBy)
    const bSecondaryVal = getSortValue(b, secondarySortBy)

    if (aSecondaryVal < bSecondaryVal) return secondarySortDirection === 'asc' ? -1 : 1
    if (aSecondaryVal > bSecondaryVal) return secondarySortDirection === 'asc' ? 1 : -1
    return 0
  })

  const filteredSuppliers = applyColumnFilters(
    suppliers.filter(s => {
      // Filter by search query
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase())

      // Filter by selected categories (if any selected)
      const matchesCategories = selectedCategories.length === 0 ||
        selectedCategories.some(cat => s.trade_categories?.includes(cat))

      return matchesSearch && matchesCategories
    })
  )

  const contactStats = {
    total: contacts.length,
    withEmail: contacts.filter(c => c.email).length,
    withPhone: contacts.filter(c => c.mobile_phone || c.office_phone).length,
    syncedXero: contacts.filter(c => c.xero_id).length
  }

  const supplierStats = {
    total: suppliers.length,
    verified: suppliers.filter(s => s.is_verified).length,
    needsReview: suppliers.filter(s => s.contact_id && !s.is_verified).length,
    unmatched: suppliers.filter(s => !s.contact_id).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
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
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Contacts & Suppliers <span className="text-base font-normal text-gray-500 dark:text-gray-400">(contacts)</span></h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your contacts and supplier relationships</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 lg:px-8 flex-1 overflow-hidden flex flex-col">
        <TabGroup selectedIndex={activeTab} onChange={handleTabChange} className="flex-1 overflow-hidden flex flex-col">
          <TabList className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-4 max-w-xl">
          <Tab
            className={({ selected }) =>
              `w-full rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-all
              ${
                selected
                  ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            Contacts ({contacts.length})
          </Tab>
          <Tab
            className={({ selected }) =>
              `w-full rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-all
              ${
                selected
                  ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            Suppliers ({suppliers.length})
          </Tab>
          <Tab
            className={({ selected }) =>
              `w-full rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-all flex items-center justify-center gap-1
              ${
                selected
                  ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            <TableCellsIcon className="h-4 w-4" />
            Raw Table
          </Tab>
        </TabList>

        <TabPanels className="flex-1 overflow-hidden flex flex-col">
          {/* Contacts Tab */}
          <TabPanel className="flex-1 overflow-hidden flex flex-col">
            {/* Stats for Contacts */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Contacts</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{contactStats.total}</p>
                  </div>
                  <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <UserGroupIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
              <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">With Email</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{contactStats.withEmail}</p>
                  </div>
                  <div className="h-12 w-12 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <EnvelopeIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>
              <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">With Phone</p>
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">{contactStats.withPhone}</p>
                  </div>
                  <div className="h-12 w-12 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <PhoneIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </div>
              <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Synced with Xero</p>
                    <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{contactStats.syncedXero}</p>
                  </div>
                  <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <CheckCircleIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="mb-6">
              <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-4 flex-wrap">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-2">
                  Contact Type:
                </div>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('customers')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'customers'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Customers
                </button>
                <button
                  onClick={() => setFilter('suppliers')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'suppliers'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Suppliers
                </button>
                <button
                  onClick={() => setFilter('sales')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'sales'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Sales
                </button>
                <button
                  onClick={() => setFilter('land_agents')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'land_agents'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Land Agents
                </button>

                <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 mx-2"></div>

                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-2">
                  Xero Sync:
                </div>
                <button
                  onClick={() => setXeroSyncFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    xeroSyncFilter === 'all'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setXeroSyncFilter('synced')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    xeroSyncFilter === 'synced'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Synced with Xero
                </button>
                <button
                  onClick={() => setXeroSyncFilter('not_synced')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    xeroSyncFilter === 'not_synced'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Not Synced
                </button>

                <div className="ml-auto">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {contacts.length} {filter === 'all' ? 'total' : filter} contacts
                  </p>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
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
                  <EyeIcon className="h-5 w-5" />
                  Columns
                </button>

                <button
                  onClick={() => navigate('/suppliers/new')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/30 transition-all duration-200 font-medium"
                >
                  <UserPlusIcon className="h-5 w-5" />
                  New Contact
                </button>
              </div>
            </div>

            {/* Bulk Update Toolbar */}
            {selectedContacts.size > 0 && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-lg p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-1">
                  <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                    {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
                  </span>

                  <div className="flex items-center gap-2">
                    <label htmlFor="bulk-contact-type" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Change type to:
                    </label>
                    <select
                      id="bulk-contact-type"
                      value={bulkContactType}
                      onChange={(e) => setBulkContactType(e.target.value)}
                      className="block rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 dark:text-white bg-white dark:bg-gray-800 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    >
                      <option value="">Select type...</option>
                      <option value="customer">Customer</option>
                      <option value="supplier">Supplier</option>
                      <option value="sales">Sales</option>
                      <option value="land_agent">Land Agent</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkDelete}
                    disabled={updating || selectedContacts.size === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                  >
                    {updating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <TrashIcon className="h-5 w-5" />
                        Delete
                      </>
                    )}
                  </button>
                  {selectedContacts.size >= 2 && (
                    <button
                      onClick={() => setShowMergeModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium shadow-sm"
                    >
                      <ArrowsRightLeftIcon className="h-5 w-5" />
                      Merge Contacts
                    </button>
                  )}
                  <button
                    onClick={handleBulkUpdate}
                    disabled={updating || !bulkContactType || selectedContacts.size === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                  >
                    {updating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Updating...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-5 w-5" />
                        Update Type
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleClearSelection}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Contacts Table */}
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#9CA3AF #E5E7EB'
            }}>
              <div className="w-full h-full">
                <table key={`contacts-${filter}-${contacts.length}`} className="border-collapse" style={{ minWidth: '100%', width: 'max-content' }}>
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 sticky top-0 z-10">
                    <tr>
                      <th style={{ minWidth: '50px' }} className="px-6 py-3 border-r border-gray-200 dark:border-gray-700 text-left">
                        <input
                          type="checkbox"
                          checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-600 dark:bg-gray-700 cursor-pointer"
                        />
                      </th>
                      {contactColumns.map((column) => {
                        if (!visibleContactColumns[column.key]) return null
                        const width = columnWidths[column.key]
                        const isSortable = column.key !== 'actions'
                        const isSorted = sortBy === column.key
                        return (
                          <th
                            key={column.key}
                            style={{ width: `${width}px`, minWidth: `${width}px`, position: 'relative' }}
                            className={`px-6 py-2 border-r border-gray-200 dark:border-gray-700 ${column.key === 'actions' ? 'text-right' : 'text-left'} ${draggedColumn === column.key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, column.key)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, column.key)}
                          >
                            <div
                              className={`flex items-center gap-2 ${isSortable ? 'cursor-pointer' : 'cursor-move'}`}
                              onClick={() => isSortable && handleSort(column.key)}
                            >
                              <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{column.label}</span>
                              {isSortable && isSorted && (
                                sortDirection === 'asc' ?
                                  <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                  <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              )}
                            </div>
                            {column.searchable && (
                              column.filterType === 'dropdown' ? (
                                <select
                                  value={columnFilters[column.key] || ''}
                                  onChange={(e) => handleColumnFilterChange(column.key, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                                >
                                  {column.key === 'type' ? (
                                    <>
                                      <option value="">All Types</option>
                                      <option value="customer">Customer</option>
                                      <option value="supplier">Supplier</option>
                                      <option value="sales">Sales</option>
                                      <option value="land_agent">Land Agent</option>
                                    </>
                                  ) : column.key === 'xero' ? (
                                    <>
                                      <option value="">All Status</option>
                                      <option value="synced">Synced</option>
                                      <option value="not_synced">Not Synced</option>
                                    </>
                                  ) : null}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  placeholder={`Search...`}
                                  value={columnFilters[column.key] || ''}
                                  onChange={(e) => handleColumnFilterChange(column.key, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                                />
                              )
                            )}
                            {/* Resize handle */}
                            <div
                              className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                              onMouseDown={(e) => handleResizeStart(e, column.key)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredContacts.length === 0 && (
                      <tr>
                        <td colSpan={Object.values(visibleContactColumns).filter(Boolean).length + 1} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                          {searchQuery || Object.keys(columnFilters).length > 0
                            ? 'No contacts found matching your filters'
                            : 'No contacts found. Click "New Contact" to create one.'}
                        </td>
                      </tr>
                    )}
                    {filteredContacts.map((contact) => (
                      <tr
                        key={contact.id}
                        className={`transition-colors duration-150 ${
                          selectedContacts.has(contact.id)
                            ? 'bg-indigo-50 dark:bg-indigo-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedContacts.has(contact.id)}
                            onChange={(e) => handleSelectContact(contact.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-600 dark:bg-gray-700 cursor-pointer"
                          />
                        </td>
                        {contactColumns.map((column) => renderContactCell(contact, column.key))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabPanel>

          {/* Suppliers Tab */}
          <TabPanel className="flex-1 overflow-hidden flex flex-col">
            {/* Stats for Suppliers */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Suppliers</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{supplierStats.total}</p>
                  </div>
                  <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <UserPlusIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
              <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Verified</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{supplierStats.verified}</p>
                  </div>
                  <div className="h-12 w-12 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>
              <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Needs Review</p>
                    <p className="text-3xl font-bold text-yellow-800 dark:text-yellow-500 mt-2">{supplierStats.needsReview}</p>
                  </div>
                  <div className="h-12 w-12 bg-yellow-100 dark:bg-yellow-400/10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <CheckCircleIcon className="h-6 w-6 text-yellow-800 dark:text-yellow-500" />
                  </div>
                </div>
              </div>
              <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unmatched</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{supplierStats.unmatched}</p>
                  </div>
                  <div className="h-12 w-12 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
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
                {/* Category Filter */}
                <Listbox value={selectedCategories} onChange={setSelectedCategories} multiple>
                  <div className="relative">
                    <ListboxButton className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition min-w-[140px] justify-between">
                      <span className="truncate">
                        {selectedCategories.length === 0
                          ? 'All Categories'
                          : `${selectedCategories.length} selected`}
                      </span>
                      <ChevronDownIcon className="h-5 w-5" />
                    </ListboxButton>
                    <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-64 overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                      {allCategories.map((category) => (
                        <ListboxOption
                          key={category}
                          value={category}
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                              active ? 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-200' : 'text-gray-900 dark:text-gray-100'
                            }`
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                {category}
                              </span>
                              {selected && (
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600 dark:text-indigo-400">
                                  <CheckCircleIcon className="h-5 w-5" />
                                </span>
                              )}
                            </>
                          )}
                        </ListboxOption>
                      ))}
                    </ListboxOptions>
                  </div>
                </Listbox>

                <button
                  onClick={() => setShowColumnModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <EyeIcon className="h-5 w-5" />
                  Columns
                </button>

                <button
                  onClick={() => navigate('/suppliers/new')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/30 transition-all duration-200 font-medium"
                >
                  <UserPlusIcon className="h-5 w-5" />
                  New Contact
                </button>
              </div>
            </div>

            {/* Suppliers Table */}
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#9CA3AF #E5E7EB'
            }}>
              <div className="w-full h-full">
                <table className="border-collapse" style={{ minWidth: '100%', width: 'max-content' }}>
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 sticky top-0 z-10">
                    <tr>
                      <th style={{ minWidth: '50px' }} className="px-6 py-3 border-r border-gray-200 dark:border-gray-700 text-left">
                        <input
                          type="checkbox"
                          checked={selectedSuppliers.size === filteredSuppliers.length && filteredSuppliers.length > 0}
                          onChange={(e) => handleSelectAllSuppliers(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-600 dark:bg-gray-700 cursor-pointer"
                        />
                      </th>
                      {visibleClientColumns.supplier && (
                        <th style={{ minWidth: '200px' }} className="px-6 py-3 border-r border-gray-200 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Supplier
                        </th>
                      )}
                      {visibleClientColumns.categories && (
                        <th style={{ minWidth: '250px' }} className="px-6 py-3 border-r border-gray-200 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Trade Categories
                        </th>
                      )}
                      {visibleClientColumns.rating && (
                        <th style={{ minWidth: '100px' }} className="px-6 py-3 border-r border-gray-200 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Rating
                        </th>
                      )}
                      {visibleClientColumns.items && (
                        <th style={{ minWidth: '100px' }} className="px-6 py-3 border-r border-gray-200 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Items
                        </th>
                      )}
                      {visibleClientColumns.contact && (
                        <th style={{ minWidth: '200px' }} className="px-6 py-3 border-r border-gray-200 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Contact
                        </th>
                      )}
                      {visibleClientColumns.status && (
                        <th style={{ minWidth: '150px' }} className="px-6 py-3 border-r border-gray-200 dark:border-gray-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                      )}
                      {visibleClientColumns.actions && (
                        <th style={{ minWidth: '100px' }} className="px-6 py-3 border-r border-gray-200 dark:border-gray-700 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredSuppliers.map((supplier) => (
                      <tr key={supplier.id} className={`transition-colors duration-150 ${
                        selectedSuppliers.has(supplier.id)
                          ? 'bg-indigo-50 dark:bg-indigo-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedSuppliers.has(supplier.id)}
                            onChange={(e) => handleSelectSupplier(supplier.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-600 dark:bg-gray-700 cursor-pointer"
                          />
                        </td>
                        {visibleClientColumns.supplier && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link
                              to={`/suppliers/${supplier.id}`}
                              className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              {supplier.name}
                            </Link>
                          </td>
                        )}
                        {visibleClientColumns.categories && (
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {supplier.trade_categories && supplier.trade_categories.length > 0 ? (
                                supplier.trade_categories.slice(0, 3).map((category, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                                  >
                                    {category}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                              )}
                              {supplier.trade_categories && supplier.trade_categories.length > 3 && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                                  +{supplier.trade_categories.length - 3} more
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        {visibleClientColumns.rating && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-gray-900 dark:text-white">
                                {supplier.rating || 0}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">/ 5</span>
                            </div>
                          </td>
                        )}
                        {visibleClientColumns.items && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900 dark:text-white">
                              {supplier.pricebook_items?.length || 0}
                            </span>
                          </td>
                        )}
                        {visibleClientColumns.contact && (
                          <td className="px-6 py-4">
                            {supplier.contact ? (
                              <span className="text-sm text-gray-900 dark:text-white font-medium">
                                {supplier.contact.full_name}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400">No contact</span>
                            )}
                          </td>
                        )}
                        {visibleClientColumns.status && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {!supplier.contact_id ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50">
                                <XCircleIcon className="h-3.5 w-3.5" />
                                Unmatched
                              </span>
                            ) : supplier.is_verified ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50">
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-500">
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                Needs Review
                              </span>
                            )}
                          </td>
                        )}
                        {visibleClientColumns.actions && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              to={`/suppliers/${supplier.id}`}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              View
                            </Link>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabPanel>

          {/* Raw Table Tab */}
          <TabPanel className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">Raw Database View</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    View all 63 columns from the contacts database table. Table ID: 188
                  </p>
                </div>
                <Link
                  to="/tables/contacts"
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"
                >
                  <TableCellsIcon className="h-4 w-4" />
                  Open Full Table View
                </Link>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <iframe
                src="/embed/tables/contacts"
                className="w-full h-full border-0"
                title="Raw Contacts Table"
              />
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>

    {/* Column Visibility Modal */}
    <ColumnVisibilityModal
      isOpen={showColumnModal}
      onClose={() => setShowColumnModal(false)}
      columns={activeTab === 0 ? contactColumns : clientColumns}
      visibleColumns={activeTab === 0 ? visibleContactColumns : visibleClientColumns}
      onToggleColumn={activeTab === 0 ? toggleContactColumn : toggleClientColumn}
    />

    {/* Merge Contacts Modal */}
    <MergeContactsModal
      isOpen={showMergeModal}
      onClose={() => setShowMergeModal(false)}
      selectedContacts={Array.from(selectedContacts)
        .map(id => filteredContacts.find(c => c.id === id))
        .filter(Boolean)}
      onMerge={handleMergeContacts}
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
