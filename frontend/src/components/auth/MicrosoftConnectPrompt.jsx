import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { XMarkIcon } from '@heroicons/react/24/outline'

/**
 * MicrosoftConnectPrompt - Shows a prompt to connect Microsoft account after login
 *
 * This component checks if the user has connected their Microsoft account and
 * shows a modal prompting them to connect if not. Users can dismiss the prompt
 * and it will be remembered for the session.
 */
export default function MicrosoftConnectPrompt() {
  const { microsoftStatus, checkingMicrosoft, connectMicrosoft, user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Check if user has dismissed this prompt before (per session)
  useEffect(() => {
    const dismissedKey = `microsoft_prompt_dismissed_${user?.id}`
    if (sessionStorage.getItem(dismissedKey)) {
      setDismissed(true)
    }
  }, [user?.id])

  const handleDismiss = () => {
    const dismissedKey = `microsoft_prompt_dismissed_${user?.id}`
    sessionStorage.setItem(dismissedKey, 'true')
    setDismissed(true)
  }

  const handleConnect = async () => {
    setConnecting(true)
    await connectMicrosoft()
    setConnecting(false)
  }

  // Don't show the automatic popup - users can connect from Settings instead
  // This avoids interrupting users during impersonation or normal use
  // The prompt was causing confusion when impersonating other users
  return null

  // Original logic (disabled):
  // Don't show if:
  // - Still checking Microsoft status
  // - User dismissed the prompt
  // - Microsoft is already connected
  // - No user logged in
  if (checkingMicrosoft || dismissed || microsoftStatus?.connected || !user) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={handleDismiss} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>

          {/* Header with Microsoft logo */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
              <svg className="h-10 w-10 text-white" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Connect Microsoft 365</h2>
            <p className="mt-1 text-sm text-blue-100">
              One connection, all services
            </p>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Connect your Microsoft 365 account to enable:
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">Outlook Email Sync</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Automatically sync job-related emails</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">OneDrive Access</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Access files and documents from OneDrive</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">SharePoint Integration</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Access team sites and shared documents</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Maybe Later
              </button>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {connecting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Connecting...
                  </>
                ) : (
                  'Connect Now'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
