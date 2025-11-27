import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { api } from '../api'

export default function XeroCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState({
    loading: true,
    success: false,
    error: null,
  })

  useEffect(() => {
    handleCallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCallback = async () => {
    // Get the authorization code from URL params
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    // Check if we've already processed this code to prevent duplicate OAuth exchanges on refresh
    const processedCode = sessionStorage.getItem('xero_processed_code')
    if (code && code === processedCode) {
      // Already processed this code, redirect immediately
      navigate('/settings', { replace: true })
      return
    }

    // Check for errors from Xero
    if (error) {
      setStatus({
        loading: false,
        success: false,
        error: `Authorization failed: ${error}`,
      })
      setTimeout(() => navigate('/settings'), 3000)
      return
    }

    // Check if code is present
    if (!code) {
      setStatus({
        loading: false,
        success: false,
        error: 'No authorization code received',
      })
      setTimeout(() => navigate('/settings'), 3000)
      return
    }

    try {
      // Exchange the code for tokens
      await api.post('/api/v1/xero/callback', { code })

      // Mark this code as processed to prevent re-execution on refresh
      sessionStorage.setItem('xero_processed_code', code)

      setStatus({
        loading: false,
        success: true,
        error: null,
      })

      // Redirect to integrations page after success
      setTimeout(() => navigate('/settings'), 2000)
    } catch (err) {
      setStatus({
        loading: false,
        success: false,
        error: err.message || 'Failed to complete Xero connection',
      })

      // Redirect to integrations page after error
      setTimeout(() => navigate('/settings'), 3000)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
          <div className="text-center">
            {status.loading ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-500"></div>
                </div>
                <h2 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
                  Connecting to Xero...
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Please wait while we complete the connection.
                </p>
              </>
            ) : status.success ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/10">
                  <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-500" />
                </div>
                <h2 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
                  Successfully Connected!
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Your Xero account has been connected. Redirecting...
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
                  <XCircleIcon className="h-10 w-10 text-red-600 dark:text-red-500" />
                </div>
                <h2 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
                  Connection Failed
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {status.error}
                </p>
                <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                  Redirecting back to settings...
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
