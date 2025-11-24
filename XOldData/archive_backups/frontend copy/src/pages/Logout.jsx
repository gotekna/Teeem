import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Logout() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  useEffect(() => {
    const performLogout = async () => {
      await logout()
      navigate('/login')
    }
    performLogout()
  }, [logout, navigate])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Signing out...</p>
      </div>
    </div>
  )
}
