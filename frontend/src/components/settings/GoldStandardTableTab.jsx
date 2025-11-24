import { useState, useEffect } from 'react'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import TrapidTableView from '../documentation/TrapidTableView'
import { COLUMN_TYPES } from '../../constants/columnTypes'

// Map COLUMN_TYPES (single source of truth) to table column configuration
// This ensures Column Info tab and Gold Standard table always match
const buildGoldStandardColumns = () => {
  // Base columns that always appear
  const baseColumns = [
    { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32, tooltip: 'Checkbox - select rows for bulk actions' },
    { key: 'id', label: 'ID / Primary Key', column_type: 'id', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 80, tooltip: 'Primary Key - Auto-increment ID' }
  ]

  // Map each COLUMN_TYPE to its database column and configuration
  // After cleanup migration, columns are named after their types
  // Column IDs are from the Gold Standard table (Table ID 1) columns table
  const typeToColumnMap = {
    'single_line_text': { key: 'single_line_text', id: 661, width: 150, filterable: true, filterType: 'text' },
    'email': { key: 'email', id: 663, width: 200, filterable: true, filterType: 'text' },
    'phone': { key: 'phone', id: 664, width: 150, filterable: true, filterType: 'text' },
    'mobile': { key: 'mobile', id: 665, width: 150, filterable: true, filterType: 'text' },
    'url': { key: 'url', id: 666, width: 180, sortable: false, filterable: false },
    'date': { key: 'date', id: 671, width: 140, filterable: false },
    'gps_coordinates': { key: 'gps_coordinates', id: 673, width: 280, sortable: false, filterable: false },
    'color_picker': { key: 'color_picker', id: 674, width: 320, sortable: false, filterable: false },
    'file_upload': { key: 'file_upload', id: 675, width: 300, sortable: false, filterable: false },
    'action_buttons': { key: 'action_buttons', id: 676, width: 180, sortable: false, filterable: false },
    'lookup': { key: 'lookup', id: 679, width: 150, filterable: true, filterType: 'dropdown' },
    'boolean': { key: 'boolean', id: 677, width: 100, filterable: true, filterType: 'boolean' },
    'percentage': { key: 'percentage', id: 670, width: 120, filterable: false },
    'choice': { key: 'choice', id: 678, width: 140, filterable: true, filterType: 'dropdown' },
    'currency': { key: 'currency', id: 669, width: 120, filterable: false, showSum: true, sumType: 'currency' },
    'number': { key: 'number', id: 667, width: 100, filterable: false, showSum: true, sumType: 'number' },
    'whole_number': { key: 'whole_number', id: 668, width: 120, filterable: false, showSum: true, sumType: 'number' },
    'computed': {
      key: 'computed',
      id: 682,
      width: 140,
      filterable: false,
      showSum: true,
      sumType: 'currency',
      isComputed: true,
      computeFunction: (entry) => (entry.currency || 0) * (entry.number || 0)
    },
    'date_and_time': { key: 'date_and_time', id: 672, width: 180, filterable: false },
    'multiple_lines_text': { key: 'multiple_lines_text', id: 662, width: 300, sortable: false, filterable: true, filterType: 'text' },
    'multiple_lookups': { key: 'multiple_lookups', id: 680, width: 200, sortable: false, filterable: false },
    'user': { key: 'user', id: 681, width: 120, filterable: true, filterType: 'dropdown' }
  }

  // Helper function to build a column from COLUMN_TYPES
  const buildColumn = (typeValue) => {
    const type = COLUMN_TYPES.find(t => t.value === typeValue)
    const config = typeToColumnMap[typeValue]
    if (!type || !config) return null

    return {
      id: config.id,  // Database column ID for schema editor
      key: config.key,
      label: type.label,
      column_type: typeValue,  // IMPORTANT: Include column type for schema editor
      resizable: true,
      sortable: config.sortable !== false,
      filterable: config.filterable || false,
      filterType: config.filterType,
      width: config.width,
      showSum: config.showSum,
      sumType: config.sumType,
      isComputed: config.isComputed,
      computeFunction: config.computeFunction,
      tooltip: `${type.sqlType} - ${type.usedFor}`
    }
  }

  // Build columns in the EXACT same order as COLUMN_TYPES array
  // This ensures Column Info tab and Gold Standard table match perfectly
  const dynamicColumns = COLUMN_TYPES
    .map(type => buildColumn(type.value))
    .filter(col => col !== null)

  // Add system timestamp columns (created_at and updated_at)
  const dateTimeType = COLUMN_TYPES.find(t => t.value === 'date_and_time')
  if (dateTimeType) {
    // Add created_at
    dynamicColumns.push({
      key: 'created_at',
      label: 'Date & Time (Created)',
      column_type: 'date_and_time',
      resizable: true,
      sortable: true,
      filterable: false,
      width: 180,
      tooltip: `${dateTimeType.sqlType} - When the record was created`
    })

    // Add updated_at
    dynamicColumns.push({
      key: 'updated_at',
      label: 'Date & Time (Updated)',
      column_type: 'date_and_time',  // IMPORTANT: Include column type for schema editor
      resizable: true,
      sortable: true,
      filterable: false,
      width: 180,
      tooltip: `${dateTimeType.sqlType} - When the record was last modified`
    })
  }

  return [...baseColumns, ...dynamicColumns]
}

