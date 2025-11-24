import { useState, useEffect, useRef } from 'react'
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { api } from '../api'
import { useLocation } from 'react-router-dom'

export default function GrokChat({ isOpen, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const location = useLocation()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize with a welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hey! I'm here to help you build out this product. Talk to me the same way you'd talk with Grok - let's wrap our heads around the product and features together. What are you thinking about building?"
      }])
    }
  }, [isOpen])

  const getContext = () => {
    return {
      current_page: location.pathname,
      // You can add more context here like current table, recent actions, etc.
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await api.post('/api/v1/grok/chat', {
        message: userMessage,
        context: getContext()
      })

      if (response.success) {
        const newMessage = {
          role: 'assistant',
          content: response.response,
          showSaveButton: response.response.toLowerCase().includes('are you happy with this plan')
        }
        setMessages(prev => [...prev, newMessage])
      } else {
        setMessages(prev => [...prev, {
          role: 'error',
          content: 'Sorry, I encountered an error. Please try again.'
        }])
      }
    } catch (error) {
      console.error('Grok chat error:', error)
      setMessages(prev => [...prev, {
        role: 'error',
        content: 'Failed to connect to Grok. Please check your API key.'
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSavePlan = async () => {
    const planTitle = prompt('Give this plan a title:')
    if (!planTitle) return

    try {
      const response = await api.post('/api/v1/grok/plans', {
        title: planTitle,
        description: messages[1]?.content?.substring(0, 200), // First user message
        conversation: messages,
        status: 'planning'
      })

      if (response.success) {
        setMessages(prev => [...prev, {
          role: 'system',
          content: `✅ Plan saved as "${planTitle}"! You can find it in the Features section.`
        }])
      }
    } catch (error) {
      console.error('Failed to save plan:', error)
      setMessages(prev => [...prev, {
        role: 'error',
        content: 'Failed to save plan. Please try again.'
      }])
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const suggestFeatures = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/v1/grok/suggest-features')

      if (response.success) {
        setMessages(prev => [...prev,
          { role: 'user', content: 'What features should we build next?' },
          { role: 'assistant', content: response.suggestions }
        ])
      }
    } catch (error) {
      console.error('Feature suggestion error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-white/10 shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-x-2">
          <SparklesIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Grok AI</h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-800/50">
        <button
          onClick={suggestFeatures}
          disabled={loading}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-x-1"
        >
          <SparklesIcon className="h-3 w-3" />
          Suggest Features
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index}>
            <div
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : message.role === 'error'
                    ? 'bg-red-50 dark:bg-red-900/10 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800'
                    : message.role === 'system'
                    ? 'bg-green-50 dark:bg-green-900/10 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
            {message.showSaveButton && (
              <div className="flex justify-start mt-2">
                <button
                  onClick={handleSavePlan}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md font-medium"
                >
                  💾 Save Plan to Features
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
              <div className="flex items-center gap-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900">
        <div className="flex items-end gap-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Grok anything..."
            rows={2}
            disabled={loading}
            className="flex-1 resize-none rounded-lg border-gray-300 dark:border-white/10 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-500 focus:ring-indigo-500 text-sm disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Shift + Enter for new line
        </p>
      </div>
    </div>
  )
}

// Floating button to open chat
export function GrokChatButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-black hover:bg-gray-800 text-white rounded-full p-3 shadow-lg z-40 flex items-center gap-x-2 group"
    >
      <img src="/grok-logo.png" alt="Grok" className="h-10 w-10" />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
        Ask Grok
      </span>
    </button>
  )
}
