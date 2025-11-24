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
  const isDevelopment = import.meta.env.MODE === 'development'

  // In development, bypass auth with a fake user
  const [user, setUser] = useState(isDevelopment ? { id: 1, email: 'dev@example.com', name: 'Dev User' } : null)
  const [loading, setLoading] = useState(!isDevelopment)
  const [token, setToken] = useState(localStorage.getItem('token'))

  // Configure axios defaults
  axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  useEffect(() => {
    // Skip auth check in development
    if (isDevelopment) {
      setLoading(false)
      return
    }

    if (token) {
      // Verify token and get user info
      checkAuth()
    } else {
      setLoading(false)
    }
  }, [token, isDevelopment])

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
