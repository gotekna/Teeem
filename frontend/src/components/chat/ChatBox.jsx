import { useState, useEffect, useRef } from 'react'
import { PaperAirplaneIcon, XMarkIcon, BookmarkIcon } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid'
import { api } from '../../api'

export default function ChatBox({ channel = 'general', projectId = null, userId = null, title = 'Chat', onClose = null, showSaveToJob = false }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const [_pollingInterval, setPollingInterval] = useState(null)
  const [savingMessageId, setSavingMessageId] = useState(null)
  const [constructions, setConstructions] = useState([])
  const [showJobSelector, setShowJobSelector] = useState(null) // message ID
  const [showConversationJobSelector, setShowConversationJobSelector] = useState(false)
  const [savingConversation, setSavingConversation] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = async () => {
    try {
      const params = {}
      if (projectId) {
        params.project_id = projectId
      } else if (userId) {
        params.user_id = userId
      } else {
        params.channel = channel
      }
      const response = await api.get('/api/v1/chat_messages', { params })
      setMessages(Array.isArray(response) ? response : [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch messages:', error)
      setMessages([])
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()

    // Poll for new messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000)
    setPollingInterval(interval)

    // Load constructions for job selector if showSaveToJob is enabled
    if (showSaveToJob) {
      loadConstructions()
    }

    return () => {
      if (interval) clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, projectId, userId])

  const loadConstructions = async () => {
    try {
      console.log('Loading constructions for job selector...')
      const response = await api.get('/api/v1/jobs', {
        params: { status: 'Active', per_page: 100 }
      })
      console.log('Constructions loaded:', response.constructions?.length || 0, 'jobs')
      setConstructions(response.constructions || [])
    } catch (error) {
      console.error('Failed to load constructions:', error)
      setConstructions([])
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const payload = {
        chat_message: {
          content: newMessage,
          ...(projectId && { project_id: projectId }),
          ...(userId && { recipient_user_id: userId }),
          ...(channel && !userId && !projectId && { channel: channel })
        }
      }

      const response = await api.post('/api/v1/chat_messages', payload)
      setMessages([...messages, response])
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

  const handleSaveToJob = async (messageId, constructionId) => {
    console.log('Saving message', messageId, 'to construction', constructionId)
    setSavingMessageId(messageId)
    try {
      const response = await api.post(`/api/v1/chat_messages/${messageId}/save_to_job`, {
        construction_id: constructionId
      })
      console.log('Save response:', response)

      // Update the message in the list to reflect it's saved
      setMessages(messages.map(msg =>
        msg.id === messageId ? { ...msg, saved_to_job: true, construction_id: constructionId } : msg
      ))

      setShowJobSelector(null)
      alert('Message saved to job successfully!')
    } catch (error) {
      console.error('Failed to save message to job:', error)
      alert('Failed to save message to job. Please try again.')
    } finally {
      setSavingMessageId(null)
    }
  }

  const handleSaveConversationToJob = async (constructionId) => {
    console.log('Saving entire conversation to construction', constructionId)
    setSavingConversation(true)
    try {
      const messageIds = messages.map(msg => msg.id)
      const response = await api.post('/api/v1/chat_messages/save_conversation_to_job', {
        construction_id: constructionId,
        message_ids: messageIds
      })
      console.log('Save conversation response:', response)

      // Update all messages in the list to reflect they're saved
      setMessages(messages.map(msg => ({
        ...msg,
        saved_to_job: true,
        construction_id: constructionId
      })))

      setShowConversationJobSelector(false)
      alert(`Conversation saved to job successfully! ${messageIds.length} messages saved.`)
    } catch (error) {
      console.error('Failed to save conversation to job:', error)
      alert('Failed to save conversation to job. Please try again.')
    } finally {
      setSavingConversation(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {projectId ? `Project Chat` : userId ? `Direct Message` : `Channel`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showSaveToJob && messages.length > 0 && (
            <button
              onClick={() => setShowConversationJobSelector(!showConversationJobSelector)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
              title="Save entire conversation to a job"
            >
              <BookmarkIcon className="h-4 w-4" />
              Save Conversation
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation Job Selector Dropdown */}
      {showConversationJobSelector && (
        <div className="mx-4 mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Save all {messages.length} messages in this conversation to:
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {constructions.map((construction) => (
              <button
                key={construction.id}
                onClick={() => handleSaveConversationToJob(construction.id)}
                disabled={savingConversation}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-gray-900 dark:text-white disabled:opacity-50"
              >
                {construction.title}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowConversationJobSelector(false)}
            className="mt-2 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 dark:text-gray-400">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-2">No messages yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const userName = message?.user?.name || message?.user?.email || 'Unknown User'
            const timestamp = message?.formatted_timestamp || new Date(message?.created_at).toLocaleString()
            const isSaved = message?.saved_to_job

            // Debug: Log message state on first render
            if (messages.length > 0 && message.id === messages[0].id) {
              console.log('Message rendering debug:', {
                showSaveToJob,
                isSaved,
                messageId: message.id,
                constructionsCount: constructions.length
              })
            }

            return (
              <div key={message.id} className="flex flex-col space-y-1 group">
                <div className="flex items-baseline space-x-2">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">
                    {userName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {timestamp}
                  </span>
                  {isSaved && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <BookmarkSolidIcon className="h-3 w-3" />
                      Saved to job
                    </span>
                  )}
                  {showSaveToJob && !isSaved && (
                    <button
                      onClick={() => {
                        console.log('Save to job clicked for message:', message.id)
                        console.log('Current showJobSelector:', showJobSelector)
                        console.log('Constructions available:', constructions.length)
                        setShowJobSelector(message.id)
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 transition-opacity"
                      title="Save to job"
                    >
                      <BookmarkIcon className="h-3 w-3" />
                      Save to job
                    </button>
                  )}
                </div>
                <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                  {message.content}
                </div>

                {/* Job selector dropdown */}
                {showJobSelector === message.id && (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select a job to save this message to:
                    </p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {constructions.map((construction) => (
                        <button
                          key={construction.id}
                          onClick={() => handleSaveToJob(message.id, construction.id)}
                          disabled={savingMessageId === message.id}
                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-gray-900 dark:text-white disabled:opacity-50"
                        >
                          {construction.title}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowJobSelector(null)}
                      className="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Message ${projectId ? 'team' : userId ? 'user' : `#${channel}`}...`}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-indigo-500 focus:ring-indigo-500"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
