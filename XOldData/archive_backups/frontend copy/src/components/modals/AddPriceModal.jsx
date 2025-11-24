import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

const LGA_OPTIONS = [
  'Toowoomba Regional Council',
  'Lockyer Valley Regional Council',
  'City of Gold Coast',
  'Brisbane City Council',
  'Sunshine Coast Regional Council',
  'Redland City Council',
  'Scenic Rim Regional Council'
]

export default function AddPriceModal({ isOpen, onClose, itemId, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [formData, setFormData] = useState({
    supplier_id: '',
    price: '',
    lga: '',
    date_effective: new Date().toISOString().split('T')[0]
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      loadSuppliers()
      // Reset form
      setFormData({
        supplier_id: '',
        price: '',
        lga: '',
        date_effective: new Date().toISOString().split('T')[0]
      })
      setErrors({})
    }
  }, [isOpen])

  const loadSuppliers = async () => {
    try {
      const response = await api.get('/api/v1/suppliers')
      setSuppliers(response.suppliers || response)
    } catch (err) {
      console.error('Failed to load suppliers:', err)
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.supplier_id) {
      newErrors.supplier_id = 'Supplier is required'
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = 'Valid price is required'
    }

    if (!formData.lga) {
      newErrors.lga = 'LGA is required'
    }

    if (!formData.date_effective) {
      newErrors.date_effective = 'Date effective is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setLoading(true)

    try {
      await api.post(`/api/v1/pricebook/${itemId}/add_price`, {
        supplier_id: formData.supplier_id,
        price: parseFloat(formData.price),
        lga: formData.lga,
        date_effective: formData.date_effective
      })

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to add price:', err)
      setErrors({ submit: err.message || 'Failed to add price' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
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
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-semibold leading-6 text-gray-900 dark:text-white"
                  >
                    Add New Price
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Supplier */}
                  <div>
                    <label htmlFor="supplier" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Supplier *
                    </label>
                    <select
                      id="supplier"
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className={`block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-white dark:bg-gray-700 shadow-sm ring-1 ring-inset ${
                        errors.supplier_id ? 'ring-red-500' : 'ring-gray-300 dark:ring-gray-600'
                      } focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6`}
                    >
                      <option value="">Select a supplier...</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                    {errors.supplier_id && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.supplier_id}</p>
                    )}
                  </div>

                  {/* Price */}
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Price *
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        id="price"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className={`block w-full rounded-md border-0 py-1.5 pl-7 pr-3 text-gray-900 dark:text-white dark:bg-gray-700 shadow-sm ring-1 ring-inset ${
                          errors.price ? 'ring-red-500' : 'ring-gray-300 dark:ring-gray-600'
                        } placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6`}
                        placeholder="0.00"
                      />
                    </div>
                    {errors.price && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.price}</p>
                    )}
                  </div>

                  {/* LGA */}
                  <div>
                    <label htmlFor="lga" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      LGA *
                    </label>
                    <select
                      id="lga"
                      value={formData.lga}
                      onChange={(e) => setFormData({ ...formData, lga: e.target.value })}
                      className={`block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-white dark:bg-gray-700 shadow-sm ring-1 ring-inset ${
                        errors.lga ? 'ring-red-500' : 'ring-gray-300 dark:ring-gray-600'
                      } focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6`}
                    >
                      <option value="">Select an LGA...</option>
                      {LGA_OPTIONS.map((lga) => (
                        <option key={lga} value={lga}>
                          {lga}
                        </option>
                      ))}
                    </select>
                    {errors.lga && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.lga}</p>
                    )}
                  </div>

                  {/* Date Effective */}
                  <div>
                    <label htmlFor="date_effective" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date Effective *
                    </label>
                    <input
                      type="date"
                      id="date_effective"
                      value={formData.date_effective}
                      onChange={(e) => setFormData({ ...formData, date_effective: e.target.value })}
                      className={`block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-white dark:bg-gray-700 shadow-sm ring-1 ring-inset ${
                        errors.date_effective ? 'ring-red-500' : 'ring-gray-300 dark:ring-gray-600'
                      } focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6`}
                    />
                    {errors.date_effective && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.date_effective}</p>
                    )}
                  </div>

                  {errors.submit && (
                    <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                      <p className="text-sm text-red-800 dark:text-red-400">{errors.submit}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Adding...' : 'Add Price'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
