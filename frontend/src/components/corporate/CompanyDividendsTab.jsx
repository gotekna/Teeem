import { useState, useEffect } from 'react'
import {
  PlusIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import api from '../../api'

export default function CompanyDividendsTab({ company, onUpdate }) {
  const [dividends, setDividends] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDividend, setEditingDividend] = useState(null)
  const [showPaymentsFor, setShowPaymentsFor] = useState(null)

  useEffect(() => {
    loadDividends()
  }, [company.id])

  const loadDividends = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/companies/${company.id}/dividends`)
      setDividends(response.dividends || [])
    } catch (error) {
      console.error('Failed to load dividends:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteDividend = async (id) => {
    if (!confirm('Are you sure you want to delete this dividend?')) return
    try {
      await api.delete(`/api/v1/companies/${company.id}/dividends/${id}`)
      await loadDividends()
    } catch (error) {
      console.error('Failed to delete dividend:', error)
      alert('Failed to delete dividend')
    }
  }

  const handleSaveDividend = async (formData) => {
    try {
      if (editingDividend) {
        await api.put(`/api/v1/companies/${company.id}/dividends/${editingDividend.id}`, {
          dividend: formData
        })
      } else {
        await api.post(`/api/v1/companies/${company.id}/dividends`, {
          dividend: formData
        })
      }
      setShowForm(false)
      setEditingDividend(null)
      await loadDividends()
      if (onUpdate) onUpdate()
    } catch (error) {
      throw error
    }
  }

  const handleCalculatePayments = async (dividendId) => {
    try {
      await api.post(`/api/v1/companies/${company.id}/dividends/${dividendId}/calculate_payments`)
      await loadDividends()
    } catch (error) {
      console.error('Failed to calculate payments:', error)
      alert(error.response?.data?.error || 'Failed to calculate payments')
    }
  }

  const handleMarkPaid = async (dividendId) => {
    if (!confirm('Mark this dividend as paid? This will update the status and set payment dates.')) return
    try {
      await api.post(`/api/v1/companies/${company.id}/dividends/${dividendId}/mark_paid`)
      await loadDividends()
    } catch (error) {
      console.error('Failed to mark as paid:', error)
      alert(error.response?.data?.error || 'Failed to mark as paid')
    }
  }

  // Calculate totals
  const totalDeclared = dividends.reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0)
  const totalPaid = dividends
    .filter(d => d.status === 'paid')
    .reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0)
  const totalPending = totalDeclared - totalPaid

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading dividends...</div>
  }

  // Show form view
  if (showForm) {
    return (
      <DividendForm
        dividend={editingDividend}
        onSave={handleSaveDividend}
        onCancel={() => { setShowForm(false); setEditingDividend(null) }}
      />
    )
  }

  // Show payments view
  if (showPaymentsFor) {
    return (
      <DividendPayments
        dividend={showPaymentsFor}
        companyId={company.id}
        onCalculate={() => handleCalculatePayments(showPaymentsFor.id)}
        onClose={() => { setShowPaymentsFor(null); loadDividends() }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Dividends</div>
          <div className="text-2xl font-bold text-gray-900">{dividends.length}</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-700">Total Declared</div>
          <div className="text-2xl font-bold text-blue-900">${totalDeclared.toLocaleString()}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center text-sm text-green-700">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            Total Paid
          </div>
          <div className="text-2xl font-bold text-green-900">${totalPaid.toLocaleString()}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center text-sm text-yellow-700">
            <ClockIcon className="h-4 w-4 mr-1" />
            Pending
          </div>
          <div className="text-2xl font-bold text-yellow-900">${totalPending.toLocaleString()}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={() => { setEditingDividend(null); setShowForm(true) }}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Declare Dividend
        </button>
      </div>

      {/* Content */}
      {dividends.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No dividends</h3>
          <p className="mt-1 text-sm text-gray-500">Declare dividends to track distributions to shareholders.</p>
          <button
            onClick={() => { setEditingDividend(null); setShowForm(true) }}
            className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Declare First Dividend
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {dividends.map((dividend) => (
            <div key={dividend.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <h4 className="text-sm font-medium text-gray-900">
                      ${parseFloat(dividend.total_amount || 0).toLocaleString()}
                    </h4>
                    <span className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      dividend.dividend_type === 'final' ? 'bg-blue-100 text-blue-800' :
                      dividend.dividend_type === 'interim' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {dividend.dividend_type || 'Standard'}
                    </span>
                    <span className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      dividend.status === 'paid' ? 'bg-green-100 text-green-800' :
                      dividend.status === 'declared' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {dividend.status === 'paid' && <CheckCircleIcon className="h-3 w-3 mr-1" />}
                      {dividend.status === 'declared' && <ClockIcon className="h-3 w-3 mr-1" />}
                      {dividend.status}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-500">
                    <div>
                      <span className="font-medium">Declared:</span> {dividend.declaration_date ? new Date(dividend.declaration_date).toLocaleDateString() : '-'}
                    </div>
                    <div>
                      <span className="font-medium">Payment:</span> {dividend.payment_date ? new Date(dividend.payment_date).toLocaleDateString() : '-'}
                    </div>
                    <div>
                      <span className="font-medium">Franking:</span> {dividend.franking_percentage || 0}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {dividend.status === 'declared' && (
                    <button
                      onClick={() => handleMarkPaid(dividend.id)}
                      className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
                    >
                      Mark Paid
                    </button>
                  )}
                  <button
                    onClick={() => setShowPaymentsFor(dividend)}
                    className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    Payments
                  </button>
                  <button
                    onClick={() => { setEditingDividend(dividend); setShowForm(true) }}
                    className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteDividend(dividend.id)}
                    className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DividendForm({ dividend, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    declaration_date: dividend?.declaration_date || new Date().toISOString().split('T')[0],
    record_date: dividend?.record_date || '',
    payment_date: dividend?.payment_date || '',
    total_amount: dividend?.total_amount || '',
    franking_percentage: dividend?.franking_percentage || '100',
    dividend_type: dividend?.dividend_type || 'interim',
    status: dividend?.status || 'declared',
    notes: dividend?.notes || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(formData)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save dividend')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {dividend ? 'Edit Dividend' : 'Declare Dividend'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Declaration Date</label>
          <input
            type="date"
            value={formData.declaration_date}
            onChange={(e) => setFormData({ ...formData, declaration_date: e.target.value })}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Dividend Type</label>
          <select
            value={formData.dividend_type}
            onChange={(e) => setFormData({ ...formData, dividend_type: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="interim">Interim</option>
            <option value="final">Final</option>
            <option value="special">Special</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Total Amount ($)</label>
          <input
            type="number"
            value={formData.total_amount}
            onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
            required
            min="0"
            step="0.01"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Franking Percentage (%)</label>
          <input
            type="number"
            value={formData.franking_percentage}
            onChange={(e) => setFormData({ ...formData, franking_percentage: e.target.value })}
            min="0"
            max="100"
            step="0.01"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">100% = fully franked, 0% = unfranked</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Record Date</label>
          <input
            type="date"
            value={formData.record_date}
            onChange={(e) => setFormData({ ...formData, record_date: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">Date for determining who is entitled to the dividend</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Payment Date</label>
          <input
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        {dividend && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="declared">Declared</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : (dividend ? 'Update' : 'Declare')}
          </button>
        </div>
      </form>
    </div>
  )
}

function DividendPayments({ dividend, companyId, onCalculate, onClose }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayments()
  }, [dividend.id])

  const loadPayments = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/companies/${companyId}/dividends/${dividend.id}/payments`)
      setPayments(response.payments || [])
    } catch (error) {
      console.error('Failed to load payments:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading payments...</div>
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Dividend Payments - {dividend.declaration_date ? new Date(dividend.declaration_date).toLocaleDateString() : ''}
      </h3>

      {/* Dividend Summary */}
      <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Total Amount</dt>
            <dd className="font-medium text-gray-900">${parseFloat(dividend.total_amount || 0).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Franking</dt>
            <dd className="font-medium text-gray-900">{dividend.franking_percentage || 0}%</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium text-gray-900">{dividend.status}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Payments</dt>
            <dd className="font-medium text-gray-900">{payments.length}</dd>
          </div>
        </dl>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500 mb-4">
            No payment records yet. Calculate payments based on current shareholdings.
          </p>
          <button
            onClick={async () => {
              await onCalculate()
              await loadPayments()
            }}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Calculate Payments
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Per-Shareholder Breakdown</h4>
          <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
            {payments.map((payment) => (
              <div key={payment.id} className="p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-900">
                      {payment.shareholder?.full_name || payment.shareholder?.name || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {payment.shares_held?.toLocaleString()} shares
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      ${parseFloat(payment.net_amount || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      Gross: ${parseFloat(payment.gross_amount || 0).toLocaleString()}
                      {payment.franking_credit > 0 && (
                        <> + FC: ${parseFloat(payment.franking_credit || 0).toLocaleString()}</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          onClick={onClose}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Back
        </button>
      </div>
    </div>
  )
}
