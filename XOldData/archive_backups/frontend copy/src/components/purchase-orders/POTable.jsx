import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { formatCurrency } from '../../utils/formatters'
import POStatusBadge from './POStatusBadge'
import {
  EllipsisVerticalIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

export default function POTable({ purchaseOrders, onEdit, onDelete, onApprove, onSend }) {
  const [expandedPO, setExpandedPO] = useState(null)
  const navigate = useNavigate()

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const handleRowClick = (poId) => {
    setExpandedPO(expandedPO === poId ? null : poId)
  }

  return (
    <div className="overflow-x-auto border-l border-r border-b border-gray-200 dark:border-gray-700 rounded-lg">
      <table className="min-w-full">
        <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              PO Number
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              Supplier
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              Description
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              Required Date
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              Status
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
              Total
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          {purchaseOrders.length === 0 ? (
            <tr>
              <td colSpan="7" className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No purchase orders found. Click "New Purchase Order" to create one.
              </td>
            </tr>
          ) : (
            purchaseOrders.map((po) => (
              <tr
                key={po.id}
                onClick={() => handleRowClick(po.id)}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                  {po.purchase_order_number}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  {po.supplier?.name || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-md truncate">
                  {po.description || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(po.required_date)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <POStatusBadge status={po.status} />
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white font-medium">
                  {formatCurrency(po.total, false)}
                </td>
                <td className="px-4 py-3 text-sm text-center" onClick={(e) => e.stopPropagation()}>
                  <Menu as="div" className="relative inline-block text-left">
                    <MenuButton className="flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none">
                      <span className="sr-only">Open options</span>
                      <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
                    </MenuButton>

                    <MenuItems
                      transition
                      className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 transition focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in"
                    >
                      <div className="py-1">
                        <MenuItem>
                          {({ focus }) => (
                            <button
                              onClick={() => navigate(`/purchase-orders/${po.id}`)}
                              className={`${
                                focus ? 'bg-gray-100 dark:bg-gray-700' : ''
                              } group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300`}
                            >
                              <EyeIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300" aria-hidden="true" />
                              View
                            </button>
                          )}
                        </MenuItem>
                        {['draft', 'pending'].includes(po.status) && onEdit && (
                          <MenuItem>
                            {({ focus }) => (
                              <button
                                onClick={() => onEdit(po)}
                                className={`${
                                  focus ? 'bg-gray-100 dark:bg-gray-700' : ''
                                } group flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300`}
                              >
                                <PencilIcon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300" aria-hidden="true" />
                                Edit
                              </button>
                            )}
                          </MenuItem>
                        )}
                        {po.status !== 'paid' && onDelete && (
                          <MenuItem>
                            {({ focus }) => (
                              <button
                                onClick={() => onDelete(po.id)}
                                className={`${
                                  focus ? 'bg-gray-100 dark:bg-gray-700' : ''
                                } group flex w-full items-center px-4 py-2 text-sm text-red-700 dark:text-red-400`}
                              >
                                <TrashIcon className="mr-3 h-5 w-5 text-red-600 group-hover:text-red-700 dark:text-red-400 dark:group-hover:text-red-300" aria-hidden="true" />
                                Delete
                              </button>
                            )}
                          </MenuItem>
                        )}
                      </div>
                    </MenuItems>
                  </Menu>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
