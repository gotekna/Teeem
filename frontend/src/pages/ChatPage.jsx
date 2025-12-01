import { useEffect, useState } from 'react'
import { UserGroupIcon, HashtagIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import AccountsLayout from '../components/layout/AccountsLayout'
import ChatBox from '../components/chat/ChatBox'
import { api } from '../api'

// Presence status indicator component
const PresenceIndicator = ({ status }) => {
  const colors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    offline: 'bg-gray-400'
  }
  const titles = {
    online: 'Online',
    away: 'Away',
    offline: 'Offline'
  }

  return (
    <span
      className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-900 ${colors[status] || colors.offline}`}
      title={titles[status] || 'Offline'}
    />
  )
}

export default function ChatPage() {
  const [users, setUsers] = useState([])
  const [selectedConversation, setSelectedConversation] = useState({ type: 'channel', id: 'general', name: '#general' })
  const [loading, setLoading] = useState(true)

  // Mark messages as read when user visits chat page
  useEffect(() => {
    const markAsRead = async () => {
      try {
        await api.post('/api/v1/chat_messages/mark_as_read', {})
      } catch (error) {
        console.error('Failed to mark messages as read:', error)
      }
    }
    markAsRead()
    loadUsers()

    // Refresh presence status every 10 seconds for more responsive updates
    const interval = setInterval(loadUsers, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/v1/users')
      const userList = Array.isArray(response) ? response : []
      // Sort users: online first, then away, then offline, then alphabetically
      const presenceOrder = { online: 0, away: 1, offline: 2 }
      userList.sort((a, b) => {
        const aOrder = presenceOrder[a.presence_status] ?? 2
        const bOrder = presenceOrder[b.presence_status] ?? 2
        if (aOrder !== bOrder) return aOrder - bOrder
        return (a.name || '').localeCompare(b.name || '')
      })
      setUsers(userList)
    } catch (error) {
      console.error('Failed to load users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const channels = [
    { id: 'general', name: 'general', description: 'General discussion' },
    { id: 'team', name: 'team', description: 'Team coordination' },
    { id: 'support', name: 'support', description: 'Support requests' }
  ]

  const selectChannel = async (channel) => {
    setSelectedConversation({
      type: 'channel',
      id: channel.id,
      name: `#${channel.name}`
    })
    // Mark messages as read when selecting a conversation
    try {
      await api.post('/api/v1/chat_messages/mark_as_read', {})
    } catch (error) {
      console.error('Failed to mark messages as read:', error)
    }
  }

  const selectUser = async (user) => {
    setSelectedConversation({
      type: 'direct',
      id: user.id,
      name: user.name,
      email: user.email
    })
    // Mark messages as read when selecting a conversation
    try {
      await api.post('/api/v1/chat_messages/mark_as_read', {})
    } catch (error) {
      console.error('Failed to mark messages as read:', error)
    }
  }

  return (
    <AccountsLayout>
      <div className="h-[calc(100vh-4rem)] flex">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Messages</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Channels Section */}
            <div className="p-2">
              <div className="flex items-center px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                <HashtagIcon className="h-4 w-4 mr-1" />
                Channels
              </div>
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => selectChannel(channel)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-2 ${
                    selectedConversation.type === 'channel' && selectedConversation.id === channel.id
                      ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <HashtagIcon className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{channel.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{channel.description}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Direct Messages Section */}
            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                <UserCircleIcon className="h-4 w-4 mr-1" />
                Direct Messages
              </div>
              {loading ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Loading users...</div>
              ) : users.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No users available</div>
              ) : (
                users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => selectUser(user)}
                    className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center gap-3 ${
                      selectedConversation.type === 'direct' && selectedConversation.id === user.id
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <UserCircleIcon className="h-8 w-8" />
                      <PresenceIndicator status={user.presence_status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1">
          <ChatBox
            key={`${selectedConversation.type}-${selectedConversation.id}`}
            channel={selectedConversation.type === 'channel' ? selectedConversation.id : null}
            userId={selectedConversation.type === 'direct' ? selectedConversation.id : null}
            title={selectedConversation.name}
            showSaveToJob={true}
          />
        </div>
      </div>
    </AccountsLayout>
  )
}
