import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PlusIcon, FolderIcon } from '@heroicons/react/24/outline'
import { api } from '../api'
import TeeemTableView from '../components/documentation/TeeemTableView'
import Toast from '../components/Toast'

// Table ID for Companies (from foundations table)
const COMPANIES_TABLE_ID = 353

// Default width mappings for column types (Gold Standard Pattern)
const COLUMN_TYPE_DEFAULTS = {
  'single_line_text': { width: 150, filterable: true, filterType: 'text' },
  'email': { width: 200, filterable: true, filterType: 'text' },
  'phone': { width: 150, filterable: true, filterType: 'text' },
  'mobile': { width: 150, filterable: true, filterType: 'text' },
  'url': { width: 180, sortable: false, filterable: false },
  'date': { width: 140, filterable: true, filterType: 'text' },
  'date_and_time': { width: 180, filterable: true, filterType: 'text' },
  'gps_coordinates': { width: 280, sortable: false, filterable: false },
  'color_picker': { width: 320, sortable: false, filterable: false },
  'file_upload': { width: 300, sortable: false, filterable: false },
  'action_buttons': { width: 180, sortable: false, filterable: false },
  'lookup': { width: 150, filterable: true, filterType: 'dropdown' },
  'boolean': { width: 100, filterable: true, filterType: 'boolean' },
  'percentage': { width: 120, filterable: true, filterType: 'text' },
  'choice': { width: 140, filterable: true, filterType: 'dropdown' },
  'currency': { width: 120, filterable: true, filterType: 'text', showSum: true, sumType: 'currency' },
  'number': { width: 100, filterable: true, filterType: 'text', showSum: true, sumType: 'number' },
  'whole_number': { width: 120, filterable: true, filterType: 'text', showSum: true, sumType: 'number' },
  'multiple_lines_text': { width: 300, sortable: false, filterable: true, filterType: 'text' },
  'multiple_lookups': { width: 200, sortable: false, filterable: false },
  'user': { width: 120, filterable: true, filterType: 'dropdown' },
  'computed': { width: 140, filterable: false, showSum: true, sumType: 'number' },
}

// Check if a column is a system column that's typically hidden
function isSystemOrHiddenColumn(columnName) {
  const systemColumns = [
    'sys_type_id', 'deleted', 'drive_id', 'folder_id',
    'parent_id', 'parent$type', 'range$type', 'colour_spec$type',
    'tedmodel$type', 'pricebook$type'
  ]

  if (systemColumns.includes(columnName)) return true
  if (columnName.endsWith('$type')) return true
  if (columnName.endsWith('_id') && !['product_id', 'contact_id', 'job_id', 'job_type_id', 'job_status_id'].includes(columnName)) return true

  return false
}

// Convert API column format to TeeemTableView column format (Gold Standard Pattern)
function convertColumnsToTEEEMFormat(apiColumns, foundationId) {
  // Start with select column for bulk actions
  const columns = [
    { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32, tooltip: 'Select rows for bulk actions' }
  ]

  // Convert each API column
  apiColumns.forEach(col => {
    // Skip system/hidden columns
    if (isSystemOrHiddenColumn(col.column_name)) return

    const defaults = COLUMN_TYPE_DEFAULTS[col.column_type] || { width: 150 }

    // Custom width overrides for specific columns
    let width = defaults.width
    if (col.column_name === 'id') width = 60
    if (col.column_name === 'name') width = 250
    if (col.column_name === 'code') width = 80
    if (col.column_name === 'company_group') width = 120
    if (col.column_name === 'status') width = 120
    if (col.column_name === 'formatted_acn') width = 130
    if (col.column_name === 'formatted_abn') width = 150

    columns.push({
      id: col.id, // Database column ID for schema editor
      foundation_id: col.foundation_id || foundationId,
      key: col.column_name,
      label: col.name,
      column_type: col.column_type,
      resizable: true,
      sortable: defaults.sortable !== false,
      filterable: defaults.filterable || false,
      filterType: defaults.filterType,
      width: width,
      showSum: defaults.showSum,
      sumType: defaults.sumType,
      tooltip: col.description || `${col.column_type} column`,
      is_title: col.column_name === 'name', // Mark name as title column
      editable: col.column_name === 'code', // Make code editable
      // Pass lookup info if available
      lookup_foundation_id: col.lookup_foundation_id,
      lookup_display_column: col.lookup_display_column,
      // Pass alignment from database
      header_align: col.header_align,
      data_align: col.data_align,
    })
  })

  return columns
}

