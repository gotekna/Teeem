import { LinkIcon, XMarkIcon } from '@heroicons/react/24/outline'
import DataTable from '../DataTable'
import Badge from '../Badge'

export default function ScheduleTaskList({ tasks, loading, onMatchTask, onUnmatch }) {
  const columns = [
    {
      key: 'title',
      label: 'Task Title',
      sortable: true,
      render: (task) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {task.title}
          </div>
          {task.status && (
            <div className="mt-1">
              <Badge color={getStatusColor(task.status)}>
                {task.status}
              </Badge>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'supplier_category',
      label: 'Supplier Category',
      sortable: true,
      render: (task) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {task.supplier_category || '-'}
        </span>
      )
    },
    {
      key: 'start_date',
      label: 'Start Date',
      sortable: true,
      getValue: (task) => task.start_date,
      render: (task) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {task.start_date ? new Date(task.start_date).toLocaleDateString() : '-'}
        </span>
      )
    },
    {
      key: 'duration_days',
      label: 'Duration',
      sortable: true,
      render: (task) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {task.duration_days ? `${task.duration_days} days` : '-'}
        </span>
      )
    },
    {
      key: 'purchase_order',
      label: 'Purchase Order',
      sortable: false,
      render: (task) => {
        if (task.purchase_order_id && task.purchase_order_number) {
          // Matched task - show PO number
          return (
            <Badge color="green" withDot>
              PO #{task.purchase_order_number}
            </Badge>
          )
        } else {
          // Unmatched task - show match button
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMatchTask(task)
              }}
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <LinkIcon className="h-3 w-3 mr-1" />
              Match
            </button>
          )
        }
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right',
      render: (task) => {
        if (task.purchase_order_id) {
          // Show unmatch button for matched tasks
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onUnmatch(task.id)
              }}
              className="inline-flex items-center px-2.5 py-1.5 border border-red-300 dark:border-red-800 rounded-md text-xs font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              <XMarkIcon className="h-3 w-3 mr-1" />
              Unmatch
            </button>
          )
        }
        return <span className="text-sm text-gray-400 dark:text-gray-600">-</span>
      }
    }
  ]

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
      <DataTable
        title="Schedule Tasks"
        description="Match tasks to purchase orders to build your project timeline"
        data={tasks}
        columns={columns}
        loading={loading}
        emptyStateTitle="No schedule tasks"
        emptyStateDescription="Import a schedule file to get started."
        defaultSortKey="start_date"
        defaultSortDirection="asc"
      />
    </div>
  )
}

function getStatusColor(status) {
  const statusLower = status?.toLowerCase() || ''

  if (statusLower.includes('completed') || statusLower.includes('done')) {
    return 'green'
  }
  if (statusLower.includes('in progress') || statusLower.includes('active')) {
    return 'blue'
  }
  if (statusLower.includes('not started') || statusLower.includes('pending')) {
    return 'gray'
  }
  if (statusLower.includes('delayed') || statusLower.includes('blocked')) {
    return 'red'
  }

  return 'gray'
}
