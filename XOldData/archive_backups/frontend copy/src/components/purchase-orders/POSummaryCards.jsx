import { ShoppingCartIcon, CurrencyDollarIcon, ClockIcon, DocumentCheckIcon } from '@heroicons/react/24/outline'
import { formatCurrency } from '../../utils/formatters'

export default function POSummaryCards({ purchaseOrders }) {
  const calculateStats = () => {
    const totalPOs = purchaseOrders.length
    const totalValue = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.total) || 0), 0)
    const pendingApprovals = purchaseOrders.filter(po => po.status === 'pending').length
    const outstandingInvoices = purchaseOrders.filter(po =>
      ['sent', 'received', 'invoiced'].includes(po.status)
    ).reduce((sum, po) => sum + (parseFloat(po.total) - parseFloat(po.amount_paid || 0)), 0)

    return { totalPOs, totalValue, pendingApprovals, outstandingInvoices }
  }

  const stats = calculateStats()

  const cards = [
    {
      name: 'Total Purchase Orders',
      value: stats.totalPOs,
      icon: ShoppingCartIcon,
      color: 'indigo'
    },
    {
      name: 'Total Value',
      value: formatCurrency(stats.totalValue, false),
      icon: CurrencyDollarIcon,
      color: 'blue'
    },
    {
      name: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: ClockIcon,
      color: 'yellow',
      highlight: stats.pendingApprovals > 0
    },
    {
      name: 'Outstanding Invoices',
      value: formatCurrency(stats.outstandingInvoices, false),
      icon: DocumentCheckIcon,
      color: 'green'
    }
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.name}
          className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <card.icon
                  className={`h-6 w-6 ${
                    card.highlight
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                  aria-hidden="true"
                />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    {card.name}
                  </dt>
                  <dd>
                    <div className={`text-lg font-medium ${
                      card.highlight
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {card.value}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
