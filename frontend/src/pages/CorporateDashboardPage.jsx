import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  HeartIcon,
  KeyIcon,
  FolderOpenIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
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
      editable: ['code', 'entity_type', 'status', 'acn', 'abn'].includes(col.column_name), // Make key fields editable
      // Pass choice options for dropdown columns
      available_choices: col.available_choices,
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

export default function CorporateDashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
    totalAssets: 0,
    complianceDueSoon: 0,
    insuranceExpiring: 0,
    healthScore: 0,
    criticalCompanies: 0
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [upcomingCompliance, setUpcomingCompliance] = useState([])
  const [companies, setCompanies] = useState([])
  const [columns, setColumns] = useState([])
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadDashboardData()
    fetchColumns()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // Load companies
      const companiesResponse = await api.get('/api/v1/companies')
      const companiesList = companiesResponse.companies || []
      setCompanies(companiesList)

      // Load compliance items due soon
      const complianceResponse = await api.get('/api/v1/company_compliance_items', {
        params: { due_soon: 'true', days: 30 }
      })
      const compliance = complianceResponse.compliance_items || []

      // Load assets
      const assetsResponse = await api.get('/api/v1/assets')
      const assets = assetsResponse.assets || []

      // Load health report
      const healthResponse = await api.get('/api/v1/companies/health_report')
      const healthSummary = healthResponse.summary || {}

      // Calculate stats
      setStats({
        totalCompanies: companiesList.length,
        activeCompanies: companiesList.filter(c => c.status === 'active').length,
        totalAssets: assets.length,
        complianceDueSoon: compliance.length,
        insuranceExpiring: assets.filter(a => a.needs_attention).length,
        healthScore: healthSummary.average_score || 0,
        criticalCompanies: healthSummary.critical || 0
      })

      setUpcomingCompliance(compliance.slice(0, 5))

    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch columns from API and convert to TEEEM format (Gold Standard Pattern)
  const fetchColumns = async () => {
    try {
      const response = await api.get(`/api/v1/foundations/${COMPANIES_TABLE_ID}`)
      const dbColumns = response?.foundation?.columns || []
      console.log('📥 Dashboard: Received', dbColumns.length, 'columns from API')

      // Convert API columns to TEEEM format
      const teeemColumns = convertColumnsToTEEEMFormat(dbColumns, COMPANIES_TABLE_ID)
      console.log('✅ Dashboard: Converted to', teeemColumns.length, 'TEEEM columns')

      setColumns(teeemColumns)
    } catch (err) {
      console.error('❌ Dashboard: Failed to fetch columns:', err)
    }
  }

  const handleEdit = async (entry) => {
    console.log('🔥 Dashboard handleEdit CALLED with entry:', entry.id, entry.entity_type)
    try {
      console.log('🔥 Making PATCH request to /api/v1/companies/' + entry.id)
      const response = await api.patch(`/api/v1/companies/${entry.id}`, { company: entry })
      console.log('🔥 PATCH response:', response)

      // Update local state with saved data
      setCompanies(companies.map(c => c.id === entry.id ? response.company : c))
      setToast({ message: 'Company updated successfully', type: 'success' })
    } catch (err) {
      console.error('🔥 Failed to update company:', err)
      setToast({ message: 'Failed to update company', type: 'error' })
    }
  }

  const handleBulkUpdate = async (entries) => {
    try {
      // Update all companies in parallel
      const responses = await Promise.all(
        entries.map(entry => api.patch(`/api/v1/companies/${entry.id}`, { company: entry }))
      )

      // Update local state with saved data
      const updatedIds = new Set(entries.map(e => e.id))
      setCompanies(companies.map(c => {
        if (updatedIds.has(c.id)) {
          const response = responses.find(r => r.company.id === c.id)
          return response?.company || c
        }
        return c
      }))

      setToast({ message: `Successfully updated ${entries.length} companies`, type: 'success' })
    } catch (err) {
      console.error('Failed to bulk update companies:', err)
      setToast({ message: 'Failed to update companies', type: 'error' })
    }
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

  const statCards = [
    { name: 'Total Companies', value: stats.totalCompanies, icon: BuildingOfficeIcon, href: '/corporate/companies' },
    { name: 'Active Companies', value: stats.activeCompanies, icon: CheckCircleIcon, href: '/corporate/companies?status=active' },
    { name: 'Health Score', value: `${stats.healthScore}%`, icon: HeartIcon, href: '/corporate/health', alert: stats.criticalCompanies > 0, alertColor: stats.healthScore >= 80 ? 'green' : stats.healthScore >= 60 ? 'yellow' : 'red' },
    { name: 'Critical Companies', value: stats.criticalCompanies, icon: ExclamationTriangleIcon, href: '/corporate/health', alert: stats.criticalCompanies > 0 },
    { name: 'Total Assets', value: stats.totalAssets, icon: TruckIcon, href: '/corporate/assets' },
    { name: 'Compliance Due (30 days)', value: stats.complianceDueSoon, icon: ClockIcon, href: '/corporate/companies', alert: stats.complianceDueSoon > 0 }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-none p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-bold text-gray-900">Corporate Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          Manage companies, assets, compliance, and Xero integrations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          // Determine colors based on alertColor or default
          const getColors = () => {
            if (stat.alertColor === 'green') return { bg: 'bg-green-500', ring: 'ring-green-500' }
            if (stat.alertColor === 'yellow') return { bg: 'bg-yellow-500', ring: 'ring-yellow-500' }
            if (stat.alertColor === 'red') return { bg: 'bg-red-500', ring: 'ring-red-500' }
            if (stat.alert) return { bg: 'bg-orange-500', ring: 'ring-orange-500' }
            return { bg: 'bg-indigo-500', ring: '' }
          }
          const colors = getColors()
          return (
            <div
              key={stat.name}
              onClick={() => navigate(stat.href)}
              className={`relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow cursor-pointer hover:shadow-md transition-shadow ${
                colors.ring ? `ring-2 ${colors.ring}` : ''
              }`}
            >
              <dt>
                <div className={`absolute rounded-md p-3 ${colors.bg}`}>
                  <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <p className="ml-16 truncate text-sm font-medium text-gray-500">{stat.name}</p>
              </dt>
              <dd className="ml-16 flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </dd>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => navigate('/corporate/health')}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <HeartIcon className="h-5 w-5 mr-2" />
              Health Report
            </button>
            <button
              onClick={() => navigate('/corporate/companies/new')}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <BuildingOfficeIcon className="h-5 w-5 mr-2" />
              Add Company
            </button>
            <button
              onClick={() => navigate('/corporate/assets/new')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <TruckIcon className="h-5 w-5 mr-2" />
              Add Asset
            </button>
            <button
              onClick={() => navigate('/corporate/directors')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <UserGroupIcon className="h-5 w-5 mr-2" />
              View Directors
            </button>
            <button
              onClick={() => navigate('/corporate/compliance-calendar')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <CalendarDaysIcon className="h-5 w-5 mr-2" />
              Compliance Calendar
            </button>
            <button
              onClick={() => navigate('/corporate/minute-templates')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <DocumentTextIcon className="h-5 w-5 mr-2" />
              Minute Templates
            </button>
            <button
              onClick={() => navigate('/corporate/xero')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Xero Integration
            </button>
            <button
              onClick={() => navigate('/corporate/asic-logins')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <KeyIcon className="h-5 w-5 mr-2" />
              ASIC Logins
            </button>
            <button
              onClick={() => navigate('/corporate/tab-structure')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FolderOpenIcon className="h-5 w-5 mr-2" />
              View Tab Structure
            </button>
            <button
              onClick={() => navigate('/corporate/groups')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <BuildingOfficeIcon className="h-5 w-5 mr-2" />
              Company Groups
            </button>
          </div>
        </div>
      </div>

      {/* All Companies Table - Gold Standard Pattern */}
      <TeeemTableView
        foundationId="companies"
        foundationIdNumeric={COMPANIES_TABLE_ID}
        tableName="All Companies"
        entries={companies}
        columns={columns}
        onEdit={handleEdit}
        onBulkUpdate={handleBulkUpdate}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRowDoubleClick={(company) => navigate(`/corporate/companies/${company.id}`)}
        enableImport={false}
        enableExport={true}
        enableSchemaEditor={true}
        hideUpdateViewButton={true}
        onColumnUpdate={() => {
          console.log('Dashboard: Refreshing columns after schema update')
          fetchColumns()
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

      {/* Upcoming Compliance */}
      {upcomingCompliance.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Compliance (Next 30 Days)</h3>
            <div className="space-y-3">
              {upcomingCompliance.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/corporate/companies/${item.company.id}?tab=compliance`)}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-500">{item.company.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-orange-600">
                      {item.days_until_due} days
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <button
                onClick={() => navigate('/corporate/compliance-calendar')}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                View all compliance items →
              </button>
            </div>
          </div>
        </div>
      )}

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
