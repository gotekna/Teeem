import { useState, useEffect } from 'react'
import { XMarkIcon, MagnifyingGlassIcon, FolderIcon, CloudArrowDownIcon, CheckIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function OutlookImportModal({ isOpen, onClose, constructionId, onImportComplete }) {
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('inbox')
  const [folders, setFolders] = useState([])
  const [maxResults, setMaxResults] = useState(50)
  const [importStatus, setImportStatus] = useState(null)
  const [error, setError] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [searchResults, setSearchResults] = useState(null)
  const [selectedEmails, setSelectedEmails] = useState(new Set())
  const [outlookStatus, setOutlookStatus] = useState(null)

  useEffect(() => {
    if (isOpen) {
      loadFolders()
      checkOutlookStatus()
      if (constructionId) {
        loadSuggestions()
      }
    }
  }, [isOpen, constructionId])

  const checkOutlookStatus = async () => {
    try {
      const response = await api.get('/api/v1/outlook/status')
      setOutlookStatus(response)
    } catch (error) {
      console.error('Failed to check Outlook status:', error)
      setOutlookStatus({ configured: false })
    }
  }

  const loadFolders = async () => {
    try {
      const response = await api.get('/api/v1/outlook/folders')
      setFolders(response.folders || [])
    } catch (error) {
      console.error('Failed to load Outlook folders:', error)
      // Don't show error if Outlook not connected - will be handled by status check
    }
  }

  const loadSuggestions = async () => {
    if (!constructionId) return
    try {
      const response = await api.get(`/api/v1/outlook/job_search_suggestions/${constructionId}`)
      setSuggestions(response.suggestions || [])
    } catch (error) {
      console.error('Failed to load search suggestions:', error)
    }
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term')
      return
    }

    try {
      setSearching(true)
      setError(null)
      setSearchResults(null)
      setSelectedEmails(new Set())

      const response = await api.post('/api/v1/outlook/search_for_job', {
        job_id: constructionId,
        search: searchTerm,
        folder: selectedFolder,
        top: maxResults
      })

      setSearchResults(response)

      // Auto-select all non-imported emails
      const newEmailIds = new Set(
        response.emails
          .filter(e => !e.already_imported)
          .map(e => e.message_id)
      )
      setSelectedEmails(newEmailIds)
    } catch (error) {
      console.error('Failed to search emails:', error)
      setError(error.response?.data?.error || 'Failed to search Outlook')
    } finally {
      setSearching(false)
    }
  }

  const handleImport = async () => {
    if (selectedEmails.size === 0) {
      setError('Please select at least one email to import')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setImportStatus(null)

      const response = await api.post('/api/v1/outlook/import_for_job', {
        job_id: constructionId,
        search: searchTerm,
        folder: selectedFolder,
        top: maxResults,
        message_ids: Array.from(selectedEmails)
      })

      setImportStatus({
        success: true,
        count: response.imported_count,
        message: response.message
      })

      // Wait a moment to show success message, then close
      setTimeout(() => {
        if (onImportComplete) {
          onImportComplete()
        }
        onClose()
      }, 2000)
    } catch (error) {
      console.error('Failed to import emails:', error)
      setError(error.response?.data?.error || 'Failed to import emails from Outlook')
      setImportStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const toggleEmailSelection = (messageId) => {
    setSelectedEmails(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (!searchResults) return
    const selectableEmails = searchResults.emails.filter(e => !e.already_imported)
    if (selectedEmails.size === selectableEmails.length) {
      setSelectedEmails(new Set())
    } else {
      setSelectedEmails(new Set(selectableEmails.map(e => e.message_id)))
    }
  }

  const useSuggestion = (suggestion) => {
    setSearchTerm(suggestion.value)
    setSearchResults(null)
    setSelectedEmails(new Set())
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  // Show connect prompt if Outlook not connected
  if (outlookStatus && !outlookStatus.configured) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div
            className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
            onClick={onClose}
          />
          <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full sm:p-6">
            <div className="text-center">
              <EnvelopeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">
                Connect Outlook First
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                You need to connect your Outlook account before you can import emails.
                Go to Settings → Integrations to connect.
              </p>
              <button
                onClick={onClose}
                className="mt-4 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900">
                <CloudArrowDownIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Import from Outlook
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Search and import emails for this job
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
            {/* Search suggestions */}
            {suggestions.length > 0 && !searchResults && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quick Search Suggestions
                </label>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => useSuggestion(suggestion)}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      <span className="text-xs text-indigo-500 dark:text-indigo-400 mr-1.5">
                        {suggestion.type === 'email' ? '@' : suggestion.type === 'address' ? '📍' : '🏠'}
                      </span>
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search Query
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by address, email, subject..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchTerm.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {searching ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Searching...
                    </>
                  ) : (
                    <>
                      <MagnifyingGlassIcon className="h-4 w-4" />
                      Search
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Folder and max results row */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Folder
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FolderIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="inbox">Inbox</option>
                    <option value="sentitems">Sent Items</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name} {folder.unread_count > 0 && `(${folder.unread_count})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Results
                </label>
                <input
                  type="number"
                  value={maxResults}
                  onChange={(e) => setMaxResults(parseInt(e.target.value) || 50)}
                  min="1"
                  max="200"
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Search results */}
            {searchResults && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Found <strong>{searchResults.count}</strong> emails
                    {searchResults.new_count < searchResults.count && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {' '}({searchResults.count - searchResults.new_count} already imported)
                      </span>
                    )}
                  </div>
                  {searchResults.new_count > 0 && (
                    <button
                      onClick={toggleSelectAll}
                      className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      {selectedEmails.size === searchResults.new_count ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                  {searchResults.emails.map((email) => (
                    <div
                      key={email.message_id}
                      className={`px-4 py-3 flex items-start gap-3 ${
                        email.already_imported
                          ? 'bg-gray-100 dark:bg-gray-800/50 opacity-60'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer'
                      }`}
                      onClick={() => !email.already_imported && toggleEmailSelection(email.message_id)}
                    >
                      <div className="flex-shrink-0 pt-0.5">
                        {email.already_imported ? (
                          <div className="h-5 w-5 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <CheckIcon className="h-3 w-3 text-gray-500" />
                          </div>
                        ) : (
                          <div
                            className={`h-5 w-5 rounded border ${
                              selectedEmails.has(email.message_id)
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-gray-300 dark:border-gray-600'
                            } flex items-center justify-center`}
                          >
                            {selectedEmails.has(email.message_id) && (
                              <CheckIcon className="h-3 w-3 text-white" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {email.from || 'Unknown Sender'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                            {formatDate(email.received_at)}
                          </p>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {email.subject || '(No Subject)'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {email.preview_body || ''}
                        </p>
                        {email.already_imported && (
                          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            Already imported
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status messages */}
            {importStatus && (
              <div className="mt-4 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  {importStatus.message}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedEmails.size > 0 && (
                <span>{selectedEmails.size} email{selectedEmails.size !== 1 ? 's' : ''} selected</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={loading || selectedEmails.size === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <CloudArrowDownIcon className="h-4 w-4" />
                    Import {selectedEmails.size > 0 ? `(${selectedEmails.size})` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
