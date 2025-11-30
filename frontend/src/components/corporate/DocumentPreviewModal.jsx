import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import api from '../../api'

export default function DocumentPreviewModal({ document, onClose, onDocumentUpdate }) {
  const [validating, setValidating] = useState(false)
  const [validated, setValidated] = useState(document?.user_validated_at != null)

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

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '-'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

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

                  {/* Validation Status */}
                  {validated ? (
                    <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        Document naming has been validated
                      </span>
                    </div>
                  ) : (
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
