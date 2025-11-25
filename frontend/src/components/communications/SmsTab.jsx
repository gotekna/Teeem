import { useState, useEffect, useRef } from 'react'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  PhoneIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function SmsTab({ entityType, entityId, contact }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [toPhone, setToPhone] = useState(contact?.mobile_phone || '')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (contact?.mobile_phone) {
      setToPhone(contact.mobile_phone)
    }
  }, [contact])

  useEffect(() => {
    loadMessages()
    // Poll for new messages every 3 seconds
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      if (loading) setLoading(true)
      // Adjust API endpoint based on entity type
      const endpoint = entityType === 'job'
        ? `/api/v1/jobs/${entityId}/sms_messages`
        : `/api/v1/contacts/${entityId}/sms_messages`

      const response = await api.get(endpoint)
      const msgs = Array.isArray(response) ? response : Array.isArray(response.sms_messages) ? response.sms_messages : []
      setMessages(msgs)
    } catch (error) {
      console.error('Failed to load SMS messages:', error)
      setMessages([])
    } finally {
      if (loading) setLoading(false)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !toPhone.trim() || sending) return

    try {
      setSending(true)
      const endpoint = entityType === 'job'
        ? `/api/v1/jobs/${entityId}/sms_messages`
        : `/api/v1/contacts/${entityId}/sms_messages`

      await api.post(endpoint, {
        body: newMessage,
        to_phone: toPhone
      })

      setNewMessage('')
      loadMessages()
    } catch (error) {
      console.error('Failed to send SMS:', error)
      alert('Failed to send SMS. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const filteredMessages = messages.filter(msg =>
    msg.body?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.from_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.to_phone?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      const minutes = Math.floor((now - date) / (1000 * 60))
      return minutes === 0 ? 'Just now' : `${minutes}m ago`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  const getMessageStatus = (status) => {
    const statusConfig = {
      sent: { color: 'blue', label: 'Sent' },
      delivered: { color: 'green', label: 'Delivered' },
      failed: { color: 'red', label: 'Failed' },
      pending: { color: 'yellow', label: 'Pending' }
    }
    return statusConfig[status] || { color: 'gray', label: status }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              SMS / Text Messages
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({filteredMessages.length})
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Messages List */}
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No messages</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No messages match your search.' : 'Start by sending a message below.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto mb-4">
            {filteredMessages.map((message) => {
              const isOutbound = message.direction === 'outbound'
              const status = getMessageStatus(message.status)

              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${isOutbound ? 'flex-row-reverse' : ''}`}
                >
                  <div className="flex-shrink-0">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      isOutbound
                        ? 'bg-indigo-100 dark:bg-indigo-900/30'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      {isOutbound ? (
                        <UserCircleIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <PhoneIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                  </div>
                  <div className={`flex-1 min-w-0 ${isOutbound ? 'text-right' : ''}`}>
                    <div className="flex items-center gap-2 justify-between">
                      <div className={`flex items-center gap-2 ${isOutbound ? 'flex-row-reverse' : ''}`}>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {isOutbound ? toPhone : message.from_phone}
                        </p>
                        {isOutbound && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${status.color}-100 text-${status.color}-800 dark:bg-${status.color}-900/30 dark:text-${status.color}-400`}>
                            {status.label}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(message.created_at)}
                      </span>
                    </div>
                    <div className={`mt-1 inline-block rounded-lg px-4 py-2 ${
                      isOutbound
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="mt-4 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-shrink-0">
              <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="tel"
                value={toPhone}
                onChange={(e) => setToPhone(e.target.value)}
                placeholder="Phone number"
                className="w-48 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={sending}
              />
            </div>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || !toPhone.trim() || sending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
