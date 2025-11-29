import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  EnvelopeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  PaperClipIcon,
  UserIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  HandRaisedIcon,
} from '@heroicons/react/24/outline'
import { api } from '../api'
import ApprovalModal from '../components/proposals/ApprovalModal'

export default function EmailJobProposalsPage() {
  const navigate = useNavigate()
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProposal, setSelectedProposal] = useState(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [processing, setProcessing] = useState(null)

  useEffect(() => {
    loadProposals()
  }, [])

  const loadProposals = async () => {
    try {
      setLoading(true)
      // Get ALL proposals (not just pending - backend defaults to pending)
      const response = await api.get('/api/v1/email_job_proposals?status=')
      setProposals(response.proposals || [])
    } catch (error) {
      console.error('Failed to load proposals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (proposalId) => {
    const proposal = proposals.find(p => p.id === proposalId)
    setSelectedProposal(proposal)
    setShowApprovalModal(true)
  }

  const handleApproveWithEdits = async (proposalId, userEdits) => {
    try {
      setProcessing(proposalId)
      const response = await api.post(`/api/v1/email_job_proposals/${proposalId}/approve`, {
        user_edits: userEdits
      })

      if (response.data.success) {
        alert(`Job #${response.data.job.id} created successfully!`)
        setShowApprovalModal(false)
        setSelectedProposal(null)
        loadProposals()

        // Navigate to the new job
        if (response.data.job.id) {
          navigate(`/jobs/${response.data.job.id}`)
        }
      }
    } catch (error) {
      console.error('Failed to approve proposal:', error)
      alert('Failed to approve proposal: ' + (error.response?.data?.error || error.message))
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (proposalId) => {
    const reason = prompt('Reason for rejection (optional):')
    if (reason === null) return // Cancelled

    try {
      setProcessing(proposalId)
      const response = await api.post(`/api/v1/email_job_proposals/${proposalId}/reject`, {
        rejection_reason: reason
      })

      if (response.data.success) {
        alert('Proposal rejected')
        loadProposals()
      }
    } catch (error) {
      console.error('Failed to reject proposal:', error)
      alert('Failed to reject proposal: ' + (error.response?.data?.error || error.message))
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: ClockIcon, label: 'Pending Review' },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon, label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircleIcon, label: 'Rejected' },
      error: { color: 'bg-gray-100 text-gray-800', icon: ExclamationTriangleIcon, label: 'Error' },
    }

    const badge = badges[status] || badges.pending
    const Icon = badge.icon

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {badge.label}
      </span>
    )
  }

  const getConfidenceBadge = (score) => {
    const percentage = Math.round(score * 100)
    let color = 'bg-gray-100 text-gray-800'

    if (percentage >= 80) color = 'bg-green-100 text-green-800'
    else if (percentage >= 60) color = 'bg-yellow-100 text-yellow-800'
    else if (percentage >= 30) color = 'bg-orange-100 text-orange-800'
    else color = 'bg-red-100 text-red-800'

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        <SparklesIcon className="w-3 h-3 mr-1" />
        {percentage}% confidence
      </span>
    )
  }

  const pendingProposals = proposals.filter(p => p.status === 'pending')
  const otherProposals = proposals.filter(p => p.status !== 'pending')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading proposals...</div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Email Job Proposals</h1>
          <p className="mt-2 text-sm text-gray-700">
            AI-generated job proposals from emails sent to <code className="text-xs bg-gray-100 px-2 py-1 rounded">newjob@tekna.com.au</code>
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={loadProposals}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Proposals</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{proposals.length}</dd>
          </div>
        </div>
        <div className="bg-yellow-50 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-yellow-700 truncate">Pending Review</dt>
            <dd className="mt-1 text-3xl font-semibold text-yellow-900">{pendingProposals.length}</dd>
          </div>
        </div>
        <div className="bg-green-50 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-green-700 truncate">Approved</dt>
            <dd className="mt-1 text-3xl font-semibold text-green-900">
              {proposals.filter(p => p.status === 'approved').length}
            </dd>
          </div>
        </div>
        <div className="bg-red-50 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-red-700 truncate">Rejected/Error</dt>
            <dd className="mt-1 text-3xl font-semibold text-red-900">
              {proposals.filter(p => p.status === 'rejected' || p.status === 'error').length}
            </dd>
          </div>
        </div>
      </div>

      {/* Pending Proposals */}
      {pendingProposals.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Pending Review</h2>
          <div className="space-y-4">
            {pendingProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onApprove={handleApprove}
                onReject={handleReject}
                processing={processing}
                getStatusBadge={getStatusBadge}
                getConfidenceBadge={getConfidenceBadge}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Proposals */}
      {otherProposals.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Previous Proposals</h2>
          <div className="space-y-4">
            {otherProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onApprove={handleApprove}
                onReject={handleReject}
                processing={processing}
                getStatusBadge={getStatusBadge}
                getConfidenceBadge={getConfidenceBadge}
                readonly={true}
              />
            ))}
          </div>
        </div>
      )}

      {proposals.length === 0 && (
        <div className="text-center mt-12">
          <EnvelopeIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No proposals yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Forward emails to newjob@tekna.com.au to create proposals
          </p>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedProposal && (
        <ApprovalModal
          proposal={selectedProposal}
          onApprove={handleApproveWithEdits}
          onCancel={() => {
            setShowApprovalModal(false)
            setSelectedProposal(null)
          }}
          processing={processing === selectedProposal.id}
        />
      )}
    </div>
  )
}

