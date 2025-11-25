import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, EnvelopeIcon, PaperClipIcon, CloudArrowDownIcon } from '@heroicons/react/24/outline'
import DOMPurify from 'isomorphic-dompurify'
import { api } from '../../api'
import OutlookImportModal from './OutlookImportModal'

export default function JobEmailsTab({ constructionId }) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [showOutlookModal, setShowOutlookModal] = useState(false)

  useEffect(() => {
    loadEmails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [constructionId])

  const loadEmails = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/jobs/${constructionId}/emails`)
      setEmails(Array.isArray(response) ? response : [])
    } catch (error) {
      console.error('Failed to load emails:', error)
      setEmails([])
    } finally {
      setLoading(false)
    }
  }

  const filteredEmails = emails.filter(email => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      email.subject?.toLowerCase().includes(searchLower) ||
      email.from_email?.toLowerCase().includes(searchLower) ||
      email.body_text?.toLowerCase().includes(searchLower) ||
      email.to_emails?.some(to => to.toLowerCase().includes(searchLower))
    )
  })

  const handleEmailClick = (email) => {
    setSelectedEmail(selectedEmail?.id === email.id ? null : email)
  }

  const handleImportComplete = () => {
    loadEmails()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading emails...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] bg-white dark:bg-gray-900 rounded-lg shadow">
      {/* Search bar with import button */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowOutlookModal(true)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <CloudArrowDownIcon className="h-4 w-4 mr-2" />
            Import from Outlook
          </button>
        </div>
      </div>

      {/* Emails list */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <EnvelopeIcon className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'No emails found' : 'No emails yet'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Emails sent to this job will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden"
              >
                {/* Email header - always visible */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => handleEmailClick(email)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                          {email.from_email}
                        </span>
                        {email.has_attachments && (
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <PaperClipIcon className="h-3 w-3 mr-1" />
                            {email.attachment_count}
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {email.subject || '(No Subject)'}
                      </div>
                      {!selectedEmail || selectedEmail.id !== email.id ? (
                        <div className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                          {email.body_text?.substring(0, 100)}...
                        </div>
                      ) : null}
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {email.formatted_received_at || new Date(email.received_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Recipients preview */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>To:</span>
                    <span className="truncate">
                      {email.to_emails?.join(', ') || 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Email body - expandable */}
                {selectedEmail && selectedEmail.id === email.id && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
                    {/* Full email details */}
                    <div className="space-y-3 mb-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">From: </span>
                        <span className="text-gray-900 dark:text-white">{email.from_email}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">To: </span>
                        <span className="text-gray-900 dark:text-white">{email.to_emails?.join(', ')}</span>
                      </div>
                      {email.cc_emails && email.cc_emails.length > 0 && (
                        <div>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">CC: </span>
                          <span className="text-gray-900 dark:text-white">{email.cc_emails.join(', ')}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Subject: </span>
                        <span className="text-gray-900 dark:text-white">{email.subject || '(No Subject)'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Date: </span>
                        <span className="text-gray-900 dark:text-white">
                          {new Date(email.received_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Email body */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      {email.body_html ? (
                        <div
                          className="prose dark:prose-invert max-w-none text-sm"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(email.body_html, {
                              ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'span', 'div'],
                              ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
                              ALLOW_DATA_ATTR: false,
                              FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
                              FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
                            })
                          }}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                          {email.body_text}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outlook Import Modal */}
      <OutlookImportModal
        isOpen={showOutlookModal}
        onClose={() => setShowOutlookModal(false)}
        constructionId={constructionId}
        onImportComplete={handleImportComplete}
      />
    </div>
  )
}
