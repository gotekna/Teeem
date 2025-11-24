import { useState, useEffect } from 'react'
import { PlusIcon, BanknotesIcon, CreditCardIcon } from '@heroicons/react/24/outline'
import TrapidTableView from '../components/documentation/TrapidTableView'
import TransactionForm from '../components/financial/TransactionForm'
import api from '../api'

// Define columns for financial transactions table
const TRANSACTION_COLUMNS = [
  {
    key: 'select',
    label: '',
    resizable: false,
    sortable: false,
    filterable: false,
    width: 32
  },
  {
    key: 'transaction_date',
    label: 'Date',
    resizable: true,
    sortable: true,
    filterable: false,
    width: 140,
    tooltip: 'Transaction date'
  },
  {
    key: 'transaction_type',
    label: 'Type',
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: 'dropdown',
    width: 100,
    tooltip: 'Income or Expense'
  },
  {
    key: 'category',
    label: 'Category',
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: 'dropdown',
    width: 150,
    tooltip: 'Transaction category'
  },
  {
    key: 'description',
    label: 'Description',
    resizable: true,
    sortable: false,
    filterable: true,
    filterType: 'text',
    width: 300,
    tooltip: 'Transaction description'
  },
  {
    key: 'construction_name',
    label: 'Job',
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: 'dropdown',
    width: 180,
    tooltip: 'Linked construction job'
  },
  {
    key: 'amount',
    label: 'Amount',
    resizable: true,
    sortable: true,
    filterable: false,
    width: 120,
    showSum: true,
    sumType: 'currency',
    tooltip: 'Transaction amount'
  },
  {
    key: 'status',
    label: 'Status',
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: 'dropdown',
    width: 100,
    tooltip: 'Draft, Posted, or Synced'
  },
  {
    key: 'user_name',
    label: 'Created By',
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: 'dropdown',
    width: 150,
    tooltip: 'User who created this transaction'
  }
]

export default function FinancialPage() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [transactionType, setTransactionType] = useState('expense')
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [summary, setSummary] = useState({
    total_income: 0,
    total_expenses: 0,
    net_profit: 0
  })

  useEffect(() => {
    fetchTransactions()
    fetchSummary()
  }, [])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/financial_transactions')
      if (response.success) {
        // Transform data to include computed fields for TrapidTableView
        const transformedData = response.transactions.map(t => ({
          ...t,
          construction_name: t.construction?.name || 'N/A',
          user_name: t.user ? `${t.user.first_name} ${t.user.last_name}` : 'Unknown'
        }))
        setTransactions(transformedData)
      }
    } catch (err) {
      console.error('Failed to load transactions:', err)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const fetchSummary = async () => {
    try {
      const response = await api.get('/api/v1/financial_transactions/summary')
      if (response.success) {
        setSummary(response.summary)
      }
    } catch (err) {
      console.error('Failed to load summary:', err)
    }
  }

  const handleEdit = async (entry) => {
    // For inline edits from TrapidTableView
    try {
      const response = await api.put(`/api/v1/financial_transactions/${entry.id}`, {
        transaction: {
          description: entry.description,
          category: entry.category
        }
      })

      if (response.success) {
        setTransactions(prev =>
          prev.map(t => t.id === response.transaction.id ? {
            ...response.transaction,
            construction_name: response.transaction.construction?.name || 'N/A',
            user_name: response.transaction.user ?
              `${response.transaction.user.first_name} ${response.transaction.user.last_name}` :
              'Unknown'
          } : t)
        )
        await fetchSummary()
      }
    } catch (err) {
      console.error('Error updating transaction:', err)
      alert(`Failed to update transaction: ${err.message}`)
    }
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Are you sure you want to delete this ${entry.transaction_type} transaction?`)) return

    try {
      const response = await api.delete(`/api/v1/financial_transactions/${entry.id}`)

      if (response.success) {
        setTransactions(prev => prev.filter(t => t.id !== entry.id))
        await fetchSummary()
      }
    } catch (err) {
      console.error('Error deleting transaction:', err)
      alert(`Failed to delete transaction: ${err.message}`)
    }
  }

  const handleAddIncome = () => {
    setEditingTransaction(null)
    setTransactionType('income')
    setShowTransactionForm(true)
  }

  const handleAddExpense = () => {
    setEditingTransaction(null)
    setTransactionType('expense')
    setShowTransactionForm(true)
  }

  const handleTransactionSuccess = async (transaction) => {
    await fetchTransactions()
    await fetchSummary()
    setShowTransactionForm(false)
    setEditingTransaction(null)
  }

  const handleImport = () => {
    alert('Import - This would open a file picker to import transactions from CSV')
  }

  const handleExport = async () => {
    try {
      const response = await api.get('/financial_exports/transactions', {
        responseType: 'blob'
      })

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Error exporting transactions:', err)
      alert('Failed to export transactions')
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading transactions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Financial Tracking
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Track income and expenses for your construction projects
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Total Income */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Income</p>
              <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">
                ${summary.total_income?.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <BanknotesIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</p>
              <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                ${summary.total_expenses?.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
              <CreditCardIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Profit</p>
              <p className={`mt-2 text-3xl font-bold ${
                (summary.net_profit || 0) >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                ${summary.net_profit?.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
            <div className={`p-3 rounded-full ${
              (summary.net_profit || 0) >= 0
                ? 'bg-green-100 dark:bg-green-900/20'
                : 'bg-red-100 dark:bg-red-900/20'
            }`}>
              <BanknotesIcon className={`h-8 w-8 ${
                (summary.net_profit || 0) >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <TrapidTableView
        tableId="financial-transactions"
        tableName="Financial Transactions"
        entries={transactions}
        columns={TRANSACTION_COLUMNS}
        onEdit={handleEdit}
        onDelete={handleDelete}
        enableImport={true}
        enableExport={true}
        onImport={handleImport}
        onExport={handleExport}
        customActions={
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddIncome}
              className="inline-flex items-center gap-2 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
            >
              <PlusIcon className="h-5 w-5" />
              Record Income
            </button>
            <button
              onClick={handleAddExpense}
              className="inline-flex items-center gap-2 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
            >
              <PlusIcon className="h-5 w-5" />
              Record Expense
            </button>
          </div>
        }
      />

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={showTransactionForm}
        onClose={() => {
          setShowTransactionForm(false)
          setEditingTransaction(null)
        }}
        onSuccess={handleTransactionSuccess}
        transaction={editingTransaction}
        type={transactionType}
      />
    </div>
  )
}
