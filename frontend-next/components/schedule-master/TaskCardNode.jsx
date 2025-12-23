'use client'

import { memo } from 'react'
import { Handle, Position } from 'reactflow'

/**
 * TaskCardNode - Custom node for React Flow kanban visualization
 * Displays task information in a card format
 */
const TaskCardNode = memo(({ data, isConnectable }) => {
  const { label, status, duration, resource, progress } = data

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'complete':
      case 'completed':
        return 'bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700'
      case 'in_progress':
      case 'in progress':
        return 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700'
      case 'blocked':
        return 'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700'
      case 'pending':
      default:
        return 'bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600'
    }
  }

  return (
    <div className={`px-3 py-2 rounded-lg border-2 shadow-sm min-w-[150px] ${getStatusColor(status)}`}>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-gray-500"
      />

      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
        {label}
      </div>

      {duration && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Duration: {duration} days
        </div>
      )}

      {resource && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {resource}
        </div>
      )}

      {progress !== undefined && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-gray-500"
      />
    </div>
  )
})

TaskCardNode.displayName = 'TaskCardNode'

export default TaskCardNode
