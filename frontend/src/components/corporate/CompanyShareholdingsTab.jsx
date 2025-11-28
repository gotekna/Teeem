import { useState, useEffect } from 'react'
import {
  PlusIcon,
  ArrowsRightLeftIcon,
  UserGroupIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import api from '../../api'

export default function CompanyShareholdingsTab({ company, onUpdate }) {
  const [shareholdings, setShareholdings] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [editingShareholding, setEditingShareholding] = useState(null)
  const [contacts, setContacts] = useState([])
  const [activeView, setActiveView] = useState('shareholdings')

  useEffect(() => {
    loadData()
  }, [company.id])

  const loadData = async () => {
    try {
      setLoading(true)
      const [shareholdingsRes, transfersRes, contactsRes] = await Promise.all([
        api.get(`/api/v1/companies/${company.id}/shareholdings`),
        api.get(`/api/v1/companies/${company.id}/share_transfers`),
        api.get('/api/v1/contacts?per_page=1000')
      ])
      setShareholdings(shareholdingsRes.shareholdings || [])
      setTransfers(transfersRes.share_transfers || [])
      setContacts(contactsRes.contacts || [])
    } catch (error) {
      console.error('Failed to load shareholdings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteShareholding = async (id) => {
    if (!confirm('Are you sure you want to delete this shareholding?')) return
    try {
      await api.delete(`/api/v1/companies/${company.id}/shareholdings/${id}`)
      await loadData()
    } catch (error) {
      console.error('Failed to delete shareholding:', error)
      alert('Failed to delete shareholding')
    }
  }

  const handleSaveShareholding = async (formData) => {
    try {
      if (editingShareholding) {
        await api.put(`/api/v1/companies/${company.id}/shareholdings/${editingShareholding.id}`, {
          company_shareholding: formData
        })
      } else {
        await api.post(`/api/v1/companies/${company.id}/shareholdings`, {
          company_shareholding: formData
        })
      }
      setShowForm(false)
      setEditingShareholding(null)
      await loadData()
      if (onUpdate) onUpdate()
    } catch (error) {
      throw error
    }
  }

  const handleTransfer = async (formData) => {
    try {
      await api.post(`/api/v1/companies/${company.id}/shareholdings/transfer`, {
        share_transfer: formData
      })
      setShowTransferForm(false)
      await loadData()
      if (onUpdate) onUpdate()
    } catch (error) {
      throw error
    }
  }

  const totalShares = shareholdings.reduce((sum, s) => sum + (s.number_of_shares || 0), 0)

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading shareholdings...</div>
  }

  // Show form view
  if (showForm) {
    return (
      <ShareholdingForm
        shareholding={editingShareholding}
        contacts={contacts}
        onSave={handleSaveShareholding}
        onCancel={() => { setShowForm(false); setEditingShareholding(null) }}
      />
    )
  }

  if (showTransferForm) {
    return (
      <TransferForm
        shareholdings={shareholdings}
        contacts={contacts}
        onSave={handleTransfer}
        onCancel={() => setShowTransferForm(false)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Shares</div>
          <div className="text-2xl font-bold text-gray-900">{totalShares.toLocaleString()}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Shareholders</div>
          <div className="text-2xl font-bold text-gray-900">{shareholdings.length}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Transfers</div>
          <div className="text-2xl font-bold text-gray-900">{transfers.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveView('shareholdings')}
            className={`py-2 px-1 border-b-2 text-sm font-medium ${
              activeView === 'shareholdings'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Current Shareholdings
          </button>
          <button
            onClick={() => setActiveView('transfers')}
            className={`py-2 px-1 border-b-2 text-sm font-medium ${
              activeView === 'transfers'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Transfer History ({transfers.length})
          </button>
        </nav>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={() => setShowTransferForm(true)}
          className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          <ArrowsRightLeftIcon className="h-4 w-4 mr-1" />
          Record Transfer
        </button>
        <button
          onClick={() => { setEditingShareholding(null); setShowForm(true) }}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Shareholder
        </button>
      </div>

      {/* Content */}
      {activeView === 'shareholdings' ? (
        shareholdings.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No shareholders</h3>
            <p className="mt-1 text-sm text-gray-500">Add shareholders to track the share register.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shareholdings.map((s) => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-300">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-sm font-medium text-gray-900">
                        {s.shareholder?.full_name || s.shareholder?.name || 'Unknown'}
                      </h4>
                      <span className="ml-2 text-xs text-gray-500">
                        {s.share_class || 'Ordinary'}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      <span className="font-medium">{s.number_of_shares?.toLocaleString()}</span> shares
                      ({totalShares > 0 ? ((s.number_of_shares / totalShares) * 100).toFixed(1) : 0}%)
                    </div>
                    {s.beneficially_held && (
                      <div className="mt-1 text-xs text-gray-500">
                        Beneficially held for: {s.beneficial_owner}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => { setEditingShareholding(s); setShowForm(true) }}
                      className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteShareholding(s.id)}
                      className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-red-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        transfers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <ArrowsRightLeftIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No transfer history</h3>
          </div>
        ) : (
          <div className="space-y-3">
            {transfers.map((t) => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {t.from_shareholder?.full_name || 'New Issue'} → {t.to_shareholder?.full_name || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {t.number_of_shares?.toLocaleString()} {t.share_class || 'ordinary'} shares
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {t.transfer_date ? new Date(t.transfer_date).toLocaleDateString() : '-'}
                    {t.consideration && <div>${parseFloat(t.consideration).toLocaleString()}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function ShareholdingForm({ shareholding, contacts, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    shareholder_id: shareholding?.shareholder_id || '',
    share_class: shareholding?.share_class || 'ordinary',
    number_of_shares: shareholding?.number_of_shares || '',
    beneficially_held: shareholding?.beneficially_held || false,
    beneficial_owner: shareholding?.beneficial_owner || '',
    acquired_date: shareholding?.acquired_date || '',
    notes: shareholding?.notes || ''
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
      setError(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {shareholding ? 'Edit Shareholding' : 'Add Shareholding'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700">Shareholder</label>
          <select
            value={formData.shareholder_id}
            onChange={(e) => setFormData({ ...formData, shareholder_id: e.target.value })}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select a contact...</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name || c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Share Class</label>
            <select
              value={formData.share_class}
              onChange={(e) => setFormData({ ...formData, share_class: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="ordinary">Ordinary</option>
              <option value="preference">Preference</option>
              <option value="redeemable">Redeemable</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Number of Shares</label>
            <input
              type="number"
              value={formData.number_of_shares}
              onChange={(e) => setFormData({ ...formData, number_of_shares: e.target.value })}
              required
              min="1"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Acquired Date</label>
          <input
            type="date"
            value={formData.acquired_date}
            onChange={(e) => setFormData({ ...formData, acquired_date: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="beneficially_held"
            checked={formData.beneficially_held}
            onChange={(e) => setFormData({ ...formData, beneficially_held: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
          />
          <label htmlFor="beneficially_held" className="ml-2 block text-sm text-gray-900">
            Beneficially held for another party
          </label>
        </div>

        {formData.beneficially_held && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Beneficial Owner</label>
            <input
              type="text"
              value={formData.beneficial_owner}
              onChange={(e) => setFormData({ ...formData, beneficial_owner: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="e.g., The Smith Family Trust"
            />
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" onClick={onCancel} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

function TransferForm({ shareholdings, contacts, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    from_shareholder_id: '',
    to_shareholder_id: '',
    share_class: 'ordinary',
    number_of_shares: '',
    consideration: '',
    transfer_date: new Date().toISOString().split('T')[0],
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const currentShareholders = shareholdings.map(s => s.shareholder).filter(Boolean)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(formData)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record transfer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Record Share Transfer</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700">From Shareholder</label>
          <select
            value={formData.from_shareholder_id}
            onChange={(e) => setFormData({ ...formData, from_shareholder_id: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">New Issue (no transferor)</option>
            {currentShareholders.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name || s.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">To Shareholder</label>
          <select
            value={formData.to_shareholder_id}
            onChange={(e) => setFormData({ ...formData, to_shareholder_id: e.target.value })}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select a contact...</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name || c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Share Class</label>
            <select
              value={formData.share_class}
              onChange={(e) => setFormData({ ...formData, share_class: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="ordinary">Ordinary</option>
              <option value="preference">Preference</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Number of Shares</label>
            <input
              type="number"
              value={formData.number_of_shares}
              onChange={(e) => setFormData({ ...formData, number_of_shares: e.target.value })}
              required
              min="1"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Consideration ($)</label>
            <input
              type="number"
              value={formData.consideration}
              onChange={(e) => setFormData({ ...formData, consideration: e.target.value })}
              min="0"
              step="0.01"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Transfer Date</label>
            <input
              type="date"
              value={formData.transfer_date}
              onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" onClick={onCancel} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
            {saving ? 'Recording...' : 'Record Transfer'}
          </button>
        </div>
      </form>
    </div>
  )
}
