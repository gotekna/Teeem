import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CheckCircleIcon, XCircleIcon, ClockIcon, BanknotesIcon, CalendarIcon, UserIcon, PhotoIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import axios from 'axios'

export default function PayNowDetailModal({ isOpen, onClose, request: initialRequest }) {
  const [loading, setLoading] = useState(false)
  const [request, setRequest] = useState(initialRequest)

  useEffect(() => {
    if (isOpen && initialRequest) {
      loadFullDetails()
    }
  }, [isOpen, initialRequest])

  const loadFullDetails = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      const response = await axios.get(`/api/v1/pay_now_requests/${initialRequest.id}`)

      if (response.data.success) {
        setRequest(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load request details:', error)
    } finally {
      setLoading(false)
    }
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
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
                <div className="sm:flex sm:items-start mb-6">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left flex-1">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                      Pay Now Request #{request.id}
                    </Dialog.Title>
                    <p className="text-sm text-gray-500 mt-1">
                      {request.supplier?.name} - PO #{request.purchase_order?.number}
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Financial Details */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-indigo-900 mb-3 flex items-center">
                        <BanknotesIcon className="h-5 w-5 mr-2" />
                        Financial Details
                      </h4>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-indigo-600">Original Amount</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {request.financial_details?.original_amount || request.original_amount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-indigo-600">Discount ({request.financial_details?.discount_percentage || request.discount_percentage}%)</p>
                          <p className="text-lg font-semibold text-red-600">
                            -{request.financial_details?.discount_amount || request.discount_amount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-indigo-600">Final Payment</p>
                          <p className="text-lg font-semibold text-green-600">
                            {request.financial_details?.discounted_amount || request.discounted_amount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-indigo-600">Supplier Saves</p>
                          <p className="text-lg font-semibold text-green-600">
                            {request.financial_details?.savings_to_supplier || request.discount_amount}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Supplier & Job Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                          <UserIcon className="h-5 w-5 mr-2" />
                          Supplier Information
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-gray-600">Name</p>
                            <p className="font-medium">{request.supplier?.name}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Email</p>
                            <p className="font-medium">{request.supplier?.email}</p>
                          </div>
                          {request.supplier?.phone && (
                            <div>
                              <p className="text-gray-600">Phone</p>
                              <p className="font-medium">{request.supplier?.phone}</p>
                            </div>
                          )}
                          {request.supplier?.trapid_rating && (
                            <div>
                              <p className="text-gray-600">Rating</p>
                              <p className="font-medium">{request.supplier.trapid_rating}/5</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Purchase Order Details</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-gray-600">PO Number</p>
                            <p className="font-medium">{request.purchase_order?.number}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Total</p>
                            <p className="font-medium">{request.purchase_order?.total}</p>
                          </div>
                          {request.purchase_order?.construction && (
                            <>
                              <div>
                                <p className="text-gray-600">Job</p>
                                <p className="font-medium">{request.purchase_order.construction.name}</p>
                              </div>
                              {request.purchase_order.construction.address && (
                                <div>
                                  <p className="text-gray-600">Address</p>
                                  <p className="font-medium text-xs">{request.purchase_order.construction.address}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Review Details */}
                    {request.review_details && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Review Details</h4>
                        {request.review_details.reviewed_by ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Reviewed By:</span>
                              <span className="font-medium">{request.review_details.reviewed_by.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Reviewed At:</span>
                              <span className="font-medium">{formatDate(request.review_details.reviewed_at)}</span>
                            </div>
                            {request.review_details.supervisor_notes && (
                              <div>
                                <p className="text-gray-600">Notes:</p>
                                <p className="mt-1 text-gray-900">{request.review_details.supervisor_notes}</p>
                              </div>
                            )}
                            {request.review_details.rejection_reason && (
                              <div className="bg-red-50 border border-red-200 rounded p-3 mt-2">
                                <p className="text-xs text-red-600 font-medium">Rejection Reason:</p>
                                <p className="mt-1 text-sm text-red-800">{request.review_details.rejection_reason}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Not yet reviewed</p>
                        )}
                      </div>
                    )}

                    {/* Supplier Notes */}
                    {request.supplier_notes && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                          <DocumentTextIcon className="h-5 w-5 mr-2" />
                          Supplier Notes
                        </h4>
                        <p className="text-sm text-gray-700">{request.supplier_notes}</p>
                      </div>
                    )}

                    {/* Attachments */}
                    {request.attachments && (request.attachments.invoice_file_url || (request.attachments.proof_photos && request.attachments.proof_photos.length > 0)) && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                          <PhotoIcon className="h-5 w-5 mr-2" />
                          Attachments
                        </h4>

                        {request.attachments.invoice_file_url && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1">Invoice File</p>
                            <a
                              href={request.attachments.invoice_file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                            >
                              <DocumentTextIcon className="h-4 w-4 mr-1" />
                              View Invoice
                            </a>
                          </div>
                        )}

                        {request.attachments.proof_photos && request.attachments.proof_photos.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-2">
                              Proof of Completion ({request.attachments.proof_photos.length} photos)
                            </p>
                            <div className="grid grid-cols-4 gap-2">
                              {request.attachments.proof_photos.map((photo, index) => (
                                <a
                                  key={index}
                                  href={photo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-75 transition"
                                >
                                  <img
                                    src={photo.url}
                                    alt={photo.filename || `Proof ${index + 1}`}
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
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-green-700">Amount Paid</p>
                            <p className="font-medium text-green-900">{request.payment.amount}</p>
                          </div>
                          <div>
                            <p className="text-green-700">Payment Date</p>
                            <p className="font-medium text-green-900">{formatDate(request.payment.payment_date)}</p>
                          </div>
                          <div>
                            <p className="text-green-700">Reference</p>
                            <p className="font-medium text-green-900">{request.payment.reference_number}</p>
                          </div>
                        </div>
                        {request.payment.notes && (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <p className="text-xs text-green-700">Notes</p>
                            <p className="text-sm text-green-900">{request.payment.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-6">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
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
