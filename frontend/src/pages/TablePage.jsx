import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import TrapidTableView from '../components/documentation/TrapidTableView'
import { PlusIcon } from '@heroicons/react/24/outline'

// Default width mappings for column types
const COLUMN_TYPE_DEFAULTS = {
  'single_line_text': { width: 150, filterable: true, filterType: 'text' },
  'email': { width: 200, filterable: true, filterType: 'text' },
  'phone': { width: 150, filterable: true, filterType: 'text' },
  'mobile': { width: 150, filterable: true, filterType: 'text' },
  'url': { width: 180, sortable: false, filterable: false },
  'date': { width: 140, filterable: false },
  'date_and_time': { width: 180, filterable: false },
  'gps_coordinates': { width: 280, sortable: false, filterable: false },
  'color_picker': { width: 320, sortable: false, filterable: false },
  'file_upload': { width: 300, sortable: false, filterable: false },
  'action_buttons': { width: 180, sortable: false, filterable: false },
  'lookup': { width: 150, filterable: true, filterType: 'dropdown' },
  'boolean': { width: 100, filterable: true, filterType: 'boolean' },
  'percentage': { width: 120, filterable: false },
  'choice': { width: 140, filterable: true, filterType: 'dropdown' },
  'currency': { width: 120, filterable: false, showSum: true, sumType: 'currency' },
  'number': { width: 100, filterable: false, showSum: true, sumType: 'number' },
  'whole_number': { width: 120, filterable: false, showSum: true, sumType: 'number' },
  'multiple_lines_text': { width: 300, sortable: false, filterable: true, filterType: 'text' },
  'multiple_lookups': { width: 200, sortable: false, filterable: false },
  'user': { width: 120, filterable: true, filterType: 'dropdown' },
  'computed': { width: 140, filterable: false, showSum: true, sumType: 'number' },
}

// Convert API column format to TrapidTableView column format
function convertColumnsToTrapidFormat(apiColumns, tableSlug) {
  // Start with select column for bulk actions
  const columns = [
    { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32, tooltip: 'Select rows for bulk actions' }
  ]

  // Convert each API column
  apiColumns.forEach(col => {
    // Skip system/hidden columns
    if (isSystemOrHiddenColumn(col.column_name)) return

    const defaults = COLUMN_TYPE_DEFAULTS[col.column_type] || { width: 150 }

    columns.push({
      id: col.id, // Database column ID for schema editor
      key: col.column_name,
      label: col.name,
      column_type: col.column_type,
      resizable: true,
      sortable: defaults.sortable !== false,
      filterable: defaults.filterable || false,
      filterType: defaults.filterType,
      width: defaults.width,
      showSum: defaults.showSum,
      sumType: defaults.sumType,
      tooltip: col.description || `${col.column_type} column`,
      // Pass lookup info if available
      lookup_table_id: col.lookup_table_id,
      lookup_display_column: col.lookup_display_column,
    })
  })

  return columns
}

// Check if a column is a system column that's typically hidden
function isSystemOrHiddenColumn(columnName) {
  const systemColumns = [
    'id', 'sys_type_id', 'deleted', 'drive_id', 'folder_id',
    'parent_id', 'parent$type', 'range$type', 'colour_spec$type',
    'tedmodel$type', 'pricebook$type'
  ]

  if (systemColumns.includes(columnName)) return true
  if (columnName.endsWith('$type')) return true
  if (columnName.endsWith('_id') && !['product_id', 'contact_id', 'job_id'].includes(columnName)) return true

  return false
}