function ProposalCard({ proposal, onApprove, onReject, processing, getStatusBadge, getConfidenceBadge, readonly = false }) {
  const email = proposal.email_warehouse || {}
  const data = proposal.extracted_data || {}
  const customer = data.customer || {}

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-gray-900">
                {data.job_title || email.subject || 'Untitled'}
              </h3>
              {getStatusBadge(proposal.status)}
              {getConfidenceBadge(data.confidence_score || 0)}
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500 gap-4">
              <div className="flex items-center">
                <EnvelopeIcon className="w-4 h-4 mr-1" />
                From: {email.from_email}
              </div>
              <div>
                {new Date(proposal.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Actions */}
          {!readonly && proposal.status === 'pending' && (
            <div className="ml-4 flex gap-2">
              <button
                onClick={() => onApprove(proposal.id)}
                disabled={processing === proposal.id}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircleIcon className="w-4 h-4 mr-1" />
                Approve
              </button>
              <button
                onClick={() => onReject(proposal.id)}
                disabled={processing === proposal.id}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <XCircleIcon className="w-4 h-4 mr-1" />
                Reject
              </button>
            </div>
          )}
        </div>

        {/* Details Grid */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          {/* Customer */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Customer</h4>
            <div className="space-y-1">
              {customer.name && (
                <div className="flex items-center text-sm">
                  <UserIcon className="w-4 h-4 mr-2 text-gray-400" />
                  {customer.name}
                </div>
              )}
              {customer.email && (
                <div className="flex items-center text-sm text-gray-600">
                  <EnvelopeIcon className="w-4 h-4 mr-2 text-gray-400" />
                  {customer.email}
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center text-sm text-gray-600">
                  📞 {customer.phone}
                </div>
              )}
              {customer.company && (
                <div className="flex items-center text-sm text-gray-600">
                  <BuildingOfficeIcon className="w-4 h-4 mr-2 text-gray-400" />
                  {customer.company}
                </div>
              )}
            </div>
          </div>

          {/* Job Details */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Job Details</h4>
            <div className="space-y-1 text-sm">
              {data.job_type && (
                <div><span className="font-medium">Type:</span> {data.job_type}</div>
              )}
              {data.urgency && (
                <div><span className="font-medium">Urgency:</span> {data.urgency}</div>
              )}
              {data.contract_value && (
                <div><span className="font-medium">Value:</span> ${data.contract_value.toLocaleString()}</div>
              )}
              {email.has_attachments && (
                <div className="flex items-center text-blue-600">
                  <PaperClipIcon className="w-4 h-4 mr-1" />
                  Has attachments
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sales & Referral Info */}
        {(data.internal_sales || data.external_sales?.length > 0 || data.referral_contact) && (
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-gray-200 pt-4">
            {/* Internal Sales */}
            {data.internal_sales && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center">
                  <UserIcon className="w-3 h-3 mr-1" />
                  Internal Sales
                </h4>
                <div className="text-sm">
                  <div className="font-medium">{data.internal_sales.user_name}</div>
                  <div className="text-gray-600 text-xs">{data.internal_sales.user_email}</div>
                  {!data.internal_sales.contact_exists && (
                    <div className="text-orange-600 text-xs mt-1">⚠️ Contact needs creation</div>
                  )}
                </div>
              </div>
            )}

            {/* External Sales */}
            {data.external_sales?.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center">
                  <UserGroupIcon className="w-3 h-3 mr-1" />
                  External Sales
                </h4>
                <div className="space-y-2">
                  {data.external_sales.map((sales, idx) => (
                    <div key={idx} className="text-sm">
                      <div className="font-medium">{sales.name}</div>
                      <div className="text-gray-600 text-xs">{sales.email}</div>
                      {!sales.contact_exists && (
                        <div className="text-orange-600 text-xs">⚠️ Contact needs creation</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Referral */}
            {data.referral_contact && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center">
                  <HandRaisedIcon className="w-3 h-3 mr-1" />
                  Referral
                </h4>
                <div className="text-sm">
                  <div className="font-medium">{data.referral_contact.name}</div>
                  {data.referral_contact.email && (
                    <div className="text-gray-600 text-xs">{data.referral_contact.email}</div>
                  )}
                  {!data.referral_contact.contact_exists && (
                    <div className="text-orange-600 text-xs mt-1">⚠️ Contact needs creation</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {data.description && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Description</h4>
            <p className="text-sm text-gray-700">{data.description}</p>
          </div>
        )}

        {/* Scope of Work */}
        {data.scope_of_work && (
          <div className="mt-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Scope of Work</h4>
            <p className="text-sm text-gray-700">{data.scope_of_work}</p>
          </div>
        )}

        {/* Missing Info */}
        {data.missing_info && data.missing_info.length > 0 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3">
            <h4 className="text-xs font-medium text-yellow-800 uppercase tracking-wide mb-1">Missing Information</h4>
            <ul className="list-disc list-inside text-sm text-yellow-700">
              {data.missing_info.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Error Message */}
        {proposal.error_message && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
            <h4 className="text-xs font-medium text-red-800 uppercase tracking-wide mb-1">Error</h4>
            <p className="text-sm text-red-700">{proposal.error_message}</p>
          </div>
        )}

        {/* Rejection Reason */}
        {proposal.rejection_reason && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-3">
            <h4 className="text-xs font-medium text-gray-800 uppercase tracking-wide mb-1">Rejection Reason</h4>
            <p className="text-sm text-gray-700">{proposal.rejection_reason}</p>
          </div>
        )}

        {/* Job Link */}
        {proposal.job_id && (
          <div className="mt-4">
            <a
              href={`/jobs/${proposal.job_id}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              → View Job #{proposal.job_id}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
