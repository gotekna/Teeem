import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const devModeBypass = import.meta.env.VITE_DEV_MODE_AUTH_BYPASS === 'true'

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [skipNextAuthCheck, setSkipNextAuthCheck] = useState(false)
  const [microsoftStatus, setMicrosoftStatus] = useState(null)
  const [checkingMicrosoft, setCheckingMicrosoft] = useState(false)

  // Configure axios defaults
  // Trim the API URL to remove any whitespace/newlines from environment variables
  axios.defaults.baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').trim()
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  useEffect(() => {
    // Skip auth check if we just logged in (we already have user data)
    if (skipNextAuthCheck) {
      setSkipNextAuthCheck(false)
      setLoading(false)
      return
    }

    // Auto-login in dev mode
    if (devModeBypass && !token) {
      devLogin()
      return
    }

    if (token) {
      // Verify token and get user info
      checkAuth()
    } else {
      setLoading(false)
    }
  }, [token, devModeBypass])

  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/v1/auth/me')
      if (response.data.success) {
        setUser(response.data.user)
      } else {
        logout()
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      logout()
    } finally {
      setLoading(false)
    }
  }

  const devLogin = async () => {
    try {
      console.log('🔧 Dev Mode: Auto-logging in...')
      const response = await axios.get('/api/v1/auth/dev_login')

      if (response.data.success) {
        const { token: newToken, user: userData } = response.data
        // Set axios header first
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
        // Store in localStorage
        localStorage.setItem('token', newToken)
        // Skip the useEffect auth check since we already have user data
        setSkipNextAuthCheck(true)
        // Set user first, then token (token change triggers useEffect)
        setUser(userData)
        setToken(newToken)
        console.log('✅ Dev Mode: Logged in as', userData.name)
      }
    } catch (error) {
      console.error('❌ Dev Mode: Auto-login failed:', error)
      console.log('Falling back to normal authentication flow')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/v1/auth/login', {
        user: { email, password }
      })

      if (response.data.success) {
        const { token: newToken, user: userData } = response.data
        // Set axios header first
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
        // Store in localStorage
        localStorage.setItem('token', newToken)
        // Skip the useEffect auth check since we already have user data
        setSkipNextAuthCheck(true)
        // Set user first, then token (token change triggers useEffect)
        setUser(userData)
        setToken(newToken)
        return { success: true }
      } else {
        return { success: false, error: response.data.error }
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed. Please try again.'
      }
    }
  }

  const signup = async (name, email, password, passwordConfirmation) => {
    try {
      const response = await axios.post('/api/v1/auth/signup', {
        user: {
          name,
          email,
          password,
          password_confirmation: passwordConfirmation
        }
      })

      if (response.data.success) {
        const { token: newToken, user: userData } = response.data
        // Set axios header first
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
        // Store in localStorage
        localStorage.setItem('token', newToken)
        // Skip the useEffect auth check since we already have user data
        setSkipNextAuthCheck(true)
        // Set user first, then token (token change triggers useEffect)
        setUser(userData)
        setToken(newToken)
        return { success: true }
      } else {
        return { success: false, errors: response.data.errors }
      }
    } catch (error) {
      return {
        success: false,
        errors: error.response?.data?.errors || ['Signup failed. Please try again.']
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setMicrosoftStatus(null)
    delete axios.defaults.headers.common['Authorization']
  }

  // Check Microsoft connection status
  const checkMicrosoftStatus = useCallback(async () => {
    if (!token) return null

    setCheckingMicrosoft(true)
    try {
      const response = await axios.get('/api/v1/microsoft/status')
      setMicrosoftStatus(response.data)
      return response.data
    } catch (error) {
      console.error('Failed to check Microsoft status:', error)
      setMicrosoftStatus({ connected: false })
      return { connected: false }
    } finally {
      setCheckingMicrosoft(false)
    }
  }, [token])

  // Connect to Microsoft (opens OAuth popup)
  const connectMicrosoft = useCallback(async () => {
    try {
      const response = await axios.get('/api/v1/microsoft/auth_url')
      const authUrl = response.data.auth_url

      // Open OAuth in popup window
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      const popup = window.open(
        authUrl,
        'microsoft-oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      // Listen for OAuth callback message
      const handleMessage = (event) => {
        if (event.data?.type === 'microsoft-oauth-callback') {
          window.removeEventListener('message', handleMessage)
          if (event.data.success) {
            // Refresh Microsoft status
            checkMicrosoftStatus()
          }
        }
      }
      window.addEventListener('message', handleMessage)

      // Poll to check if popup was closed without completing OAuth
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          // Refresh status in case OAuth completed
          checkMicrosoftStatus()
        }
      }, 500)

      return { success: true }
    } catch (error) {
      console.error('Failed to get Microsoft auth URL:', error)
      return { success: false, error: error.message }
    }
  }, [checkMicrosoftStatus])

  // Disconnect Microsoft
  const disconnectMicrosoft = useCallback(async () => {
    try {
      await axios.delete('/api/v1/microsoft/disconnect')
      setMicrosoftStatus({ connected: false })
      return { success: true }
    } catch (error) {
      console.error('Failed to disconnect Microsoft:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Check Microsoft status after user logs in
  useEffect(() => {
    if (user && token && !microsoftStatus && !checkingMicrosoft) {
      checkMicrosoftStatus()
    }
  }, [user, token, microsoftStatus, checkingMicrosoft, checkMicrosoftStatus])

  const value = {
    user,
    login,
    signup,
    logout,
    loading,
    isAuthenticated: !!user,
    // Microsoft integration
    microsoftStatus,
    checkingMicrosoft,
    checkMicrosoftStatus,
    connectMicrosoft,
    disconnectMicrosoft
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
