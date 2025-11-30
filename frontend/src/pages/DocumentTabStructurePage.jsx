import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeftIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import api from '../api'
import TeeemTableView from '../components/documentation/TeeemTableView'

// Table ID for Document Types
const DOCUMENT_TYPES_TABLE_ID = 500

// Available folders/tabs
const FOLDER_OPTIONS = [
  'ADVICE', 'ASIC', 'ASSETS', 'ATO', 'BANK', 'COMPANY',
  'DIVIDENDS', 'FINANCIALS', 'GENERAL', 'INSURANCE',
  'LOANS', 'MINUTES', 'REGISTRY', 'TRUST'
]

// Build column definitions for document types table
const buildDocumentTypeColumns = () => [
  { key: 'id', label: 'ID', column_type: 'whole_number', resizable: true, sortable: true, filterable: true, width: 60 },
  { key: 'abbreviation', label: 'Code', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, width: 80, editable: true },
  { key: 'name', label: 'Document Type', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, width: 280, is_title: true, editable: true },
  { key: 'naming_format', label: 'Naming Format', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, width: 300, editable: true },
  { key: 'primary_tab', label: 'Primary Tab', column_type: 'dropdown', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120, editable: true, options: FOLDER_OPTIONS },
  { key: 'folder', label: 'Folder', column_type: 'dropdown', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120, editable: true, options: FOLDER_OPTIONS },
  { key: 'tabs_display', label: 'All Tabs', column_type: 'single_line_text', resizable: true, sortable: false, filterable: false, width: 200 },
  { key: 'active', label: 'Active', column_type: 'checkbox', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 70, editable: true },
  { key: 'documents_count', label: 'Docs', column_type: 'whole_number', resizable: true, sortable: true, filterable: false, width: 60 }
]

