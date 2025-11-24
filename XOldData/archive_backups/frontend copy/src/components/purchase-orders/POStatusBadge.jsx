export default function POStatusBadge({ status }) {
  const statusConfig = {
    draft: {
      color: 'gray',
      classes: 'bg-gray-400/20 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400'
    },
    pending: {
      color: 'yellow',
      classes: 'bg-yellow-400/20 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500'
    },
    approved: {
      color: 'blue',
      classes: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
    },
    sent: {
      color: 'indigo',
      classes: 'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
    },
    received: {
      color: 'green',
      classes: 'bg-green-500/15 text-green-700 dark:bg-green-500/10 dark:text-green-400'
    },
    invoiced: {
      color: 'purple',
      classes: 'bg-purple-500/15 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
    },
    paid: {
      color: 'emerald',
      classes: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
    },
    cancelled: {
      color: 'red',
      classes: 'bg-red-500/15 text-red-700 dark:bg-red-500/10 dark:text-red-400'
    }
  }

  const config = statusConfig[status?.toLowerCase()] || statusConfig.draft
  const displayStatus = status?.charAt(0).toUpperCase() + status?.slice(1) || 'Draft'

  return (
    <span className={`inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium ${config.classes}`}>
      <svg className="h-1.5 w-1.5 fill-current" viewBox="0 0 6 6" aria-hidden="true">
        <circle cx={3} cy={3} r={3} />
      </svg>
      {displayStatus}
    </span>
  )
}