const GOLD_STANDARD_COLUMNS = buildGoldStandardColumns()

// Helper to get current user ID (defined outside component)
const getCurrentUserId = () => {
  try {
    const user = localStorage.getItem('user')
    if (user) {
      const userData = JSON.parse(user)
      return userData.id || 1 // Default to 1 if no ID
    }
  } catch (e) {
    console.error('Failed to parse user from localStorage:', e)
  }
  return 1 // Default user ID
}

export default function GoldStandardTableTab() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [columnsWithIds, setColumnsWithIds] = useState(GOLD_STANDARD_COLUMNS)
  // Removed: showFeatures state - "Features to Test" section deleted

  const [newItem, setNewItem] = useState({
    single_line_text: '',
    email: '',
    phone: '',
    mobile: '',
    date: '',
    gps_coordinates: '',
    color_picker: '#000000',
    file_upload: '',
    action_buttons: '',
    lookup: '',
    boolean: true,
    percentage: 0,
    choice: 'active',
    currency: 0,
    number: 0,
    whole_number: 0,
    multiple_lines_text: '',
    url: '',
    user: getCurrentUserId(),
    multiple_lookups: ''
  })

  // Fetch gold standard items and columns from API
  useEffect(() => {
    fetchGoldStandardItems()
    fetchColumnIds()
  }, [])

  const fetchGoldStandardItems = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/gold_standard_items')
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }
      const items = await response.json()
      console.log('Fetched items from API:', items.length)
      setData(items)
    } catch (err) {
      console.debug('Gold standard items unavailable:', err?.message || 'Unknown error')
      // Show empty table if API fails - no fallback to sample data
      setData([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch column IDs from API and merge with static config
  const fetchColumnIds = async () => {
    try {
      const response = await fetch('/api/v1/tables/1')
      if (!response.ok) return
      const result = await response.json()
      const dbColumns = result.table?.columns || []

      // Merge database column IDs with static column config
      const updatedColumns = GOLD_STANDARD_COLUMNS.map(col => {
        // Find matching database column by column_name (key)
        const dbCol = dbColumns.find(dc => dc.column_name === col.key)
        if (dbCol) {
          return { ...col, id: dbCol.id }
        }
        return col
      })
      setColumnsWithIds(updatedColumns)
    } catch (err) {
      console.debug('Column IDs unavailable:', err?.message || 'Unknown error')
      // Keep using static columns without IDs
    }
  }

  const handleEdit = async (entry) => {
    try {
      console.log('handleEdit called with entry:', entry)
      const payload = { gold_standard_item: entry }
      console.log('Sending PATCH request with payload:', payload)

      const response = await fetch(`/api/v1/gold_standard_items/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      console.log('Response status:', response.status)
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error('Failed to update item')
      }

      const updatedItem = await response.json()
      console.log('Updated item received from API:', updatedItem)
      setData(prevData =>
        prevData.map(item => item.id === updatedItem.id ? updatedItem : item)
      )
      console.log('Updated:', updatedItem)
    } catch (err) {
      console.error('Error updating item:', err)
      alert(`Failed to update item: ${err.message}`)
    }
  }

  const handleDelete = async (entry) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const response = await fetch(`/api/v1/gold_standard_items/${entry.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete item')

      setData(prevData =>
        prevData.filter(item => item.id !== entry.id)
      )
      console.log('Deleted:', entry)
    } catch (err) {
      console.error('Error deleting item:', err)
      alert(`Failed to delete item: ${err.message}`)
    }
  }

  // Bulk delete handler - no confirmation needed (TrapidTableView already confirmed)
  const handleBulkDelete = async (entries) => {
    try {
      // Delete all entries in parallel
      await Promise.all(
        entries.map(entry =>
          fetch(`/api/v1/gold_standard_items/${entry.id}`, {
            method: 'DELETE'
          })
        )
      )

      // Remove deleted entries from state
      const deletedIds = entries.map(e => e.id)
      setData(prevData =>
        prevData.filter(item => !deletedIds.includes(item.id))
      )
      console.log('Bulk deleted:', entries.length, 'items')
    } catch (err) {
      console.error('Error bulk deleting items:', err)
      alert(`Failed to delete items: ${err.message}`)
    }
  }

  const handleAddNew = () => {
    // Field names must match actual database columns (see Bible Rule #19.37)
    // Source of Truth: Trinity T19.001-T19.021
    setNewItem({
      single_line_text: '',
      email: '',
      phone: '',
      mobile: '',
      date: '',
      gps_coordinates: '',
      color_picker: '#000000',
      file_upload: '',
      action_buttons: '',
      lookup: '',
      boolean: true,
      percentage: 0,
      choice: 'active',
      currency: 0,
      number: 0,
      whole_number: 0,
      multiple_lines_text: '',
      url: '',
      user: getCurrentUserId(),
      multiple_lookups: ''
    })
    setShowAddModal(true)
  }

  const handleSaveNewItem = async () => {
    try {
      const response = await fetch('/api/v1/gold_standard_items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gold_standard_item: newItem })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create item: ${response.status} ${errorText}`)
      }

      const createdItem = await response.json()
      console.log('Created:', createdItem)

      // Close modal first for better UX
      setShowAddModal(false)

      // Reload all items from API to ensure consistency
      await fetchGoldStandardItems()
    } catch (err) {
      console.error('Error creating item:', err)
      alert(`Failed to save item: ${err.message}`)
    }
  }

  const handleImport = () => {
    alert('Import - This would open a file picker to import price book data')
  }

  const handleExport = () => {
    console.log('Export price book data')
    alert('Export functionality - see console for data structure')
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading gold standard items...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Gold Standard - TrapidTableView Reference
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Live database table demonstrating all TrapidTableView column types and features.
          Use this as a reference standard for implementing tables throughout Trapid.
        </p>
      </div>

      <div className="flex-1 min-h-0 px-6">
      <TrapidTableView
        tableId="gold-standard-table"
        tableIdNumeric={1}
        tableName="Gold Standard Reference"
        entries={data}
        columns={columnsWithIds}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        enableImport={true}
        enableExport={true}
        enableSchemaEditor={true}
        onImport={handleImport}
        onExport={handleExport}
        hideUpdateViewButton={true}
        customActions={
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
          >
            <PlusIcon className="h-5 w-5" />
            Add Item
          </button>
        }
      />
      </div>

      {/* Add New Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Item</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Single Line Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Single Line Text
                </label>
                <input
                  type="text"
                  value={newItem.single_line_text}
                  onChange={(e) => setNewItem({ ...newItem, single_line_text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., CONC-001"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newItem.email}
                  onChange={(e) => setNewItem({ ...newItem, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="supplier@example.com"
                />
              </div>

              {/* Phone & Mobile */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newItem.phone}
                    onChange={(e) => setNewItem({ ...newItem, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="(03) 9123 4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mobile
                  </label>
                  <input
                    type="tel"
                    value={newItem.mobile}
                    onChange={(e) => setNewItem({ ...newItem, mobile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0407 397 541"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newItem.date}
                  onChange={(e) => setNewItem({ ...newItem, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* GPS Coordinates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  GPS Coordinates
                </label>
                <input
                  type="text"
                  value={newItem.gps_coordinates}
                  onChange={(e) => setNewItem({ ...newItem, gps_coordinates: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="-33.8688, 151.2093"
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color Picker
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newItem.color_picker}
                    onChange={(e) => setNewItem({ ...newItem, color_picker: e.target.value })}
                    className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newItem.color_picker}
                    onChange={(e) => setNewItem({ ...newItem, color_picker: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono"
                    placeholder="#000000"
                  />
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  File Upload
                </label>
                <input
                  type="text"
                  value={newItem.file_upload}
                  onChange={(e) => setNewItem({ ...newItem, file_upload: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="/uploads/document.pdf"
                />
              </div>

              {/* Lookup */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lookup
                </label>
                <select
                  value={newItem.lookup}
                  onChange={(e) => setNewItem({ ...newItem, lookup: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select...</option>
                  <option value="Concrete">Concrete</option>
                  <option value="Timber">Timber</option>
                  <option value="Steel">Steel</option>
                  <option value="Plasterboard">Plasterboard</option>
                  <option value="Insulation">Insulation</option>
                  <option value="Tiles">Tiles</option>
                  <option value="Paint">Paint</option>
                  <option value="Roofing">Roofing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="Landscaping">Landscaping</option>
                </select>
              </div>

              {/* Choice */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Choice
                </label>
                <select
                  value={newItem.choice}
                  onChange={(e) => setNewItem({ ...newItem, choice: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Boolean */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newItem.boolean}
                  onChange={(e) => setNewItem({ ...newItem, boolean: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Boolean
                </label>
              </div>

              {/* Percentage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Percentage
                </label>
                <input
                  type="number"
                  value={newItem.percentage}
                  onChange={(e) => setNewItem({ ...newItem, percentage: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              {/* Currency, Number, and Whole Number */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currency
                  </label>
                  <input
                    type="number"
                    value={newItem.currency}
                    onChange={(e) => setNewItem({ ...newItem, currency: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Number
                  </label>
                  <input
                    type="number"
                    value={newItem.number}
                    onChange={(e) => setNewItem({ ...newItem, number: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Whole Number
                  </label>
                  <input
                    type="number"
                    value={newItem.whole_number}
                    onChange={(e) => setNewItem({ ...newItem, whole_number: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                    min="0"
                    step="1"
                  />
                </div>
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={newItem.url}
                  onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="https://example.com/document.pdf"
                />
              </div>

              {/* Multiple Lines Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Multiple Lines Text
                </label>
                <textarea
                  value={newItem.multiple_lines_text}
                  onChange={(e) => setNewItem({ ...newItem, multiple_lines_text: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                  placeholder="Enter any notes or description..."
                />
              </div>

              {/* Auto-populated timestamp note */}
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                ID, Created At, and Updated At will be auto-populated when the item is created
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewItem}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
