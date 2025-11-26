import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Logout() {
  const { logout } = useAuth()

  useEffect(() => {
    // Clear auth state
    logout()
    // Hard redirect to login page to ensure clean state
    window.location.href = '/login'
  }, [logout])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Signing out...</p>
      </div>
    </div>
  )
}
