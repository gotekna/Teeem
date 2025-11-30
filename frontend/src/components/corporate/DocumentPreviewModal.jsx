import { useState, useEffect, Fragment, useRef } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  CheckIcon,
  SparklesIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PencilIcon
} from '@heroicons/react/24/outline'
import api from '../../api'

// Folder options for document organization
const FOLDER_OPTIONS = [
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

// Generate financial year options (last 10 years)
const generateFYOptions = () => {
  const currentYear = new Date().getFullYear()
  const options = []
  for (let i = 0; i < 10; i++) {
    options.push(currentYear - i)
  }
  return options
}

const FY_OPTIONS = generateFYOptions()

export default function DocumentPreviewModal({
  document: initialDocument,
  onClose,
  onDocumentUpdate,
  onNavigate, // New prop: { companyId, folder } to navigate after save
  companies = [] // List of companies for dropdown
}) {
  const [document, setDocument] = useState(initialDocument)
  const [validating, setValidating] = useState(false)
  const [validated, setValidated] = useState(initialDocument?.user_validated_at != null)
  const [aiVerifying, setAiVerifying] = useState(false)
  const [applyingSuggestion, setApplyingSuggestion] = useState(false)

  // Editing states
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(initialDocument?.title || '')
  const [editedCompanyId, setEditedCompanyId] = useState(initialDocument?.company_id || initialDocument?.company?.id || '')
  const [editedFolder, setEditedFolder] = useState(initialDocument?.folder || '')
  const [editedFinancialYears, setEditedFinancialYears] = useState(initialDocument?.financial_years || [])
  const [saving, setSaving] = useState(false)

  const pollingRef = useRef(null)
  const titleInputRef = useRef(null)

  // Determine file type for preview
  const getFileType = (filename) => {
    if (!filename) return 'unknown'
    const ext = filename.split('.').pop()?.toLowerCase()
    if (['pdf'].includes(ext)) return 'pdf'
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image'
    if (['doc', 'docx'].includes(ext)) return 'word'
    if (['xls', 'xlsx'].includes(ext)) return 'excel'
    return 'unknown'
  }

  const fileType = getFileType(document?.file_name || document?.title)

  // Poll for AI verification results
  useEffect(() => {
    if (document?.ai_verification_status === 'processing') {
      pollingRef.current = setInterval(async () => {
        try {
          const response = await api.get(`/api/v1/company_documents/${document.id}`)
          if (response.document) {
            setDocument(response.document)
            // Stop polling when status changes from processing
            if (response.document.ai_verification_status !== 'processing') {
              clearInterval(pollingRef.current)
              setAiVerifying(false)
            }
          }
        } catch (error) {
          console.error('Failed to poll document status:', error)
        }
      }, 2000)
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [document?.id, document?.ai_verification_status])

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditing])

  // Handle user validation
  const handleValidate = async () => {
    try {
      setValidating(true)
      await api.post(`/api/v1/company_documents/${document.id}/validate`)
      setValidated(true)
      if (onDocumentUpdate) {
        await onDocumentUpdate()
      }
    } catch (error) {
      console.error('Failed to validate document:', error)
      alert('Failed to validate document')
    } finally {
      setValidating(false)
    }
  }

  // Handle AI verification
  const handleAiVerify = async () => {
    try {
      setAiVerifying(true)
      const response = await api.post(`/api/v1/company_documents/${document.id}/ai_verify`)
      if (response.success) {
        // Update document status to processing
        setDocument(prev => ({ ...prev, ai_verification_status: 'processing' }))
      }
    } catch (error) {
      console.error('Failed to start AI verification:', error)
      alert(error.response?.error || 'Failed to start AI verification')
      setAiVerifying(false)
    }
  }

  // Start editing mode
  const startEditing = () => {
    setEditedTitle(document.title || '')
    setEditedCompanyId(document.company_id || document.company?.id || '')
    setEditedFolder(document.folder || '')
    setEditedFinancialYears(document.financial_years || [])
    setIsEditing(true)
  }

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false)
  }

  // Save all changes - uses relocate endpoint to move file in OneDrive
  const handleSave = async () => {
    try {
      setSaving(true)

      // Use relocate endpoint which moves/renames in OneDrive
      const response = await api.post(`/api/v1/company_documents/${document.id}/relocate`, {
        relocate: {
          title: editedTitle.trim(),
          company_id: editedCompanyId || null,
          folder: editedFolder || null,
          financial_years: editedFinancialYears
        }
      })

      if (response.success) {
        setDocument(response.document)
        setIsEditing(false)

        // Refresh parent list
        if (onDocumentUpdate) {
          await onDocumentUpdate()
        }

        // Navigate to new location if company or folder changed
        const companyChanged = editedCompanyId && editedCompanyId !== (document.company_id || document.company?.id)
        const folderChanged = editedFolder && editedFolder !== document.folder

        if (onNavigate && (companyChanged || folderChanged)) {
          onNavigate({
            companyId: editedCompanyId,
            folder: editedFolder
          })
          onClose()
        }
      }
    } catch (error) {
      console.error('Failed to save document:', error)
      alert(error.response?.error || 'Failed to save document')
    } finally {
      setSaving(false)
    }
  }

  // Handle applying AI suggestion
  const handleApplySuggestion = async () => {
    try {
      setApplyingSuggestion(true)
      const response = await api.post(`/api/v1/company_documents/${document.id}/apply_ai_suggestion`)
      if (response.success) {
        setDocument(response.document)
        setValidated(true)
        if (onDocumentUpdate) {
          await onDocumentUpdate()
        }
      }
    } catch (error) {
      console.error('Failed to apply suggestion:', error)
      alert(error.response?.error || 'Failed to apply suggestion')
    } finally {
      setApplyingSuggestion(false)
    }
  }

  // Handle financial year checkbox toggle
  const toggleFinancialYear = (year) => {
    setEditedFinancialYears(prev => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year)
      } else {
        return [...prev, year].sort((a, b) => b - a)
      }
    })
  }

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '-'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  // Check if document has OneDrive file for AI verification
  const canAiVerify = document?.onedrive_file_id && !validated

  // AI verification status
  const aiStatus = document?.ai_verification_status
  const hasAiSuggestion = document?.ai_suggested_name && aiStatus === 'mismatch'
  const isProcessing = aiStatus === 'processing' || aiVerifying

  // Get current company name
  const currentCompanyName = document?.company?.name ||
    companies.find(c => c.id === document?.company_id)?.name ||
    '-'

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <DocumentTextIcon className="h-6 w-6 text-gray-400 flex-shrink-0" />
                    {isEditing ? (
                      <input
                        ref={titleInputRef}
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="flex-1 min-w-0 text-lg font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-indigo-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Document title"
                      />
                    ) : (
                      <button
                        onClick={startEditing}
                        className="group flex items-center gap-2 text-left flex-1 min-w-0"
                        title="Click to edit"
                      >
                        <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {document.display_title || document.title}
                        </Dialog.Title>
                        <PencilIcon className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0 ml-2"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                  {/* Document Details - Editable or Display */}
                  {isEditing ? (
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Edit Document Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Company Dropdown */}
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Company</label>
                          <select
                            value={editedCompanyId}
                            onChange={(e) => setEditedCompanyId(e.target.value)}
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Select company...</option>
                            {companies.map(company => (
                              <option key={company.id} value={company.id}>
                                {company.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Folder Dropdown */}
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Folder (Tab)</label>
                          <select
                            value={editedFolder}
                            onChange={(e) => setEditedFolder(e.target.value)}
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Select folder...</option>
                            {FOLDER_OPTIONS.map(folder => (
                              <option key={folder} value={folder}>
                                {folder}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Financial Year Multi-Select */}
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Financial Year(s)</label>
                          <div className="relative">
                            <div className="flex flex-wrap gap-1 min-h-[38px] p-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                              {editedFinancialYears.length > 0 ? (
                                editedFinancialYears.map(year => (
                                  <span
                                    key={year}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded text-xs"
                                  >
                                    FY{year.toString().slice(-2)}
                                    <button
                                      type="button"
                                      onClick={() => toggleFinancialYear(year)}
                                      className="hover:text-indigo-900 dark:hover:text-indigo-100"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 text-sm px-2 py-0.5">Select years...</span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {FY_OPTIONS.slice(0, 6).map(year => (
                                <button
                                  key={year}
                                  type="button"
                                  onClick={() => toggleFinancialYear(year)}
                                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                    editedFinancialYears.includes(year)
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                                  }`}
                                >
                                  FY{year.toString().slice(-2)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Save/Cancel buttons */}
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          {saving ? (
                            <>
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckIcon className="h-4 w-4" />
                              Save Changes
                            </>
                          )}
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={saving}
                          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Company</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentCompanyName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Folder</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {document.folder || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Financial Year</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {Array.isArray(document.financial_years) && document.financial_years.length > 0
                            ? document.financial_years.map(y => `FY${y.toString().slice(-2)}`).join(', ')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">File Size</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatFileSize(document.file_size)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Preview Area */}
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden mb-6" style={{ minHeight: '400px' }}>
                    {fileType === 'pdf' && document.file_url ? (
                      <iframe
                        src={document.file_url}
                        className="w-full h-[500px]"
                        title="Document Preview"
                      />
                    ) : fileType === 'image' && document.file_url ? (
                      <div className="flex items-center justify-center p-4">
                        <img
                          src={document.file_url}
                          alt={document.title}
                          className="max-w-full max-h-[500px] object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 dark:text-gray-400">
                        <DocumentTextIcon className="h-16 w-16 mb-4" />
                        <p className="text-lg font-medium mb-2">Preview not available</p>
                        <p className="text-sm mb-4">
                          {fileType === 'word' ? 'Word documents' :
                           fileType === 'excel' ? 'Excel spreadsheets' :
                           'This file type'} cannot be previewed inline
                        </p>
                        {document.file_url && (
                          <a
                            href={document.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                          >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            Open in New Tab
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* AI Verification Results */}
                  {hasAiSuggestion && (
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <SparklesIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                            AI Suggests a Better Name
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 dark:text-gray-400 w-20">Current:</span>
                              <span className="font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                {document.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 dark:text-gray-400 w-20">Suggested:</span>
                              <span className="font-mono text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                                {document.ai_suggested_name}
                              </span>
                            </div>
                            {document.ai_confidence_score && (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 dark:text-gray-400 w-20">Confidence:</span>
                                <span className="font-medium text-blue-700 dark:text-blue-300">
                                  {document.ai_confidence_score}%
                                </span>
                              </div>
                            )}
                            {document.ai_analysis_notes && (
                              <div className="mt-2 text-gray-600 dark:text-gray-400 italic">
                                {document.ai_analysis_notes}
                              </div>
                            )}
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              onClick={handleApplySuggestion}
                              disabled={applyingSuggestion}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                              <CheckIcon className="h-4 w-4" />
                              {applyingSuggestion ? 'Applying...' : 'Apply Suggestion'}
                            </button>
                            <button
                              onClick={handleValidate}
                              disabled={validating}
                              className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {validating ? 'Keeping...' : 'Keep Current Name'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Error Status */}
                  {aiStatus === 'error' && document.ai_analysis_notes && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                            AI Verification Failed
                          </h4>
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            {document.ai_analysis_notes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Processing Status */}
                  {isProcessing && (
                    <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <ArrowPathIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-spin" />
                        <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                          AI is analyzing document...
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Validation Status */}
                  {validated ? (
                    <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        Document naming has been validated
                      </span>
                    </div>
                  ) : !hasAiSuggestion && !isProcessing && !isEditing && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                        Please review the document and confirm the naming is correct.
                      </p>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={handleValidate}
                          disabled={validating}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <CheckIcon className="h-4 w-4" />
                          {validating ? 'Validating...' : 'Confirm Naming is Correct'}
                        </button>
                        {canAiVerify && (
                          <button
                            onClick={handleAiVerify}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-2 px-4 py-2 text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-900 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <SparklesIcon className="h-4 w-4" />
                            {isProcessing ? 'Verifying...' : 'AI Verify'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {currentCompanyName}
                  </div>
                  <div className="flex items-center gap-3">
                    {!isEditing && (
                      <button
                        onClick={startEditing}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit
                      </button>
                    )}
                    {document.file_url && (
                      <a
                        href={document.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        Open
                      </a>
                    )}
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
