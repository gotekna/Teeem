import { useState, useEffect } from 'react'
import {
  EnvelopeIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'
import DOMPurify from 'isomorphic-dompurify'
import { api } from '../../api'

export default function EmailsTab({ entityType, entityId }) {
  const [emails, setEmails] = useState([])
  const [suggestedEmails, setSuggestedEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [showAllInThread, setShowAllInThread] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)

  // Only support jobs for now - email warehouse is job-centric
  const isJob = entityType === 'job'

  useEffect(() => {
    if (isJob) {
      loadEmails()
      loadSyncStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId])

  const loadEmails = async () => {
    if (!isJob) return

    try {
      setLoading(true)
      // Load from email warehouse
      const response = await api.get(`/api/v1/email_warehouse/for_job/${entityId}`, {
        params: {
          include_suggestions: true,
          show_all_in_thread: showAllInThread
        }
      })
      setEmails(response.emails || [])
      setSuggestedEmails(response.suggested || [])
    } catch (error) {
      console.error('Failed to load emails:', error)
      setEmails([])
      setSuggestedEmails([])
    } finally {
      setLoading(false)
    }
  }

  const loadSyncStatus = async () => {
    try {
      const response = await api.get('/api/v1/email_warehouse/sync_status')
      setSyncStatus(response)
    } catch (error) {
      console.error('Failed to load sync status:', error)
    }
  }

  // Refresh just reloads from the warehouse (instant)
  const handleRefresh = async () => {
    await loadEmails()
    await loadSyncStatus()
  }

  const handleAssignSuggested = async (suggestion) => {
    try {
      await api.post(`/api/v1/email_warehouse/${suggestion.email.id}/assign_to_job`, {
        job_id: entityId,
        assign_thread: true
      })
      // Reload emails
      await loadEmails()
    } catch (error) {
      console.error('Failed to assign email:', error)
      alert('Failed to assign email to this job')
    }
  }

  const filteredEmails = emails.filter(email => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      email.subject?.toLowerCase().includes(searchLower) ||
      email.from_email?.toLowerCase().includes(searchLower) ||
      email.preview_body?.toLowerCase().includes(searchLower) ||
      email.to_emails?.some(to => to.toLowerCase().includes(searchLower))
    )
  })

  const handleEmailClick = (email) => {
    setSelectedEmail(selectedEmail?.id === email.id ? null : email)
  }

  // For non-job entities, show a message
  if (!isJob) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <EnvelopeIcon className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Email sync available for jobs only
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            View a job to see associated emails from the email warehouse.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 dark:text-gray-400">Loading emails...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      {/* Search bar with sync/import buttons */}
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
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            title="Refresh emails from warehouse"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Warehouse status */}
        {syncStatus && syncStatus.total_emails_synced > 0 && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{syncStatus.total_emails_synced.toLocaleString()} emails in warehouse</span>
            {syncStatus.last_sync_at && (
              <span className="ml-2">• Last sync: {new Date(syncStatus.last_sync_at).toLocaleString()}</span>
            )}
          </div>
        )}

        {/* Thread toggle */}
        <div className="mt-2 flex items-center">
          <label className="flex items-center text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllInThread}
              onChange={(e) => {
                setShowAllInThread(e.target.checked)
                loadEmails()
              }}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
            />
            Show all emails in conversations (instead of latest only)
          </label>
        </div>
      </div>

      {/* Suggested emails section */}
      {suggestedEmails.length > 0 && (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4 bg-yellow-50 dark:bg-yellow-900/20">
          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            Suggested Emails ({suggestedEmails.length})
          </h4>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
            These emails might belong to this job based on contact matches or address mentions.
          </p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {suggestedEmails.slice(0, 5).map((suggestion) => (
              <div
                key={suggestion.email.id}
                className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-800"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {suggestion.email.subject || '(No Subject)'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    From: {suggestion.email.from_email} • {suggestion.reason}
                  </p>
                </div>
                <button
                  onClick={() => handleAssignSuggested(suggestion)}
                  className="flex-shrink-0 px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded"
                >
                  Add to Job
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emails list */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <EnvelopeIcon className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'No emails found' : 'No emails yet'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'No emails matched to this job yet. Emails with job contacts or "id:XX" in the subject will auto-match.'}
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
                          {email.display_from || email.from_email}
                        </span>
                        {email.has_attachments && (
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <PaperClipIcon className="h-3 w-3 mr-1" />
                            {email.attachment_count}
                          </div>
                        )}
                        {email.thread_count > 1 && (
                          <div className="flex items-center text-xs text-indigo-500 dark:text-indigo-400">
                            <ChatBubbleLeftRightIcon className="h-3 w-3 mr-1" />
                            {email.thread_count} in thread
                          </div>
                        )}
                        {email.match_type === 'auto' && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            Auto-matched
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {email.subject || '(No Subject)'}
                      </div>
                      {!selectedEmail || selectedEmail.id !== email.id ? (
                        <div className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1">
                          {email.preview_body}
                        </div>
                      ) : null}
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {email.received_at ? new Date(email.received_at).toLocaleString() : ''}
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

    </div>
  )
}
