import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import axios from 'axios'

export default function ApproveRejectModal({ isOpen, onClose, request, action, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (action === 'reject' && !rejectionReason.trim()) {
      setError('Rejection reason is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      const endpoint = `/api/v1/pay_now_requests/${request.id}/${action}`
      const payload = action === 'approve'
        ? { notes }
        : { reason: rejectionReason }

      const response = await axios.post(endpoint, payload)

      if (response.data.success) {
        alert(response.data.message || `Request ${action}d successfully`)
        onSuccess()
      } else {
        setError(response.data.error || `Failed to ${action} request`)
      }
    } catch (error) {
      console.error(`Failed to ${action} request:`, error)
      setError(error.response?.data?.error || `Failed to ${action} request`)
    } finally {
      setLoading(false)
    }
  }

  const isApprove = action === 'approve'

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
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
                  <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${isApprove ? 'bg-green-100' : 'bg-red-100'} sm:mx-0 sm:h-10 sm:w-10`}>
                    {isApprove ? (
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    ) : (
                      <XCircleIcon className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                      {isApprove ? 'Approve' : 'Reject'} Payment Request
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {request.supplier?.name} - PO #{request.purchase_order?.number}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="mt-5">
                  {/* Amount Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Original</p>
                        <p className="font-semibold text-gray-900">{request.original_amount}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Discount</p>
                        <p className="font-semibold text-red-600">-{request.discount_amount}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Payment</p>
                        <p className="font-semibold text-green-600">{request.discounted_amount}</p>
                      </div>
                    </div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {isApprove ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Approval Notes (Optional)
                        </label>
                        <textarea
                          rows={3}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="Add any notes about this approval..."
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Rejection Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={3}
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="Please provide a reason for rejection..."
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          This reason will be sent to the supplier.
                        </p>
                      </div>
                    )}

                    {/* Error Message */}
                    {error && (
                      <div className="rounded-md bg-red-50 p-4">
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    )}

                    {/* Warning for approval */}
                    {isApprove && (
                      <div className="rounded-md bg-yellow-50 p-4">
                        <p className="text-sm text-yellow-800">
                          <strong>Note:</strong> Approving this request will immediately process the payment of {request.discounted_amount}.
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:col-start-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isApprove
                            ? 'bg-green-600 hover:bg-green-500 focus-visible:outline-green-600'
                            : 'bg-red-600 hover:bg-red-500 focus-visible:outline-red-600'
                        }`}
                      >
                        {loading ? (isApprove ? 'Approving...' : 'Rejecting...') : (isApprove ? 'Approve & Process Payment' : 'Reject Request')}
                      </button>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                        onClick={onClose}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
