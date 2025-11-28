import { useState, useEffect } from 'react'
import { api } from '../../api'
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export default function OutlookConnection() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    checkStatus()

    // Check for OAuth callback parameters in URL
    const params = new URLSearchParams(window.location.search)
    if (params.get('outlook_success')) {
      checkStatus()
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname + '?tab=integrations')
    } else if (params.get('outlook_error')) {
      alert(`Outlook connection failed: ${params.get('outlook_error')}`)
      window.history.replaceState({}, document.title, window.location.pathname + '?tab=integrations')
    }
  }, [])

  const checkStatus = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/outlook/status')
      setStatus(response)
    } catch (error) {
      console.error('Failed to check Outlook status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    try {
      setConnecting(true)
      const response = await api.get('/api/v1/outlook/auth_url')

      if (response.auth_url) {
        // Open OAuth in popup window
        const width = 600
        const height = 700
        const left = window.screenX + (window.outerWidth - width) / 2
        const top = window.screenY + (window.outerHeight - height) / 2

        const popup = window.open(
          response.auth_url,
          'outlook_oauth',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        )

        // Poll for popup close and check for success
        const pollTimer = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollTimer)
            setConnecting(false)
            // Refresh status after popup closes
            checkStatus()
          }
        }, 500)
      } else {
        alert('Failed to get authorization URL. Please check server configuration.')
        setConnecting(false)
      }
    } catch (error) {
      console.error('Failed to initiate Outlook connection:', error)
      alert(error.response?.data?.error || 'Failed to connect to Outlook')
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Outlook? You will no longer be able to import emails.')) {
      return
    }

    try {
      await api.delete('/api/v1/outlook/disconnect')
      setStatus({ configured: false })
      checkStatus()
    } catch (error) {
      console.error('Failed to disconnect Outlook:', error)
      alert('Failed to disconnect Outlook')
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-6">
        <div className="flex items-center">
          <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin mr-3" />
          <span className="text-gray-600 dark:text-gray-400">Checking Outlook connection...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
          Microsoft Outlook / Office 365
        </h3>
        <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
          <p>
            Connect your Office 365 account to import emails directly into jobs.
            This allows the entire team to access emails associated with each construction project.
          </p>
        </div>

        <div className="mt-5">
          {status?.configured ? (
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                    Connected to Outlook
                  </h3>
                  <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                    <p>Connected as: <strong>{status.email}</strong></p>
                    {status.expired && (
                      <p className="mt-1 text-yellow-700 dark:text-yellow-300">
                        Token expired - will refresh automatically on next use
                      </p>
                    )}
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleDisconnect}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <XCircleIcon className="h-4 w-4 mr-2" />
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800">
              <div className="flex">
                <div className="flex-shrink-0">
                  <XCircleIcon className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Not Connected
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <p>Connect your Office 365 account to enable email import functionality.</p>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connecting ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-4 w-4 mr-2" />
                          Connect Outlook
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Setup Instructions</h4>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
            <li>Register an app in <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Azure Portal</a></li>
            <li>Set redirect URI to: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{window.location.origin}/api/v1/outlook/callback</code></li>
            <li>Grant permissions: Mail.Read, MailboxSettings.Read, offline_access</li>
            <li>Add environment variables: OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET</li>
            <li>Click "Connect Outlook" above to authorize</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
