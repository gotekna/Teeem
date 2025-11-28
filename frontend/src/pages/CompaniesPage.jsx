import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PlusIcon } from '@heroicons/react/24/outline'
import { api } from '../api'
import TeeemTableView from '../components/documentation/TeeemTableView'
import Toast from '../components/Toast'

// Table ID for Companies (from foundations table)
const COMPANIES_TABLE_ID = 353

// Column definitions matching the companies table
const buildCompaniesColumns = () => [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'id', label: 'ID', column_type: 'whole_number', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 60 },
  { key: 'name', label: 'Company Name', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 250, is_title: true },
  { key: 'company_group', label: 'Group', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120 },
  { key: 'status', label: 'Status', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120 },
  { key: 'formatted_acn', label: 'ACN', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 130 },
  { key: 'formatted_abn', label: 'ABN', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 150 },
  { key: 'date_incorporated', label: 'Incorporated', column_type: 'date', resizable: true, sortable: true, filterable: false, width: 120 },
  { key: 'has_xero_connection', label: 'Xero', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'boolean', width: 80 },
  { key: 'created_at', label: 'Created', column_type: 'date_and_time', resizable: true, sortable: true, filterable: false, width: 150 },
  { key: 'updated_at', label: 'Updated', column_type: 'date_and_time', resizable: true, sortable: true, filterable: false, width: 150 }
]

export default function CompaniesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [columns, setColumns] = useState(buildCompaniesColumns())
  const [selectedGroup, setSelectedGroup] = useState(searchParams.get('group') || 'all')
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'all')
  const [toast, setToast] = useState(null)

  const groups = ['all', 'tekna', 'team_harder', 'promise', 'charity', 'other']
  const statuses = ['all', 'active', 'struck_off', 'in_liquidation', 'dormant']

  useEffect(() => {
    loadCompanies()
    fetchColumnIds()
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

  // Fetch column IDs from API and merge with static config
  const fetchColumnIds = async () => {
    try {
      const response = await api.get(`/api/v1/foundations/${COMPANIES_TABLE_ID}`)
      const dbColumns = response?.foundation?.columns || []
      console.log('📥 Companies: Received', dbColumns.length, 'columns from API')

      const updatedColumns = buildCompaniesColumns().map(col => {
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
          fetchColumnIds()
        }}
        customActions={
          <button
            onClick={() => navigate('/corporate/companies/new')}
            className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
          >
            <PlusIcon className="h-5 w-5" />
            Add Company
          </button>
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