export default function CompaniesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [columns, setColumns] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(searchParams.get('group') || 'all')
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'all')
  const [toast, setToast] = useState(null)

  const groups = ['all', 'tekna', 'team_harder', 'promise', 'charity', 'other']
  const statuses = ['all', 'active', 'struck_off', 'in_liquidation', 'dormant']

  useEffect(() => {
    loadCompanies()
    fetchColumns()
  }, [selectedGroup, selectedStatus])

  const loadCompanies = async () => {
    try {
      setLoading(true)

      const params = {}
      if (selectedGroup !== 'all') params.group = selectedGroup
      if (selectedStatus !== 'all') params.status = selectedStatus

      const response = await api.get('/api/v1/companies', { params })
      setCompanies(response.companies || [])
    } catch (error) {
      console.error('Failed to load companies:', error)
      setToast({ message: 'Failed to load companies', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Fetch columns from API and convert to TEEEM format (Gold Standard Pattern)
  const fetchColumns = async () => {
    try {
      const response = await api.get(`/api/v1/foundations/${COMPANIES_TABLE_ID}`)
      const dbColumns = response?.foundation?.columns || []
      console.log('📥 Companies: Received', dbColumns.length, 'columns from API')

      // Convert API columns to TEEEM format
      const teeemColumns = convertColumnsToTEEEMFormat(dbColumns, COMPANIES_TABLE_ID)
      console.log('✅ Companies: Converted to', teeemColumns.length, 'TEEEM columns')

      setColumns(teeemColumns)
    } catch (err) {
      console.error('❌ Companies: Failed to fetch columns:', err)
      setToast({ message: 'Failed to load table schema', type: 'error' })
    }
  }

  const handleGroupChange = (group) => {
    setSelectedGroup(group)
    if (group === 'all') {
      searchParams.delete('group')
    } else {
      searchParams.set('group', group)
    }
    setSearchParams(searchParams)
  }

  const handleStatusChange = (status) => {
    setSelectedStatus(status)
    if (status === 'all') {
      searchParams.delete('status')
    } else {
      searchParams.set('status', status)
    }
    setSearchParams(searchParams)
  }

  const formatGroup = (group) => {
    if (!group) return ''
    return group.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const handleRowClick = (entry) => {
    navigate(`/corporate/companies/${entry.id}`)
  }

  // Build SharePoint URL for corporate folder
  const getSharePointUrl = () => {
    return `https://gotekna-my.sharepoint.com/personal/robert_tekna_com_au/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Frobert%5Ftekna%5Fcom%5Fau%2FDocuments%2FAccounts%20%2D%20Internal%2FCorporate%20File`
  }

  const handleEdit = async (entry) => {
    // Navigate to edit page
    navigate(`/corporate/companies/${entry.id}`)
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Delete company "${entry.name}"? This cannot be undone.`)) return

    try {
      await api.delete(`/api/v1/companies/${entry.id}`)
      setCompanies(companies.filter(c => c.id !== entry.id))
      setToast({ message: 'Company deleted successfully', type: 'success' })
    } catch (err) {
      console.error('Failed to delete company:', err)
      setToast({ message: 'Failed to delete company', type: 'error' })
    }
  }

  const handleBulkDelete = async (entries) => {
    try {
      const ids = entries.map(e => e.id)
      await Promise.all(ids.map(id => api.delete(`/api/v1/companies/${id}`)))
      setCompanies(companies.filter(c => !ids.includes(c.id)))
      setToast({ message: `Successfully deleted ${entries.length} companies`, type: 'success' })
    } catch (err) {
      console.error('Failed to bulk delete companies:', err)
      setToast({ message: 'Failed to delete companies', type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-5 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Companies</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Manage all corporate entities
          </p>
        </div>
      </div>

      {/* Pre-filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor="group" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Group
          </label>
          <select
            id="group"
            value={selectedGroup}
            onChange={(e) => handleGroupChange(e.target.value)}
            className="block w-40 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:text-white"
          >
            {groups.map((group) => (
              <option key={group} value={group}>
                {group === 'all' ? 'All Groups' : formatGroup(group)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            id="status"
            value={selectedStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="block w-40 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:text-white"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'All Statuses' : status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TeeemTableView */}
      <TeeemTableView
        foundationId="companies"
        foundationIdNumeric={COMPANIES_TABLE_ID}
        tableName="Companies"
        entries={companies}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRowDoubleClick={handleRowClick}
        enableImport={false}
        enableExport={true}
        enableSchemaEditor={true}
        hideUpdateViewButton={true}
        onColumnUpdate={() => {
          console.log('Companies: Refreshing columns after schema update')
          fetchColumns()
        }}
        customActions={
          <div className="flex items-center gap-2">
            <a
              href={getSharePointUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-lg transition-colors h-[42px] ring-1 ring-inset ring-blue-200"
            >
              <FolderIcon className="h-5 w-5" />
              SharePoint
            </a>
            <button
              onClick={() => navigate('/corporate/companies/new')}
              className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
            >
              <PlusIcon className="h-5 w-5" />
              Add Company
            </button>
          </div>
        }
      />

      {/* Toast Notifications */}
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
