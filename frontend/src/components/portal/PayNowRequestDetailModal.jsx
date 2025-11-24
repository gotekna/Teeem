import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CheckCircleIcon, XCircleIcon, ClockIcon, BanknotesIcon, CalendarIcon, DocumentTextIcon, PhotoIcon } from '@heroicons/react/24/outline'

export default function PayNowRequestDetailModal({ isOpen, onClose, request }) {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-6 w-6 text-yellow-500" />
      case 'approved':
      case 'paid':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />
      case 'rejected':
      case 'cancelled':
        return <XCircleIcon className="h-6 w-6 text-red-500" />
      default:
        return <ClockIcon className="h-6 w-6 text-gray-500" />
    }
  }

  const getStatusBadgeClass = (status) => {
    const classes = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    return classes[status] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount) => {
    if (typeof amount === 'string' && amount.startsWith('$')) {
      return amount
    }
    return `$${Number(amount).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (!request) return null

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6">
                {/* Close button */}
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Header */}
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                    {getStatusIcon(request.status)}
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                      Payment Request Details
                    </Dialog.Title>
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium ${getStatusBadgeClass(request.status)}`}>
                        {request.status_display}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="mt-6 space-y-6">
                  {/* Purchase Order Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Purchase Order</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">PO Number:</span>
                        <span className="font-medium text-gray-900">{request.purchase_order_number}</span>
                      </div>
                      {request.purchase_order?.construction_name && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Job:</span>
                          <span className="font-medium text-gray-900">{request.purchase_order.construction_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Details */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-indigo-900 mb-3 flex items-center">
                      <BanknotesIcon className="h-5 w-5 mr-2" />
                      Financial Details
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-indigo-600">Original Amount</p>
                        <p className="text-lg font-semibold text-gray-900">{request.original_amount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-indigo-600">Discount ({request.discount_percentage}%)</p>
                        <p className="text-lg font-semibold text-red-600">-{request.discount_amount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-indigo-600">Final Payment</p>
                        <p className="text-lg font-semibold text-green-600">{request.discounted_amount}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-indigo-200">
                      <p className="text-xs text-indigo-600">Your Savings</p>
                      <p className="text-xl font-bold text-green-600">{request.discount_amount}</p>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <CalendarIcon className="h-5 w-5 mr-2" />
                      Timeline
                    </h4>
                    <div className="flow-root">
                      <ul className="-mb-8">
                        {/* Requested */}
                        <li>
                          <div className="relative pb-8">
                            <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                            <div className="relative flex space-x-3">
                              <div>
                                <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                                  <ClockIcon className="h-5 w-5 text-white" />
                                </span>
                              </div>
                              <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                <div>
                                  <p className="text-sm text-gray-500">Request Submitted</p>
                                </div>
                                <div className="whitespace-nowrap text-right text-sm text-gray-500">
                                  {formatDate(request.requested_at)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>

                        {/* Reviewed */}
                        {request.reviewed_at && (
                          <li>
                            <div className="relative pb-8">
                              <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                              <div className="relative flex space-x-3">
                                <div>
                                  <span className={`h-8 w-8 rounded-full ${request.status === 'rejected' ? 'bg-red-500' : 'bg-green-500'} flex items-center justify-center ring-8 ring-white`}>
                                    {request.status === 'rejected' ? (
                                      <XCircleIcon className="h-5 w-5 text-white" />
                                    ) : (
                                      <CheckCircleIcon className="h-5 w-5 text-white" />
                                    )}
                                  </span>
                                </div>
                                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                  <div>
                                    <p className="text-sm text-gray-500">
                                      {request.status === 'rejected' ? 'Rejected' : 'Approved'} by {request.reviewed_by || 'Supervisor'}
                                    </p>
                                    {request.supervisor_notes && (
                                      <p className="mt-1 text-sm text-gray-700">{request.supervisor_notes}</p>
                                    )}
                                  </div>
                                  <div className="whitespace-nowrap text-right text-sm text-gray-500">
                                    {formatDate(request.reviewed_at)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        )}

                        {/* Paid */}
                        {request.paid_at && (
                          <li>
                            <div className="relative pb-8">
                              <div className="relative flex space-x-3">
                                <div>
                                  <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                                    <BanknotesIcon className="h-5 w-5 text-white" />
                                  </span>
                                </div>
                                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                  <div>
                                    <p className="text-sm text-gray-500">Payment Processed</p>
                                    {request.payment?.reference_number && (
                                      <p className="mt-1 text-xs text-gray-600">Ref: {request.payment.reference_number}</p>
                                    )}
                                  </div>
                                  <div className="whitespace-nowrap text-right text-sm text-gray-500">
                                    {formatDate(request.paid_at)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Rejection Reason */}
                  {request.rejection_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-red-900 mb-2">Rejection Reason</h4>
                      <p className="text-sm text-red-800">{request.rejection_reason}</p>
                    </div>
                  )}

                  {/* Supplier Notes */}
                  {request.supplier_notes && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                        <DocumentTextIcon className="h-5 w-5 mr-2" />
                        Your Notes
                      </h4>
                      <p className="text-sm text-gray-700">{request.supplier_notes}</p>
                    </div>
                  )}

                  {/* Attachments */}
                  {(request.invoice_file_url || (request.proof_photos && request.proof_photos.length > 0)) && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                        <PhotoIcon className="h-5 w-5 mr-2" />
                        Attachments
                      </h4>

                      {request.invoice_file_url && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-1">Invoice File</p>
                          <a
                            href={request.invoice_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                          >
                            <DocumentTextIcon className="h-4 w-4 mr-1" />
                            View Invoice
                          </a>
                        </div>
                      )}

                      {request.proof_photos && request.proof_photos.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Proof of Completion ({request.proof_photos.length} photos)</p>
                          <div className="grid grid-cols-4 gap-2">
                            {request.proof_photos.map((photo, index) => (
                              <a
                                key={index}
                                href={photo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-75 transition"
                              >
                                <img
                                  src={photo}
                                  alt={`Proof ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Details */}
                  {request.payment && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-green-900 mb-3">Payment Information</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-green-700">Amount Paid:</span>
                          <span className="font-medium text-green-900">{formatCurrency(request.payment.amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Payment Date:</span>
                          <span className="font-medium text-green-900">{formatDate(request.payment.payment_date)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Reference:</span>
                          <span className="font-medium text-green-900">{request.payment.reference_number}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-6">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
