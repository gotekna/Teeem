import { useState, useEffect, Suspense, lazy } from 'react'
import { api } from '../../api'

const UserManualTableView = lazy(() => import('../documentation/UserManualTableView'))

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500 dark:text-gray-400">Loading User Manual...</div>
    </div>
  )
}

export default function UserManualTab() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadManualContent()
  }, [])

  const loadManualContent = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/v1/documentation/user-manual')
      if (response.success) {
        setContent(response.data.content)
      }
    } catch (error) {
      console.error('Failed to load user manual:', error)
      setContent('# Error\n\nFailed to load user manual.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingFallback />
  }

  return (
    <div className="fixed inset-0 top-16 flex flex-col overflow-hidden bg-white dark:bg-gray-900" style={{ left: '18rem', bottom: '40px' }}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          📘 User Manual
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          End-user guides and step-by-step instructions for using TEEEM features
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<LoadingFallback />}>
          <UserManualTableView content={content} />
        </Suspense>
      </div>
    </div>
  )
}
