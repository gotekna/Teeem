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
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import api from '../../api'

export default function DocumentPreviewModal({ document: initialDocument, onClose, onDocumentUpdate }) {
  const [document, setDocument] = useState(initialDocument)
  const [validating, setValidating] = useState(false)
  const [validated, setValidated] = useState(initialDocument?.user_validated_at != null)
  const [aiVerifying, setAiVerifying] = useState(false)
  const [applyingSuggestion, setApplyingSuggestion] = useState(false)
  const pollingRef = useRef(null)

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
                  <div className="flex items-center gap-3">
                    <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                    <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                      {document.display_title || document.title}
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                  {/* Document Details */}
                  <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Folder</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {document.folder || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Financial Year</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {document.financial_years || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">File Size</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatFileSize(document.file_size)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Source</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {document.source || 'Upload'}
                      </p>
                    </div>
                  </div>

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
                  ) : !hasAiSuggestion && !isProcessing && (
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
                    {document.company?.name}
                  </div>
                  <div className="flex items-center gap-3">
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
