import { useState, useEffect, useRef } from 'react'
import { MagnifyingGlassIcon, ChatBubbleLeftRightIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function JobMessagesTab({ constructionId }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadMessages()

    // Poll for new messages every 3 seconds
    const interval = setInterval(loadMessages, 3000)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [constructionId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      if (loading) setLoading(true)
      const response = await api.get(`/api/v1/jobs/${constructionId}/saved_messages`)
      setMessages(Array.isArray(response) ? response : [])
    } catch (error) {
      console.error('Failed to load messages:', error)
      setMessages([])
    } finally {
      if (loading) setLoading(false)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      // Create message in project chat and automatically save to job
      const response = await api.post('/api/v1/chat_messages', {
        chat_message: {
          content: newMessage,
          project_id: constructionId
        }
      })

      // Auto-save to this construction
      await api.post(`/api/v1/chat_messages/${response.id}/save_to_job`, {
        construction_id: constructionId
      })

      // Add to messages list
      setMessages([...messages, { ...response, saved_to_job: true, construction_id: constructionId }])
      setNewMessage('')
      scrollToBottom()
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const filteredMessages = messages.filter(msg => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      msg.content?.toLowerCase().includes(searchLower) ||
      msg.user?.name?.toLowerCase().includes(searchLower) ||
      msg.user?.email?.toLowerCase().includes(searchLower)
    )
  })

  const getConversationType = (message) => {
    if (message.channel) return `#${message.channel}`
    if (message.recipient_user_id) return 'Direct Message'
    if (message.project_id) return 'Project Chat'
    return 'Unknown'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] bg-white dark:bg-gray-900 rounded-lg shadow">
      {/* Chat input at top */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
        <form onSubmit={handleSendMessage} className="flex space-x-2 mb-3">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message for this job..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="self-end inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed h-[42px]"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </form>

        {/* Search bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 dark:text-gray-400">Loading messages...</div>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'No messages found' : 'No messages yet'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Start the conversation by sending a message below'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((message) => {
              const userName = message?.user?.name || message?.user?.email || 'Unknown User'
              const timestamp = message?.formatted_timestamp || new Date(message?.created_at).toLocaleString()
              const conversationType = getConversationType(message)

              return (
                <div
                  key={message.id}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">
                        {userName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {timestamp}
                      </span>
                    </div>
                    {conversationType !== 'Project Chat' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {conversationType}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
