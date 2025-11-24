import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Label,
} from '@headlessui/react'
import {
  ArrowLeftIcon,
  EllipsisVerticalIcon,
  UserCircleIcon,
  CalendarDaysIcon,
  BuildingStorefrontIcon,
  PaperClipIcon,
  FaceSmileIcon,
  FireIcon,
  HeartIcon,
  FaceSmileIcon as FaceHappyIcon,
  FaceFrownIcon,
  HandThumbUpIcon,
  XMarkIcon as XMarkIconMini,
} from '@heroicons/react/20/solid'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { api } from '../api'
import { formatCurrency } from '../utils/formatters'

const moods = [
  { name: 'Excited', value: 'excited', icon: FireIcon, iconColor: 'text-white', bgColor: 'bg-red-500' },
  { name: 'Loved', value: 'loved', icon: HeartIcon, iconColor: 'text-white', bgColor: 'bg-pink-400' },
  { name: 'Happy', value: 'happy', icon: FaceHappyIcon, iconColor: 'text-white', bgColor: 'bg-green-400' },
  { name: 'Sad', value: 'sad', icon: FaceFrownIcon, iconColor: 'text-white', bgColor: 'bg-yellow-400' },
  { name: 'Thumbsy', value: 'thumbsy', icon: HandThumbUpIcon, iconColor: 'text-white', bgColor: 'bg-blue-500' },
  { name: 'I feel nothing', value: null, icon: XMarkIconMini, iconColor: 'text-gray-400', bgColor: 'bg-transparent' },
]

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [purchaseOrder, setPurchaseOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(moods[5])
  const [comment, setComment] = useState('')

  useEffect(() => {
    loadPurchaseOrder()
  }, [id])

  const loadPurchaseOrder = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/purchase_orders/${id}`)
      setPurchaseOrder(response)
    } catch (err) {
      setError('Failed to load purchase order')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    try {
      await api.post(`/api/v1/purchase_orders/${id}/approve`)
      await loadPurchaseOrder()
    } catch (err) {
      console.error('Failed to approve purchase order:', err)
      alert('Failed to approve purchase order')
    }
  }

  const handleSendToSupplier = async () => {
    try {
      await api.post(`/api/v1/purchase_orders/${id}/send_to_supplier`)
      await loadPurchaseOrder()
    } catch (err) {
      console.error('Failed to send to supplier:', err)
      alert('Failed to send to supplier')
    }
  }

  const handleMarkReceived = async () => {
    try {
      await api.post(`/api/v1/purchase_orders/${id}/mark_received`)
      await loadPurchaseOrder()
    } catch (err) {
      console.error('Failed to mark as received:', err)
      alert('Failed to mark as received')
    }
  }

  const getStatusBadgeClass = (status) => {
    const classes = {
      draft: 'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-500/10 dark:text-gray-500 dark:ring-gray-500/30',
      pending: 'bg-yellow-50 text-yellow-600 ring-yellow-600/20 dark:bg-yellow-500/10 dark:text-yellow-500 dark:ring-yellow-500/30',
      approved: 'bg-blue-50 text-blue-600 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-500 dark:ring-blue-500/30',
      sent: 'bg-indigo-50 text-indigo-600 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-500 dark:ring-indigo-500/30',
      received: 'bg-green-50 text-green-600 ring-green-600/20 dark:bg-green-500/10 dark:text-green-500 dark:ring-green-500/30',
      invoiced: 'bg-purple-50 text-purple-600 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-500 dark:ring-purple-500/30',
      paid: 'bg-green-50 text-green-600 ring-green-600/20 dark:bg-green-500/10 dark:text-green-500 dark:ring-green-500/30',
      cancelled: 'bg-red-50 text-red-600 ring-red-600/20 dark:bg-red-500/10 dark:text-red-500 dark:ring-red-500/30',
    }
    return classes[status] || classes.draft
  }

  const handleCommentSubmit = async (e) => {
    e.preventDefault()
    // TODO: Implement comment submission
    console.log('Comment:', comment, 'Mood:', selected)
    setComment('')
    setSelected(moods[5])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error || !purchaseOrder) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 dark:text-red-400">{error || 'Purchase order not found'}</div>
      </div>
    )
  }

  return (
    <main>
      <header className="relative isolate">
        <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-16 top-full -mt-16 transform-gpu opacity-50 blur-3xl xl:left-1/2 xl:-ml-80 dark:opacity-30">
            <div
              style={{
                clipPath:
                  'polygon(100% 38.5%, 82.6% 100%, 60.2% 37.7%, 52.4% 32.1%, 47.5% 41.8%, 45.2% 65.6%, 27.5% 23.4%, 0.1% 35.3%, 17.9% 0%, 27.7% 23.4%, 76.2% 2.5%, 74.2% 56%, 100% 38.5%)',
              }}
              className="aspect-[1154/678] w-[72.125rem] bg-gradient-to-br from-[#FF80B5] to-[#9089FC]"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-gray-900/5 dark:bg-white/5" />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-4">
            <Link
              to="/active-jobs"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <ArrowLeftIcon className="mr-2 h-4 w-4" />
              Back to Jobs
            </Link>
          </div>

          <div className="mx-auto flex max-w-2xl items-center justify-between gap-x-8 lg:mx-0 lg:max-w-none">
            <div className="flex items-center gap-x-6">
              <div className="size-16 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/10 outline outline-1 -outline-offset-1 outline-black/5 dark:outline-white/10">
                <BuildingStorefrontIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-500" />
              </div>
              <h1>
                <div className="text-sm/6 text-gray-500 dark:text-gray-400">
                  Purchase Order <span className="text-gray-700 dark:text-gray-300">#{purchaseOrder.purchase_order_number}</span>
                </div>
                <div className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                  {purchaseOrder.construction?.title || 'No Construction Job'}
                </div>
              </h1>
            </div>
            <div className="flex items-center gap-x-4 sm:gap-x-6">
              <button
                type="button"
                onClick={() => navigate(`/jobs/${purchaseOrder.construction_id}`)}
                className="hidden text-sm/6 font-semibold text-gray-900 sm:block dark:text-white"
              >
                View Job
              </button>
              {purchaseOrder.can_edit && (
                <button
                  type="button"
                  className="hidden text-sm/6 font-semibold text-gray-900 sm:block dark:text-white"
                >
                  Edit
                </button>
              )}
              {purchaseOrder.status === 'draft' && (
                <button
                  onClick={handleApprove}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
                >
                  Submit for Approval
                </button>
              )}
              {purchaseOrder.status === 'approved' && (
                <button
                  onClick={handleSendToSupplier}
                  className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
                >
                  Send to Supplier
                </button>
              )}
              {purchaseOrder.status === 'sent' && (
                <button
                  onClick={handleMarkReceived}
                  className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:bg-green-500 dark:shadow-none dark:hover:bg-green-400 dark:focus-visible:outline-green-500"
                >
                  Mark Received
                </button>
              )}

              <Menu as="div" className="relative sm:hidden">
                <MenuButton className="relative block">
                  <span className="absolute -inset-3" />
                  <span className="sr-only">More</span>
                  <EllipsisVerticalIcon aria-hidden="true" className="size-5 text-gray-500 dark:text-gray-400" />
                </MenuButton>

                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-0.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg outline outline-1 outline-gray-900/5 transition data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                >
                  <MenuItem>
                    <button
                      type="button"
                      className="block w-full px-3 py-1 text-left text-sm/6 text-gray-900 data-[focus]:bg-gray-50 data-[focus]:outline-none dark:text-white dark:data-[focus]:bg-white/5"
                    >
                      View Job
                    </button>
                  </MenuItem>
                  {purchaseOrder.can_edit && (
                    <MenuItem>
                      <button
                        type="button"
                        className="block w-full px-3 py-1 text-left text-sm/6 text-gray-900 data-[focus]:bg-gray-50 data-[focus]:outline-none dark:text-white dark:data-[focus]:bg-white/5"
                      >
                        Edit
                      </button>
                    </MenuItem>
                  )}
                </MenuItems>
              </Menu>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 grid-rows-1 items-start gap-x-8 gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {/* PO Summary */}
          <div className="lg:col-start-3 lg:row-end-1">
            <h2 className="sr-only">Summary</h2>
            <div className="rounded-lg bg-gray-50 shadow-sm outline outline-1 outline-gray-900/5 dark:bg-gray-800/50 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10">
              <dl className="flex flex-wrap">
                <div className="flex-auto pl-6 pt-6">
                  <dt className="text-sm/6 font-semibold text-gray-900 dark:text-white">Amount</dt>
                  <dd className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(purchaseOrder.total || 0)}
                  </dd>
                </div>
                <div className="flex-none self-end px-6 pt-4">
                  <dt className="sr-only">Status</dt>
                  <dd className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusBadgeClass(purchaseOrder.status)}`}>
                    {purchaseOrder.status.charAt(0).toUpperCase() + purchaseOrder.status.slice(1)}
                  </dd>
                </div>
                <div className="mt-6 flex w-full flex-none gap-x-4 border-t border-gray-900/5 px-6 pt-6 dark:border-white/10">
                  <dt className="flex-none">
                    <span className="sr-only">Supplier</span>
                    <BuildingStorefrontIcon aria-hidden="true" className="h-6 w-5 text-gray-400 dark:text-gray-500" />
                  </dt>
                  <dd className="text-sm/6 font-medium text-gray-900 dark:text-white">
                    {purchaseOrder.supplier?.name || 'No supplier'}
                  </dd>
                </div>
                <div className="mt-4 flex w-full flex-none gap-x-4 px-6">
                  <dt className="flex-none">
                    <span className="sr-only">Required date</span>
                    <CalendarDaysIcon aria-hidden="true" className="h-6 w-5 text-gray-400 dark:text-gray-500" />
                  </dt>
                  <dd className="text-sm/6 text-gray-500 dark:text-gray-400">
                    {purchaseOrder.required_date ? (
                      <time dateTime={purchaseOrder.required_date}>{formatDate(purchaseOrder.required_date)}</time>
                    ) : (
                      'No date set'
                    )}
                  </dd>
                </div>
                {purchaseOrder.budget && (
                  <div className="mt-4 flex w-full flex-none gap-x-4 px-6">
                    <dt className="flex-none">
                      <span className="sr-only">Budget</span>
                      <UserCircleIcon aria-hidden="true" className="h-6 w-5 text-gray-400 dark:text-gray-500" />
                    </dt>
                    <dd className="text-sm/6 text-gray-500 dark:text-gray-400">
                      Budget: {formatCurrency(purchaseOrder.budget)}
                    </dd>
                  </div>
                )}
              </dl>
              {purchaseOrder.status === 'paid' && (
                <div className="mt-6 border-t border-gray-900/5 px-6 py-6 dark:border-white/10">
                  <button className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                    Download receipt <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Purchase Order Details */}
          <div className="-mx-4 px-4 py-8 shadow-sm ring-1 ring-gray-900/5 sm:mx-0 sm:rounded-lg sm:px-8 sm:pb-14 lg:col-span-2 lg:row-span-2 lg:row-end-2 xl:px-16 xl:pb-20 xl:pt-16 dark:shadow-none dark:ring-white/10">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Purchase Order</h2>
            <dl className="mt-6 grid grid-cols-1 text-sm/6 sm:grid-cols-2">
              <div className="sm:pr-4">
                <dt className="inline text-gray-500 dark:text-gray-400">Created on</dt>{' '}
                <dd className="inline text-gray-700 dark:text-gray-300">
                  <time dateTime={purchaseOrder.created_at}>{formatDate(purchaseOrder.created_at)}</time>
                </dd>
              </div>
              <div className="mt-2 sm:mt-0 sm:pl-4">
                <dt className="inline text-gray-500 dark:text-gray-400">Required by</dt>{' '}
                <dd className="inline text-gray-700 dark:text-gray-300">
                  {purchaseOrder.required_date ? (
                    <time dateTime={purchaseOrder.required_date}>{formatDate(purchaseOrder.required_date)}</time>
                  ) : (
                    'Not specified'
                  )}
                </dd>
              </div>
              <div className="mt-6 border-t border-gray-900/5 pt-6 sm:pr-4 dark:border-white/10">
                <dt className="font-semibold text-gray-900 dark:text-white">From</dt>
                <dd className="mt-2 text-gray-500 dark:text-gray-400">
                  {purchaseOrder.company_setting ? (
                    <>
                      <span className="font-medium text-gray-900 dark:text-white">{purchaseOrder.company_setting.company_name}</span>
                      <br />
                      {purchaseOrder.company_setting.address && purchaseOrder.company_setting.address}
                      {purchaseOrder.company_setting.abn && (
                        <>
                          <br />
                          ABN: {purchaseOrder.company_setting.abn}
                        </>
                      )}
                      {purchaseOrder.company_setting.gst_number && (
                        <>
                          <br />
                          GST: {purchaseOrder.company_setting.gst_number}
                        </>
                      )}
                    </>
                  ) : (
                    'Company details not configured'
                  )}
                </dd>
              </div>
              {purchaseOrder.supplier && (
                <div className="mt-8 sm:mt-6 sm:border-t sm:border-gray-900/5 sm:pl-4 sm:pt-6 dark:sm:border-white/10">
                  <dt className="font-semibold text-gray-900 dark:text-white">To</dt>
                  <dd className="mt-2 text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{purchaseOrder.supplier.name}</span>
                    {purchaseOrder.supplier.address && (
                      <>
                        <br />
                        {purchaseOrder.supplier.address}
                      </>
                    )}
                    {purchaseOrder.supplier.contact_person && (
                      <>
                        <br />
                        Contact: {purchaseOrder.supplier.contact_person}
                      </>
                    )}
                    {purchaseOrder.supplier.email && (
                      <>
                        <br />
                        {purchaseOrder.supplier.email}
                      </>
                    )}
                    {purchaseOrder.supplier.phone && (
                      <>
                        <br />
                        {purchaseOrder.supplier.phone}
                      </>
                    )}
                  </dd>
                </div>
              )}
              {purchaseOrder.delivery_address && (
                <div className="mt-8 sm:mt-6 sm:border-t sm:border-gray-900/5 sm:pt-6 dark:sm:border-white/10">
                  <dt className="font-semibold text-gray-900 dark:text-white">Delivery Address</dt>
                  <dd className="mt-2 text-gray-500 dark:text-gray-400 whitespace-pre-line">
                    {purchaseOrder.delivery_address}
                  </dd>
                </div>
              )}
            </dl>

            {/* Description */}
            {purchaseOrder.description && (
              <div className="mt-6 border-t border-gray-900/5 pt-6 dark:border-white/10">
                <dt className="font-semibold text-gray-900 dark:text-white">Description</dt>
                <dd className="mt-2 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">
                  {purchaseOrder.description}
                </dd>
              </div>
            )}

            {/* Special Instructions */}
            {purchaseOrder.special_instructions && (
              <div className="mt-6 border-t border-gray-900/5 pt-6 dark:border-white/10">
                <dt className="font-semibold text-gray-900 dark:text-white">Special Instructions</dt>
                <dd className="mt-2 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">
                  {purchaseOrder.special_instructions}
                </dd>
              </div>
            )}

            {/* Line Items Table */}
            <table className="mt-16 w-full whitespace-nowrap text-left text-sm/6">
              <colgroup>
                <col className="w-full" />
                <col />
                <col />
                <col />
              </colgroup>
              <thead className="border-b border-gray-200 text-gray-900 dark:border-white/15 dark:text-white">
                <tr>
                  <th scope="col" className="px-0 py-3 font-semibold">
                    Item
                  </th>
                  <th scope="col" className="hidden py-3 pl-8 pr-0 text-right font-semibold sm:table-cell">
                    Qty
                  </th>
                  <th scope="col" className="hidden py-3 pl-8 pr-0 text-right font-semibold sm:table-cell">
                    Unit Price
                  </th>
                  <th scope="col" className="py-3 pl-8 pr-0 text-right font-semibold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrder.line_items?.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 dark:border-white/10">
                    <td className="max-w-0 px-0 py-5 align-top">
                      <div className="truncate font-medium text-gray-900 dark:text-white">{item.description}</div>
                      {item.notes && (
                        <div className="truncate text-gray-500 dark:text-gray-400">{item.notes}</div>
                      )}
                    </td>
                    <td className="hidden py-5 pl-8 pr-0 text-right align-top tabular-nums text-gray-700 sm:table-cell dark:text-gray-300">
                      {item.quantity}
                    </td>
                    <td className="hidden py-5 pl-8 pr-0 text-right align-top tabular-nums text-gray-700 sm:table-cell dark:text-gray-300">
                      {formatCurrency(item.unit_price, false)}
                    </td>
                    <td className="py-5 pl-8 pr-0 text-right align-top tabular-nums text-gray-700 dark:text-gray-300">
                      {formatCurrency(item.quantity * item.unit_price, false)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="px-0 pb-0 pt-6 font-normal text-gray-700 sm:hidden dark:text-gray-300">
                    Subtotal
                  </th>
                  <th
                    scope="row"
                    colSpan={3}
                    className="hidden px-0 pb-0 pt-6 text-right font-normal text-gray-700 sm:table-cell dark:text-gray-300"
                  >
                    Subtotal
                  </th>
                  <td className="pb-0 pl-8 pr-0 pt-6 text-right tabular-nums text-gray-900 dark:text-white">
                    {formatCurrency(purchaseOrder.sub_total, false)}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="pt-4 font-normal text-gray-700 sm:hidden dark:text-gray-300">
                    Tax (GST)
                  </th>
                  <th
                    scope="row"
                    colSpan={3}
                    className="hidden pt-4 text-right font-normal text-gray-700 sm:table-cell dark:text-gray-300"
                  >
                    Tax (GST)
                  </th>
                  <td className="pb-0 pl-8 pr-0 pt-4 text-right tabular-nums text-gray-900 dark:text-white">
                    {formatCurrency(purchaseOrder.tax, false)}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="pt-4 font-semibold text-gray-900 sm:hidden dark:text-white">
                    Total
                  </th>
                  <th
                    scope="row"
                    colSpan={3}
                    className="hidden pt-4 text-right font-semibold text-gray-900 sm:table-cell dark:text-white"
                  >
                    Total
                  </th>
                  <td className="pb-0 pl-8 pr-0 pt-4 text-right font-semibold tabular-nums text-gray-900 dark:text-white">
                    {formatCurrency(purchaseOrder.total, false)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="lg:col-start-3">
            {/* Activity feed */}
            <h2 className="text-sm/6 font-semibold text-gray-900 dark:text-white">Activity</h2>
            <ul role="list" className="mt-6 space-y-6">
              <li className="relative flex gap-x-4">
                <div className="absolute left-0 top-0 flex w-6 justify-center h-6">
                  <div className="w-px bg-gray-200 dark:bg-white/10" />
                </div>
                <div className="relative flex size-6 flex-none items-center justify-center bg-white dark:bg-gray-900">
                  <CheckCircleIcon
                    aria-hidden="true"
                    className="size-6 text-indigo-600 dark:text-indigo-500"
                  />
                </div>
                <p className="flex-auto py-0.5 text-xs/5 text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-900 dark:text-white">System</span> created the purchase order.
                </p>
                <time className="flex-none py-0.5 text-xs/5 text-gray-500 dark:text-gray-400">
                  {formatDate(purchaseOrder.created_at)}
                </time>
              </li>
            </ul>

            {/* New comment form */}
            <div className="mt-6 flex gap-x-3">
              <div className="size-6 flex-none rounded-full bg-gray-100 dark:bg-gray-800 outline outline-1 -outline-offset-1 outline-black/5 dark:outline-white/10" />
              <form onSubmit={handleCommentSubmit} className="relative flex-auto">
                <div className="overflow-hidden rounded-lg pb-12 outline outline-1 -outline-offset-1 outline-gray-300 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-indigo-600 dark:bg-white/5 dark:outline-white/10 dark:focus-within:outline-indigo-500">
                  <label htmlFor="comment" className="sr-only">
                    Add your comment
                  </label>
                  <textarea
                    id="comment"
                    name="comment"
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add your comment..."
                    className="block w-full resize-none bg-transparent px-3 py-1.5 text-base text-gray-900 placeholder:text-gray-400 focus:outline focus:outline-0 sm:text-sm/6 dark:text-white dark:placeholder:text-gray-500"
                  />
                </div>

                <div className="absolute inset-x-0 bottom-0 flex justify-between py-2 pl-3 pr-2">
                  <div className="flex items-center space-x-5">
                    <div className="flex items-center">
                      <button
                        type="button"
                        className="-m-2.5 flex size-10 items-center justify-center rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-white"
                      >
                        <PaperClipIcon aria-hidden="true" className="size-5" />
                        <span className="sr-only">Attach a file</span>
                      </button>
                    </div>
                    <div className="flex items-center">
                      <Listbox value={selected} onChange={setSelected}>
                        <Label className="sr-only">Your mood</Label>
                        <div className="relative">
                          <ListboxButton className="relative -m-2.5 flex size-10 items-center justify-center rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-white">
                            <span className="flex items-center justify-center">
                              {selected.value === null ? (
                                <span>
                                  <FaceSmileIcon aria-hidden="true" className="size-5 shrink-0" />
                                  <span className="sr-only">Add your mood</span>
                                </span>
                              ) : (
                                <span>
                                  <span
                                    className={classNames(
                                      selected.bgColor,
                                      'flex size-8 items-center justify-center rounded-full',
                                    )}
                                  >
                                    <selected.icon aria-hidden="true" className="size-5 shrink-0 text-white" />
                                  </span>
                                  <span className="sr-only">{selected.name}</span>
                                </span>
                              )}
                            </span>
                          </ListboxButton>

                          <ListboxOptions
                            transition
                            className="absolute bottom-10 z-10 -ml-6 w-60 rounded-lg bg-white py-3 text-base shadow outline outline-1 outline-black/5 data-[closed]:data-[leave]:opacity-0 data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in sm:ml-auto sm:w-64 sm:text-sm dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                          >
                            {moods.map((mood) => (
                              <ListboxOption
                                key={mood.value}
                                value={mood}
                                className="relative cursor-default select-none bg-white px-3 py-2 text-gray-900 data-[focus]:bg-gray-100 dark:bg-transparent dark:text-white dark:data-[focus]:bg-white/5"
                              >
                                <div className="flex items-center">
                                  <div
                                    className={classNames(
                                      mood.bgColor,
                                      'flex size-8 items-center justify-center rounded-full',
                                    )}
                                  >
                                    <mood.icon
                                      aria-hidden="true"
                                      className={classNames(mood.iconColor, 'size-5 shrink-0')}
                                    />
                                  </div>
                                  <span className="ml-3 block truncate font-medium">{mood.name}</span>
                                </div>
                              </ListboxOption>
                            ))}
                          </ListboxOptions>
                        </div>
                      </Listbox>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-white/10 dark:text-white dark:shadow-none dark:ring-white/5 dark:hover:bg-white/20"
                  >
                    Comment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
