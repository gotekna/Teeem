import { useState, useEffect } from 'react'
import {
  PlusIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import api from '../../api'

export default function CompanyLoansTab({ company, onUpdate }) {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [companies, setCompanies] = useState([])
  const [activeView, setActiveView] = useState('all') // 'all', 'lent', 'borrowed'

  useEffect(() => {
    loadData()
  }, [company.id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [loansRes, companiesRes] = await Promise.all([
        api.get(`/api/v1/companies/${company.id}/loans`),
        api.get('/api/v1/companies?per_page=500')
      ])
      setLoans(loansRes.loans || [])
      setCompanies(companiesRes.companies || [])
    } catch (error) {
      console.error('Failed to load loans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddLoan = () => {
    setEditingLoan(null)
    setShowForm(true)
  }

  const handleEditLoan = (loan) => {
    setEditingLoan(loan)
    setShowForm(true)
  }

  const handleDeleteLoan = async (id) => {
    if (!confirm('Are you sure you want to delete this loan?')) return
    try {
      await api.delete(`/api/v1/companies/${company.id}/loans/${id}`)
      await loadData()
    } catch (error) {
      console.error('Failed to delete loan:', error)
      alert('Failed to delete loan')
    }
  }

  const handleSaveLoan = async (formData) => {
    try {
      if (editingLoan) {
        await api.put(`/api/v1/companies/${company.id}/loans/${editingLoan.id}`, {
          company_loan: formData
        })
      } else {
        await api.post(`/api/v1/companies/${company.id}/loans`, {
          company_loan: formData
        })
      }
      setShowForm(false)
      setEditingLoan(null)
      await loadData()
      if (onUpdate) onUpdate()
    } catch (error) {
      throw error
    }
  }

  // Filter loans by direction
  const loansLent = loans.filter(l => l.lender_company_id === company.id)
  const loansBorrowed = loans.filter(l => l.borrower_company_id === company.id)
  const filteredLoans = activeView === 'lent' ? loansLent :
                        activeView === 'borrowed' ? loansBorrowed : loans

  // Calculate totals
  const totalLent = loansLent.reduce((sum, l) => sum + (parseFloat(l.current_balance) || 0), 0)
  const totalBorrowed = loansBorrowed.reduce((sum, l) => sum + (parseFloat(l.current_balance) || 0), 0)
  const netPosition = totalLent - totalBorrowed

  const columns = [
    {
      key: 'direction',
      label: '',
      render: (row) => row.lender_company_id === company.id ? (
        <ArrowTrendingUpIcon className="h-5 w-5 text-green-500" title="Lent to" />
      ) : (
        <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" title="Borrowed from" />
      )
    },
    {
      key: 'counterparty',
      label: 'Counterparty',
      render: (row) => {
        const isLender = row.lender_company_id === company.id
        const counterparty = isLender ? row.borrower_company : row.lender_company
        return (
          <div>
            <div className="font-medium text-gray-900">{counterparty?.name || 'Unknown'}</div>
            <div className="text-xs text-gray-500">{isLender ? 'Borrower' : 'Lender'}</div>
          </div>
        )
      }
    },
    {
      key: 'principal_amount',
      label: 'Principal',
      render: (row) => `$${parseFloat(row.principal_amount || 0).toLocaleString()}`
    },
    {
      key: 'current_balance',
      label: 'Balance',
      render: (row) => `$${parseFloat(row.current_balance || 0).toLocaleString()}`
    },
    {
      key: 'interest_rate',
      label: 'Interest',
      render: (row) => row.interest_type === 'interest-free' ? 'Interest-free' :
        row.interest_rate ? `${row.interest_rate}% ${row.interest_type || ''}` : '-'
    },
    {
      key: 'loan_date',
      label: 'Date',
      render: (row) => row.loan_date ? new Date(row.loan_date).toLocaleDateString() : '-'
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          row.status === 'active' ? 'bg-green-100 text-green-800' :
          row.status === 'repaid' ? 'bg-gray-100 text-gray-800' :
          'bg-red-100 text-red-800'
        }`}>
          {row.status}
        </span>
      )
    },
    {
      key: 'loan_documents_in_place',
      label: 'Docs',
      render: (row) => row.loan_documents_in_place ? (
        <span className="text-green-600">Yes</span>
      ) : (
        <span className="text-red-600">No</span>
      )
    }
  ]

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading loans...</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Loans</div>
          <div className="text-2xl font-bold text-gray-900">{loans.length}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center text-sm text-green-700">
            <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
            Lent Out
          </div>
          <div className="text-2xl font-bold text-green-900">${totalLent.toLocaleString()}</div>
          <div className="text-xs text-green-600">{loansLent.length} loans</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <div className="flex items-center text-sm text-red-700">
            <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
            Borrowed
          </div>
          <div className="text-2xl font-bold text-red-900">${totalBorrowed.toLocaleString()}</div>
          <div className="text-xs text-red-600">{loansBorrowed.length} loans</div>
        </div>
        <div className={`rounded-lg p-4 ${netPosition >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="text-sm text-gray-500">Net Position</div>
          <div className={`text-2xl font-bold ${netPosition >= 0 ? 'text-green-900' : 'text-red-900'}`}>
            {netPosition >= 0 ? '' : '-'}${Math.abs(netPosition).toLocaleString()}
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveView('all')}
            className={`py-2 px-1 border-b-2 text-sm font-medium ${
              activeView === 'all'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Loans ({loans.length})
          </button>
          <button
            onClick={() => setActiveView('lent')}
            className={`py-2 px-1 border-b-2 text-sm font-medium ${
              activeView === 'lent'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ArrowTrendingUpIcon className="h-4 w-4 inline mr-1" />
            Lent ({loansLent.length})
          </button>
          <button
            onClick={() => setActiveView('borrowed')}
            className={`py-2 px-1 border-b-2 text-sm font-medium ${
              activeView === 'borrowed'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ArrowTrendingDownIcon className="h-4 w-4 inline mr-1" />
            Borrowed ({loansBorrowed.length})
          </button>
        </nav>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={handleAddLoan}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Loan
        </button>
      </div>

      {/* Content */}
      {filteredLoans.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <BanknotesIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No loans</h3>
          <p className="mt-1 text-sm text-gray-500">
            {activeView === 'all' ? 'Add inter-company loans to track balances.' :
             activeView === 'lent' ? 'No loans made to other companies.' :
             'No loans borrowed from other companies.'}
          </p>
          <button
            onClick={handleAddLoan}
            className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add First Loan
          </button>
        </div>
      ) : (
        <TEEEMTableView
          data={filteredLoans}
          columns={columns}
          onRowClick={handleEditLoan}
          onDelete={handleDeleteLoan}
          idField="id"
        />
      )}

      {/* Add/Edit Loan SlideOver */}
      <SlideOver
        open={showForm}
        onClose={() => { setShowForm(false); setEditingLoan(null) }}
        title={editingLoan ? 'Edit Loan' : 'Add Loan'}
      >
        <LoanForm
          loan={editingLoan}
          currentCompanyId={company.id}
          companies={companies}
          onSave={handleSaveLoan}
          onCancel={() => { setShowForm(false); setEditingLoan(null) }}
        />
      </SlideOver>
    </div>
  )
}

function LoanForm({ loan, currentCompanyId, companies, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    lender_company_id: loan?.lender_company_id || currentCompanyId,
    borrower_company_id: loan?.borrower_company_id || '',
    principal_amount: loan?.principal_amount || '',
    current_balance: loan?.current_balance || '',
    interest_rate: loan?.interest_rate || '',
    interest_type: loan?.interest_type || 'interest-free',
    loan_date: loan?.loan_date || '',
    maturity_date: loan?.maturity_date || '',
    loan_documents_in_place: loan?.loan_documents_in_place || false,
    security_type: loan?.security_type || 'unsecured',
    status: loan?.status || 'active',
    notes: loan?.notes || ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [isLender, setIsLender] = useState(loan ? loan.lender_company_id === currentCompanyId : true)

  // Update lender/borrower when direction changes
  useEffect(() => {
    if (isLender) {
      setFormData(prev => ({
        ...prev,
        lender_company_id: currentCompanyId,
        borrower_company_id: prev.borrower_company_id === currentCompanyId ? '' : prev.borrower_company_id
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        borrower_company_id: currentCompanyId,
        lender_company_id: prev.lender_company_id === currentCompanyId ? '' : prev.lender_company_id
      }))
    }
  }, [isLender, currentCompanyId])

  // Auto-fill current balance from principal if not set
  useEffect(() => {
    if (formData.principal_amount && !formData.current_balance) {
      setFormData(prev => ({ ...prev, current_balance: prev.principal_amount }))
    }
  }, [formData.principal_amount])

  const otherCompanies = companies.filter(c => c.id !== currentCompanyId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(formData)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save loan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Direction Toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Loan Direction</label>
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => setIsLender(true)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
              isLender
                ? 'bg-green-100 text-green-800 ring-2 ring-green-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ArrowTrendingUpIcon className="h-4 w-4 inline mr-1" />
            This company LENT to
          </button>
          <button
            type="button"
            onClick={() => setIsLender(false)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
              !isLender
                ? 'bg-red-100 text-red-800 ring-2 ring-red-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ArrowTrendingDownIcon className="h-4 w-4 inline mr-1" />
            This company BORROWED from
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {isLender ? 'Borrower Company' : 'Lender Company'}
        </label>
        <select
          value={isLender ? formData.borrower_company_id : formData.lender_company_id}
          onChange={(e) => setFormData({
            ...formData,
            [isLender ? 'borrower_company_id' : 'lender_company_id']: e.target.value
          })}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">Select a company...</option>
          {otherCompanies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Principal Amount ($)</label>
          <input
            type="number"
            value={formData.principal_amount}
            onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
            required
            min="0"
            step="0.01"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Current Balance ($)</label>
          <input
            type="number"
            value={formData.current_balance}
            onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
            min="0"
            step="0.01"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Interest Type</label>
          <select
            value={formData.interest_type}
            onChange={(e) => setFormData({ ...formData, interest_type: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="interest-free">Interest-free</option>
            <option value="fixed">Fixed Rate</option>
            <option value="variable">Variable Rate</option>
          </select>
        </div>
        {formData.interest_type !== 'interest-free' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Interest Rate (%)</label>
            <input
              type="number"
              value={formData.interest_rate}
              onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
              min="0"
              step="0.01"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Loan Date</label>
          <input
            type="date"
            value={formData.loan_date}
            onChange={(e) => setFormData({ ...formData, loan_date: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Maturity Date</label>
          <input
            type="date"
            value={formData.maturity_date}
            onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Security Type</label>
          <select
            value={formData.security_type}
            onChange={(e) => setFormData({ ...formData, security_type: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="unsecured">Unsecured</option>
            <option value="mortgage">Mortgage</option>
            <option value="ppsr">PPSR Registered</option>
            <option value="guarantee">Personal Guarantee</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="active">Active</option>
            <option value="repaid">Repaid</option>
            <option value="written_off">Written Off</option>
          </select>
        </div>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="loan_documents_in_place"
          checked={formData.loan_documents_in_place}
          onChange={(e) => setFormData({ ...formData, loan_documents_in_place: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="loan_documents_in_place" className="ml-2 block text-sm text-gray-900">
          Loan documents in place
        </label>
      </div>

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
          {saving ? 'Saving...' : (loan ? 'Update' : 'Add')}
        </button>
      </div>
    </form>
  )
}
