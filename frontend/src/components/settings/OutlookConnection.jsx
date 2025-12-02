import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../api'
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default function OutlookConnection() {
  const { microsoftStatus, checkingMicrosoft, connectMicrosoft, disconnectMicrosoft, checkMicrosoftStatus } = useAuth()
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // Refresh status on mount if not already loaded
  useEffect(() => {
    if (!microsoftStatus && !checkingMicrosoft) {
      checkMicrosoftStatus()
    }
  }, [microsoftStatus, checkingMicrosoft, checkMicrosoftStatus])

  const handleConnect = async () => {
    setConnecting(true)
    await connectMicrosoft()
    setConnecting(false)
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Office 365? This will disable email sync and SharePoint integration.')) {
      return
    }

    setDisconnecting(true)
    await disconnectMicrosoft()
    setDisconnecting(false)
  }

  const handleReconnect = async () => {
    setConnecting(true)
    await connectMicrosoft()
    setConnecting(false)
  }

  if (checkingMicrosoft) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg p-6">
        <div className="flex items-center">
          <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin mr-3" />
          <span className="text-gray-600 dark:text-gray-400">Checking Microsoft connection...</span>
        </div>
      </div>
    )
  }

  const isConnected = microsoftStatus?.connected
  const needsReconnect = microsoftStatus?.needs_refresh || microsoftStatus?.status === 'error'

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
          Office 365
        </h3>
        <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
          <p>
            Connect your Office 365 account to import emails directly into jobs.
            This allows the entire team to access emails associated with each construction project.
          </p>
        </div>

        <div className="mt-5">
          {isConnected && !needsReconnect ? (
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
                    <p>Connected as: <strong>{microsoftStatus.email}</strong></p>
                  </div>
                  {/* Services status */}
                  {microsoftStatus.services && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {microsoftStatus.services.outlook && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200">
                          <CheckCircleIcon className="h-3 w-3 mr-1" />
                          Outlook
                        </span>
                      )}
                      {(microsoftStatus.services.onedrive || microsoftStatus.services.sharepoint) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200">
                          <CheckCircleIcon className="h-3 w-3 mr-1" />
                          SharePoint
                        </span>
                      )}
                    </div>
                  )}
                  {/* Legacy connection notice */}
                  {microsoftStatus.legacy && (
                    <div className="mt-3 text-xs text-yellow-600 dark:text-yellow-400">
                      <p>{microsoftStatus.message}</p>
                      <button
                        onClick={handleReconnect}
                        className="mt-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Reconnect to enable all services
                      </button>
                    </div>
                  )}
                  <div className="mt-4">
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {disconnecting ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-4 w-4 mr-2" />
                          Disconnect
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : needsReconnect ? (
            <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Reconnection Required
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <p>
                      {microsoftStatus?.sync_error || 'Your Microsoft connection needs to be refreshed.'}
                    </p>
                    {microsoftStatus?.email && (
                      <p className="mt-1">Previously connected as: <strong>{microsoftStatus.email}</strong></p>
                    )}
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleReconnect}
                      disabled={connecting}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connecting ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                          Reconnecting...
                        </>
                      ) : (
                        <>
                          <ArrowPathIcon className="h-4 w-4 mr-2" />
                          Reconnect Microsoft
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-gray-50 dark:bg-gray-700/50 p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex">
                <div className="flex-shrink-0">
                  <XCircleIcon className="h-5 w-5 text-gray-400" />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Not Connected
                  </h3>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <p>Connect your Office 365 account to enable:</p>
                    <ul className="mt-2 space-y-1 list-disc list-inside">
                      <li>Automatic email sync to jobs</li>
                      <li>SharePoint file access</li>
                    </ul>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {connecting ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4 mr-2" viewBox="0 0 21 21">
                            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                          </svg>
                          Connect Microsoft 365
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
            <li>Set redirect URI to: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{window.location.origin.replace('teeemrob.vercel.app', 'teeem-rob-dev-cfbdfa15b107.herokuapp.com')}/api/v1/microsoft/callback</code></li>
            <li>Grant permissions: Mail.Read, MailboxSettings.Read, offline_access</li>
            <li>Add environment variables: OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET</li>
            <li>Click "Connect Outlook" above to authorize</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
