import { useState, useEffect } from 'react'
import {
  PlusIcon,
  TrashIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  CloudIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'
import api from '../../api'

export default function CompanyDocumentsTab({ company, onUpdate }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedTab, setSelectedTab] = useState('all')
  const [selectedAsset, setSelectedAsset] = useState('all')
  const [assets, setAssets] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [documentTypes, setDocumentTypes] = useState([])
  const [sharepointConnected, setSharepointConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  // 10 tabs for document organization
  const tabs = [
    'ASIC',
    'ASSETS',
    'ATO',
    'BANK',
    'DIVIDENDS',
    'FINANCIALS',
    'GENERAL',
    'LOANS',
    'MINUTES',
    'REGISTRY'
  ]

  useEffect(() => {
    loadDocuments()
    loadAssets()
    loadDocumentTypes()
    checkSharePointConnection()
  }, [company.id, selectedTab, selectedAsset])

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
      setDocuments(response.documents || [])
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

    if (!confirm(`Sync documents from SharePoint for ${company.name}?\n\nThis will scan the SharePoint "Corporate File" folder and link any documents found to this company.`)) {
      return
    }

    try {
      setSyncing(true)
      setSyncResult(null)

      const response = await api.post('/api/v1/organization_onedrive/sync_corporate_documents', {
        folder_path: 'Corporate File'
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

  const handleDeleteDocument = async (documentId) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      await api.delete(`/api/v1/company_documents/${documentId}`)
      await loadDocuments()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Failed to delete document:', error)
      alert('Failed to delete document')
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

  const filteredDocuments = documents

  if (loading) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading documents...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Documents ({filteredDocuments.length})
          </h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-x-2 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-inset ${
              showFilters || selectedTab !== 'all' || selectedAsset !== 'all'
                ? 'bg-indigo-600 text-white ring-indigo-600'
                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <FunnelIcon className="h-4 w-4" />
            Filters
          </button>
          {/* SharePoint Connection Status */}
          <span className={`inline-flex items-center gap-x-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            sharepointConnected
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            {sharepointConnected ? (
              <>
                <CheckCircleIcon className="h-3.5 w-3.5" />
                SharePoint Connected
              </>
            ) : (
              <>
                <XCircleIcon className="h-3.5 w-3.5" />
                SharePoint Offline
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* SharePoint Sync Button */}
          {sharepointConnected && !showForm && (
            <button
              onClick={syncFromSharePoint}
              disabled={syncing}
              className="inline-flex items-center gap-x-1.5 rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <CloudIcon className="h-4 w-4" />
                  Sync from SharePoint
                </>
              )}
            </button>
          )}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Upload Document
            </button>
          )}
        </div>
      </div>

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
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No documents</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {selectedTab !== 'all' || selectedAsset !== 'all'
              ? 'No documents match your filters.'
              : 'Get started by uploading a document.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start flex-1">
                  <DocumentTextIcon className="h-8 w-8 text-gray-400 dark:text-gray-500 mr-3 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">{doc.title}</h4>
                    {doc.description && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{doc.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      {doc.document_type_record && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-300">
                          {doc.document_type_record.name}
                        </span>
                      )}
                      {doc.source === 'sharepoint' && (
                        <span className="inline-flex items-center gap-x-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:text-purple-300">
                          <CloudIcon className="h-3 w-3" />
                          SharePoint
                        </span>
                      )}
                      {doc.asset && (
                        <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-300">
                          Asset: {doc.asset.abbreviation || doc.asset.name}
                        </span>
                      )}
                      {doc.document_date && (
                        <span>Date: {new Date(doc.document_date).toLocaleDateString()}</span>
                      )}
                      {doc.file_size && (
                        <span>Size: {formatFileSize(doc.file_size)}</span>
                      )}
                      {doc.created_at && (
                        <span>Uploaded: {new Date(doc.created_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {doc.source === 'sharepoint' && doc.file_url ? (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-x-1.5 rounded-md bg-purple-600 dark:bg-purple-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-purple-500 dark:hover:bg-purple-600"
                      title="Open in SharePoint"
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      SharePoint
                    </a>
                  ) : doc.file_url ? (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md bg-white dark:bg-gray-700 px-2.5 py-1.5 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </a>
                  ) : null}
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="inline-flex items-center rounded-md bg-white dark:bg-gray-700 px-2.5 py-1.5 text-sm font-semibold text-red-600 dark:text-red-400 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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
