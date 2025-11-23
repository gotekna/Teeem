import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { api } from '../api'

export default function InspiringBanner() {
  const [quote, setQuote] = useState(null)
  const [visible, setVisible] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDailyQuote()
  }, [])

  const loadDailyQuote = async () => {
    try {
      const response = await api.get('/api/v1/inspiring_quotes/daily')
      if (response.success) {
        setQuote(response.data)
      }
    } catch (error) {
      console.error('Failed to load daily quote:', error?.message || error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !quote || !visible) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-sm rounded-lg max-w-2xl">
      <div className="px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex p-1.5 rounded-lg bg-white/20 flex-shrink-0">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">
                {quote.quote}
              </p>
            </div>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="inline-flex rounded-md p-1 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white flex-shrink-0"
          >
            <span className="sr-only">Dismiss</span>
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
