import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition, Listbox } from '@headlessui/react'
import { XMarkIcon, CheckIcon, ChevronUpDownIcon, PhotoIcon } from '@heroicons/react/24/outline'
import axios from 'axios'

export default function RequestPaymentModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [loadingPOs, setLoadingPOs] = useState(true)
  const [eligiblePOs, setEligiblePOs] = useState([])
  const [selectedPO, setSelectedPO] = useState(null)
  const [formData, setFormData] = useState({
    amount: '',
    discount_percentage: 5.0,
    notes: '',
    requested_payment_date: new Date().toISOString().split('T')[0]
  })
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [proofPhotos, setProofPhotos] = useState([])
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      loadEligiblePOs()
    }
  }, [isOpen])

  useEffect(() => {
    if (selectedPO) {
      // Auto-fill amount with remaining PO amount
      setFormData(prev => ({
        ...prev,
        amount: selectedPO.remaining_amount.toString()
      }))
    }
  }, [selectedPO])

  const loadEligiblePOs = async () => {
    try {
      const token = localStorage.getItem('portal_token')
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      const response = await axios.get('/api/v1/portal/pay_now_requests/eligible_purchase_orders')

      if (response.data.success) {
        setEligiblePOs(response.data.data)
        if (response.data.data.length > 0) {
          setSelectedPO(response.data.data[0])
        }
      }
    } catch (error) {
      console.error('Failed to load eligible purchase orders:', error)
    } finally {
      setLoadingPOs(false)
    }
  }

  const handleInvoiceFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setErrors(prev => ({ ...prev, invoice_file: 'File size must be less than 10MB' }))
        return
      }
      setInvoiceFile(file)
      setErrors(prev => ({ ...prev, invoice_file: null }))
    }
  }

  const handleProofPhotosChange = (e) => {
    const files = Array.from(e.target.files)

    if (files.length > 10) {
      setErrors(prev => ({ ...prev, proof_photos: 'Maximum 10 photos allowed' }))
      return
    }

    // Validate file sizes
    const oversizedFiles = files.filter(f => f.size > 10 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      setErrors(prev => ({ ...prev, proof_photos: 'Each file must be less than 10MB' }))
      return
    }

    setProofPhotos(files)
    setErrors(prev => ({ ...prev, proof_photos: null }))
  }

  const calculateDiscountAmount = () => {
    const amount = parseFloat(formData.amount) || 0
    const percentage = parseFloat(formData.discount_percentage) || 0
    return (amount * (percentage / 100)).toFixed(2)
  }

  const calculateDiscountedAmount = () => {
    const amount = parseFloat(formData.amount) || 0
    const discount = parseFloat(calculateDiscountAmount()) || 0
    return (amount - discount).toFixed(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedPO) {
      setErrors({ general: 'Please select a purchase order' })
      return
    }

    if (proofPhotos.length === 0) {
      setErrors({ proof_photos: 'At least one proof of completion photo is required' })
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const token = localStorage.getItem('portal_token')
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      // Create FormData for file upload
      const submitData = new FormData()
      submitData.append('purchase_order_id', selectedPO.id)
      submitData.append('amount', formData.amount)
      submitData.append('discount_percentage', formData.discount_percentage)
      submitData.append('notes', formData.notes)
      submitData.append('requested_payment_date', formData.requested_payment_date)

      if (invoiceFile) {
        submitData.append('invoice_file', invoiceFile)
      }

      proofPhotos.forEach((photo, index) => {
        submitData.append('proof_photos[]', photo)
      })

      const response = await axios.post('/api/v1/portal/pay_now_requests', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      if (response.data.success) {
        alert(response.data.message || 'Payment request submitted successfully')
        onSuccess()
      } else {
        setErrors({ general: response.data.error || 'Failed to submit request' })
      }
    } catch (error) {
      console.error('Failed to submit payment request:', error)
      const errorMessage = error.response?.data?.error || 'Failed to submit payment request'
      const validationErrors = error.response?.data?.errors || []

      if (validationErrors.length > 0) {
        setErrors({ general: validationErrors.join(', ') })
      } else {
        setErrors({ general: errorMessage })
      }
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return `$${Number(amount).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
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
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                      Request Early Payment
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500">
                      Get paid early with a 5% discount
                    </p>
                  </div>
                </div>

                {loadingPOs ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : eligiblePOs.length === 0 ? (
                  <div className="mt-6 text-center py-12">
                    <p className="text-sm text-gray-500">No eligible purchase orders found.</p>
                    <p className="mt-2 text-xs text-gray-400">
                      Purchase orders must be completed and not fully paid to be eligible.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                    {/* Purchase Order Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Purchase Order
                      </label>
                      <Listbox value={selectedPO} onChange={setSelectedPO}>
                        <div className="relative mt-1">
                          <Listbox.Button className="relative w-full cursor-default rounded-md border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm">
                            <span className="block truncate">
                              {selectedPO ? `PO #${selectedPO.purchase_order_number} - ${selectedPO.construction_name} (${formatCurrency(selectedPO.remaining_amount)} remaining)` : 'Select a purchase order'}
                            </span>
                            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                              <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                            </span>
                          </Listbox.Button>
                          <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                          >
                            <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                              {eligiblePOs.map((po) => (
                                <Listbox.Option
                                  key={po.id}
                                  value={po}
                                  className={({ active }) =>
                                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                      active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                                    }`
                                  }
                                >
                                  {({ selected }) => (
                                    <>
                                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                        PO #{po.purchase_order_number} - {po.construction_name}
                                      </span>
                                      <span className="block text-xs text-gray-500">
                                        Remaining: {formatCurrency(po.remaining_amount)}
                                      </span>
                                      {selected && (
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                                          <CheckIcon className="h-5 w-5" />
                                        </span>
                                      )}
                                    </>
                                  )}
                                </Listbox.Option>
                              ))}
                            </Listbox.Options>
                          </Transition>
                        </div>
                      </Listbox>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Request Amount
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          className="block w-full rounded-md border-gray-300 pl-7 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      {selectedPO && (
                        <p className="mt-1 text-xs text-gray-500">
                          Maximum available: {formatCurrency(selectedPO.remaining_amount)}
                        </p>
                      )}
                    </div>

                    {/* Discount Preview */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-md p-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Original Amount</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(formData.amount || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Discount (5%)</p>
                          <p className="text-lg font-semibold text-red-600">
                            -{formatCurrency(calculateDiscountAmount())}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">You'll Receive</p>
                          <p className="text-lg font-semibold text-green-600">
                            {formatCurrency(calculateDiscountedAmount())}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Proof Photos */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Proof of Completion Photos <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-indigo-500">
                        <div className="space-y-1 text-center">
                          <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="flex text-sm text-gray-600">
                            <label className="relative cursor-pointer rounded-md bg-white font-medium text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:text-indigo-500">
                              <span>Upload photos</span>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={handleProofPhotosChange}
                                className="sr-only"
                                required
                              />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB each (max 10 photos)</p>
                          {proofPhotos.length > 0 && (
                            <p className="text-sm text-green-600">{proofPhotos.length} photo(s) selected</p>
                          )}
                        </div>
                      </div>
                      {errors.proof_photos && (
                        <p className="mt-1 text-sm text-red-600">{errors.proof_photos}</p>
                      )}
                    </div>

                    {/* Invoice File (Optional) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Invoice (Optional)
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleInvoiceFileChange}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                      />
                      {invoiceFile && (
                        <p className="mt-1 text-sm text-green-600">{invoiceFile.name}</p>
                      )}
                      {errors.invoice_file && (
                        <p className="mt-1 text-sm text-red-600">{errors.invoice_file}</p>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Notes (Optional)
                      </label>
                      <textarea
                        rows={3}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Any additional information..."
                      />
                    </div>

                    {/* Error Message */}
                    {errors.general && (
                      <div className="rounded-md bg-red-50 p-4">
                        <p className="text-sm text-red-800">{errors.general}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                      <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:col-start-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Submitting...' : 'Submit Request'}
                      </button>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                        onClick={onClose}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
