import { useState, useEffect } from 'react'
import {
  PlusIcon,
  DocumentTextIcon,
  FunnelIcon,
  CloudIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import DocumentPreviewModal from './DocumentPreviewModal'
import api from '../../api'
import TeeemTableView from '../documentation/TeeemTableView'

// Table ID for Company Documents (from foundations table)
const COMPANY_DOCUMENTS_TABLE_ID = 412

// Build column definitions for documents table
const buildDocumentColumns = () => [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'preview', label: '', resizable: false, sortable: false, filterable: false, width: 40 },
  { key: 'id', label: 'ID', column_type: 'whole_number', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 60 },
  { key: 'display_title', label: 'Document', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 350, is_title: true },
  { key: 'financial_years', label: 'FY', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 80 },
  { key: 'folder', label: 'Folder', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
  { key: 'document_type', label: 'Type', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120 },
  { key: 'source', label: 'Source', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
  { key: 'file_size', label: 'Size', column_type: 'whole_number', resizable: true, sortable: true, filterable: false, width: 100 },
  { key: 'document_date', label: 'Doc Date', column_type: 'date', resizable: true, sortable: true, filterable: true, filterType: 'date', width: 120 },
  { key: 'created_at', label: 'Uploaded', column_type: 'date_and_time', resizable: true, sortable: true, filterable: false, width: 150 }
]

export default function CompanyDocumentsTab({ company, onUpdate, initialTab = 'all' }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedTab, setSelectedTab] = useState(initialTab)
  const [selectedAsset, setSelectedAsset] = useState('all')
  const [assets, setAssets] = useState([])
  const [showFilters, setShowFilters] = useState(initialTab !== 'all')
  const [documentTypes, setDocumentTypes] = useState([])
  const [sharepointConnected, setSharepointConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [columns] = useState(buildDocumentColumns())
  const [previewDocument, setPreviewDocument] = useState(null)

  // Document organization tabs
  const tabs = [
    'ADVICE',
    'ASIC',
    'ASSETS',
    'ATO',
    'BANK',
    'COMPANY',
    'DIVIDENDS',
    'FINANCIALS',
    'GENERAL',
    'INSURANCE',
    'LOANS',
    'MINUTES',
    'REGISTRY',
    'TRUST'
  ]

  useEffect(() => {
    loadDocuments()
    loadAssets()
    loadDocumentTypes()
    checkSharePointConnection()
  }, [company.id, selectedTab, selectedAsset])

  // Update selectedTab when initialTab prop changes
  useEffect(() => {
    setSelectedTab(initialTab)
  }, [initialTab])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const params = { company_id: company.id }

      if (selectedTab !== 'all') {
        params.tab = selectedTab
      }

      if (selectedAsset !== 'all') {
        params.asset_id = selectedAsset
      }

      const response = await api.get('/api/v1/company_documents', { params })
      // Transform documents for table display
      const transformedDocs = (response.documents || []).map(doc => ({
        ...doc,
        // Use display_title if available, fallback to title
        display_title: doc.display_title || doc.title,
        // Format file size for display
        file_size_display: formatFileSize(doc.file_size),
        // Add source badge info
        source_display: doc.source === 'sharepoint' ? 'SharePoint' : 'Upload',
        // Format financial years as comma-separated string (e.g., "2021" or "2021, 2022")
        financial_years: doc.financial_years?.length > 0 ? doc.financial_years.join(', ') : ''
      }))
      setDocuments(transformedDocs)
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAssets = async () => {
    try {
      const response = await api.get('/api/v1/assets', {
        params: { company_id: company.id }
      })
      setAssets(response.assets || [])
    } catch (error) {
      console.error('Failed to load assets:', error)
    }
  }

  const loadDocumentTypes = async () => {
    try {
      const response = await api.get('/api/v1/document_types')
      setDocumentTypes(response.data || [])
    } catch (error) {
      console.error('Failed to load document types:', error)
    }
  }

  const checkSharePointConnection = async () => {
    try {
      const response = await api.get('/api/v1/organization_onedrive/status')
      setSharepointConnected(response.connected === true)
    } catch (error) {
      console.error('Failed to check SharePoint connection:', error)
      setSharepointConnected(false)
    }
  }

  const syncFromSharePoint = async () => {
    if (!sharepointConnected) {
      alert('SharePoint is not connected. Please connect in Settings first.')
      return
    }

    if (!confirm(`Sync documents from SharePoint for ${company.name}?\n\nThis will scan the SharePoint "00 TEEEM PRIVATE" folder and link any documents found to this company.`)) {
      return
    }

    try {
      setSyncing(true)
      setSyncResult(null)

      const response = await api.post('/api/v1/organization_onedrive/sync_corporate_documents', {
        folder_path: '00 TEEEM PRIVATE'
      })

      if (response.success) {
        setSyncResult({
          success: true,
          message: `Synced ${response.documents_linked} documents to ${response.companies_scanned} companies`,
          ...response
        })
        await loadDocuments()
        if (onUpdate) onUpdate()
      } else {
        setSyncResult({ success: false, message: response.error || 'Sync failed' })
      }
    } catch (error) {
      console.error('Failed to sync from SharePoint:', error)
      setSyncResult({
        success: false,
        message: error.response?.data?.error || error.message || 'Failed to sync from SharePoint'
      })
    } finally {
      setSyncing(false)
      // Clear result after 10 seconds
      setTimeout(() => setSyncResult(null), 10000)
    }
  }

  const handleDeleteDocument = async (doc) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      await api.delete(`/api/v1/company_documents/${doc.id}`)
      await loadDocuments()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Failed to delete document:', error)
      alert('Failed to delete document')
    }
  }

  const handleBulkDelete = async (entries) => {
    try {
      const ids = entries.map(e => e.id)
      await Promise.all(ids.map(id => api.delete(`/api/v1/company_documents/${id}`)))
      await loadDocuments()
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Failed to bulk delete documents:', err)
      alert('Failed to delete documents')
    }
  }

  const handleSaveDocument = async (formData) => {
    try {
      const data = new FormData()
      data.append('company_document[document_type_id]', formData.document_type_id)
      data.append('company_document[title]', formData.title)
      data.append('company_document[description]', formData.description || '')
      data.append('company_document[company_id]', company.id)

      if (formData.asset_id) {
        data.append('company_document[asset_id]', formData.asset_id)
      }

      if (formData.file) {
        data.append('file', formData.file)
      }

      await api.post('/api/v1/company_documents', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setShowForm(false)
      await loadDocuments()
      if (onUpdate) onUpdate()
    } catch (error) {
      throw error
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '-'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  // Custom row click to open document
  const handleRowClick = (doc) => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank')
    }
  }

  // Custom cell renderer for certain columns
  const customCellRenderer = (doc, column) => {
    switch (column.key) {
      case 'preview':
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPreviewDocument(doc)
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Preview document"
          >
            <EyeIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400" />
          </button>
        )
      case 'display_title':
        return (
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium text-gray-900 dark:text-white">{doc.display_title}</span>
              {doc.display_title !== doc.title && (
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[300px]" title={doc.title}>
                  {doc.title}
                </span>
              )}
            </div>
          </div>
        )
      case 'source':
        if (doc.source === 'sharepoint') {
          return (
            <span className="inline-flex items-center gap-x-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:text-purple-300">
              <CloudIcon className="h-3 w-3" />
              SharePoint
            </span>
          )
        }
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
            Upload
          </span>
        )
      case 'file_size':
        return <span className="text-gray-500 dark:text-gray-400">{formatFileSize(doc.file_size)}</span>
      case 'folder':
        return doc.folder ? (
          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-300">
            {doc.folder}
          </span>
        ) : null
      case 'document_type':
        return doc.document_type ? (
          <span className="text-gray-600 dark:text-gray-400 capitalize">
            {doc.document_type.replace(/_/g, ' ')}
          </span>
        ) : null
      default:
        return null
    }
  }

  // Custom actions for the table header
  const customActions = (
    <div className="flex items-center gap-2">
      {/* Filter Toggle */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className={`inline-flex items-center gap-x-2 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-inset h-[42px] ${
          showFilters || selectedTab !== 'all' || selectedAsset !== 'all'
            ? 'bg-indigo-600 text-white ring-indigo-600'
            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        <FunnelIcon className="h-4 w-4" />
        Filters
      </button>

      {/* SharePoint Connection Status */}
      {sharepointConnected && company.sharepoint_folder_url ? (
        <a
          href={selectedTab && selectedTab !== 'all'
            ? `${company.sharepoint_folder_url}/${encodeURIComponent(selectedTab)}`
            : company.sharepoint_folder_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-x-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors cursor-pointer h-[42px]"
        >
          <CheckCircleIcon className="h-3.5 w-3.5" />
          SharePoint
          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
        </a>
      ) : (
        <span className="inline-flex items-center gap-x-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 h-[42px]">
          <XCircleIcon className="h-3.5 w-3.5" />
          SharePoint Offline
        </span>
      )}

      {/* SharePoint Sync Button */}
      {sharepointConnected && !showForm && (
        <button
          onClick={syncFromSharePoint}
          disabled={syncing}
          className="inline-flex items-center gap-x-1.5 rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 h-[42px]"
        >
          {syncing ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <CloudIcon className="h-4 w-4" />
              Sync
            </>
          )}
        </button>
      )}

      {/* Upload Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
        >
          <PlusIcon className="h-5 w-5" />
          Upload
        </button>
      )}
    </div>
  )

  if (loading && documents.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading documents...</div>
  }

  return (
    <div className="space-y-4">
      {/* Sync Result Notification */}
      {syncResult && (
        <div className={`rounded-md p-4 ${
          syncResult.success
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          <div className="flex">
            {syncResult.success ? (
              <CheckCircleIcon className="h-5 w-5 text-green-400" />
            ) : (
              <XCircleIcon className="h-5 w-5 text-red-400" />
            )}
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${
                syncResult.success
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {syncResult.success ? 'Sync Successful' : 'Sync Failed'}
              </h3>
              <p className={`mt-1 text-sm ${
                syncResult.success
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {syncResult.message}
              </p>
              {syncResult.errors && syncResult.errors.length > 0 && (
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc list-inside mt-1">
                    {syncResult.errors.slice(0, 5).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {syncResult.errors.length > 5 && (
                      <li>... and {syncResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tab Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Document Tab
              </label>
              <select
                value={selectedTab}
                onChange={(e) => setSelectedTab(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="all">All Tabs</option>
                {tabs.map((tab) => (
                  <option key={tab} value={tab}>
                    {tab}
                  </option>
                ))}
              </select>
            </div>

            {/* Asset Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Linked Asset
              </label>
              <select
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="all">All Documents</option>
                <option value="none">No Asset Linked</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.abbreviation ? `${asset.abbreviation} - ` : ''}{asset.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          {(selectedTab !== 'all' || selectedAsset !== 'all') && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setSelectedTab('all')
                  setSelectedAsset('all')
                }}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {showForm ? (
        <DocumentForm
          onSave={handleSaveDocument}
          onCancel={() => setShowForm(false)}
          assets={assets}
          documentTypes={documentTypes}
        />
      ) : (
        <TeeemTableView
          foundationId="company-documents"
          foundationIdNumeric={COMPANY_DOCUMENTS_TABLE_ID}
          tableName={`Documents (${documents.length})`}
          entries={documents}
          columns={columns}
          onDelete={handleDeleteDocument}
          onBulkDelete={handleBulkDelete}
          onRowClick={handleRowClick}
          enableImport={false}
          enableExport={true}
          enableSchemaEditor={false}
          hideUpdateViewButton={true}
          customActions={customActions}
          customCellRenderer={customCellRenderer}
          emptyStateTitle="No documents"
          emptyStateDescription={selectedTab !== 'all' || selectedAsset !== 'all'
            ? 'No documents match your filters.'
            : 'Get started by uploading a document or syncing from SharePoint.'}
        />
      )}

      {/* Document Preview Modal */}
      {previewDocument && (
        <DocumentPreviewModal
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
          onDocumentUpdate={loadDocuments}
        />
      )}
    </div>
  )
}

function DocumentForm({ onSave, onCancel, assets, documentTypes }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    document_type_id: documentTypes[0]?.id || '',
    asset_id: '',
    file: null
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    setFormData(prev => ({ ...prev, file }))
    if (errors.file) {
      setErrors(prev => ({ ...prev, file: null }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }
    if (!formData.document_type_id) {
      newErrors.document_type_id = 'Document type is required'
    }
    if (!formData.file) {
      newErrors.file = 'File is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setLoading(true)
    try {
      await onSave(formData)
    } catch (error) {
      console.error('Form submission error:', error)
      setErrors({ submit: error.message || 'Failed to upload document' })
    } finally {
      setLoading(false)
    }
  }

  // Group document types by folder
  const groupedTypes = documentTypes.reduce((acc, type) => {
    const folder = type.folder || 'GENERAL'
    if (!acc[folder]) acc[folder] = []
    acc[folder].push(type)
    return acc
  }, {})

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Upload Document</h4>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title *
          </label>
          <input
            type="text"
            name="title"
            id="title"
            required
            value={formData.title}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors.title ? 'border-red-300 dark:border-red-600' : ''
            }`}
          />
          {errors.title && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>}
        </div>

        <div>
          <label htmlFor="document_type_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Document Type *
          </label>
          <select
            name="document_type_id"
            id="document_type_id"
            value={formData.document_type_id}
            onChange={handleChange}
            required
            className={`mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
              errors.document_type_id ? 'border-red-300 dark:border-red-600' : ''
            }`}
          >
            <option value="">Select type...</option>
            {Object.keys(groupedTypes).sort().map(folder => (
              <optgroup key={folder} label={folder}>
                {groupedTypes[folder].map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {errors.document_type_id && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.document_type_id}</p>}
        </div>

        <div>
          <label htmlFor="asset_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Link to Asset (Optional)
          </label>
          <select
            name="asset_id"
            id="asset_id"
            value={formData.asset_id}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">No asset</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.abbreviation ? `${asset.abbreviation} - ` : ''}{asset.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <textarea
            name="description"
            id="description"
            rows={2}
            value={formData.description}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            File *
          </label>
          <input
            type="file"
            name="file"
            id="file"
            required
            onChange={handleFileChange}
            className={`mt-1 block w-full text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none ${
              errors.file ? 'border-red-300 dark:border-red-600' : ''
            }`}
          />
          {errors.file && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.file}</p>}
          {formData.file && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Selected: {formData.file.name}
            </p>
          )}
        </div>
      </div>

      {errors.submit && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
      )}

      <div className="mt-4 flex items-center justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="inline-flex items-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </form>
  )
}
