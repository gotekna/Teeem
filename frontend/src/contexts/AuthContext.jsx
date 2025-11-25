import { createContext, useContext, useState, useEffect } from 'react'
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

  // Configure axios defaults
  // Trim the API URL to remove any whitespace/newlines from environment variables
  axios.defaults.baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').trim()
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  useEffect(() => {
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
        const { token, user } = response.data
        localStorage.setItem('token', token)
        setToken(token)
        setUser(user)
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
        console.log('✅ Dev Mode: Logged in as', user.name)
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
        const { token, user } = response.data
        localStorage.setItem('token', token)
        setToken(token)
        setUser(user)
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
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
        const { token, user } = response.data
        localStorage.setItem('token', token)
        setToken(token)
        setUser(user)
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
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
    delete axios.defaults.headers.common['Authorization']
  }

  const value = {
    user,
    login,
    signup,
    logout,
    loading,
    isAuthenticated: !!user
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
