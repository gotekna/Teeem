import { useState, useEffect } from 'react'
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import TrapidTableView from '../documentation/TrapidTableView'
import Toast from '../Toast'
import GoldStandardFormModal from './GoldStandardFormModal'
import * as goldStandardApi from '../../services/goldStandardApi'
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
  const [toast, setToast] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState(null)

  // Fetch gold standard items and columns from API
  useEffect(() => {
    fetchGoldStandardItems(currentPage)
    fetchColumnIds()
  }, [currentPage])

  const fetchGoldStandardItems = async (page = 1) => {
    try {
      setLoading(true)
      const result = await goldStandardApi.fetchItems({ page, per_page: 250 })
      setData(result.items || [])
      setPagination(result.pagination)
    } catch (err) {
      console.debug('Gold standard items unavailable:', err?.message || 'Unknown error')
      // Show empty table if API fails - no fallback to sample data
      setData([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }

  // Fetch column IDs from API and merge with static config
  const fetchColumnIds = async () => {
    try {
      console.log('🔍 fetchColumnIds: Starting fetch from /api/v1/tables/1')
      const response = await fetch('/api/v1/tables/1')
      if (!response.ok) {
        console.log('❌ fetchColumnIds: Response not OK', response.status)
        return
      }
      const result = await response.json()
      const dbColumns = result.table?.columns || []
      console.log('📥 fetchColumnIds: Received', dbColumns.length, 'columns from API')

      // Log a sample column to see what data we're getting
      const idColumn = dbColumns.find(dc => dc.column_name === 'id')
      if (idColumn) {
        console.log('🔎 Sample column (id):', {
          id: idColumn.id,
          name: idColumn.name,
          column_name: idColumn.column_name,
          header_align: idColumn.header_align,
          data_align: idColumn.data_align
        })
      }

      // Merge database column data with static column config
      const updatedColumns = GOLD_STANDARD_COLUMNS.map(col => {
        // Find matching database column by column_name (key)
        const dbCol = dbColumns.find(dc => dc.column_name === col.key)
        if (dbCol) {
          // Merge ALL database column properties (id, lookup_table_id, lookup_display_column, header_align, data_align, etc.)
          const merged = {
            ...col,
            id: dbCol.id,
            lookup_table_id: dbCol.lookup_table_id,
            lookup_display_column: dbCol.lookup_display_column,
            header_align: dbCol.header_align,
            data_align: dbCol.data_align
          }

          // Log the first few merges for debugging
          if (col.key === 'id' || col.key === 'single_line_text') {
            console.log(`🔀 Merged column ${col.key}:`, {
              key: col.key,
              header_align: merged.header_align,
              data_align: merged.data_align,
              from_db: { header_align: dbCol.header_align, data_align: dbCol.data_align }
            })
          }

          return merged
        }
        return col
      })

      console.log('✅ fetchColumnIds: Setting', updatedColumns.length, 'columns with IDs')
      setColumnsWithIds(updatedColumns)
    } catch (err) {
      console.error('❌ fetchColumnIds error:', err?.message || 'Unknown error')
      // Keep using static columns without IDs
    }
  }

  const handleEdit = async (entry) => {
    try {
      const result = await goldStandardApi.updateItem(entry.id, entry)
      setData(prevData =>
        prevData.map(item => item.id === result.item.id ? result.item : item)
      )
      setToast({ message: 'Item updated successfully', type: 'success' })
    } catch (err) {
      console.error('Error updating item:', err)
      setToast({ message: `Failed to update item: ${err.message}`, type: 'error' })
    }
  }

  const handleDelete = async (entry) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      await goldStandardApi.deleteItem(entry.id)
      setData(prevData =>
        prevData.filter(item => item.id !== entry.id)
      )
      setToast({ message: 'Item deleted successfully', type: 'success' })
    } catch (err) {
      console.error('Error deleting item:', err)
      setToast({ message: `Failed to delete item: ${err.message}`, type: 'error' })
    }
  }

  // Bulk delete handler - no confirmation needed (TrapidTableView already confirmed)
  const handleBulkDelete = async (entries) => {
    try {
      const ids = entries.map(e => e.id)
      await goldStandardApi.bulkDeleteItems(ids)

      // Remove deleted entries from state
      setData(prevData =>
        prevData.filter(item => !ids.includes(item.id))
      )
      setToast({ message: `Successfully deleted ${entries.length} items`, type: 'success' })
    } catch (err) {
      console.error('Error bulk deleting items:', err)
      setToast({ message: `Failed to delete items: ${err.message}`, type: 'error' })
    }
  }

  const handleAddNew = () => {
    setShowAddModal(true)
  }

  const handleSaveNewItem = async (formData) => {
    try {
      await goldStandardApi.createItem(formData)

      // Close modal first for better UX
      setShowAddModal(false)

      // Reload all items from API to ensure consistency
      await fetchGoldStandardItems()

      setToast({ message: 'Item created successfully', type: 'success' })
    } catch (err) {
      console.error('Error creating item:', err)
      setToast({ message: `Failed to save item: ${err.message}`, type: 'error' })
      throw err // Re-throw so modal can handle it
    }
  }

  const handleImport = () => {
    setToast({ message: 'Import feature coming soon', type: 'success' })
  }

  const handleExport = () => {
    setToast({ message: 'Export feature coming soon', type: 'success' })
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
        onColumnUpdate={() => {
          // Reload column definitions when column schema is updated
          console.log('📢 GoldStandardTableTab: Refreshing columns after schema update')
          fetchColumnIds()
        }}
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

      {/* Pagination Controls */}
      {pagination && pagination.total_pages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing <span className="font-medium">{((pagination.current_page - 1) * pagination.per_page) + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(pagination.current_page * pagination.per_page, pagination.total_count)}
              </span>{' '}
              of <span className="font-medium">{pagination.total_count}</span> records
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={!pagination.has_prev_page}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeftIcon className="h-4 w-4" />
                Previous
              </button>

              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page <span className="font-medium">{pagination.current_page}</span> of{' '}
                <span className="font-medium">{pagination.total_pages}</span>
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(pagination.total_pages, prev + 1))}
                disabled={!pagination.has_next_page}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Item Modal */}
      {showAddModal && (
        <GoldStandardFormModal
          item={null}
          onSave={handleSaveNewItem}
          onCancel={() => setShowAddModal(false)}
          currentUserId={getCurrentUserId()}
        />
      )}

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
