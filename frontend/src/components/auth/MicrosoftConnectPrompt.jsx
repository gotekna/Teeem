import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'

/**
 * MicrosoftConnectPrompt - Auto-opens Microsoft OAuth when user is not connected
 *
 * This component checks if the user has connected their Microsoft account and
 * automatically opens the OAuth popup if not. Works for both normal login and impersonation.
 */
export default function MicrosoftConnectPrompt() {
  const { microsoftStatus, checkingMicrosoft, connectMicrosoft, user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const hasAutoConnected = useRef(false)

  // Check if user has dismissed/connected this session
  useEffect(() => {
    const dismissedKey = `microsoft_prompt_dismissed_${user?.id}`
    if (sessionStorage.getItem(dismissedKey)) {
      setDismissed(true)
    }
    // Reset auto-connect flag when user changes (e.g., impersonation)
    hasAutoConnected.current = false
  }, [user?.id])

  // Auto-open Microsoft OAuth popup when:
  // - User is logged in
  // - Microsoft status has been checked
  // - User is NOT connected
  // - Haven't already tried to auto-connect this session
  useEffect(() => {
    if (
      user &&
      !checkingMicrosoft &&
      microsoftStatus &&
      !microsoftStatus.connected &&
      !dismissed &&
      !hasAutoConnected.current
    ) {
      // Mark that we've tried auto-connect for this user
      hasAutoConnected.current = true

      // Auto-open the OAuth popup
      connectMicrosoft()

      // Mark as dismissed so we don't keep trying
      const dismissedKey = `microsoft_prompt_dismissed_${user?.id}`
      sessionStorage.setItem(dismissedKey, 'true')
      setDismissed(true)
    }
  }, [user, checkingMicrosoft, microsoftStatus, dismissed, connectMicrosoft])

  // This component doesn't render anything - it just triggers the popup
  return null
}
