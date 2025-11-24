import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { LockClosedIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

// Helper to get today in company timezone
const getTodayInCompanyTimezone = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

/**
 * TaskCardNode - Custom ReactFlow node for displaying task cards in cascade modal
 * Supports drag-and-drop between swim lanes
 */
const TaskCardNode = memo(({ data }) => {
  const {
    task,
    zone, // 'cascade', 'break', 'locked'
    depType,
    depLag,
    requiredStart,
    lockReason,
    isConflicted,
    onUnlock
  } = data

  // Zone-specific styling
  const zoneStyles = {
    cascade: {
      border: 'border-green-500 dark:border-green-400',
      bg: 'bg-white dark:bg-gray-800',
      hover: 'hover:shadow-xl hover:scale-105',
      icon: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400'
    },
    break: {
      border: 'border-yellow-500 dark:border-yellow-400',
      bg: 'bg-white dark:bg-gray-800',
      hover: 'hover:shadow-xl hover:scale-105',
      icon: 'bg-yellow-100 dark:bg-yellow-900/30',
      iconColor: 'text-yellow-600 dark:text-yellow-400'
    },
    locked: {
      border: 'border-gray-400 dark:border-gray-600',
      bg: 'bg-gray-50 dark:bg-gray-800',
      hover: '',
      icon: 'bg-gray-200 dark:bg-gray-700',
      iconColor: 'text-gray-600 dark:text-gray-400'
    }
  }

  const style = zoneStyles[zone] || zoneStyles.cascade

  // Format date for display
  const formatDate = (dateValue) => {
    if (!dateValue) return null
    const date = new Date(dateValue)
    date.setHours(0, 0, 0, 0)
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="relative">
      {/* Conflict indicator pulse animation */}
      {isConflicted && (
        <div className="absolute inset-0 rounded-lg border-4 border-red-500 animate-pulse pointer-events-none" />
      )}

      {/* Main card */}
      <div
        className={`
          ${style.bg} ${style.border} ${style.hover}
          rounded-lg shadow-lg border-2 p-4 min-w-[240px] max-w-[280px]
          transition-all duration-300 ease-out cursor-grab active:cursor-grabbing
          ${zone === 'locked' ? 'opacity-75 cursor-not-allowed' : ''}
        `}
      >
        {/* Handles for ReactFlow connections */}
        <Handle type="target" position={Position.Top} className="opacity-0" />
        <Handle type="source" position={Position.Bottom} className="opacity-0" />

        {/* Header: Icon + Task Info */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`rounded-lg ${style.icon} p-2 flex-shrink-0`}>
            {zone === 'cascade' && <CheckCircleIcon className={`h-5 w-5 ${style.iconColor}`} />}
            {zone === 'break' && <ExclamationTriangleIcon className={`h-5 w-5 ${style.iconColor}`} />}
            {zone === 'locked' && <LockClosedIcon className={`h-5 w-5 ${style.iconColor}`} />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
              {task.text}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              #{task.id}
            </div>
          </div>
        </div>

        {/* Dependency Info Badge */}
        {depType && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium">
              {depType}{depLag > 0 ? `+${depLag}` : depLag < 0 ? depLag : ''}
            </span>
          </div>
        )}

        {/* Required Start Date (for cascade zone) */}
        {requiredStart && zone === 'cascade' && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded font-mono">
              Will move to: {formatDate(requiredStart)}
            </span>
          </div>
        )}

        {/* Lock Reason Badge (for locked zone) */}
        {lockReason && zone === 'locked' && (
          <div className="mb-3">
            <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded font-semibold">
              🔒 {lockReason}
            </span>
          </div>
        )}

        {/* Supplier Info */}
        {task.supplier_name && (
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            Supplier: {task.supplier_name}
          </div>
        )}

        {/* Conflict Warning */}
        {isConflicted && (
          <div className="mt-2 pt-2 border-t border-red-300 dark:border-red-700">
            <div className="text-xs text-red-600 dark:text-red-400 font-medium">
              ⚠️ Cannot cascade while locked dependency exists
            </div>
          </div>
        )}

        {/* Unlock Button (for locked cards) */}
        {zone === 'locked' && onUnlock && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onUnlock(task)
            }}
            className="mt-2 w-full text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors duration-200 flex items-center justify-center gap-1"
          >
            <LockClosedIcon className="h-3 w-3" />
            Unlock Task
          </button>
        )}

        {/* Draggable indicator */}
        {zone !== 'locked' && (
          <div className="absolute top-2 right-2 opacity-30">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
})

TaskCardNode.displayName = 'TaskCardNode'

export default TaskCardNode