export default function DocumentTabStructurePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [documentTypes, setDocumentTypes] = useState([])
  const [columns] = useState(buildDocumentTypeColumns())
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDocType, setNewDocType] = useState({
    name: '',
    abbreviation: '',
    naming_format: '{CompanyCode} {Description} {Date}',
    folder: 'GENERAL',
    primary_tab: 'GENERAL',
    active: true
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/document_types', {
        params: { include_inactive: 'true' }
      })
      const types = response.data || []
      // Transform for table display
      const transformed = types.map(dt => ({
        ...dt,
        tabs_display: dt.tabs?.join(', ') || ''
      }))
      setDocumentTypes(transformed)
    } catch (error) {
      console.error('Failed to load document types:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCellEdit = async (entry, columnKey, newValue) => {
    try {
      const updateData = { [columnKey]: newValue }
      await api.patch(`/api/v1/document_types/${entry.id}`, {
        document_type: updateData
      })
      await loadData()
    } catch (error) {
      console.error('Failed to update document type:', error)
      alert('Failed to update: ' + (error.response?.errors?.join(', ') || error.message))
    }
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Delete document type "${entry.name}"? This cannot be undone.`)) {
      return
    }
    try {
      await api.delete(`/api/v1/document_types/${entry.id}`)
      await loadData()
    } catch (error) {
      console.error('Failed to delete document type:', error)
      alert('Failed to delete: ' + (error.response?.errors?.join(', ') || error.message))
    }
  }

  const handleBulkDelete = async (entries) => {
    if (!confirm(`Delete ${entries.length} document types? This cannot be undone.`)) {
      return
    }
    try {
      await Promise.all(entries.map(e => api.delete(`/api/v1/document_types/${e.id}`)))
      await loadData()
    } catch (error) {
      console.error('Failed to bulk delete document types:', error)
      alert('Failed to delete some types')
    }
  }

  const handleAddDocType = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/v1/document_types', {
        document_type: {
          ...newDocType,
          tabs: [newDocType.primary_tab]
        }
      })
      setShowAddForm(false)
      setNewDocType({
        name: '',
        abbreviation: '',
        naming_format: '{CompanyCode} {Description} {Date}',
        folder: 'GENERAL',
        primary_tab: 'GENERAL',
        active: true
      })
      await loadData()
    } catch (error) {
      console.error('Failed to create document type:', error)
      alert('Failed to create: ' + (error.response?.errors?.join(', ') || error.message))
    }
  }

  // Custom cell renderer for tabs display
  const customCellRenderer = (entry, columnKey) => {
    if (columnKey === 'tabs_display') {
      const tabs = entry.tabs || []
      if (tabs.length === 0) return <span className="text-gray-400">-</span>
      return (
        <div className="flex flex-wrap gap-1">
          {tabs.map(tab => (
            <span
              key={tab}
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                tab === entry.primary_tab
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 ring-1 ring-indigo-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
      )
    }
    if (columnKey === 'primary_tab' || columnKey === 'folder') {
      const value = entry[columnKey]
      if (!value) return <span className="text-gray-400">-</span>
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {value}
        </span>
      )
    }
    if (columnKey === 'abbreviation') {
      const value = entry[columnKey]
      if (!value) return <span className="text-gray-400">-</span>
      return (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{value}</span>
      )
    }
    if (columnKey === 'naming_format') {
      const value = entry[columnKey]
      if (!value) return <span className="text-gray-400 italic">Not set</span>
      return (
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{value}</span>
      )
    }
    return null
  }

  // Custom actions for the table header
  const customActions = (
    <button
      onClick={() => setShowAddForm(true)}
      className="inline-flex items-center gap-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
    >
      <PlusIcon className="h-5 w-5" />
      Add Document Type
    </button>
  )

  if (loading && documentTypes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/corporate/dashboard')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Document Types & Naming Conventions</h1>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                Manage document types, naming formats, and tab assignments. Click any cell to edit.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <form onSubmit={handleAddDocType} className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
              <input
                type="text"
                value={newDocType.abbreviation}
                onChange={(e) => setNewDocType({ ...newDocType, abbreviation: e.target.value.toUpperCase() })}
                placeholder="CTR"
                className="w-20 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document Type Name *</label>
              <input
                type="text"
                value={newDocType.name}
                onChange={(e) => setNewDocType({ ...newDocType, name: e.target.value })}
                placeholder="CTR - Company Tax Return"
                required
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Naming Format</label>
              <input
                type="text"
                value={newDocType.naming_format}
                onChange={(e) => setNewDocType({ ...newDocType, naming_format: e.target.value })}
                placeholder="{CompanyCode} CTR FY{YY}"
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Folder</label>
              <select
                value={newDocType.folder}
                onChange={(e) => setNewDocType({ ...newDocType, folder: e.target.value, primary_tab: e.target.value })}
                className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {FOLDER_OPTIONS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-none p-6">
        <TeeemTableView
          foundationId="document-types"
          foundationIdNumeric={DOCUMENT_TYPES_TABLE_ID}
          tableName={`Document Types (${documentTypes.length})`}
          entries={documentTypes}
          columns={columns}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onCellEdit={handleCellEdit}
          enableImport={false}
          enableExport={true}
          enableSchemaEditor={false}
          hideUpdateViewButton={true}
          customActions={customActions}
          customCellRenderer={customCellRenderer}
          emptyStateTitle="No document types"
          emptyStateDescription="Add document types to define naming conventions and folder assignments."
        />

        {/* Legend */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Naming Format Variables</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-blue-700 dark:text-blue-300">
            <div><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{CompanyCode}'}</code> Company abbreviation</div>
            <div><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{LoanID}'}</code> Loan identifier</div>
            <div><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{AssetCode}'}</code> Asset abbreviation</div>
            <div><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{FY}'}</code> or <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{YY}'}</code> Financial year</div>
            <div><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{Date}'}</code> Document date</div>
            <div><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{Period}'}</code> BAS period</div>
            <div><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{Description}'}</code> Custom text</div>
            <div><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{LenderCode}'}</code> Lender company</div>
          </div>
        </div>
      </div>
    </div>
  )
}