export default function TablePage({ embedded = false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [table, setTable] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [trapidColumns, setTrapidColumns] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 100 // Reduced from 500 for better performance with large tables
  const scrollObserverRef = useRef(null)
  const tableContainerRef = useRef(null)

  // Load table metadata
  useEffect(() => {
    loadTable()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load records after table is loaded
  useEffect(() => {
    if (table) {
      loadRecords()
    }
  }, [table, id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Convert columns when table data changes
  useEffect(() => {
    if (table && table.columns) {
      const converted = convertColumnsToTrapidFormat(table.columns, table.slug)
      setTrapidColumns(converted)
    }
  }, [table])

  // Load more records when scrolling near bottom
  const loadMoreRecords = useCallback(() => {
    if (!loadingMore && !loading && hasMore) {
      console.log('[Infinite Scroll] Loading more records, next page:', currentPage + 1)
      loadRecords(currentPage + 1, true)
    }
  }, [loadingMore, loading, hasMore, currentPage])

  // Set up IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!tableContainerRef.current || loading || !hasMore) return

    const options = {
      root: null,
      rootMargin: '200px', // Start loading 200px before reaching bottom
      threshold: 0.1
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadMoreRecords()
        }
      })
    }, options)

    if (scrollObserverRef.current) {
      observer.observe(scrollObserverRef.current)
    }

    return () => {
      if (scrollObserverRef.current) {
        observer.unobserve(scrollObserverRef.current)
      }
    }
  }, [loadMoreRecords, loading, hasMore])

  const loadTable = async () => {
    try {
      const response = await api.get(`/api/v1/tables/${id}`)
      setTable(response.table)
    } catch (err) {
      setError('Failed to load table')
      console.error(err)
    }
  }

  const loadRecords = async (page = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      const response = await api.get(`/api/v1/tables/${id}/records?per_page=${PAGE_SIZE}&page=${page}`)

      if (append) {
        setRecords(prev => [...prev, ...(response.records || [])])
      } else {
        setRecords(response.records || [])
      }

      setCurrentPage(page)
      setTotalPages(response.pagination?.total_pages || 1)
      setTotalCount(response.pagination?.total_count || 0)
      setHasMore(page < (response.pagination?.total_pages || 1))

      if (append) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    } catch (err) {
      setError('Failed to load records')
      console.error(err)
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // CRUD handlers for TrapidTableView
  const handleEdit = async (entry) => {
    try {
      // Filter out UI-only columns (select, actions, etc.) before sending to backend
      const { select, actions, ...recordData } = entry

      // Also filter out any empty string values that were added by the UI
      const cleanedData = Object.fromEntries(
        Object.entries(recordData).filter(([_, v]) => v !== '')
      )

      const response = await api.put(`/api/v1/tables/${id}/records/${entry.id}`, {
        record: cleanedData
      })
      if (response.success) {
        await loadRecords()
      }
    } catch (err) {
      console.error('Failed to update record:', err)
      alert('Failed to update record')
    }
  }

  const handleDelete = async (entry) => {
    try {
      const response = await api.delete(`/api/v1/tables/${id}/records/${entry.id}`)
      if (response.success) {
        await loadRecords()
      }
    } catch (err) {
      console.error('Failed to delete record:', err)
      alert('Failed to delete record')
    }
  }

  const handleBulkDelete = async (entries) => {
    try {
      await Promise.all(
        entries.map(entry =>
          api.delete(`/api/v1/tables/${id}/records/${entry.id}`)
        )
      )
      await loadRecords()
    } catch (err) {
      console.error('Failed to bulk delete records:', err)
      alert('Failed to delete records')
    }
  }

  const handleAddNew = async () => {
    if (!table || !table.columns || table.columns.length === 0) {
      alert('This table has no columns yet. Please add columns before adding records.')
      return
    }

    try {
      const newRecordData = {}
      table.columns.forEach(col => {
        newRecordData[col.column_name] = ''
      })

      const response = await api.post(`/api/v1/tables/${id}/records`, {
        record: newRecordData
      })

      if (response.success) {
        await loadRecords()
      }
    } catch (err) {
      console.error('Failed to add record:', err)
      alert('Failed to add record')
    }
  }

  const handleImport = () => {
    alert('Import functionality coming soon')
  }

  const handleExport = () => {
    // Export current records as CSV
    if (!records.length) {
      alert('No records to export')
      return
    }

    const visibleColumns = table.columns.filter(col => !isSystemOrHiddenColumn(col.column_name))
    const headers = visibleColumns.map(col => col.name)
    const rows = records.map(record =>
      visibleColumns.map(col => {
        const value = record[col.column_name]
        if (value === null || value === undefined) return ''
        if (typeof value === 'object') return value.display || ''
        return String(value)
      })
    )

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${table.slug || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  if (!table) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading table...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${embedded ? '' : '-mx-4 sm:-mx-6 lg:-mx-8 -my-4'} flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-900`} ref={tableContainerRef}>

      {/* TrapidTableView - The Gold Standard */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading records...</p>
            </div>
          </div>
        ) : (
          <TrapidTableView
            tableId={`table-${table.slug || id}`}
            tableIdNumeric={table.id}
            tableName={table.name}
            entries={records}
            columns={trapidColumns}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            enableImport={true}
            enableExport={true}
            enableSchemaEditor={true}
            onImport={handleImport}
            onExport={handleExport}
            onRowDoubleClick={(entry) => {
              // Navigate to detail page based on table type
              if (table.slug === 'contacts' || table.database_table_name === 'contacts') {
                navigate(`/contacts/${entry.id}`)
              } else if (table.slug === 'jobs' || table.database_table_name === 'jobs') {
                navigate(`/jobs/${entry.id}`)
              } else if (table.slug === 'pricebook-items' || table.database_table_name === 'pricebook_items') {
                navigate(`/price-books/${entry.id}`)
              }
              // For other tables, default edit modal opens
            }}
            onView={(entry) => {
              // View button navigates to detail page
              if (table.slug === 'contacts' || table.database_table_name === 'contacts') {
                navigate(`/contacts/${entry.id}`)
              } else if (table.slug === 'jobs' || table.database_table_name === 'jobs') {
                navigate(`/jobs/${entry.id}`)
              } else if (table.slug === 'pricebook-items' || table.database_table_name === 'pricebook_items') {
                navigate(`/price-books/${entry.id}`)
              }
            }}
            onColumnUpdate={() => {
              // Reload table data when column schema is updated
              loadTable()
            }}
            viewOnly={table.slug === 'pricebook-items' || table.database_table_name === 'pricebook_items'}
            customActions={
              <button
                onClick={handleAddNew}
                className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
              >
                <PlusIcon className="h-5 w-5" />
                Add Record
              </button>
            }
          />
        )}
      </div>

      {/* Infinite Scroll Status */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {records.length.toLocaleString()} of {totalCount.toLocaleString()} records
        </div>
        {loadingMore && (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Loading more...</span>
          </div>
        )}
        {!hasMore && records.length > 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            All records loaded
          </div>
        )}
      </div>

      {/* Infinite Scroll Observer Element */}
      {hasMore && !loading && (
        <div
          ref={scrollObserverRef}
          className="h-20 flex items-center justify-center"
        >
          {loadingMore && (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          )}
        </div>
      )}
    </div>
  )
}
