import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CameraIcon,
  MapPinIcon,
  MicrophoneIcon,
  ChatBubbleLeftIcon,
  UserIcon,
  CalendarIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
  FlagIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  AtSymbolIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

// ============================================
// Activity Feed Component
// ============================================

const ACTIVITY_ICONS = {
  camera: CameraIcon,
  microphone: MicrophoneIcon,
  'map-pin': MapPinIcon,
  chat: ChatBubbleLeftIcon,
  user: UserIcon,
  calendar: CalendarIcon,
  'check-circle': CheckCircleIcon,
  plus: PlusIcon,
  trash: TrashIcon,
  flag: FlagIcon,
  activity: ArrowPathIcon
}

const ACTIVITY_COLORS = {
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  blue: 'bg-blue-100 text-blue-600',
  purple: 'bg-purple-100 text-purple-600',
  gray: 'bg-gray-100 text-gray-600'
}

const ActivityItem = ({ activity, onClick }) => {
  const Icon = ACTIVITY_ICONS[activity.icon] || ArrowPathIcon
  const colorClass = ACTIVITY_COLORS[activity.color] || ACTIVITY_COLORS.gray

  return (
    <div
      className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
      onClick={() => onClick?.(activity)}
    >
      <div className={`p-2 rounded-full ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 text-sm">
            {activity.actor?.name || 'System'}
          </span>
          <span className="text-gray-500 text-sm">{activity.message}</span>
        </div>
        {activity.task && (
          <div className="text-xs text-blue-600 mt-0.5">
            {activity.task.name}
          </div>
        )}
        <div className="text-xs text-gray-400 mt-1">{activity.time_ago}</div>
      </div>
    </div>
  )
}

export const ActivityFeed = ({
  constructionId,
  taskId,
  limit = 50,
  showFilters = true,
  onActivityClick,
  pollInterval = 30000 // 30 seconds
}) => {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [summary, setSummary] = useState(null)
  const lastFetchRef = useRef(null)

  const fetchActivities = useCallback(async () => {
    try {
      const params = { limit }
      if (filter !== 'all') params.type = filter
      if (lastFetchRef.current) params.since = lastFetchRef.current

      let url
      if (taskId) {
        url = `/api/v1/sm_tasks/${taskId}/activities`
      } else if (constructionId) {
        url = `/api/v1/constructions/${constructionId}/sm_activities`
      } else {
        url = '/api/v1/sm_activities/my_activity'
      }

      const res = await api.get(url, { params })

      if (lastFetchRef.current && res.data.activities.length > 0) {
        // Prepend new activities
        setActivities(prev => [...res.data.activities, ...prev].slice(0, limit))
      } else {
        setActivities(res.data.activities || [])
      }

      lastFetchRef.current = new Date().toISOString()
    } catch (err) {
      console.error('Failed to fetch activities:', err)
    } finally {
      setLoading(false)
    }
  }, [constructionId, taskId, limit, filter])

  const fetchSummary = useCallback(async () => {
    if (!constructionId) return
    try {
      const res = await api.get('/api/v1/sm_activities/summary', {
        params: { construction_id: constructionId }
      })
      setSummary(res.data)
    } catch (err) {
      console.error('Failed to fetch summary:', err)
    }
  }, [constructionId])

  useEffect(() => {
    lastFetchRef.current = null
    setLoading(true)
    fetchActivities()
    fetchSummary()
  }, [fetchActivities, fetchSummary])

  // Poll for new activities
  useEffect(() => {
    if (!pollInterval) return
    const interval = setInterval(fetchActivities, pollInterval)
    return () => clearInterval(interval)
  }, [fetchActivities, pollInterval])

  const filterOptions = [
    { value: 'all', label: 'All Activity' },
    { value: 'task_status_changed', label: 'Status Changes' },
    { value: 'photo_uploaded', label: 'Photos' },
    { value: 'comment_added', label: 'Comments' },
    { value: 'checkin_arrival', label: 'Check-ins' },
    { value: 'resource_assigned', label: 'Assignments' }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header with summary */}
      {summary && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Activity Feed</h3>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">
                Today: <span className="font-medium text-gray-700">{summary.today}</span>
              </span>
              <span className="text-gray-500">
                This week: <span className="font-medium text-gray-700">{summary.this_week}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="px-4 py-2 border-b border-gray-100">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              lastFetchRef.current = null
            }}
            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {filterOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Activity list */}
      <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No activity yet
          </div>
        ) : (
          activities.map(activity => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              onClick={onActivityClick}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ============================================
// Comment Thread Component
// ============================================

const CommentItem = ({ comment, onReply, onEdit, onDelete, currentUserId, depth = 0 }) => {
  const [showReplies, setShowReplies] = useState(depth === 0)
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return
    setSubmitting(true)
    try {
      await onReply(comment.id, replyText)
      setReplyText('')
      setReplying(false)
    } finally {
      setSubmitting(false)
    }
  }

  const canEdit = comment.author?.id === currentUserId
  const canDelete = comment.author?.id === currentUserId

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-100 pl-4' : ''}`}>
      <div className="py-3">
        {/* Comment header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium">
              {comment.author?.name?.charAt(0) || '?'}
            </div>
            <div>
              <span className="font-medium text-gray-900 text-sm">
                {comment.author?.name || 'Unknown'}
              </span>
              <span className="text-gray-400 text-xs ml-2">
                {new Date(comment.created_at).toLocaleDateString()}
                {comment.edited && ' (edited)'}
              </span>
            </div>
          </div>
          {(canEdit || canDelete) && (
            <div className="flex items-center gap-1">
              {canEdit && (
                <button
                  onClick={() => onEdit?.(comment)}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete?.(comment.id)}
                  className="text-gray-400 hover:text-red-600 text-xs ml-2"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Comment body */}
        <div className="mt-2 text-gray-700 text-sm whitespace-pre-wrap">
          {comment.deleted ? (
            <span className="italic text-gray-400">[Comment deleted]</span>
          ) : (
            comment.body
          )}
        </div>

        {/* Actions */}
        {!comment.deleted && (
          <div className="mt-2 flex items-center gap-4">
            <button
              onClick={() => setReplying(!replying)}
              className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
            >
              <ChatBubbleLeftIcon className="w-3 h-3" />
              Reply
            </button>
            {comment.reply_count > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
              >
                {showReplies ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
        )}

        {/* Reply form */}
        {replying && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitReply()}
            />
            <button
              onClick={handleSubmitReply}
              disabled={submitting || !replyText.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50"
            >
              {submitting ? '...' : 'Reply'}
            </button>
          </div>
        )}
      </div>

      {/* Replies */}
      {showReplies && comment.replies?.length > 0 && (
        <div className="space-y-0">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              currentUserId={currentUserId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const CommentThread = ({
  taskId,
  currentUserId,
  onCommentAdded
}) => {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const inputRef = useRef(null)

  const fetchComments = useCallback(async () => {
    if (!taskId) return
    try {
      const res = await api.get(`/api/v1/sm_tasks/${taskId}/comments`)
      setComments(res.data.comments || [])
    } catch (err) {
      console.error('Failed to fetch comments:', err)
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleSubmit = async () => {
    if (!newComment.trim()) return
    setSubmitting(true)
    try {
      const res = await api.post(`/api/v1/sm_tasks/${taskId}/comments`, {
        body: newComment
      })
      setComments(prev => [...prev, res.data.comment])
      setNewComment('')
      onCommentAdded?.(res.data.comment)
    } catch (err) {
      console.error('Failed to post comment:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReply = async (parentId, body) => {
    try {
      const res = await api.post(`/api/v1/sm_comments/${parentId}/reply`, { body })
      // Refresh comments to get updated reply counts
      fetchComments()
      onCommentAdded?.(res.data.comment)
    } catch (err) {
      console.error('Failed to post reply:', err)
    }
  }

  const handleEdit = async (comment) => {
    const newBody = prompt('Edit comment:', comment.body)
    if (newBody && newBody !== comment.body) {
      try {
        await api.patch(`/api/v1/sm_comments/${comment.id}`, { body: newBody })
        fetchComments()
      } catch (err) {
        console.error('Failed to edit comment:', err)
      }
    }
  }

  const handleDelete = async (commentId) => {
    if (!confirm('Delete this comment?')) return
    try {
      await api.delete(`/api/v1/sm_comments/${commentId}`)
      fetchComments()
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    setNewComment(value)

    // Check for @ mention trigger
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentionSuggestions(true)
    } else {
      setShowMentionSuggestions(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <ChatBubbleLeftIcon className="w-5 h-5" />
          Comments
          {comments.length > 0 && (
            <span className="text-sm text-gray-500">({comments.length})</span>
          )}
        </h3>
      </div>

      {/* Comment list */}
      <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto px-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No comments yet. Start the conversation!
          </div>
        ) : (
          comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>

      {/* New comment form */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={newComment}
              onChange={handleInputChange}
              placeholder="Add a comment... (use @ to mention)"
              rows={2}
              className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit()
                }
              }}
            />
            {showMentionSuggestions && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-md shadow-lg p-2 text-xs text-gray-500">
                Type a name to mention someone
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50 flex items-center gap-1 self-end"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
            {submitting ? '...' : 'Send'}
          </button>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Press Cmd+Enter to send
        </div>
      </div>
    </div>
  )
}

// ============================================
// Mentions Badge Component
// ============================================

export const MentionsBadge = ({ onClick }) => {
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchMentions = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/sm_comments/mentions')
      setUnreadCount(res.data.unread_count || 0)
    } catch (err) {
      console.error('Failed to fetch mentions:', err)
    }
  }, [])

  useEffect(() => {
    fetchMentions()
    // Poll every minute
    const interval = setInterval(fetchMentions, 60000)
    return () => clearInterval(interval)
  }, [fetchMentions])

  if (unreadCount === 0) return null

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-gray-600 hover:text-blue-600"
    >
      <AtSymbolIcon className="w-5 h-5" />
      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    </button>
  )
}

// ============================================
// Mentions Dropdown Component
// ============================================

export const MentionsDropdown = ({ onMentionClick, onClose }) => {
  const [mentions, setMentions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMentions = async () => {
      try {
        const res = await api.get('/api/v1/sm_comments/mentions')
        setMentions(res.data.mentions || [])
      } catch (err) {
        console.error('Failed to fetch mentions:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchMentions()
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await api.post('/api/v1/sm_comments/mentions/read_all')
      setMentions([])
    } catch (err) {
      console.error('Failed to mark mentions read:', err)
    }
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Mentions</h3>
        {mentions.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : mentions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No mentions
          </div>
        ) : (
          mentions.map(mention => (
            <div
              key={mention.id}
              onClick={() => onMentionClick?.(mention)}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
            >
              <div className="font-medium text-sm text-gray-900">
                {mention.comment.author_name} mentioned you
              </div>
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                {mention.comment.body}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                in {mention.task.name}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default {
  ActivityFeed,
  CommentThread,
  MentionsBadge,
  MentionsDropdown
}
